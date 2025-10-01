const PDFParser = require('pdf2json');
const pdfParser = new PDFParser();

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

    // Find first performance row (251010E)
    let found = false;
    for (const [y, items] of sortedRows) {
      const sortedItems = items.sort((a, b) => a.x - b.x);

      const perfItem = sortedItems.find(i => i.content === '251010E');
      if (perfItem && !found) {
        console.log(`\n✅ Found performance code: 251010E`);
        console.log('📊 Expected values: 480 fixed, 17 non-fixed, 340 single, $51,642.30 total');
        console.log('\n📋 All items in this row (in sorted order):');
        sortedItems.forEach((item, idx) => {
          console.log(`  [${idx}] "${item.content}"`);
        });

        found = true;
        break;
      }
    }
  }
});

pdfParser.loadPDF('FY26 Performance Sales Summary_1126300.pdf');
