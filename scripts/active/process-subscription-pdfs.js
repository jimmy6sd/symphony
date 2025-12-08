/**
 * Process Subscription PDFs - Extract Package Sales Data
 *
 * This script processes Tessitura Package Sales Report PDFs:
 * - Classical Package Sales
 * - Pops Package Sales
 * - Flex Package Sales
 * - Family Package Sales
 *
 * Usage:
 *   node scripts/active/process-subscription-pdfs.js ./path/to/pdfs
 *   node scripts/active/process-subscription-pdfs.js ./path/to/pdfs --dry-run
 */

const fs = require('fs');
const path = require('path');
const PDFParser = require('pdf2json');
const { BigQuery } = require('@google-cloud/bigquery');

// Initialize BigQuery
const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony',
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

const DATASET_ID = process.env.BIGQUERY_DATASET || 'symphony_dashboard';
const TABLE_ID = 'subscription_sales_snapshots';

// Map filename patterns to categories
const CATEGORY_PATTERNS = {
  'Classical': /classical/i,
  'Pops': /pops/i,
  'Flex': /flex/i,
  'Family': /family/i
};

// Extract category from filename
function extractCategory(filename) {
  for (const [category, pattern] of Object.entries(CATEGORY_PATTERNS)) {
    if (pattern.test(filename)) {
      return category;
    }
  }
  return 'Unknown';
}

// Extract snapshot date from filename (e.g., "12.04.25 Classical Package Sales.pdf")
function extractSnapshotDate(filename) {
  // Try MM.DD.YY format (e.g., "12.04.25")
  const mmddyyMatch = filename.match(/(\d{1,2})\.(\d{1,2})\.(\d{2})/);
  if (mmddyyMatch) {
    const [_, month, day, year] = mmddyyMatch;
    const fullYear = parseInt(year) < 50 ? `20${year}` : `19${year}`;
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Try ISO date format (YYYY-MM-DD)
  const isoMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) {
    return isoMatch[1];
  }

  // Fallback to current date
  console.warn(`Warning: Could not extract date from ${filename}, using current date`);
  return new Date().toISOString().split('T')[0];
}

// Extract season from PDF content
function extractSeason(items) {
  for (const item of items) {
    // Look for "Season: 25-26 SY Classical" pattern
    const seasonMatch = item.match(/Season:\s*(\d{2}-\d{2})/);
    if (seasonMatch) {
      return seasonMatch[1];
    }
    // Also try "25-26 SY" pattern
    const altMatch = item.match(/(\d{2}-\d{2})\s*SY/);
    if (altMatch) {
      return altMatch[1];
    }
  }
  return '25-26'; // Default for current season
}

