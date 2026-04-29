/**
 * Process Renewal PDFs - Extract Package Sales Renewal Data
 *
 * Processes KCS Package Sales Renewal Report PDFs (combined format):
 * - One PDF per day containing all categories
 * - Columns: New # Pkg Seats, New Amount, Renewed # Pkg Seats, Renewed Amount,
 *            Total # Pkg Seats, Total Amount
 *
 * Key rule: Rows with "Sub" in package name have duplicative seat counts
 *   → zero out all seat columns, keep revenue, set is_sub_line = true
 *
 * Usage:
 *   node scripts/active/process-renewal-pdfs.js ./data/subscription-source-update/
 *   node scripts/active/process-renewal-pdfs.js ./data/subscription-source-update/ --dry-run
 */

const fs = require('fs');
const path = require('path');
const PDFParser = require('pdf2json');
const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony',
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

const DATASET_ID = process.env.BIGQUERY_DATASET || 'symphony_dashboard';
const TABLE_ID = 'subscription_renewal_snapshots';

// Map PDF category labels to standardized names
const CATEGORY_MAP = {
  'Classical': 'Classical',
  'Pops': 'Pops',
  'Family': 'Family',
  'Special': 'Specials',
  'Flex/CYO': 'Flex',
  'Flex': 'Flex',
  'Student Pass': 'Student Pass'
};

// Extract snapshot date from filename (MM.DD.YYYY.pdf)
function extractSnapshotDate(filename) {
  const match = filename.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (match) {
    const [_, month, day, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  // Fallback: MM.DD.YY
  const shortMatch = filename.match(/(\d{1,2})\.(\d{1,2})\.(\d{2})/);
  if (shortMatch) {
    const [_, month, day, year] = shortMatch;
    const fullYear = parseInt(year) < 50 ? `20${year}` : `19${year}`;
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  console.warn(`Warning: Could not extract date from ${filename}`);
  return new Date().toISOString().split('T')[0];
}

// Parse numeric value (strip $ and commas)
function parseNumeric(text) {
  return parseFloat(text.replace(/[$,]/g, '')) || 0;
}

// Parse a single renewal PDF and extract package data
async function parsePDF(pdfPath) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataError', err => reject(new Error(err.parserError)));

    pdfParser.on('pdfParser_dataReady', pdfData => {
      const packages = [];
      let currentCategory = null;
      let currentSeason = null;

      for (const page of pdfData.Pages) {
        // Collect all text items with coordinates
        const items = page.Texts.map(t => ({
          x: t.x,
          y: t.y,
          text: decodeURIComponent(t.R[0].T)
        }));

        // Group into rows by y-coordinate (items within 0.5 of first item)
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

        // Process each row
        for (const row of rows) {
          const firstText = row[0]?.text || '';

          // Detect category header: "26-27 SY Classical", "26-27 SY Special", etc.
          const catMatch = firstText.match(/^(\d{2}-\d{2})\s+SY\s+(.+)$/);
          if (catMatch) {
            currentSeason = catMatch[1];
            const rawCat = catMatch[2].trim();
            currentCategory = CATEGORY_MAP[rawCat] || rawCat;
            continue;
          }

          // Skip SubTotal and Total rows
          if (firstText === 'SubTotal' || firstText === 'Total') continue;

          // Skip rows before first category header
          if (!currentCategory) continue;

          // Detect package data rows (start with 2-digit year prefix, e.g. "27 ...")
          if (!firstText.match(/^\d{2}\s+.+/)) continue;

          const packageName = firstText;

          // Find package type (SY-Full, SY-Mini, SY-FlexPass)
          const typeItem = row.find(r => /^SY-/.test(r.text));
          const packageType = typeItem ? typeItem.text : 'SY-Full';

          // Collect numeric items in data columns (x > 15), sorted by x
          // Matches: $1,008.00 (dollar amounts) and 63 (plain integers)
          const numericItems = row.filter(r =>
            r.x > 15 && (
              /^\$[\d,]+\.?\d*$/.test(r.text) ||
              /^[\d,]+$/.test(r.text)
            )
          ).sort((a, b) => a.x - b.x);

          // Need exactly 6 values: new_seats, new_amount, renewed_seats, renewed_amount, total_seats, total_amount
          if (numericItems.length < 6) continue;

          const newSeats = parseInt(numericItems[0].text.replace(/[$,]/g, '')) || 0;
          const newAmount = parseNumeric(numericItems[1].text);
          const renewedSeats = parseInt(numericItems[2].text.replace(/[$,]/g, '')) || 0;
          const renewedAmount = parseNumeric(numericItems[3].text);
          const totalSeats = parseInt(numericItems[4].text.replace(/[$,]/g, '')) || 0;
          const totalAmount = parseNumeric(numericItems[5].text);

          // "Sub" lines have duplicative seat counts → zero out seats, keep revenue
          // Exception: Bravo sub-lines keep their seats (one sub-line per package should be counted)
          const isSubLine = /\bsub\b/i.test(packageName);
          const zeroSeats = isSubLine && !/bravo/i.test(packageName);

          packages.push({
            season: currentSeason,
            category: currentCategory,
            package_type: packageType,
            package_name: packageName,
            new_pkg_seats: zeroSeats ? 0 : newSeats,
            new_amount: newAmount,
            renewed_pkg_seats: zeroSeats ? 0 : renewedSeats,
            renewed_amount: renewedAmount,
            total_pkg_seats: zeroSeats ? 0 : totalSeats,
            total_amount: totalAmount,
            is_sub_line: isSubLine
          });
        }
      }

      resolve({ packages, season: currentSeason });
    });

    pdfParser.loadPDF(pdfPath);
  });
}

