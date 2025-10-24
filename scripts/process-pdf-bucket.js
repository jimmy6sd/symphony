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

const fs = require('fs');
const path = require('path');
const PDFParser = require('pdf2json');
const { BigQuery } = require('@google-cloud/bigquery');
const { Storage } = require('@google-cloud/storage');

// Initialize BigQuery
const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony',
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
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

      for (const page of pdfData.Pages) {
        const allItems = [];
        for (const textItem of page.Texts) {
          const content = decodeURIComponent(textItem.R[0].T);
          allItems.push(content);
        }

        // Find performance codes and extract data
        for (let i = 0; i < allItems.length; i++) {
          const item = allItems[i];

          // Check if this is a performance code (25XXXXY format, not a total row)
          if (item.match(/^25\d{4}[A-Z]$/) && !allItems[i-1]?.includes('Total')) {
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
            const nonFixedCount = parseInt(nonFixedCountStr.replace(/,/g, '')) || 0;
            const singleCount = parseInt(singleCountStr.replace(/,/g, '')) || 0;
            const totalRevenue = parseFloat(totalStr.replace(/,/g, '')) || 0;
            const capacityPercent = parseFloat(capacityStr.replace('%', '')) || 0;

            const subscriptionTickets = fixedCount + nonFixedCount;
            const totalTickets = subscriptionTickets + singleCount;

            performances.push({
              performance_code: performanceCode,
              performance_date: dateTime,
              single_tickets: singleCount,
              subscription_tickets: subscriptionTickets,
              total_tickets: totalTickets,
              total_revenue: totalRevenue,
              capacity_percent: capacityPercent,
              budget_percent: budgetPercent
            });
          }
        }
      }

      resolve(performances);
    });

    pdfParser.loadPDF(pdfPath);
  });
}

// Insert snapshots into BigQuery
async function insertSnapshots(snapshots) {
  const table = bigquery.dataset(DATASET_ID).table(TABLE_ID);

  const rows = snapshots.map(snapshot => ({
    snapshot_id: snapshot.snapshot_id,
    performance_id: 0, // Will be updated by trigger
    performance_code: snapshot.performance_code,
    snapshot_date: snapshot.snapshot_date,
    single_tickets_sold: snapshot.single_tickets_sold,
    subscription_tickets_sold: snapshot.subscription_tickets_sold,
    total_tickets_sold: snapshot.total_tickets_sold,
    total_revenue: snapshot.total_revenue,
    capacity_percent: snapshot.capacity_percent,
    budget_percent: snapshot.budget_percent,
    source: snapshot.source,
    // source_filename removed - not in schema
    created_at: new Date().toISOString()
  }));

  try {
    await table.insert(rows);
    console.log(`✅ Inserted ${rows.length} snapshots into BigQuery`);
    return { success: true, count: rows.length };
  } catch (error) {
    if (error.name === 'PartialFailureError') {
      console.error('❌ Some rows failed to insert:');
      error.errors.forEach((err, idx) => {
        console.error(`   Row ${idx}:`, err.errors);
      });
      return { success: false, errors: error.errors };
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
    const snapshotDate = extractSnapshotDate(filename, filepath);

    console.log(`📄 Processing: ${filename} (date: ${snapshotDate})`);

    try {
      const performances = await parsePDF(filepath, filename);
      console.log(`   ✅ Parsed ${performances.length} performances`);

      // Convert to snapshot format
      const snapshots = performances.map(perf => ({
        snapshot_id: `${perf.performance_code}_${snapshotDate}_pdf`,
        performance_code: perf.performance_code,
        snapshot_date: snapshotDate,
        single_tickets_sold: perf.single_tickets,
        subscription_tickets_sold: perf.subscription_tickets,
        total_tickets_sold: perf.total_tickets,
        total_revenue: perf.total_revenue,
        capacity_percent: perf.capacity_percent,
        budget_percent: perf.budget_percent,
        source: 'historical_pdf_import',
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
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
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

  // List all PDFs in bucket
  const [files] = await bucket.getFiles({ prefix });
  const pdfFiles = files
    .filter(f => f.name.toLowerCase().endsWith('.pdf'))
    .sort((a, b) => a.name.localeCompare(b.name));

  console.log(`Found ${pdfFiles.length} PDF files in bucket\n`);

  const allSnapshots = [];
  let successCount = 0;
  let errorCount = 0;

  for (const file of pdfFiles) {
    const filename = path.basename(file.name);
    const snapshotDate = extractSnapshotDate(filename, file.name);

    console.log(`📄 Processing: ${file.name} (date: ${snapshotDate})`);

    try {
      // Download PDF to temporary buffer
      const [contents] = await file.download();
      const os = require('os');
      const tempDir = os.tmpdir();
      const tempPath = path.join(tempDir, filename);
      fs.writeFileSync(tempPath, contents);

      const performances = await parsePDF(tempPath, filename);
      console.log(`   ✅ Parsed ${performances.length} performances`);

      // Clean up temp file
      fs.unlinkSync(tempPath);

      // Convert to snapshot format
      const snapshots = performances.map(perf => ({
        snapshot_id: `${perf.performance_code}_${snapshotDate}_pdf`,
        performance_code: perf.performance_code,
        snapshot_date: snapshotDate,
        single_tickets_sold: perf.single_tickets,
        subscription_tickets_sold: perf.subscription_tickets,
        total_tickets_sold: perf.total_tickets,
        total_revenue: perf.total_revenue,
        capacity_percent: perf.capacity_percent,
        budget_percent: perf.budget_percent,
        source: 'historical_pdf_import',
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

  if (!inputPath) {
    console.error('❌ Usage: node process-pdf-bucket.js <path>');
    console.error('   Examples:');
    console.error('     node process-pdf-bucket.js ./pdfs');
    console.error('     node process-pdf-bucket.js gs://symphony-dashboard-pdfs/2025');
    process.exit(1);
  }

  console.log('═'.repeat(80));
  console.log('📊 PDF Bucket Processor - Historical Sales Snapshot Importer');
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

  // Confirm before inserting
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
    console.log('   1. Query snapshots: node scripts/check-snapshot-timeline.js');
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
