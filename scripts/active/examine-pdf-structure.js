const { Storage } = require('@google-cloud/storage');
const PDFParser = require('pdf2json');

async function examinePdf() {
  const storage = new Storage({
    projectId: 'kcsymphony'
  });

  const bucket = storage.bucket('symphony-dashboard-pdfs');

  // Get the most recent PDF
  const [files] = await bucket.getFiles();
  const pdfFiles = files.filter(f => f.name.endsWith('.pdf'));
  const recentPdf = pdfFiles[pdfFiles.length - 1];

  console.log(`📄 Examining: ${recentPdf.name}\n`);

  const [fileContents] = await recentPdf.download();

  const pdfParser = new PDFParser();

  await new Promise((resolve, reject) => {
    pdfParser.on('pdfParser_dataError', errData => reject(errData.parserError));
    pdfParser.on('pdfParser_dataReady', pdfData => {
      const searchCodes = ['251011A', '251011B', '251011C', '251205M', '251206A', '251206B', '251206C', '251215M'];

      console.log(`📊 Searching through ${pdfData.Pages.length} pages...\n`);

      for (const page of pdfData.Pages) {
        const allItems = [];
        for (const textItem of page.Texts) {
          const content = decodeURIComponent(textItem.R[0].T);
          allItems.push(content);
        }

        // Look for any of our target codes
        searchCodes.forEach(code => {
          const index = allItems.indexOf(code);
          if (index !== -1) {
            console.log(`\n✅ Found ${code} at index ${index}`);
            console.log('   Context (10 items before and after):');
            const start = Math.max(0, index - 10);
            const end = Math.min(allItems.length, index + 15);

            for (let i = start; i < end; i++) {
              const marker = i === index ? '→→→' : '   ';
              console.log(`   ${marker} [${i}] "${allItems[i]}"`);
            }
          }
        });
      }

      console.log('\n🔍 Done examining PDF');
      resolve();
    });

    pdfParser.parseBuffer(fileContents);
  });
}

examinePdf().catch(console.error);
