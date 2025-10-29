const XLSX = require('xlsx');
const fs = require('fs');

const workbook = XLSX.readFile('KCS 25-26 Weekly Sales Report - Sep 17.xlsx');

console.log('Available sheets:', workbook.SheetNames);

// Focus on the most important sheets
const sheetsToAnalyze = ['Board', 'Performances by Week', 'Summary (Draft)'];

const analysis = {};

sheetsToAnalyze.forEach(sheetName => {
    if (!workbook.SheetNames.includes(sheetName)) return;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Sheet: ${sheetName}`);
    console.log('='.repeat(60));

    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    // Store the data
    analysis[sheetName] = data;

    // Print first 20 rows to understand structure
    console.log('\nFirst 20 rows:');
    data.slice(0, 20).forEach((row, idx) => {
        console.log(`Row ${idx}:`, JSON.stringify(row));
    });

    // Find headers (look for rows with many non-empty cells)
    console.log('\n\nPotential header rows:');
    data.slice(0, 10).forEach((row, idx) => {
        const nonEmpty = row.filter(cell => cell !== '').length;
        if (nonEmpty > 5) {
            console.log(`Row ${idx} (${nonEmpty} columns):`, row);
        }
    });
});

// Save full analysis to file
fs.writeFileSync('excel-analysis.json', JSON.stringify(analysis, null, 2));
console.log('\n\nFull analysis saved to excel-analysis.json');

// Create a summary of what data is available
console.log('\n\n' + '='.repeat(60));
console.log('SUMMARY OF AVAILABLE DATA');
console.log('='.repeat(60));

if (analysis['Board']) {
    console.log('\n📊 BOARD SHEET:');
    console.log('- Main overview/dashboard sheet');
    console.log('- Contains summary of all performances');
    console.log('- Single tickets vs subscription tickets breakdown');
    console.log('- Budget vs actual comparisons');
    console.log(`- Total rows: ${analysis['Board'].length}`);
}

if (analysis['Performances by Week']) {
    console.log('\n📅 PERFORMANCES BY WEEK SHEET:');
    console.log('- Week-by-week sales progression');
    console.log('- Individual performance tracking');
    console.log('- Projected vs actual sales');
    console.log(`- Total rows: ${analysis['Performances by Week'].length}`);
}

if (analysis['Summary (Draft)']) {
    console.log('\n📈 SUMMARY SHEET:');
    console.log('- High-level summary data');
    console.log(`- Total rows: ${analysis['Summary (Draft)'].length}`);
}

console.log('\n\nOther available sheets:');
workbook.SheetNames.forEach(name => {
    if (!sheetsToAnalyze.includes(name)) {
        console.log(`  - ${name}`);
    }
});
