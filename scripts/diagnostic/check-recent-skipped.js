/**
 * Check Which Performances Are Being Skipped in Recent PDFs
 */

const { Storage } = require('@google-cloud/storage');
const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

async function checkRecentSkipped() {
  console.log('🔍 Checking Skipped Performances in Recent PDFs\n');

  const storage = new Storage({ projectId: 'kcsymphony' });
  const bigquery = new BigQuery({ projectId: 'kcsymphony', location: 'US' });

  // Get performances from database
  const query = `
    SELECT performance_code, title, performance_date
    FROM \`kcsymphony.symphony_dashboard.performances\`
    ORDER BY performance_code
  `;
  const [dbPerformances] = await bigquery.query({ query, location: 'US' });
  const dbCodes = new Set(dbPerformances.map(p => p.performance_code));

  console.log(`📊 Database has ${dbCodes.size} performances\n`);

  // Get the NEWEST PDF (most recent one being processed)
  const bucket = storage.bucket('symphony-dashboard-pdfs');
  const [files] = await bucket.getFiles();

  // Sort by name to get the most recent (they have timestamps)
  const sortedFiles = files.sort((a, b) => b.name.localeCompare(a.name));
  const recentFile = sortedFiles[0];

  console.log(`📄 Checking most recent PDF: ${recentFile.name}\n`);

  const [pdfBuffer] = await recentFile.download();

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
    console.log('✅ All performances in recent PDF exist in database!\n');
    return;
  }

  console.log('━'.repeat(80));
  console.log(`⚠️  PERFORMANCES BEING SKIPPED: ${missingPerformances.length}`);
  console.log('━'.repeat(80));

  missingPerformances.forEach((perf, idx) => {
    // Parse performance date from code
    const year = 2000 + parseInt(perf.code.substring(0, 2));
    const month = parseInt(perf.code.substring(2, 4));
    const day = parseInt(perf.code.substring(4, 6));
    const perfDate = new Date(year, month - 1, day);
    const isPast = perfDate < new Date();

    console.log(`${idx + 1}. ${perf.code} - ${perf.dateTime} ${isPast ? '(PAST - lost historical data!)' : '(future)'}`);
  });

  console.log('\n' + '━'.repeat(80));
  console.log('📋 IMPACT ANALYSIS:');

  const pastPerformances = missingPerformances.filter(p => {
    const year = 2000 + parseInt(p.code.substring(0, 2));
    const month = parseInt(p.code.substring(2, 4));
    const day = parseInt(p.code.substring(4, 6));
    const perfDate = new Date(year, month - 1, day);
    return perfDate < new Date();
  });

  if (pastPerformances.length > 0) {
    console.log(`   ❌ CRITICAL: ${pastPerformances.length} are PAST performances - we're losing historical snapshots!`);
  }

  const futurePerformances = missingPerformances.length - pastPerformances.length;
  if (futurePerformances > 0) {
    console.log(`   ℹ️  ${futurePerformances} are future performances (not critical - will be created by webhook)`);
  }

  console.log('━'.repeat(80));

  if (pastPerformances.length > 0) {
    console.log('\n🚨 RECOMMENDATION:');
    console.log('   Update reimport script to CREATE missing performances (like Cloud Function does)');
    console.log('   Then re-run reimport to capture their historical snapshot data.');
  }
}

checkRecentSkipped().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
