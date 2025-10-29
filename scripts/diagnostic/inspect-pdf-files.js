// Inspect the PDF files to see what data they contain
const fs = require('fs');
const pdf = require('pdf-parse');

async function inspectPDF(filepath) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📄 Inspecting: ${filepath}`);
  console.log('='.repeat(60));

  const dataBuffer = fs.readFileSync(filepath);
  const data = await pdf(dataBuffer);

  console.log(`Pages: ${data.numpages}`);
  console.log(`Text length: ${data.text.length} characters\n`);

  // Show first 2000 characters to understand structure
  console.log('First 2000 characters:');
  console.log('-'.repeat(60));
  console.log(data.text.substring(0, 2000));
  console.log('-'.repeat(60));

  // Try to find date in text
  const dateMatches = data.text.match(/\d{1,2}\/\d{1,2}\/\d{4}/g);
  if (dateMatches) {
    console.log(`\n📅 Dates found: ${dateMatches.slice(0, 10).join(', ')}`);
  }

  // Try to find "as of" date
  const asOfMatch = data.text.match(/as of\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (asOfMatch) {
    console.log(`\n⏰ Report Date: ${asOfMatch[1]}`);
  }

  // Look for performance codes
  const perfCodes = data.text.match(/\d{6}[EMW]/g);
  if (perfCodes) {
    const unique = [...new Set(perfCodes)];
    console.log(`\n🎭 Performance codes found: ${unique.length}`);
    console.log(`   Examples: ${unique.slice(0, 10).join(', ')}`);
  }

  return data;
}

async function main() {
  const pdfFiles = [
    'FY26 Performance Sales Summary_1124675.pdf',
    'FY26 Performance Sales Summary_1126300.pdf'
  ];

  for (const file of pdfFiles) {
    try {
      await inspectPDF(file);
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error.message);
    }
  }

  console.log('\n\n' + '='.repeat(60));
  console.log('NEXT STEPS');
  console.log('='.repeat(60));
  console.log('Based on the report dates above:');
  console.log('1. If PDFs are NEWER than BigQuery (Oct 1) → Process through webhook');
  console.log('2. If PDFs are SAME as BigQuery → BigQuery is already current');
  console.log('3. If PDFs are OLDER than BigQuery → Need newer PDFs');
}

main().catch(console.error);