// Parse subscription PDF and extract package data
async function parsePDF(pdfPath, filename) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataError', errData => {
      reject(new Error(errData.parserError));
    });

    pdfParser.on('pdfParser_dataReady', pdfData => {
      const packages = [];
      let reportDate = null;
      let season = null;

      for (const page of pdfData.Pages) {
        const allItems = [];
        for (const textItem of page.Texts) {
          const content = decodeURIComponent(textItem.R[0].T);
          allItems.push(content);
        }

        // Extract season from header
        if (!season) {
          season = extractSeason(allItems);
        }

        // Extract report date from "Run by ... on MM/DD/YYYY ..." line
        if (!reportDate) {
          for (const item of allItems) {
            const runByMatch = item.match(/on\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
            if (runByMatch) {
              const [_, month, day, year] = runByMatch;
              reportDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
              break;
            }
          }
        }

        // Parse table rows - look for package types and their data
        let currentPackageType = null;

        for (let i = 0; i < allItems.length; i++) {
          const item = allItems[i];

          // Detect package type headers
          if (item.match(/^SY-Full/i)) {
            currentPackageType = 'SY-Full';
            continue;
          }
          if (item.match(/^SY-Mini/i)) {
            currentPackageType = 'SY-Mini';
            continue;
          }
          if (item.match(/^SY-FlexPass/i)) {
            currentPackageType = 'SY-FlexPass';
            continue;
          }

          // Look for package name patterns (e.g., "26 Friday Masterworks", "26 CYO 5+")
          // Package names typically start with "26 " followed by the name
          const packageNameMatch = item.match(/^26\s+(.+)$/);
          if (packageNameMatch && currentPackageType) {
            const packageName = item;

            // Next items should be: Pkg, Perf, Total Amount, Paid Amount, Orders
            // But we need to handle variations in the PDF structure
            let idx = i + 1;

            // Collect numeric values after package name
            const numericValues = [];
            while (idx < allItems.length && numericValues.length < 5) {
              const val = allItems[idx];
              // Check if it's a numeric value (possibly with commas) or currency
              if (val.match(/^[\d,]+$/) || val.match(/^[\d,]+\.\d{2}$/)) {
                numericValues.push(val);
              } else if (val.match(/^26\s/) || val.match(/^SY-/) || val === 'SubTotal' || val === 'Total') {
                // Hit next row, stop collecting
                break;
              }
              idx++;
            }

            // Only process if we have all expected values
            if (numericValues.length >= 5) {
              const pkgSeats = parseInt(numericValues[0].replace(/,/g, '')) || 0;
              const perfSeats = parseInt(numericValues[1].replace(/,/g, '')) || 0;
              const totalAmount = parseFloat(numericValues[2].replace(/,/g, '')) || 0;
              const paidAmount = parseFloat(numericValues[3].replace(/,/g, '')) || 0;
              const orders = parseInt(numericValues[4].replace(/,/g, '')) || 0;

              packages.push({
                package_type: currentPackageType,
                package_name: packageName,
                package_seats: pkgSeats,
                perf_seats: perfSeats,
                total_amount: totalAmount,
                paid_amount: paidAmount,
                orders: orders
              });
            }
          }
        }
      }

      resolve({ packages, reportDate, season });
    });

    pdfParser.loadPDF(pdfPath);
  });
}

// Insert snapshots into BigQuery
async function insertSnapshots(snapshots, isDryRun = false) {
  if (snapshots.length === 0) {
    console.log('No snapshots to insert');
    return { success: true, count: 0, skipped: 0 };
  }

  if (isDryRun) {
    console.log(`DRY RUN: Would insert ${snapshots.length} rows`);
    console.log('Sample data:');
    snapshots.slice(0, 3).forEach(s => {
      console.log(`  - ${s.category} / ${s.package_name}: ${s.package_seats} pkg, $${s.total_amount}`);
    });
    return { success: true, count: 0, skipped: 0, dryRun: true };
  }

  // Check for existing snapshots to avoid duplicates
  const dates = [...new Set(snapshots.map(s => `'${s.snapshot_date}'`))].join(',');
  const checkQuery = `
    SELECT DISTINCT snapshot_date, category, package_name
    FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony'}.${DATASET_ID}.${TABLE_ID}\`
    WHERE snapshot_date IN (${dates})
  `;

  let existingSet = new Set();
  try {
    const [existingRows] = await bigquery.query({ query: checkQuery, location: 'US' });
    existingSet = new Set(existingRows.map(r =>
      `${r.snapshot_date.value || r.snapshot_date}_${r.category}_${r.package_name}`
    ));
  } catch (error) {
    // Table might be empty, continue
    console.log('Note: Could not check for existing records (table may be empty)');
  }

  // Filter to only new snapshots
  const newSnapshots = snapshots.filter(s =>
    !existingSet.has(`${s.snapshot_date}_${s.category}_${s.package_name}`)
  );

  const skippedCount = snapshots.length - newSnapshots.length;
  if (skippedCount > 0) {
    console.log(`Skipping ${skippedCount} existing snapshot(s)`);
  }

  if (newSnapshots.length === 0) {
    console.log('All snapshots already exist - nothing to insert');
    return { success: true, count: 0, skipped: skippedCount };
  }

  console.log(`Inserting ${newSnapshots.length} new snapshot(s)...`);

  const table = bigquery.dataset(DATASET_ID).table(TABLE_ID);
  const rows = newSnapshots.map(s => ({
    snapshot_date: s.snapshot_date,
    season: s.season,
    category: s.category,
    package_type: s.package_type,
    package_name: s.package_name,
    package_seats: s.package_seats,
    perf_seats: s.perf_seats,
    total_amount: s.total_amount,
    paid_amount: s.paid_amount,
    orders: s.orders
  }));

  try {
    await table.insert(rows);
    console.log(`Inserted ${rows.length} snapshots into BigQuery`);
    return { success: true, count: rows.length, skipped: skippedCount };
  } catch (error) {
    if (error.name === 'PartialFailureError') {
      console.error('Some rows failed to insert:');
      error.errors.forEach((err, idx) => {
        console.error(`  Row ${idx}:`, err.errors);
      });
      return { success: false, errors: error.errors, skipped: skippedCount };
    }
    throw error;
  }
}

