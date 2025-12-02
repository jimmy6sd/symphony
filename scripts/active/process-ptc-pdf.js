/**
 * Process PTC PDF - Extract Complimentary Ticket Counts
 *
 * This script processes "Performance Sales Summary by Price Type Category" PDFs
 * and extracts comp ticket counts, then updates existing snapshots in BigQuery.
 *
 * Usage:
 *   node scripts/active/process-ptc-pdf.js ./path/to/pdf.pdf
 *   node scripts/active/process-ptc-pdf.js ./path/to/pdf.pdf --dry-run
 */

const fs = require('fs');
const path = require('path');
const PDFParser = require('pdf2json');
const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

// Initialize BigQuery
const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony',
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

const DATASET_ID = process.env.BIGQUERY_DATASET || 'symphony_dashboard';
const TABLE_ID = 'performance_sales_snapshots';

/**
 * Parse PTC PDF and extract performance comp data
 *
 * PTC PDF structure per performance:
 * Row 1: Perf Code | DateTime | Budget% | Available | % Cap
 * Row 2: "Ticket Price" | Package# | Package$ | Single# | Single$ | Discount# | Discount$ | Comp# | Other# | Other$ | Total$ | Reserved# | Reserved$
 */
async function parsePTCPdf(pdfPath) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataError', errData => {
      reject(new Error(errData.parserError));
    });

    pdfParser.on('pdfParser_dataReady', pdfData => {
      const performances = [];
      let reportDate = null;

      // Collect all text items from all pages
      const allItems = [];
      for (const page of pdfData.Pages) {
        for (const textItem of page.Texts) {
          const content = decodeURIComponent(textItem.R[0].T);
          allItems.push(content);
        }
      }

      // Extract report date from "Run by ... on MM/DD/YYYY" line
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

      // Find performance codes and extract comp tickets
      // Performance codes: 25XXXXY, 26XXXXY, or variations like 26QUARTET1
      const perfCodeRegex = /^(25|26)\d{4}[A-Z]{1,2}$|^(25|26)[A-Z]+\d*$/;

      for (let i = 0; i < allItems.length; i++) {
        const item = allItems[i];

        // Check if this is a performance code (not a summary row)
        if (perfCodeRegex.test(item) && !allItems[i-1]?.includes('Total') && !allItems[i-1]?.includes('26 ')) {
          const performanceCode = item;

          // Look for "Ticket Price" row after the header row
          // The structure is: Code | DateTime | Budget% | Available | %Cap
          // Then: "Ticket Price" | Package# | Package$ | Single# | Single$ | Discount# | Discount$ | Comp# | Other# | Other$ | Total$ | Reserved# | Reserved$

          // Find the "Ticket Price" label for this performance
          let ticketPriceIdx = -1;
          for (let j = i + 1; j < Math.min(i + 20, allItems.length); j++) {
            if (allItems[j] === 'Ticket Price') {
              ticketPriceIdx = j;
              break;
            }
            // Stop if we hit another performance code
            if (perfCodeRegex.test(allItems[j])) {
              break;
            }
          }

          if (ticketPriceIdx === -1) {
            continue; // No Ticket Price row found
          }

          // Parse the data after "Ticket Price"
          // Expected: Package# | Package$ | Single# | Single$ | Discount# | Discount$ | Comp# | Other# | Other$ | Total$ | Reserved# | Reserved$
          let idx = ticketPriceIdx + 1;

          // Helper to parse number (removes commas)
          const parseNum = (str) => parseInt((str || '0').replace(/,/g, '')) || 0;
          const parseMoney = (str) => parseFloat((str || '0').replace(/,/g, '')) || 0;

          // Skip through Package (# and $)
          const packageCount = parseNum(allItems[idx++]);
          const packageRev = parseMoney(allItems[idx++]);

          // Skip through Single (# and $)
          const singleCount = parseNum(allItems[idx++]);
          const singleRev = parseMoney(allItems[idx++]);

          // Skip through Discount (# and $)
          const discountCount = parseNum(allItems[idx++]);
          const discountRev = parseMoney(allItems[idx++]);

          // COMP COUNT - this is what we want!
          const compCount = parseNum(allItems[idx++]);

          // Skip Other (# and $) and rest
          const otherCount = parseNum(allItems[idx++]);
          const otherRev = parseMoney(allItems[idx++]);
          const totalRev = parseMoney(allItems[idx++]);

          performances.push({
            performance_code: performanceCode,
            comp_tickets: compCount,
            // Also capture these for verification
            package_tickets: packageCount,
            single_tickets: singleCount,
            discount_tickets: discountCount,
            other_tickets: otherCount,
            total_revenue: totalRev
          });
        }
      }

      resolve({ performances, reportDate });
    });

    pdfParser.loadPDF(pdfPath);
  });
}

/**
 * Update existing snapshots with comp ticket data
 * Updates the LATEST snapshot for each performance (not date-specific)
 */