// Ensure BigQuery table exists, create if not
async function ensureTableExists() {
  const dataset = bigquery.dataset(DATASET_ID);
  const table = dataset.table(TABLE_ID);

  try {
    const [exists] = await table.exists();
    if (exists) {
      console.log(`Table ${TABLE_ID} already exists`);
      return;
    }
  } catch (e) {
    // Continue to create
  }

  console.log(`Creating table ${TABLE_ID}...`);
  const schema = [
    { name: 'snapshot_date', type: 'DATE', mode: 'REQUIRED' },
    { name: 'season', type: 'STRING', mode: 'REQUIRED' },
    { name: 'category', type: 'STRING', mode: 'REQUIRED' },
    { name: 'package_type', type: 'STRING', mode: 'REQUIRED' },
    { name: 'package_name', type: 'STRING', mode: 'REQUIRED' },
    { name: 'new_pkg_seats', type: 'INTEGER' },
    { name: 'new_amount', type: 'FLOAT' },
    { name: 'renewed_pkg_seats', type: 'INTEGER' },
    { name: 'renewed_amount', type: 'FLOAT' },
    { name: 'total_pkg_seats', type: 'INTEGER' },
    { name: 'total_amount', type: 'FLOAT' },
    { name: 'is_sub_line', type: 'BOOLEAN' }
  ];

  await dataset.createTable(TABLE_ID, {
    schema: { fields: schema },
    timePartitioning: { type: 'DAY', field: 'snapshot_date' },
    clustering: { fields: ['category', 'season'] }
  });

  console.log(`Table ${TABLE_ID} created successfully`);
}

// Insert snapshots into BigQuery with dedup check
async function insertSnapshots(snapshots, isDryRun = false) {
  if (snapshots.length === 0) {
    console.log('No snapshots to insert');
    return { success: true, count: 0, skipped: 0 };
  }

  if (isDryRun) {
    console.log(`\nDRY RUN: Would insert ${snapshots.length} rows`);
    const byDate = {};
    snapshots.forEach(s => {
      if (!byDate[s.snapshot_date]) byDate[s.snapshot_date] = [];
      byDate[s.snapshot_date].push(s);
    });
    for (const [date, rows] of Object.entries(byDate).sort()) {
      console.log(`\n  ${date}: ${rows.length} packages`);
      const categories = [...new Set(rows.map(r => r.category))];
      categories.forEach(cat => {
        const catRows = rows.filter(r => r.category === cat);
        const subRows = catRows.filter(r => r.is_sub_line);
        const totalSeats = catRows.reduce((s, r) => s + r.total_pkg_seats, 0);
        const totalRev = catRows.reduce((s, r) => s + r.total_amount, 0);
        console.log(`    ${cat}: ${catRows.length} pkgs (${subRows.length} sub), ${totalSeats} seats, $${totalRev.toLocaleString()}`);
      });
    }
    return { success: true, count: 0, skipped: 0, dryRun: true };
  }

  // Check for existing data to avoid duplicates
  const dates = [...new Set(snapshots.map(s => `'${s.snapshot_date}'`))].join(',');
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony';
  const checkQuery = `
    SELECT DISTINCT snapshot_date, category, package_name
    FROM \`${projectId}.${DATASET_ID}.${TABLE_ID}\`
    WHERE snapshot_date IN (${dates})
  `;

  let existingSet = new Set();
  try {
    const [existingRows] = await bigquery.query({ query: checkQuery, location: 'US' });
    existingSet = new Set(existingRows.map(r => {
      const date = typeof r.snapshot_date === 'object' ? r.snapshot_date.value : r.snapshot_date;
      return `${date}_${r.category}_${r.package_name}`;
    }));
  } catch (error) {
    console.log('Note: Could not check for existing records (table may be new/empty)');
  }

  const newSnapshots = snapshots.filter(s =>
    !existingSet.has(`${s.snapshot_date}_${s.category}_${s.package_name}`)
  );

  const skipped = snapshots.length - newSnapshots.length;
  if (skipped > 0) console.log(`Skipping ${skipped} existing snapshot(s)`);

  if (newSnapshots.length === 0) {
    console.log('All snapshots already exist - nothing to insert');
    return { success: true, count: 0, skipped };
  }

  console.log(`Inserting ${newSnapshots.length} new snapshot(s)...`);

  const table = bigquery.dataset(DATASET_ID).table(TABLE_ID);

  try {
    await table.insert(newSnapshots);
    console.log(`Inserted ${newSnapshots.length} snapshots into BigQuery`);
    return { success: true, count: newSnapshots.length, skipped };
  } catch (error) {
    if (error.name === 'PartialFailureError') {
      console.error('Some rows failed to insert:');
      error.errors.slice(0, 5).forEach((err, idx) => {
        console.error(`  Row ${idx}:`, err.errors);
      });
      return { success: false, errors: error.errors, skipped };
    }
    throw error;
  }
}

