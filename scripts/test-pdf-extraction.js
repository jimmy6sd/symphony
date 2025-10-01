const PDFParser = require('pdf2json');
const pdfParser = new PDFParser();

pdfParser.on('pdfParser_dataError', errData => console.error(errData.parserError));
pdfParser.on('pdfParser_dataReady', pdfData => {
  let text = '';

  for (const page of pdfData.Pages) {
    const rows = new Map();

    for (const textItem of page.Texts) {
      const y = textItem.y;
      const x = textItem.x;
      const content = decodeURIComponent(textItem.R[0].T);

      if (!rows.has(y)) rows.set(y, []);
      rows.get(y).push({ x, content });
    }

    const sortedRows = Array.from(rows.entries()).sort((a, b) => a[0] - b[0]);

    for (const [y, items] of sortedRows) {
      const sortedItems = items.sort((a, b) => a.x - b.x);
      let rowText = '';
      let lastX = 0;

      for (const item of sortedItems) {
        const xDiff = item.x - lastX;
        if (xDiff > 0.3) rowText += '  ';
        else if (xDiff > 0.1 && rowText.length > 0) rowText += ' ';
        rowText += item.content;
        lastX = item.x + item.content.length * 0.1;
      }

      text += rowText + '\n';
    }
  }

  console.log('Extracted text - First 30 lines:');
  const lines = text.split('\n').slice(0, 30);
  lines.forEach((line, i) => console.log(`${i}: ${line}`));

  console.log('\n\n=== Looking for performance codes ===');
  const perfLines = text.split('\n').filter(l => /25\d{4}[A-Z]/.test(l));
  console.log(`Found ${perfLines.length} lines with performance codes`);
  perfLines.slice(0, 5).forEach(line => console.log(line));
});

pdfParser.loadPDF('FY26 Performance Sales Summary_1126300.pdf');