// Process directory of subscription PDFs
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
    const category = extractCategory(filename);
    const fallbackDate = extractSnapshotDate(filename);

    try {
      console.log(`Processing: ${filename}`);
      console.log(`  Category: ${category}`);

      const result = await parsePDF(filepath, filename);
      const packages = result.packages;
      const snapshotDate = result.reportDate || fallbackDate;
      const season = result.season || '25-26';

      console.log(`  Date: ${snapshotDate}`);
      console.log(`  Season: ${season}`);
      console.log(`  Packages found: ${packages.length}`);

      // Convert to snapshot format
      const snapshots = packages.map(pkg => ({
        snapshot_date: snapshotDate,
        season: season,
        category: category,
        package_type: pkg.package_type,
        package_name: pkg.package_name,
        package_seats: pkg.package_seats,
        perf_seats: pkg.perf_seats,
        total_amount: pkg.total_amount,
        paid_amount: pkg.paid_amount,
        orders: pkg.orders
      }));

      allSnapshots.push(...snapshots);
      successCount++;

      // Print sample of extracted data
      if (packages.length > 0) {
        console.log('  Sample packages:');
        packages.slice(0, 2).forEach(pkg => {
          console.log(`    - ${pkg.package_name}: ${pkg.package_seats} pkg seats, $${pkg.total_amount.toLocaleString()}`);
        });
      }

    } catch (error) {
      console.error(`  Error: ${error.message}`);
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
    console.error('Usage: node process-subscription-pdfs.js <path> [--dry-run]');
    console.error('Examples:');
    console.error('  node scripts/active/process-subscription-pdfs.js ./');
    console.error('  node scripts/active/process-subscription-pdfs.js ./ --dry-run');
    process.exit(1);
  }

  console.log('='.repeat(70));
  console.log('Subscription PDF Processor - Package Sales Data Import');
  if (isDryRun) {
    console.log('DRY RUN MODE - No data will be inserted');
  }
  console.log('='.repeat(70));
  console.log('');

  const result = await processDirectory(inputPath, isDryRun);
  const { allSnapshots, successCount, errorCount } = result;

  console.log('='.repeat(70));
  console.log('Summary:');
  console.log(`  Files processed: ${successCount}`);
  console.log(`  Files with errors: ${errorCount}`);
  console.log(`  Total package records: ${allSnapshots.length}`);
  console.log('='.repeat(70));
  console.log('');

  if (allSnapshots.length > 0) {
    const insertResult = await insertSnapshots(allSnapshots, isDryRun);

    if (insertResult.success) {
      console.log(`\nComplete! Inserted ${insertResult.count} records, skipped ${insertResult.skipped || 0} duplicates.`);
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
