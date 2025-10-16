const PDFParser = require('pdf2json');
const fs = require('fs');

async function testPDF2JSON() {
  const pdfPath = 'FY26 Performance Sales Summary_1126300.pdf';

  console.log('Testing pdf2json extraction...\n');

  const pdfParser = new PDFParser();

  return new Promise((resolve, reject) => {
    pdfParser.on('pdfParser_dataError', errData => {
      console.error('PDF parsing error:', errData.parserError);
      reject(errData.parserError);
    });

    pdfParser.on('pdfParser_dataReady', pdfData => {
      console.log('✅ PDF parsed successfully!');
      console.log(`Pages: ${pdfData.Pages.length}`);

      // Get first page
      const firstPage = pdfData.Pages[0];
      console.log(`\nFirst page has ${firstPage.Texts.length} text elements`);

      // Show first 20 text elements with their positions
      console.log('\nFirst 20 text elements:');
      firstPage.Texts.slice(0, 20).forEach((text, i) => {
        const decoded = decodeURIComponent(text.R[0].T);
        console.log(`${i + 1}. [x:${text.x.toFixed(2)}, y:${text.y.toFixed(2)}] "${decoded}"`);
      });

      // Look for performance code pattern (6 digits + letter)
      console.log('\n\nSearching for performance codes (######L format):');
      const perfCodes = firstPage.Texts.filter(text => {
        const decoded = decodeURIComponent(text.R[0].T);
        return /^\d{6}[A-Z]$/.test(decoded);
      }).slice(0, 10);

      perfCodes.forEach(text => {
        const decoded = decodeURIComponent(text.R[0].T);
        console.log(`  Found: "${decoded}" at x:${text.x.toFixed(2)}, y:${text.y.toFixed(2)}`);
      });

      // Save full JSON for inspection
      fs.writeFileSync('data/pdf-structure.json', JSON.stringify(pdfData, null, 2));
      console.log('\n✅ Full PDF structure saved to data/pdf-structure.json');

      resolve(pdfData);
    });

    pdfParser.loadPDF(pdfPath);
  });
}

testPDF2JSON().catch(console.error);
