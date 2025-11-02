const { Storage } = require('@google-cloud/storage');
const PDFParser = require('pdf2json');

async function verifyNewPdf() {
  const storage = new Storage({
    projectId: 'kcsymphony'
  });

  const bucket = storage.bucket('symphony-dashboard-pdfs');
  const [files] = await bucket.getFiles();

  console.log('🔍 Looking for PDF ending in 1128862...\n');

  // Find the PDF
  const targetFile = files.find(f => f.name.includes('1128862'));

  if (!targetFile) {
    console.log('❌ PDF ending in 1128862 not found in bucket');
    console.log('\n📋 PDFs in bucket:');
    files.filter(f => f.name.endsWith('.pdf')).forEach(f => {
      console.log(`  ${f.name}`);
    });
    return;
  }

  console.log(`✅ Found: ${targetFile.name}\n`);

  // Download and parse
  console.log('📄 Downloading and parsing PDF...\n');
  const [fileContents] = await targetFile.download();

  const pdfParser = new PDFParser();

  await new Promise((resolve, reject) => {
    pdfParser.on('pdfParser_dataError', errData => reject(errData.parserError));
    pdfParser.on('pdfParser_dataReady', pdfData => {
      let reportDate = null;
      let performanceCount = 0;

      for (const page of pdfData.Pages) {
        const allItems = [];
        for (const textItem of page.Texts) {
          const content = decodeURIComponent(textItem.R[0].T);
          allItems.push(content);
        }

        // Extract report date from PDF footer
        if (!reportDate) {
          for (const item of allItems) {
            const footerMatch = item.match(/Run by .* on (\d{1,2}\/\d{1,2}\/\d{4})/i);
            if (footerMatch) {
              const parts = footerMatch[1].split('/');
              if (parts.length === 3) {
                const month = parts[0].padStart(2, '0');
                const day = parts[1].padStart(2, '0');
                const year = parts[2];
                reportDate = `${year}-${month}-${day}`;
                break;
              }
            }
          }
        }

        // Count performances
        for (let i = 0; i < allItems.length; i++) {
          const item = allItems[i];
          if (item.match(/^25\d{4}[A-Z]{1,2}$/) && !allItems[i-1]?.includes('Total')) {
            performanceCount++;
          }
        }
      }

      console.log('📊 PDF Details:');
      console.log(`  Report Date: ${reportDate || 'NOT FOUND'}`);
      console.log(`  Performance Count: ${performanceCount}`);

      if (reportDate === '2025-10-08') {
        console.log('\n✅ VERIFIED: This is the October 8th PDF!');
        console.log('\nTo process it, run:');
        console.log('  export GOOGLE_APPLICATION_CREDENTIALS="./symphony-bigquery-key.json" && node scripts/active/reprocess-pdfs-from-bucket.js --since=2025-10-08 --limit=1');
      } else if (reportDate) {
        console.log(`\n⚠️  WARNING: Expected 2025-10-08, but found ${reportDate}`);
      } else {
        console.log('\n❌ ERROR: Could not extract report date from PDF');
      }

      resolve();
    });

    pdfParser.parseBuffer(fileContents);
  });
}

verifyNewPdf().catch(console.error);