// Process a directory of renewal PDFs
async function processDirectory(dirPath, isDryRun = false) {
  console.log(`Processing directory: ${dirPath}\n`);

  const files = fs.readdirSync(dirPath)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .sort();

  console.log(`Found ${files.length} PDF files\n`);

  const allSnapshots = [];
  let successCount = 0;
  let errorCount = 0;

  for (const filename of files) {
    const filepath = path.join(dirPath, filename);
    const snapshotDate = extractSnapshotDate(filename);

    try {
      const { packages } = await parsePDF(filepath);

      console.log(`${filename}: ${packages.length} packages, date=${snapshotDate}`);

      const snapshots = packages.map(pkg => ({ ...pkg, snapshot_date: snapshotDate }));
      allSnapshots.push(...snapshots);
      successCount++;

      if (packages.length > 0) {
        const categories = [...new Set(packages.map(p => p.category))];
        console.log(`  Categories: ${categories.join(', ')}`);
        const subLines = packages.filter(p => p.is_sub_line);
        if (subLines.length > 0) {
          console.log(`  Sub lines (seats zeroed): ${subLines.map(s => s.package_name).join(', ')}`);
        }
      }
    } catch (error) {
      console.error(`${filename}: ERROR - ${error.message}`);
      errorCount++;
    }
  }

  return { allSnapshots, successCount, errorCount };
}

async function main() {
  const inputPath = process.argv[2];
  const isDryRun = process.argv.includes('--dry-run');

  if (!inputPath) {
    console.error('Usage: node process-renewal-pdfs.js <path> [--dry-run]');
    console.error('Examples:');
    console.error('  node scripts/active/process-renewal-pdfs.js ./data/subscription-source-update/');
    console.error('  node scripts/active/process-renewal-pdfs.js ./data/subscription-source-update/ --dry-run');
    process.exit(1);
  }

  console.log('='.repeat(70));
  console.log('Renewal PDF Processor - Package Sales Renewal Data Import');
  console.log(`Target table: ${DATASET_ID}.${TABLE_ID}`);
  if (isDryRun) console.log('DRY RUN MODE - No data will be inserted');
  console.log('='.repeat(70));
  console.log('');

  if (!isDryRun) {
    await ensureTableExists();
  }

  const { allSnapshots, successCount, errorCount } = await processDirectory(inputPath, isDryRun);

  console.log('\n' + '='.repeat(70));
  console.log('Summary:');
  console.log(`  Files processed: ${successCount}`);
  console.log(`  Files with errors: ${errorCount}`);
  console.log(`  Total package records: ${allSnapshots.length}`);

  // Show sub line summary
  const subLines = allSnapshots.filter(s => s.is_sub_line);
  if (subLines.length > 0) {
    const uniqueSubNames = [...new Set(subLines.map(s => s.package_name))];
    console.log(`  Sub lines (seats zeroed): ${subLines.length} rows across ${uniqueSubNames.length} packages`);
    uniqueSubNames.forEach(name => console.log(`    - ${name}`));
  }
  console.log('='.repeat(70));

  if (allSnapshots.length > 0) {
    const result = await insertSnapshots(allSnapshots, isDryRun);
    if (result.success) {
      console.log(`\nComplete! Inserted ${result.count} records, skipped ${result.skipped || 0} duplicates.`);
    } else {
      console.error('\nInsert failed with errors.');
      process.exit(1);
    }
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
