/**
 * Backfill Family subscription history for 25-26 from weekly renewal-format PDFs.
 *
 * Reads all PDFs in data/source-files/pdfs/family/, parses the "25-26 SY Family"
 * SubTotal row from each, and MERGEs a weekly snapshot into
 * subscription_historical_data. Also seeds a single is_final=TRUE row using the
 * maximum observed total (the frozen tail of the renewal cycle).
 *
 * Idempotent: safe to re-run.
 *
 * Usage: node scripts/active/backfill-family-historical.js
 */

const PDFParser = require('../../cloud-functions/subscription-webhook/node_modules/pdf2json');
const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'kcsymphony';
const DATASET_ID = 'symphony_dashboard';
const TABLE_ID = 'subscription_historical_data';
const PDF_DIR = path.join(__dirname, '../../data/source-files/pdfs/family');
const KEY_FILE = path.join(__dirname, '../../symphony-bigquery-key.json');
const TARGET_SEASON = '25-26';
const SERIES = 'Family';

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  keyFilename: fs.existsSync(KEY_FILE) ? KEY_FILE : undefined,
});

function extractDateFromFilename(filename) {
  const m = filename.match(/^(\d{2})\.(\d{2})\.(\d{2})\.pdf$/);
  if (!m) return null;
  const [, mm, dd, yy] = m;
  const year = parseInt(yy, 10) < 50 ? `20${yy}` : `19${yy}`;
  return `${year}-${mm}-${dd}`;
}

function getISOWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function parseNumeric(text) {
  return parseFloat(String(text).replace(/[$,]/g, '')) || 0;
}

async function extractFamilySubtotal(filepath) {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser();
    parser.on('pdfParser_dataError', e => reject(e.parserError));
    parser.on('pdfParser_dataReady', pdfData => {
      const result = {};
      for (const page of pdfData.Pages) {
        const items = page.Texts.map(t => ({
          x: t.x,
          y: t.y,
          text: decodeURIComponent(t.R[0].T),
        }));
        const sortedByY = [...items].sort((a, b) => a.y - b.y);
        const rows = [];
        let cur = [];
        for (const it of sortedByY) {
          if (cur.length === 0 || it.y - cur[0].y < 0.5) cur.push(it);
          else {
            rows.push(cur.sort((a, b) => a.x - b.x));
            cur = [it];
          }
        }
        if (cur.length) rows.push(cur.sort((a, b) => a.x - b.x));

        let currentSeason = null;
        let inFamily = false;
        for (const row of rows) {
          const first = row[0]?.text || '';
          const catMatch = first.match(/^(\d{2}-\d{2})\s+SY\s+(.+)$/);
          if (catMatch) {
            currentSeason = catMatch[1];
            inFamily = catMatch[2].trim() === 'Family';
            continue;
          }
          if (first === 'SubTotal' && inFamily && currentSeason) {
            const nums = row
              .filter(r => r.x > 15 && (/^\$[\d,]+\.?\d*$/.test(r.text) || /^[\d,]+$/.test(r.text)))
              .sort((a, b) => a.x - b.x);
            if (nums.length >= 6) {
              result[currentSeason] = {
                new_units: Math.round(parseNumeric(nums[0].text)),
                new_revenue: parseNumeric(nums[1].text),
                renewal_units: Math.round(parseNumeric(nums[2].text)),
                renewal_revenue: parseNumeric(nums[3].text),
                total_units: Math.round(parseNumeric(nums[4].text)),
                total_revenue: parseNumeric(nums[5].text),
              };
            }
            inFamily = false;
          }
        }
      }
      resolve(result);
    });
    parser.loadPDF(filepath);
  });
}

async function mergeWeeklyRow(row) {
  const query = `
    MERGE \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\` T
    USING (SELECT @series AS series, @season AS season, DATE(@snapshot_date) AS snapshot_date) S
    ON T.series = S.series AND T.season = S.season AND T.snapshot_date = S.snapshot_date AND T.is_final = FALSE
    WHEN MATCHED THEN UPDATE SET
      week_number = @week_number,
      new_units = @new_units, new_revenue = @new_revenue,
      renewal_units = @renewal_units, renewal_revenue = @renewal_revenue,
      total_units = @total_units, total_revenue = @total_revenue
    WHEN NOT MATCHED THEN INSERT
      (series, season, snapshot_date, week_number, new_units, new_revenue, renewal_units, renewal_revenue, total_units, total_revenue, is_final)
      VALUES (@series, @season, DATE(@snapshot_date), @week_number, @new_units, @new_revenue, @renewal_units, @renewal_revenue, @total_units, @total_revenue, FALSE)
  `;
  await bigquery.query({
    query,
    location: 'US',
    params: {
      series: SERIES,
      season: TARGET_SEASON,
      snapshot_date: row.snapshot_date,
      week_number: row.week_number,
      new_units: row.new_units,
      new_revenue: row.new_revenue,
      renewal_units: row.renewal_units,
      renewal_revenue: row.renewal_revenue,
      total_units: row.total_units,
      total_revenue: row.total_revenue,
    },
  });
}

