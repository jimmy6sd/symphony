const { Storage } = require('@google-cloud/storage');
const PDFParser = require('pdf2json');
const fs = require('fs');
const path = require('path');

const storage = new Storage({ keyFilename: './symphony-bigquery-key.json' });
const bucket = storage.bucket('symphony-dashboard-pdfs');

async function inspectPDF(gcsPath) {
  console.log(`\nInspecting: ${gcsPath}\n`);

  const [contents] = await bucket.file(gcsPath).download();
  const tempPath = './temp/inspect-pdf.pdf';

  if (!fs.existsSync('./temp')) {
    fs.mkdirSync('./temp', { recursive: true });
  }

  fs.writeFileSync(tempPath, contents);

  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataReady', (pdfData) => {
      const allText = [];

      // Get first page text
      if (pdfData.Pages && pdfData.Pages[0]) {
        for (const textItem of pdfData.Pages[0].Texts) {
          const content = decodeURIComponent(textItem.R[0].T);
          allText.push(content);
        }
      }

      console.log('First 100 text items from PDF:');
      allText.slice(0, 100).forEach((text, i) => {
        console.log(`${i}: ${text}`);
      });

      // Look for date patterns
      console.log('\n\nSearching for date patterns:');
      const datePatterns = [
        /\d{1,2}\/\d{1,2}\/\d{4}/,  // MM/DD/YYYY
        /\d{4}-\d{2}-\d{2}/,         // YYYY-MM-DD
        /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i,
        /Report.*Date/i,
        /as of/i
      ];

      allText.forEach((text, i) => {
        datePatterns.forEach(pattern => {
          if (pattern.test(text)) {
            console.log(`  Found at index ${i}: "${text}"`);
          }
        });
      });

      fs.unlinkSync(tempPath);
      resolve(allText);
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

// Inspect a few different PDFs
async function main() {
  const filesToInspect = [
    '2025/10/FY26 Performance Sales Summary_1124633.pdf',
    '2025/10/FY26 Performance Sales Summary_1132777.pdf',
    '2025/10/FY26_Performance_Sales_Summary_1133029.pdf_2025-10-23T21-39-11_webhook_1761255550395_e497f953.pdf'
  ];

  for (const file of filesToInspect) {
    await inspectPDF(file);
    console.log('\n' + '='.repeat(80) + '\n');
  }
}

main().catch(console.error);
