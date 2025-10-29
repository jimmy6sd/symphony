const PDFParser = require('pdf2json');

async function analyzePDFStructure() {
  const pdfParser = new PDFParser();

  return new Promise((resolve, reject) => {
    pdfParser.on('pdfParser_dataError', reject);
    pdfParser.on('pdfParser_dataReady', pdfData => {
      const firstPage = pdfData.Pages[0];

      // Find first performance code
      const perfCodeIndex = firstPage.Texts.findIndex(text => {
        const decoded = decodeURIComponent(text.R[0].T);
        return decoded === '251010E';
      });

      console.log(`Found 251010E at index ${perfCodeIndex}`);
      console.log('\nShowing 30 text elements starting from performance code:\n');

      // Show the next 30 elements after the performance code
      for (let i = 0; i < 30 && perfCodeIndex + i < firstPage.Texts.length; i++) {
        const text = firstPage.Texts[perfCodeIndex + i];
        const decoded = decodeURIComponent(text.R[0].T);
        const x = text.x.toFixed(2);
        const y = text.y.toFixed(2);

        console.log(`${i}. [x:${x}, y:${y}] "${decoded}"`);
      }

      // Group by Y position to see table structure
      console.log('\n\n=== Grouping by Y position (table rows) ===\n');

      const perfRow = firstPage.Texts.filter(text =>
        Math.abs(text.y - firstPage.Texts[perfCodeIndex].y) < 0.1
      );

      console.log(`Performance 251010E row has ${perfRow.length} elements:`);
      perfRow.forEach((text, i) => {
        const decoded = decodeURIComponent(text.R[0].T);
        console.log(`  ${i + 1}. [x:${text.x.toFixed(2)}] "${decoded}"`);
      });

      resolve();
    });

    pdfParser.loadPDF('FY26 Performance Sales Summary_1126300.pdf');
  });
}

analyzePDFStructure().catch(console.error);
