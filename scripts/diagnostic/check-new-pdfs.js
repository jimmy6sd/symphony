const { Storage } = require('@google-cloud/storage');
const PDFParser = require('pdf2json');
const fs = require('fs');
const path = require('path');

const storage = new Storage({ keyFilename: './symphony-bigquery-key.json' });
const bucket = storage.bucket('symphony-dashboard-pdfs');

async function checkPDF(gcsPath) {
  console.log(`\nChecking: ${gcsPath}`);

  const [contents] = await bucket.file(gcsPath).download();
  const tempPath = './temp/check-pdf.pdf';

  if (!fs.existsSync('./temp')) {
    fs.mkdirSync('./temp', { recursive: true });
  }

  fs.writeFileSync(tempPath, contents);

  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataReady', (pdfData) => {
      const allText = [];

      if (pdfData.Pages && pdfData.Pages[0]) {
        for (const textItem of pdfData.Pages[0].Texts) {
          const content = decodeURIComponent(textItem.R[0].T);
          allText.push(content);
        }
      }

      // Find "Run by ... on DATE" line
      const runByLine = allText.find(t => t.includes('Run by') && /\d{1,2}\/\d{1,2}\/\d{4}/.test(t));

      if (runByLine) {
        const match = runByLine.match(/Run by .* on (\d{1,2}\/\d{1,2}\/\d{4})/);
        if (match) {
          console.log(`  Report date: ${match[1]}`);
        }
      }

      fs.unlinkSync(tempPath);
      resolve();
    });

    pdfParser.on('pdfParser_dataError', err => {
      console.error('Error:', err);
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      reject(err);
    });

    pdfParser.loadPDF(tempPath);
  });
}

async function main() {
  await checkPDF('2025/10/FY26 Performance Sales Summary_1126300.pdf');
  await checkPDF('2025/10/FY26 Performance Sales Summary_1126746.pdf');
}

main().catch(console.error);
