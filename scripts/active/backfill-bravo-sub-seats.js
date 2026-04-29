/**
 * Backfill Bravo Sub-Line Seats
 *
 * Previously all sub-lines had seats zeroed out. Bravo sub-lines should keep
 * their actual seat counts. This script downloads subscription PDFs from GCS,
 * re-parses Bravo sub-line rows to get real seat values, and updates BigQuery.
 *
 * Usage:
 *   node scripts/active/backfill-bravo-sub-seats.js --dry-run
 *   node scripts/active/backfill-bravo-sub-seats.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const os = require('os');
const PDFParser = require('pdf2json');
const { BigQuery } = require('@google-cloud/bigquery');
const { Storage } = require('@google-cloud/storage');

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './symphony-bigquery-key.json';
const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony',
  credentials: { client_email: creds.client_email, private_key: creds.private_key },
  location: 'US'
});

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony',
  credentials: { client_email: creds.client_email, private_key: creds.private_key }
});

const DATASET_ID = process.env.BIGQUERY_DATASET || 'symphony_dashboard';
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony';
const BUCKET_NAME = process.env.GCS_PDF_BACKUP_BUCKET || 'symphony-dashboard-pdfs';
const TABLE_ID = 'subscription_renewal_snapshots';

const CATEGORY_MAP = {
  'Classical': 'Classical',
  'Pops': 'Pops',
  'Family': 'Family',
  'Special': 'Specials',
  'Flex/CYO': 'Flex',
  'Flex': 'Flex',
  'Student Pass': 'Student Pass'
};

function parseNumeric(text) {
  return parseFloat(text.replace(/[$,]/g, '')) || 0;
}

function extractSnapshotDateFromGCSPath(filepath) {
  const timestampMatch = filepath.match(/(\d{4})-(\d{2})-(\d{2})T/);
  if (timestampMatch) {
    return `${timestampMatch[1]}-${timestampMatch[2]}-${timestampMatch[3]}`;
  }
  const dateMatch = filepath.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (dateMatch) {
    const [_, month, day, year] = dateMatch;
    const fullYear = year.length === 2 ? (parseInt(year) < 50 ? `20${year}` : `19${year}`) : year;
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
}

async function parsePDFForBravoSubs(pdfPath) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();
    pdfParser.on('pdfParser_dataError', err => reject(new Error(err.parserError)));
    pdfParser.on('pdfParser_dataReady', pdfData => {
      const bravoSubs = [];
      let currentCategory = null;
      let currentSeason = null;

      for (const page of pdfData.Pages) {
        const items = page.Texts.map(t => ({
          x: t.x,
          y: t.y,
          text: decodeURIComponent(t.R[0].T)
        }));

        const sortedByY = [...items].sort((a, b) => a.y - b.y);
        const rows = [];
        let currentRow = [];

        for (const item of sortedByY) {
          if (currentRow.length === 0 || item.y - currentRow[0].y < 0.5) {
            currentRow.push(item);
          } else {
            rows.push(currentRow.sort((a, b) => a.x - b.x));
            currentRow = [item];
          }
        }
        if (currentRow.length > 0) {
          rows.push(currentRow.sort((a, b) => a.x - b.x));
        }

        for (const row of rows) {
          const firstText = row[0]?.text || '';

          const catMatch = firstText.match(/^(\d{2}-\d{2})\s+SY\s+(.+)$/);
          if (catMatch) {
            currentSeason = catMatch[1];
            const rawCat = catMatch[2].trim();
            currentCategory = CATEGORY_MAP[rawCat] || rawCat;
            continue;
          }

          if (firstText === 'SubTotal' || firstText === 'Total') continue;
          if (!currentCategory) continue;
          if (!firstText.match(/^\d{2}\s+.+/)) continue;

          const packageName = firstText;
          const isSubLine = /\bsub\b/i.test(packageName);
          const isBravoSub = isSubLine && /bravo/i.test(packageName);

          if (!isBravoSub) continue;

          const numericItems = row.filter(r =>
            r.x > 15 && (
              /^\$[\d,]+\.?\d*$/.test(r.text) ||
              /^[\d,]+$/.test(r.text)
            )
          ).sort((a, b) => a.x - b.x);

          if (numericItems.length < 6) continue;

          const newSeats = parseInt(numericItems[0].text.replace(/[$,]/g, '')) || 0;
          const renewedSeats = parseInt(numericItems[2].text.replace(/[$,]/g, '')) || 0;
          const totalSeats = parseInt(numericItems[4].text.replace(/[$,]/g, '')) || 0;

          bravoSubs.push({
            season: currentSeason,
            category: currentCategory,
            package_name: packageName,
            new_pkg_seats: newSeats,
            renewed_pkg_seats: renewedSeats,
            total_pkg_seats: totalSeats
          });
        }
      }

      resolve(bravoSubs);
    });

    pdfParser.loadPDF(pdfPath);
  });
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  if (isDryRun) console.log('=== DRY RUN MODE ===\n');

  console.log(`Listing subscription PDFs in gs://${BUCKET_NAME}/...`);
  const bucket = storage.bucket(BUCKET_NAME);
  const [files] = await bucket.getFiles({ prefix: '' });

  const subPdfs = files.filter(f => f.name.includes('/subscriptions/') && f.name.endsWith('.pdf'));
  console.log(`Found ${subPdfs.length} subscription PDFs\n`);

  if (subPdfs.length === 0) {
    console.log('No subscription PDFs found in bucket.');
    return;
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bravo-backfill-'));
  console.log(`Temp directory: ${tmpDir}\n`);

  const allUpdates = [];
  let processed = 0;
  let errors = 0;

  for (const file of subPdfs) {
    const snapshotDate = extractSnapshotDateFromGCSPath(file.name);
    if (!snapshotDate) {
      console.log(`  Skipping ${file.name} - could not determine date`);
      errors++;
      continue;
    }

    const localPath = path.join(tmpDir, path.basename(file.name));

    try {
      await file.download({ destination: localPath });
      const bravoSubs = await parsePDFForBravoSubs(localPath);

      if (bravoSubs.length > 0) {
        console.log(`${file.name} (${snapshotDate}): ${bravoSubs.length} Bravo sub-lines`);
        bravoSubs.forEach(b => {
          console.log(`    ${b.package_name}: new=${b.new_pkg_seats}, renewed=${b.renewed_pkg_seats}, total=${b.total_pkg_seats}`);
          allUpdates.push({ ...b, snapshot_date: snapshotDate });
        });
      }

      processed++;
    } catch (err) {
      console.error(`  Error processing ${file.name}: ${err.message}`);
      errors++;
    } finally {
      try { fs.unlinkSync(localPath); } catch {}
    }
  }

  console.log(`\nProcessed ${processed} PDFs, ${errors} errors`);
  console.log(`Found ${allUpdates.length} Bravo sub-line rows to update\n`);

  if (allUpdates.length === 0) {
    console.log('Nothing to update.');
    fs.rmdirSync(tmpDir);
    return;
  }

  if (isDryRun) {
    console.log('DRY RUN - no BigQuery updates performed.');
    const byDate = {};
    allUpdates.forEach(u => {
      if (!byDate[u.snapshot_date]) byDate[u.snapshot_date] = [];
      byDate[u.snapshot_date].push(u);
    });
    for (const [date, rows] of Object.entries(byDate).sort()) {
      console.log(`  ${date}:`);
      rows.forEach(r => console.log(`    ${r.package_name}: new=${r.new_pkg_seats}, renewed=${r.renewed_pkg_seats}, total=${r.total_pkg_seats}`));
    }
    fs.rmdirSync(tmpDir);
    return;
  }

  console.log('Updating BigQuery...');
  let updated = 0;

  for (const row of allUpdates) {
    const query = `
      UPDATE \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
      SET new_pkg_seats = @new_seats,
          renewed_pkg_seats = @renewed_seats,
          total_pkg_seats = @total_seats
      WHERE snapshot_date = @snapshot_date
        AND package_name = @package_name
        AND is_sub_line = TRUE
    `;

    try {
      const [job] = await bigquery.createQueryJob({
        query,
        params: {
          new_seats: row.new_pkg_seats,
          renewed_seats: row.renewed_pkg_seats,
          total_seats: row.total_pkg_seats,
          snapshot_date: bigquery.date(row.snapshot_date),
          package_name: row.package_name
        },
        location: 'US'
      });

      const [result] = await job.getQueryResults();
      updated++;
    } catch (err) {
      console.error(`  Failed to update ${row.snapshot_date} / ${row.package_name}: ${err.message}`);
    }
  }

  console.log(`\nUpdated ${updated}/${allUpdates.length} rows in BigQuery`);
  fs.rmdirSync(tmpDir);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
