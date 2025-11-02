const { Storage } = require('@google-cloud/storage');
const PDFParser = require('pdf2json');

async function extractTitles() {
  const storage = new Storage({
    projectId: 'kcsymphony'
  });

  const bucket = storage.bucket('symphony-dashboard-pdfs');

  // Performance codes we need to find
  const searchCodes = [
    '251011A', '251011B', '251011C',
    '251205M', '251206A', '251206B', '251206C',
    '251215M'
  ];

  console.log('📂 Fetching a recent PDF from bucket...\n');

  // Get the most recent PDF
  const [files] = await bucket.getFiles();
  const pdfFiles = files.filter(f => f.name.endsWith('.pdf'));
  const recentPdf = pdfFiles[pdfFiles.length - 1]; // Get the latest one

  console.log(`📄 Using: ${recentPdf.name}\n`);
  console.log('⏳ Downloading and parsing PDF...\n');

  const [fileContents] = await recentPdf.download();

  const pdfParser = new PDFParser();

  await new Promise((resolve, reject) => {
    pdfParser.on('pdfParser_dataError', errData => reject(errData.parserError));
    pdfParser.on('pdfParser_dataReady', pdfData => {
      const performances = new Map();

      for (const page of pdfData.Pages) {
        const allItems = [];
        for (const textItem of page.Texts) {
          const content = decodeURIComponent(textItem.R[0].T);
          allItems.push(content);
        }

        // Look for performance code pattern and extract title
        for (let i = 0; i < allItems.length; i++) {
          const item = allItems[i];

          // Check if this matches a performance code we're looking for
          if (searchCodes.includes(item)) {
            // The title should be nearby - typically the next few items
            // Performance PDFs usually have: Code, Title, Date/Time, etc.
            let title = '';

            // Look ahead for the title (skip numeric/date-like items)
            for (let j = i + 1; j < Math.min(i + 10, allItems.length); j++) {
              const nextItem = allItems[j];

              // Skip if it's a date, time, number, or common column header
              if (nextItem.match(/^\d+$/) ||
                  nextItem.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}/) ||
                  nextItem.match(/^\d{1,2}:\d{2}/) ||
                  nextItem.match(/^(AM|PM)$/i) ||
                  nextItem.match(/^[\d,]+\.\d{2}$/) ||
                  nextItem === 'Total' ||
                  nextItem === 'Subscription' ||
                  nextItem === 'Single') {
                continue;
              }

              // This should be the title
              title = nextItem;
              break;
            }

            if (title && !performances.has(item)) {
              performances.set(item, title);
            }
          }
        }
      }

      console.log('🎭 Performance Titles Found:\n');

      searchCodes.forEach(code => {
        if (performances.has(code)) {
          console.log(`  ${code}: "${performances.get(code)}"`);
        } else {
          console.log(`  ${code}: NOT FOUND IN PDF`);
        }
      });

      console.log(`\n✅ Found ${performances.size} of ${searchCodes.length} performances`);

      resolve();
    });

    pdfParser.parseBuffer(fileContents);
  });
}

extractTitles().catch(console.error);
