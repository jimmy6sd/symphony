/**
 * Check Which Performances Are Being Skipped
 *
 * Identifies performances in PDFs that aren't in the database
 */

const { Storage } = require('@google-cloud/storage');
const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

async function checkSkippedPerformances() {
  console.log('🔍 Checking for Skipped Performances\n');

  // Initialize clients
  const storage = new Storage({ projectId: 'kcsymphony' });
  const bigquery = new BigQuery({ projectId: 'kcsymphony', location: 'US' });

  // Get performances from database
  const query = `
    SELECT performance_code, performance_id, title
    FROM \`kcsymphony.symphony_dashboard.performances\`
    ORDER BY performance_code
  `;
  const [dbPerformances] = await bigquery.query({ query, location: 'US' });
  const dbCodes = new Set(dbPerformances.map(p => p.performance_code));

  console.log(`📊 Database has ${dbCodes.size} performances\n`);

  // Get first PDF from bucket to see what's in it
  const bucket = storage.bucket('symphony-dashboard-pdfs');
  const [files] = await bucket.getFiles();

  if (files.length === 0) {
    console.log('❌ No PDFs found');
    return;
  }

  // Parse first PDF
  const file = files[0];
  console.log(`📄 Checking: ${file.name}\n`);

  const [pdfBuffer] = await file.download();

  const PDFParser = require('pdf2json');
  const pdfParser = new PDFParser();

  const pdfPerformances = await new Promise((resolve, reject) => {
    pdfParser.on('pdfParser_dataError', errData => reject(errData.parserError));
    pdfParser.on('pdfParser_dataReady', pdfData => {
      const performances = [];

      for (const page of pdfData.Pages) {
        const allItems = [];
        for (const textItem of page.Texts) {
          const content = decodeURIComponent(textItem.R[0].T);
          allItems.push(content);
        }

        for (let i = 0; i < allItems.length; i++) {
          const item = allItems[i];

          if (item.match(/^\d{6}[A-Z]{1,2}$/) && !allItems[i-1]?.includes('Total')) {
            const performanceCode = item;
            const dateTime = allItems[i + 1] || '';
            performances.push({ code: performanceCode, dateTime });
          }
        }
      }

      resolve(performances);
    });

    pdfParser.parseBuffer(pdfBuffer);
  });

  console.log(`📊 PDF has ${pdfPerformances.length} performances\n`);

  // Find missing ones
  const missingPerformances = pdfPerformances.filter(p => !dbCodes.has(p.code));

  if (missingPerformances.length === 0) {
    console.log('✅ All performances in PDF exist in database - nothing being skipped!\n');
    return;
  }

  console.log('━'.repeat(80));
  console.log(`⚠️  SKIPPED PERFORMANCES: ${missingPerformances.length}`);
  console.log('━'.repeat(80));

  missingPerformances.forEach((perf, idx) => {
    console.log(`${idx + 1}. ${perf.code} - ${perf.dateTime}`);
  });

  console.log('\n' + '━'.repeat(80));
  console.log('📋 ANALYSIS:');
  console.log(`   Total in PDF: ${pdfPerformances.length}`);
  console.log(`   In Database: ${pdfPerformances.length - missingPerformances.length}`);
  console.log(`   Being Skipped: ${missingPerformances.length}`);
  console.log('━'.repeat(80));

  console.log('\n💡 RECOMMENDATION:');
  console.log('   These performances are in the PDF but not in the database.');
  console.log('   They are being skipped during reimport (no historical snapshots created).');
  console.log('   To fix: Update reimport script to create new performances like Cloud Function does.');

  // Check if these are future performances
  const performanceCodes = missingPerformances.map(p => p.code);
  const futurePerfs = performanceCodes.filter(code => {
    const year = parseInt('20' + code.substring(0, 2));
    const month = parseInt(code.substring(2, 4));
    const day = parseInt(code.substring(4, 6));
    const perfDate = new Date(year, month - 1, day);
    const now = new Date();
    return perfDate > now;
  });

  if (futurePerfs.length > 0) {
    console.log(`\n   Note: ${futurePerfs.length} of these are FUTURE performances (haven't happened yet).`);
    console.log('   It\'s normal for future performances to not have full metadata yet.');
  }
}

checkSkippedPerformances().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
