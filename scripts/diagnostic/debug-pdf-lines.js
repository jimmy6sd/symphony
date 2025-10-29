const pdf = require('pdf-parse');
const fs = require('fs');

async function debugPDFLines() {
  const dataBuffer = fs.readFileSync('FY26 Performance Sales Summary_1126300.pdf');
  const data = await pdf(dataBuffer);

  const lines = data.text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const perfLines = lines.filter(l => l.match(/^\d{6}[A-Z]\d{1,2}\/\d{1,2}\/\d{4}/));

  console.log('First 3 performance lines after split:');
  perfLines.slice(0, 3).forEach((line, i) => {
    console.log(`${i+1}. [Length: ${line.length}]`);
    console.log(`   ${line}`);
    console.log('');
  });
}

debugPDFLines();