async function mergeFinalRow(finalRow) {
  const query = `
    MERGE \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\` T
    USING (SELECT @series AS series, @season AS season) S
    ON T.series = S.series AND T.season = S.season AND T.is_final = TRUE
    WHEN MATCHED THEN UPDATE SET
      week_number = 52,
      new_units = @new_units, new_revenue = @new_revenue,
      renewal_units = @renewal_units, renewal_revenue = @renewal_revenue,
      total_units = @total_units, total_revenue = @total_revenue
    WHEN NOT MATCHED THEN INSERT
      (series, season, snapshot_date, week_number, new_units, new_revenue, renewal_units, renewal_revenue, total_units, total_revenue, is_final)
      VALUES (@series, @season, NULL, 52, @new_units, @new_revenue, @renewal_units, @renewal_revenue, @total_units, @total_revenue, TRUE)
  `;
  await bigquery.query({
    query,
    location: 'US',
    params: {
      series: SERIES,
      season: TARGET_SEASON,
      new_units: finalRow.new_units,
      new_revenue: finalRow.new_revenue,
      renewal_units: finalRow.renewal_units,
      renewal_revenue: finalRow.renewal_revenue,
      total_units: finalRow.total_units,
      total_revenue: finalRow.total_revenue,
    },
  });
}

async function main() {
  console.log(`Family historical backfill → ${SERIES} ${TARGET_SEASON}`);
  console.log('='.repeat(60));

  if (!fs.existsSync(PDF_DIR)) {
    throw new Error(`PDF directory not found: ${PDF_DIR}`);
  }

  const files = fs.readdirSync(PDF_DIR).filter(f => f.endsWith('.pdf')).sort();
  console.log(`Found ${files.length} PDF(s) in ${PDF_DIR}\n`);

  // The chart's toDayOfYear uses literal calendar day-of-year and sorts ascending,
  // so snapshots whose calendar year differs from the season start year would wrap
  // around and produce a visual "dip." For season 25-26 the start year is 2025, so
  // any PDF dated 2026+ is excluded from the import.
  const seasonStartYear = 2000 + parseInt(TARGET_SEASON.split('-')[0], 10);

  const rows = [];
  for (const f of files) {
    const snapshotDate = extractDateFromFilename(f);
    if (!snapshotDate) {
      console.warn(`  SKIP ${f}: can't parse date from filename`);
      continue;
    }
    const year = parseInt(snapshotDate.slice(0, 4), 10);
    if (year !== seasonStartYear) {
      console.log(`  SKIP ${f}: ${snapshotDate} outside season start year ${seasonStartYear} (avoids day-of-year wrap)`);
      continue;
    }
    try {
      const parsed = await extractFamilySubtotal(path.join(PDF_DIR, f));
      const data = parsed[TARGET_SEASON];
      if (!data) {
        console.warn(`  SKIP ${f}: no ${TARGET_SEASON} Family SubTotal row`);
        continue;
      }
      const row = { snapshot_date: snapshotDate, week_number: getISOWeek(snapshotDate), ...data };
      rows.push(row);
      console.log(`  ${f} → ${snapshotDate} week ${row.week_number}: ${row.total_units} seats / $${row.total_revenue.toLocaleString()}`);
    } catch (err) {
      console.error(`  ERROR ${f}:`, err.message || err);
    }
  }

  if (rows.length === 0) {
    console.error('\nNo rows to import.');
    process.exit(1);
  }

  rows.sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));

  console.log(`\nMerging ${rows.length} weekly row(s) into ${TABLE_ID}...`);
  for (const row of rows) {
    await mergeWeeklyRow(row);
  }
  console.log(`  weekly rows merged`);

  const finalRow = rows.reduce((max, r) => (r.total_units > (max?.total_units || -1) ? r : max), null);
  console.log(`\nSeeding is_final=TRUE anchor: ${finalRow.total_units} seats / $${finalRow.total_revenue.toLocaleString()}`);
  await mergeFinalRow(finalRow);

  console.log('\nVerifying...');
  const [check] = await bigquery.query({
    query: `
      SELECT
        COUNTIF(is_final = FALSE) AS weekly_rows,
        COUNTIF(is_final = TRUE) AS final_rows,
        MIN(snapshot_date) AS first_date,
        MAX(snapshot_date) AS last_date,
        MAX(total_units) AS peak_units
      FROM \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
      WHERE series = '${SERIES}' AND season = '${TARGET_SEASON}'
    `,
    location: 'US',
  });
  console.log(check[0]);
  console.log('\nDone.');
}

main().catch(err => {
  console.error('\nBackfill failed:', err);
  process.exit(1);
});
