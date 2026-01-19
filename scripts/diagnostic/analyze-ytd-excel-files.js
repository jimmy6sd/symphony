// Diagnostic script to analyze YTD Excel files and show what data we're extracting
// Run with: node scripts/diagnostic/analyze-ytd-excel-files.js
// Or for a specific year: node scripts/diagnostic/analyze-ytd-excel-files.js FY25

require('dotenv').config();
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data/YTD-Comp-Data');
const targetFY = process.argv[2] || null; // Optional: pass FY23, FY24, etc.

// Parse date from filename
function parseDateFromFilename(filename) {
  const match = filename.match(/^(\d{4})\.(\d{2})\.(\d{2})/);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}

// Analyze a single Excel file
function analyzeExcelFile(filePath, filename) {
  const workbook = XLSX.readFile(filePath);
  const reportDate = parseDateFromFilename(filename);

  console.log(`\n${'='.repeat(80)}`);
  console.log(`FILE: ${filename}`);
  console.log(`DATE: ${reportDate ? reportDate.toISOString().split('T')[0] : 'UNKNOWN'}`);
  console.log(`SHEETS: ${workbook.SheetNames.join(', ')}`);
  console.log('');

  // Analyze each sheet
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (data.length === 0) return;

    console.log(`  SHEET: "${sheetName}" (${data.length} rows)`);

    // Look for potential total rows and header rows
    const interestingRows = [];

    for (let i = 0; i < Math.min(data.length, 100); i++) {
      const row = data[i];
      const firstCell = String(row[0] || '').toLowerCase().trim();
      const rowStr = row.slice(0, 8).map(c => String(c || '').substring(0, 15)).join(' | ');

      // Look for totals, headers, or rows with "single" mentioned
      if (firstCell.includes('total') ||
          firstCell.includes('ytd') ||
          firstCell.includes('single') ||
          firstCell.includes('actual') ||
          firstCell.includes('header') ||
          (row.some(c => String(c).toLowerCase().includes('single ticket')))) {
        interestingRows.push({ rowNum: i + 1, preview: rowStr, firstCell });
      }
    }

    if (interestingRows.length > 0) {
      console.log(`    Interesting rows found:`);
      interestingRows.slice(0, 10).forEach(r => {
        console.log(`      Row ${r.rowNum}: ${r.preview}`);
      });
    }

    // Show first few rows for context
    console.log(`    First 5 rows:`);
    data.slice(0, 5).forEach((row, i) => {
      const preview = row.slice(0, 6).map(c => String(c || '').substring(0, 12)).join(' | ');
      console.log(`      ${i + 1}: ${preview}`);
    });

    console.log('');
  });

  return {
    filename,
    date: reportDate,
    sheets: workbook.SheetNames
  };
}

// Main
function main() {
  const fiscalYears = targetFY ? [targetFY] : ['FY23', 'FY24', 'FY25', 'FY26'];

  console.log('YTD Excel File Analysis');
  console.log('=======================\n');
  console.log('Looking for: Single ticket YTD totals\n');

  for (const fy of fiscalYears) {
    const fyDir = path.join(DATA_DIR, fy);

    if (!fs.existsSync(fyDir)) {
      console.log(`Directory not found: ${fyDir}`);
      continue;
    }

    const files = fs.readdirSync(fyDir)
      .filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'))
      .sort();

    console.log(`\n${'#'.repeat(80)}`);
    console.log(`# ${fy}: ${files.length} files`);
    console.log(`${'#'.repeat(80)}`);

    // Only analyze first 3 and last 2 files to keep output manageable
    const samplesToAnalyze = [
      ...files.slice(0, 3),
      ...files.slice(-2)
    ];

    console.log(`\nAnalyzing sample files: ${samplesToAnalyze.length} of ${files.length}`);

    for (const filename of samplesToAnalyze) {
      try {
        analyzeExcelFile(path.join(fyDir, filename), filename);
      } catch (error) {
        console.log(`\nERROR processing ${filename}: ${error.message}`);
      }
    }
  }
}

main();
