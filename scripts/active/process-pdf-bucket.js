/**
 * Process PDF Bucket - Extract Historical Daily Sales Snapshots
 *
 * This script:
 * 1. Reads all PDFs from a directory (local or GCS bucket)
 * 2. Extracts performance sales data from each PDF
 * 3. Determines snapshot date from PDF filename or metadata
 * 4. Inserts data into BigQuery performance_sales_snapshots table
 *
 * Usage:
 *   node scripts/process-pdf-bucket.js ./pdfs
 *   node scripts/process-pdf-bucket.js gs://symphony-dashboard-pdfs/2025
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const PDFParser = require('pdf2json');
const { BigQuery } = require('@google-cloud/bigquery');
const { Storage } = require('@google-cloud/storage');

// Load credentials from key file
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './symphony-bigquery-key.json';
const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));

// Initialize BigQuery
const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony',
  credentials: { client_email: creds.client_email, private_key: creds.private_key },
  location: 'US'
});

const DATASET_ID = process.env.BIGQUERY_DATASET || 'symphony_dashboard';
const TABLE_ID = 'performance_sales_snapshots';

// Extract snapshot date from PDF filename
// Expects format: "FY26 Performance Sales Summary_1133029.pdf"
// or "performance_sales_2025-10-20.pdf"
// or from GCS path: "2025/10/filename_2025-10-20T14-30-00_execid.pdf"
function extractSnapshotDate(filename, filepath = '') {
  // Try ISO date format in filename
  const isoMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) {
    return isoMatch[1];
  }

  // Try GCS path (2025/10/...)
  const pathMatch = filepath.match(/(\d{4})\/(\d{2})\//);
  if (pathMatch) {
    const [_, year, month] = pathMatch;
    // Use the 1st of the month as default if no specific date in filename
    return `${year}-${month}-01`;
  }

  // Try timestamp format in filename (2025-10-20T14-30-00)
  const timestampMatch = filename.match(/(\d{4})-(\d{2})-(\d{2})T/);
  if (timestampMatch) {
    return `${timestampMatch[1]}-${timestampMatch[2]}-${timestampMatch[3]}`;
  }

  // Fallback: use current date
  console.warn(`⚠️  Could not extract date from ${filename}, using current date`);
  return new Date().toISOString().split('T')[0];
}

// Parse a single PDF and extract performance data
async function parsePDF(pdfPath, filename) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataError', errData => {
      reject(new Error(errData.parserError));
    });

    pdfParser.on('pdfParser_dataReady', pdfData => {
      const performances = [];
      let reportDate = null;

      for (const page of pdfData.Pages) {
        const allItems = [];
        for (const textItem of page.Texts) {
          const content = decodeURIComponent(textItem.R[0].T);
          allItems.push(content);
        }

        // Extract report date from "Run by ... on MM/DD/YYYY ..." line
        if (!reportDate) {
          for (let i = 0; i < allItems.length; i++) {
            const runByMatch = allItems[i].match(/Run by .* on (\d{1,2}\/\d{1,2}\/\d{4})/);
            if (runByMatch) {
              const dateParts = runByMatch[1].split('/');
              const month = dateParts[0].padStart(2, '0');
              const day = dateParts[1].padStart(2, '0');
              const year = dateParts[2];
              reportDate = `${year}-${month}-${day}`;
              break;
            }
          }
        }

        // Find performance codes and extract data
        for (let i = 0; i < allItems.length; i++) {
          const item = allItems[i];

          // Check if this is a performance code (YYMMDDX or YYMMDDXX format, not a total row)
          // Matches any 6-digit code + 1-2 letters (e.g., 251010E, 260109E, 270101E)
          if (item.match(/^\d{6}[A-Z]{1,2}$/) && !allItems[i-1]?.includes('Total')) {
            const performanceCode = item;
            let idx = i + 1;

            const dateTime = allItems[idx++] || '';
            const budgetStr = allItems[idx++] || '0%';
            const fixedCountStr = allItems[idx++] || '0';
            const fixedRevStr = allItems[idx++] || '0.00';
            const nonFixedCountStr = allItems[idx++] || '0';
            const nonFixedRevStr = allItems[idx++] || '0.00';
            const singleCountStr = allItems[idx++] || '0';
            const singleRevStr = allItems[idx++] || '0.00';
            const subtotalStr = allItems[idx++] || '0.00';

            // Check for reserved
            let reservedStr = '0';
            let reservedRevStr = '0.00';
            const isCurrency = (str) => /^\d{1,3}(,\d{3})*\.\d{2}$/.test(str);
            const isCount = (str) => /^[\d,]+$/.test(str);

            if (idx < allItems.length && isCount(allItems[idx])) {
              reservedStr = allItems[idx++];
              if (idx < allItems.length && isCurrency(allItems[idx])) {
                reservedRevStr = allItems[idx++];
              }
            }

            const totalStr = allItems[idx++] || subtotalStr;
            const availStr = allItems[idx++] || '0';
            const capacityStr = allItems[idx++] || '0.0%';

            const budgetPercent = parseFloat(budgetStr.replace('%', '')) || 0;
            const fixedCount = parseInt(fixedCountStr.replace(/,/g, '')) || 0;
            const fixedRev = parseFloat(fixedRevStr.replace(/,/g, '')) || 0;
            const nonFixedCount = parseInt(nonFixedCountStr.replace(/,/g, '')) || 0;
            const nonFixedRev = parseFloat(nonFixedRevStr.replace(/,/g, '')) || 0;
            const singleCount = parseInt(singleCountStr.replace(/,/g, '')) || 0;
            const singleRev = parseFloat(singleRevStr.replace(/,/g, '')) || 0;
            const totalRevenue = parseFloat(totalStr.replace(/,/g, '')) || 0;
            const capacityPercent = parseFloat(capacityStr.replace('%', '')) || 0;
            const reservedCount = parseInt(reservedStr.replace(/,/g, '')) || 0;
            const reservedRev = parseFloat(reservedRevStr.replace(/,/g, '')) || 0;
            const subtotalRev = parseFloat(subtotalStr.replace(/,/g, '')) || 0;
            const availableSeats = parseInt(availStr.replace(/,/g, '')) || 0;

            const subscriptionTickets = fixedCount + nonFixedCount;
            const subscriptionRevenue = fixedRev + nonFixedRev;
            const totalTickets = subscriptionTickets + singleCount;

            performances.push({
              performance_code: performanceCode,
              performance_date: dateTime,
              single_tickets: singleCount,
              single_revenue: singleRev,
              subscription_tickets: subscriptionTickets,
              subscription_revenue: subscriptionRevenue,
              fixed_tickets: fixedCount,
              fixed_revenue: fixedRev,
              non_fixed_tickets: nonFixedCount,
              non_fixed_revenue: nonFixedRev,
              reserved_tickets: reservedCount,
              reserved_revenue: reservedRev,
              subtotal_revenue: subtotalRev,
              available_seats: availableSeats,
              total_tickets: totalTickets,
              total_revenue: totalRevenue,
              capacity_percent: capacityPercent,
              budget_percent: budgetPercent
            });
          }
        }
      }

      resolve({ performances, reportDate });
    });

    pdfParser.loadPDF(pdfPath);
  });
}

// Insert snapshots into BigQuery (with duplicate checking for idempotency)
async function insertSnapshots(snapshots) {
  if (snapshots.length === 0) {
    console.log('ℹ️  No snapshots to insert');
    return { success: true, count: 0, skipped: 0 };
  }

  console.log(`🔍 Checking for existing snapshots...`);

  // Check which snapshots already exist
  const snapshotIds = snapshots.map(s => `'${s.snapshot_id}'`).join(',');
  const checkQuery = `
    SELECT snapshot_id
    FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
    WHERE snapshot_id IN (${snapshotIds})
  `;

  const [existingRows] = await bigquery.query({ query: checkQuery, location: 'US' });
  const existingIds = new Set(existingRows.map(row => row.snapshot_id));

  // Filter to only NEW snapshots
  const newSnapshots = snapshots.filter(s => !existingIds.has(s.snapshot_id));
  const skippedCount = snapshots.length - newSnapshots.length;

  if (skippedCount > 0) {
    console.log(`⏭️  Skipping ${skippedCount} existing snapshot(s)`);
  }

  if (newSnapshots.length === 0) {
    console.log('ℹ️  All snapshots already exist - nothing to insert');
    return { success: true, count: 0, skipped: skippedCount };
  }

  console.log(`📝 Inserting ${newSnapshots.length} new snapshot(s)...`);

  const table = bigquery.dataset(DATASET_ID).table(TABLE_ID);

  const rows = newSnapshots.map(snapshot => ({
    snapshot_id: snapshot.snapshot_id,
    performance_id: 0, // Will be updated by trigger
    performance_code: snapshot.performance_code,
    snapshot_date: snapshot.snapshot_date,
    single_tickets_sold: snapshot.single_tickets_sold,
    single_revenue: snapshot.single_revenue,
    subscription_tickets_sold: snapshot.subscription_tickets_sold,
    fixed_tickets_sold: snapshot.fixed_tickets_sold,
    fixed_revenue: snapshot.fixed_revenue,
    non_fixed_tickets_sold: snapshot.non_fixed_tickets_sold,
    non_fixed_revenue: snapshot.non_fixed_revenue,
    reserved_tickets: snapshot.reserved_tickets,
    reserved_revenue: snapshot.reserved_revenue,
    subtotal_revenue: snapshot.subtotal_revenue,
    available_seats: snapshot.available_seats,
    total_tickets_sold: snapshot.total_tickets_sold,
    total_revenue: snapshot.total_revenue,
    capacity_percent: snapshot.capacity_percent,
    budget_percent: snapshot.budget_percent,
    source: snapshot.source,
    created_at: new Date().toISOString()
  }));

  try {
    await table.insert(rows);
    console.log(`✅ Inserted ${rows.length} snapshots into BigQuery`);
    return { success: true, count: rows.length, skipped: skippedCount };
  } catch (error) {
    if (error.name === 'PartialFailureError') {
      console.error('❌ Some rows failed to insert:');
      error.errors.forEach((err, idx) => {
        console.error(`   Row ${idx}:`, err.errors);
      });
      return { success: false, errors: error.errors, skipped: skippedCount };
    }
    throw error;
  }
}

// Process local directory of PDFs
async function processLocalDirectory(dirPath) {
  console.log(`📁 Processing local directory: ${dirPath}\n`);

  const files = fs.readdirSync(dirPath)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .sort();

  console.log(`Found ${files.length} PDF files\n`);

  const allSnapshots = [];
  let successCount = 0;
  let errorCount = 0;

  for (const filename of files) {
    const filepath = path.join(dirPath, filename);
    const fallbackDate = extractSnapshotDate(filename, filepath);

    try {
      const result = await parsePDF(filepath, filename);
      const performances = result.performances;
      const snapshotDate = result.reportDate || fallbackDate;

      console.log(`📄 Processing: ${filename} (date: ${snapshotDate})`);
      console.log(`   ✅ Parsed ${performances.length} performances`);

      // Convert to snapshot format
      const snapshots = performances.map(perf => ({
        snapshot_id: `${perf.performance_code}_${snapshotDate}_pdf`,
        performance_code: perf.performance_code,
        snapshot_date: snapshotDate,
        single_tickets_sold: perf.single_tickets,
        single_revenue: perf.single_revenue,
        subscription_tickets_sold: perf.subscription_tickets,
        fixed_tickets_sold: perf.fixed_tickets,
        fixed_revenue: perf.fixed_revenue,
        non_fixed_tickets_sold: perf.non_fixed_tickets,
        non_fixed_revenue: perf.non_fixed_revenue,
        reserved_tickets: perf.reserved_tickets,
        reserved_revenue: perf.reserved_revenue,
        subtotal_revenue: perf.subtotal_revenue,
        available_seats: perf.available_seats,
        total_tickets_sold: perf.total_tickets,
        total_revenue: perf.total_revenue,
        capacity_percent: perf.capacity_percent,
        budget_percent: perf.budget_percent,
        source: 'historical_pdf_import_v3',
        source_filename: filename
      }));

      allSnapshots.push(...snapshots);
      successCount++;

    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      errorCount++;
    }

    console.log('');
  }

  return { allSnapshots, successCount, errorCount };
}

// Process GCS bucket
async function processGCSBucket(bucketPath) {
  console.log(`☁️  Processing GCS bucket: ${bucketPath}\n`);

  const storage = new Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony',
    credentials: { client_email: creds.client_email, private_key: creds.private_key }
  });

  // Parse bucket path: gs://bucket-name/prefix
  const match = bucketPath.match(/gs:\/\/([^\/]+)\/?(.*)$/);
  if (!match) {
    throw new Error('Invalid GCS path. Format: gs://bucket-name/prefix');
  }

  const [_, bucketName, prefix] = match;
  const bucket = storage.bucket(bucketName);

  console.log(`   Bucket: ${bucketName}`);
  console.log(`   Prefix: ${prefix || '(root)'}\n`);

  // List all PDFs in bucket (exclude PTC files which have different format)
  const [files] = await bucket.getFiles({ prefix });
  const pdfFiles = files
    .filter(f => f.name.toLowerCase().endsWith('.pdf'))
    .filter(f => !f.name.includes('/ptc/') && !f.name.includes('_ptc_'))
    .sort((a, b) => a.name.localeCompare(b.name));

  console.log(`Found ${pdfFiles.length} PDF files in bucket (excluding PTC files)\n`);

  const allSnapshots = [];
  let successCount = 0;
  let errorCount = 0;

  for (const file of pdfFiles) {
    const filename = path.basename(file.name);
    const fallbackDate = extractSnapshotDate(filename, file.name);

    try {
      // Download PDF to temporary buffer
      const [contents] = await file.download();
      const os = require('os');
      const tempDir = os.tmpdir();
      const tempPath = path.join(tempDir, filename);
      fs.writeFileSync(tempPath, contents);

      const result = await parsePDF(tempPath, filename);
      const performances = result.performances;
      const snapshotDate = result.reportDate || fallbackDate;

      console.log(`📄 Processing: ${file.name} (date: ${snapshotDate})`);
      console.log(`   ✅ Parsed ${performances.length} performances`);

      // Clean up temp file
      fs.unlinkSync(tempPath);

      // Convert to snapshot format
      const snapshots = performances.map(perf => ({
        snapshot_id: `${perf.performance_code}_${snapshotDate}_pdf`,
        performance_code: perf.performance_code,
        snapshot_date: snapshotDate,
        single_tickets_sold: perf.single_tickets,
        single_revenue: perf.single_revenue,
        subscription_tickets_sold: perf.subscription_tickets,
        fixed_tickets_sold: perf.fixed_tickets,
        fixed_revenue: perf.fixed_revenue,
        non_fixed_tickets_sold: perf.non_fixed_tickets,
        non_fixed_revenue: perf.non_fixed_revenue,
        reserved_tickets: perf.reserved_tickets,
        reserved_revenue: perf.reserved_revenue,
        subtotal_revenue: perf.subtotal_revenue,
        available_seats: perf.available_seats,
        total_tickets_sold: perf.total_tickets,
        total_revenue: perf.total_revenue,
        capacity_percent: perf.capacity_percent,
        budget_percent: perf.budget_percent,
        source: 'historical_pdf_import_v3',
        source_filename: file.name
      }));

      allSnapshots.push(...snapshots);
      successCount++;

    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      errorCount++;
    }

    console.log('');
  }

  return { allSnapshots, successCount, errorCount };
}

// Main execution
async function main() {
  const inputPath = process.argv[2];
  const isDryRun = process.argv.includes('--dry-run');

  if (!inputPath) {
    console.error('❌ Usage: node process-pdf-bucket.js <path> [--dry-run]');
    console.error('   Examples:');
    console.error('     node process-pdf-bucket.js ./pdfs');
    console.error('     node process-pdf-bucket.js gs://symphony-dashboard-pdfs/2025');
    console.error('     node process-pdf-bucket.js gs://symphony-dashboard-pdfs/2025 --dry-run');
    process.exit(1);
  }

  console.log('═'.repeat(80));
  console.log('📊 PDF Bucket Processor - Historical Sales Snapshot Importer');
  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No data will be inserted into BigQuery');
  }
  console.log('═'.repeat(80));
  console.log('');

  let result;

  if (inputPath.startsWith('gs://')) {
    result = await processGCSBucket(inputPath);
  } else {
    result = await processLocalDirectory(inputPath);
  }

  const { allSnapshots, successCount, errorCount } = result;

  console.log('═'.repeat(80));
  console.log('📈 PROCESSING SUMMARY');
  console.log('═'.repeat(80));
  console.log(`   PDFs processed successfully: ${successCount}`);
  console.log(`   PDFs with errors: ${errorCount}`);
  console.log(`   Total snapshots extracted: ${allSnapshots.length}`);
  console.log('');

  if (allSnapshots.length === 0) {
    console.log('⚠️  No snapshots to insert');
    return;
  }

  // Group snapshots by date
  const byDate = {};
  for (const snapshot of allSnapshots) {
    if (!byDate[snapshot.snapshot_date]) {
      byDate[snapshot.snapshot_date] = [];
    }
    byDate[snapshot.snapshot_date].push(snapshot);
  }

  console.log(`📅 Snapshots by date:`);
  Object.keys(byDate).sort().forEach(date => {
    console.log(`   ${date}: ${byDate[date].length} performances`);
  });
  console.log('');

  // Group snapshots by performance code to show sample
  const byPerformanceCode = {};
  for (const snapshot of allSnapshots) {
    if (!byPerformanceCode[snapshot.performance_code]) {
      byPerformanceCode[snapshot.performance_code] = [];
    }
    byPerformanceCode[snapshot.performance_code].push(snapshot);
  }

  // Show sample performance codes with snapshot counts
  console.log(`📊 Sample performance codes (top 10 by snapshot count):`);
  const sortedPerfs = Object.entries(byPerformanceCode)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10);

  sortedPerfs.forEach(([code, snapshots]) => {
    const dates = snapshots.map(s => s.snapshot_date).sort();
    console.log(`   ${code}: ${snapshots.length} snapshots (${dates[0]} to ${dates[dates.length - 1]})`);
  });
  console.log('');

  // DRY RUN: Save to file and exit
  if (isDryRun) {
    const outputPath = './temp/dry-run-results.json';
    const fs = require('fs');

    // Ensure temp directory exists
    if (!fs.existsSync('./temp')) {
      fs.mkdirSync('./temp', { recursive: true });
    }

    const report = {
      summary: {
        total_pdfs: successCount,
        failed_pdfs: errorCount,
        total_snapshots: allSnapshots.length,
        unique_dates: Object.keys(byDate).length,
        unique_performances: Object.keys(byPerformanceCode).length,
        date_range: {
          start: Object.keys(byDate).sort()[0],
          end: Object.keys(byDate).sort()[Object.keys(byDate).length - 1]
        }
      },
      snapshots_by_date: byDate,
      snapshots_by_performance: byPerformanceCode,
      all_snapshots: allSnapshots
    };

    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

    console.log('═'.repeat(80));
    console.log('🔍 DRY RUN COMPLETE');
    console.log('═'.repeat(80));
    console.log(`   Report saved to: ${outputPath}`);
    console.log('');
    console.log('📊 Summary:');
    console.log(`   Total PDFs processed: ${successCount}`);
    console.log(`   Failed PDFs: ${errorCount}`);
    console.log(`   Total snapshots: ${allSnapshots.length}`);
    console.log(`   Unique dates: ${Object.keys(byDate).length}`);
    console.log(`   Unique performances: ${Object.keys(byPerformanceCode).length}`);
    console.log(`   Date range: ${report.summary.date_range.start} to ${report.summary.date_range.end}`);
    console.log('');
    console.log('🎯 Next step:');
    console.log('   Run: npm run backfill-historical (to actually import to BigQuery)');
    return;
  }

  // LIVE RUN: Confirm before inserting
  console.log('💾 Ready to insert snapshots into BigQuery');
  console.log(`   Dataset: ${DATASET_ID}`);
  console.log(`   Table: ${TABLE_ID}`);
  console.log('');

  // Insert into BigQuery
  console.log('🚀 Inserting snapshots...');
  const insertResult = await insertSnapshots(allSnapshots);

  if (insertResult.success) {
    console.log('');
    console.log('✅ IMPORT COMPLETE!');
    console.log('═'.repeat(80));
    console.log(`   ${insertResult.count} snapshots successfully imported`);
    console.log('');
    console.log('🎯 Next steps:');
    console.log('   1. Validate: npm run validate-backfill');
    console.log('   2. Update modal to display historical progression');
    console.log('   3. Build sales curve visualizations');
  } else {
    console.error('');
    console.error('⚠️  IMPORT COMPLETED WITH ERRORS');
    console.error('   Some rows failed to insert. Check errors above.');
  }
}

// Run if executed directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Fatal error:', error);
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = { parsePDF, extractSnapshotDate, insertSnapshots };