async function updateSnapshotsWithComps(compData, snapshotDate, isDryRun = false) {
  console.log(`\n📝 Updating latest snapshots with comp data`);
  console.log(`   Report date: ${snapshotDate}`);
  console.log(`   Performances to update: ${compData.length}`);

  if (compData.length === 0) {
    console.log('   ⚠️  No comp data to update');
    return { updated: 0, notFound: 0 };
  }

  let updated = 0;
  let notFound = 0;

  for (const perf of compData) {
    const { performance_code, comp_tickets } = perf;

    if (isDryRun) {
      console.log(`   [DRY RUN] Would update ${performance_code}: comp_tickets = ${comp_tickets}`);
      updated++;
      continue;
    }

    try {
      // Step 1: Get the latest snapshot_date for this performance
      const maxDateQuery = `
        SELECT MAX(snapshot_date) as max_date
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony'}.${DATASET_ID}.${TABLE_ID}\`
        WHERE performance_code = '${performance_code}'
      `;

      const [maxDateJob] = await bigquery.createQueryJob({
        query: maxDateQuery,
        location: 'US'
      });

      const [maxDateRows] = await maxDateJob.getQueryResults();

      if (!maxDateRows || maxDateRows.length === 0 || !maxDateRows[0].max_date) {
        console.log(`   ⚠️  ${performance_code}: No snapshot found`);
        notFound++;
        continue;
      }

      const maxDate = maxDateRows[0].max_date.value; // BigQuery DATE comes as {value: 'YYYY-MM-DD'}

      // Step 2: Update with the literal date value
      const updateQuery = `
        UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony'}.${DATASET_ID}.${TABLE_ID}\`
        SET comp_tickets = ${comp_tickets}
        WHERE performance_code = '${performance_code}'
          AND snapshot_date = '${maxDate}'
      `;

      const [job] = await bigquery.createQueryJob({
        query: updateQuery,
        location: 'US'
      });

      await job.getQueryResults();

      // If we get here without error, the update succeeded
      console.log(`   ✅ ${performance_code}: comp_tickets = ${comp_tickets} (snapshot: ${maxDate})`);
      updated++;
    } catch (error) {
      console.error(`   ❌ ${performance_code}: ${error.message}`);
      notFound++;
    }
  }

  return { updated, notFound };
}

/**
 * Main execution
 */
async function main() {
  const pdfPath = process.argv[2];
  const isDryRun = process.argv.includes('--dry-run');

  if (!pdfPath) {
    console.error('❌ Usage: node process-ptc-pdf.js <path-to-pdf> [--dry-run]');
    console.error('   Example: node process-ptc-pdf.js "./26 PSS by PT Category_1144268.pdf"');
    process.exit(1);
  }

  if (!fs.existsSync(pdfPath)) {
    console.error(`❌ File not found: ${pdfPath}`);
    process.exit(1);
  }

  console.log('═'.repeat(70));
  console.log('🎟️  PTC PDF Processor - Complimentary Ticket Extractor');
  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No data will be updated in BigQuery');
  }
  console.log('═'.repeat(70));
  console.log(`\n📄 Processing: ${path.basename(pdfPath)}\n`);

  try {
    // Parse the PDF
    const { performances, reportDate } = await parsePTCPdf(pdfPath);

    console.log(`📅 Report Date: ${reportDate || 'Unknown'}`);
    console.log(`📊 Performances found: ${performances.length}`);

    if (performances.length === 0) {
      console.log('\n⚠️  No performance data extracted from PDF');
      console.log('   Check if the PDF format matches expected PTC structure');
      process.exit(1);
    }

    // Show summary of comp tickets
    console.log('\n📋 Comp Ticket Summary:');
    console.log('─'.repeat(50));

    const withComps = performances.filter(p => p.comp_tickets > 0);
    const withoutComps = performances.filter(p => p.comp_tickets === 0);

    console.log(`   Performances with comps: ${withComps.length}`);
    console.log(`   Performances without comps: ${withoutComps.length}`);
    console.log(`   Total comp tickets: ${performances.reduce((sum, p) => sum + p.comp_tickets, 0)}`);

    // Show top 10 by comp count
    if (withComps.length > 0) {
      console.log('\n🎫 Top 10 by Comp Tickets:');
      const topComps = [...withComps].sort((a, b) => b.comp_tickets - a.comp_tickets).slice(0, 10);
      topComps.forEach(p => {
        console.log(`   ${p.performance_code}: ${p.comp_tickets} comps`);
      });
    }

    // Update BigQuery
    if (!reportDate) {
      console.error('\n❌ Could not determine report date from PDF');
      console.error('   Cannot update snapshots without a date');
      process.exit(1);
    }

    const result = await updateSnapshotsWithComps(performances, reportDate, isDryRun);

    console.log('\n═'.repeat(70));
    console.log('📈 SUMMARY');
    console.log('═'.repeat(70));
    console.log(`   Snapshots updated: ${result.updated}`);
    console.log(`   Not found/errors: ${result.notFound}`);

    if (isDryRun) {
      console.log('\n🔍 DRY RUN COMPLETE');
      console.log('   Run without --dry-run to actually update BigQuery');
    } else {
      console.log('\n✅ COMPLETE');
    }

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { parsePTCPdf, updateSnapshotsWithComps };
