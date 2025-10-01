const PDFParser = require('pdf2json');
const pdfParser = new PDFParser();
const fs = require('fs');

pdfParser.on('pdfParser_dataError', errData => console.error(errData.parserError));
pdfParser.on('pdfParser_dataReady', pdfData => {
  const Y_TOLERANCE = 0.05;

  for (const page of pdfData.Pages) {
    const rows = new Map();

    for (const textItem of page.Texts) {
      const y = textItem.y;
      const x = textItem.x;
      const content = decodeURIComponent(textItem.R[0].T);

      let foundY = null;
      for (const existingY of rows.keys()) {
        if (Math.abs(existingY - y) < Y_TOLERANCE) {
          foundY = existingY;
          break;
        }
      }

      const rowY = foundY !== null ? foundY : y;
      if (!rows.has(rowY)) rows.set(rowY, []);
      rows.get(rowY).push({ x, content });
    }

    const sortedRows = Array.from(rows.entries()).sort((a, b) => a[0] - b[0]);

    // Find first performance row
    let found = false;
    for (const [y, items] of sortedRows) {
      const sortedItems = items.sort((a, b) => a.x - b.x);

      // Look for performance code anywhere in row
      const perfItem = sortedItems.find(i => i.content.match(/^25\d{4}[A-Z]$/));
      if (perfItem && !found) {
        console.log(`\nFound performance code: ${perfItem.content} at X=${perfItem.x.toFixed(2)}`);
        console.log('All items in this row (X position | content):');
        sortedItems.forEach(item => {
          console.log(`  ${item.x.toFixed(2)} | ${item.content}`);
        });
        found = true;
        break;
      }
    }

    if (!found) {
      console.log('\nNo performance codes found. Showing first 5 rows:');
      sortedRows.slice(0, 5).forEach(([y, items], idx) => {
        const sortedItems = items.sort((a, b) => a.x - b.x);
        console.log(`\nRow ${idx}: ${sortedItems.map(i => i.content).join(' | ')}`);
      });
    }
  }
});

pdfParser.loadPDF('FY26 Performance Sales Summary_1126300.pdf');
