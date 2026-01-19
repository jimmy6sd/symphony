// Generate a validation report of YTD data extraction from Excel files
// Run with: node scripts/diagnostic/ytd-extraction-report.js
// Or for specific FY: node scripts/diagnostic/ytd-extraction-report.js FY26

require('dotenv').config();
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data/YTD-Comp-Data');
const targetFY = process.argv[2] || null;

// Parse date from filename
function parseDateFromFilename(filename) {
  const match = filename.match(/^(\d{4})\.(\d{2})\.(\d{2})/);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}

// Find column by header text (searches rows 3-5)
function findColumnByHeader(data, searchTerms) {
  for (let r = 2; r <= 5; r++) {
    const row = data[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] || '').toLowerCase();
      for (const term of searchTerms) {
        if (cell.includes(term.toLowerCase())) {
          return { col: c, row: r, header: row[c] };
        }
      }
    }
  }
  return null;
}

// Find the total/summary row
function findTotalRow(data, startRow = 5) {
  for (let r = data.length - 1; r >= startRow; r--) {
    const row = data[r];
    if (!row) continue;
    const firstCell = String(row[0] || '').toLowerCase();
    const thirdCell = String(row[2] || row[3] || '').toLowerCase();
    if (firstCell.includes('all concert') || firstCell.includes('total') ||
        thirdCell.includes('all concert') || thirdCell.includes('total')) {
      return r;
    }
  }
  return -1;
}

// Find the total row for a specific column (looks for standalone numeric value after data ends)
function findColumnTotalRow(data, colIdx, headerRow) {
  // Scan from bottom up, looking for a row that:
  // 1. Has a numeric value in our column
  // 2. Has empty or minimal data in the first columns (not a performance row)
  for (let r = data.length - 1; r > headerRow + 5; r--) {
    const row = data[r];
    if (!row) continue;

    const val = row[colIdx];
    if (typeof val === 'number' && val > 0) {
      // Check if this looks like a total row (empty first columns)
      const firstCellEmpty = !row[0] || String(row[0]).trim() === '';
      const hasNoWeekNum = !row[1] || typeof row[1] !== 'number' || row[1] > 100;

      // If first columns are empty but we have a value, likely a total row
      if (firstCellEmpty && hasNoWeekNum) {
        return { row: r, value: val };
      }
    }
  }
  return null;
}

// Sum a column from data rows
function sumColumn(data, colIdx, startRow, endRow) {
  let sum = 0;
  let count = 0;
  for (let r = startRow; r < endRow; r++) {
    const row = data[r];
    if (row && typeof row[colIdx] === 'number' && !isNaN(row[colIdx])) {
      sum += row[colIdx];
      count++;
    }
  }
  return { sum, count };
}

// Extract YTD data from a file
function extractFromFile(filePath, filename) {
  const workbook = XLSX.readFile(filePath);
  const reportDate = parseDateFromFilename(filename);

  const result = {
    filename,
    date: reportDate ? reportDate.toISOString().split('T')[0] : 'UNKNOWN',
    sheets: workbook.SheetNames,
    extracted: null,
    method: null,
    notes: []
  };

  // Try different sheet names
  const sheetCandidates = [
    'Performances by Week',
    'Performance by Week',
    'Board',
    '24 25',
    '23 24',
    'Sheet1'
  ];

  let sheet = null;
  let sheetName = null;

  for (const candidate of sheetCandidates) {
    if (workbook.Sheets[candidate]) {
      sheet = workbook.Sheets[candidate];
      sheetName = candidate;
      break;
    }
  }

  if (!sheet) {
    sheet = workbook.Sheets[workbook.SheetNames[0]];
    sheetName = workbook.SheetNames[0];
  }

  result.sheetUsed = sheetName;

  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Strategy 1: Look for "Revenue last week" column WITH a total row (late FY26 format)
  // This column contains weekly single ticket increments, with a total row at bottom.
  // Only use this strategy if we find a valid total row - otherwise the column may contain different data.
  const revLastWeekCol = findColumnByHeader(data, ['revenue last week']);
  if (revLastWeekCol) {
    const totalRow = findColumnTotalRow(data, revLastWeekCol.col, revLastWeekCol.row);
    if (totalRow && totalRow.value > 0) {
      // Count performance rows for context
      let perfCount = 0;
      for (let r = revLastWeekCol.row + 1; r < totalRow.row; r++) {
        if (data[r] && typeof data[r][revLastWeekCol.col] === 'number') {
          perfCount++;
        }
      }
      result.extracted = {
        ytd_single_revenue: Math.round(totalRow.value * 100) / 100,
        performance_rows: perfCount
      };
      result.method = 'Revenue last week total (col ' + revLastWeekCol.col + ', row ' + totalRow.row + ')';
      return result;
    }
    // No total row - skip to Strategy 2 (Actual Revenue column)
  }

  // Strategy 2: FY26 early files without total row - mark as unavailable
  // The "Actual Revenue" column in these files shows cumulative revenue (not FY26-specific YTD)
  if (revLastWeekCol) {
    // We found "Revenue last week" but no total row - can't extract accurate FY26 YTD
    result.notes.push('Has "Revenue last week" column but no total row - cannot extract accurate FY26 YTD');
    // Fall through to other strategies
  }

  // Strategy 3: Find Single Ticket columns - useful for FY25 and earlier
  // In FY26 early format: Row 3 has "Single Tickets" header, Row 4 has "Actual Tickets Sold" and "Actual Revenue"
  let singleTicketsCol = null;
  let singleRevenueCol = null;

  // First, find the "Single Tickets" section header in row 3
  let singleTicketSectionStart = -1;
  let singleTicketSectionEnd = -1;
  for (let c = 0; c < (data[3]?.length || 0); c++) {
    const cell = String(data[3]?.[c] || '').toLowerCase();
    if (cell.includes('single ticket')) {
      singleTicketSectionStart = c;
    }
    if (singleTicketSectionStart > 0 && cell.includes('subscription')) {
      singleTicketSectionEnd = c;
      break;
    }
  }

  // Look for "Actual Revenue" in row 4 within Single Tickets section (or anywhere if section not found)
  const searchStart = singleTicketSectionStart > 0 ? singleTicketSectionStart : 0;
  const searchEnd = singleTicketSectionEnd > 0 ? singleTicketSectionEnd : (data[4]?.length || 50);

  for (let c = searchStart; c < searchEnd; c++) {
    const cell = String(data[4]?.[c] || '').toLowerCase();
    if (cell.includes('actual tickets sold') && !singleTicketsCol) {
      singleTicketsCol = { col: c, row: 4, header: data[4][c] };
    }
    if (cell === 'actual revenue' && !singleRevenueCol) {
      singleRevenueCol = { col: c, row: 4, header: data[4][c] };
    }
  }

  if (singleTicketsCol || singleRevenueCol) {
    const totalRow = findTotalRow(data);
    const endRow = totalRow > 0 ? totalRow : data.length - 5;
    const startRow = 5; // Data starts at row 5 typically

    let tickets = null;
    let revenue = null;

    if (singleTicketsCol) {
      const { sum, count } = sumColumn(data, singleTicketsCol.col, startRow, endRow);
      if (sum > 0) tickets = { value: sum, count };
    }

    if (singleRevenueCol) {
      const { sum, count } = sumColumn(data, singleRevenueCol.col, startRow, endRow);
      if (sum > 0) revenue = { value: Math.round(sum * 100) / 100, count };
    }

    if (tickets || revenue) {
      result.extracted = {
        ytd_single_tickets: tickets ? tickets.value : null,
        ytd_single_revenue: revenue ? revenue.value : null,
        performance_rows: tickets ? tickets.count : revenue.count
      };
      result.method = 'Single Ticket columns (tickets col ' + (singleTicketsCol?.col || 'n/a') + ', revenue col ' + (singleRevenueCol?.col || 'n/a') + ')';
      // For FY26 files, add note that this is cumulative, not FY26-specific
      if (revLastWeekCol) {
        result.notes.push('WARNING: Revenue is cumulative total, not FY26 YTD');
      }
      return result;
    }
  }

  // Strategy 4: FY23/24 simple format - look for BUDGET/ACTUAL/# SOLD pattern
  for (let r = 2; r <= 5; r++) {
    const row = data[r];
    if (!row) continue;

    for (let c = 0; c < row.length - 2; c++) {
      const h1 = String(row[c] || '').toLowerCase();
      const h2 = String(row[c + 1] || '').toLowerCase();
      const h3 = String(row[c + 2] || '').toLowerCase();

      if ((h1.includes('budget') || h1.includes('actual')) &&
          (h2.includes('actual') || h2.includes('# sold')) &&
          (h3.includes('# sold') || h3.includes('cap'))) {

        // Found the pattern - actual revenue is likely c+1, tickets is c+2
        const revenueCol = c + 1;
        const ticketsCol = h2.includes('# sold') ? c + 1 : c + 2;

        const totalRow = findTotalRow(data);
        const endRow = totalRow > 0 ? totalRow : data.length - 5;

        const { sum: revSum } = sumColumn(data, revenueCol, r + 1, endRow);
        const { sum: tickSum, count } = sumColumn(data, ticketsCol, r + 1, endRow);

        if (revSum > 0 || tickSum > 0) {
          result.extracted = {
            ytd_single_tickets: tickSum > 0 ? tickSum : null,
            ytd_single_revenue: revSum > 0 ? Math.round(revSum * 100) / 100 : null,
            performance_rows: count
          };
          result.method = 'Simple format (revenue col ' + revenueCol + ', tickets col ' + ticketsCol + ')';
          return result;
        }
      }
    }
  }

  result.notes.push('Could not extract data - unknown format');
  return result;
}

// Main
function main() {
  const fiscalYears = targetFY ? [targetFY] : ['FY23', 'FY24', 'FY25', 'FY26'];

  console.log('YTD Extraction Validation Report');
  console.log('=================================\n');
  console.log('Generated:', new Date().toISOString());
  console.log('');

  for (const fy of fiscalYears) {
    const fyDir = path.join(DATA_DIR, fy);

    if (!fs.existsSync(fyDir)) {
      console.log(`\n${fy}: Directory not found`);
      continue;
    }

    const files = fs.readdirSync(fyDir)
      .filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'))
      .sort();

    console.log(`\n${'='.repeat(80)}`);
    console.log(`${fy}: ${files.length} files`);
    console.log('='.repeat(80));

    // Process all files
    const results = [];

    for (const filename of files) {
      try {
        const result = extractFromFile(path.join(fyDir, filename), filename);
        results.push(result);
      } catch (error) {
        results.push({
          filename,
          error: error.message
        });
      }
    }

    // Output results
    console.log('\nDate       | Tickets    | Revenue        | Method');
    console.log('-'.repeat(90));

    for (const r of results) {
      if (r.error) {
        console.log(`${r.date || 'UNKNOWN'} | ERROR: ${r.error}`);
        continue;
      }

      const tickets = r.extracted?.ytd_single_tickets?.toLocaleString().padStart(10) || '-'.padStart(10);
      const revenue = r.extracted?.ytd_single_revenue ? ('$' + r.extracted.ytd_single_revenue.toLocaleString()).padStart(14) : '-'.padStart(14);
      const method = r.method || 'FAILED';
      const warning = r.notes?.some(n => n.includes('WARNING')) ? ' ⚠️' : '';

      console.log(`${r.date} | ${tickets} | ${revenue} | ${method.substring(0, 40)}${warning}`);
    }

    // Summary
    const successful = results.filter(r => r.extracted);
    const failed = results.filter(r => !r.extracted && !r.error);

    console.log('\n' + '-'.repeat(50));
    console.log(`Summary: ${successful.length} extracted, ${failed.length} failed, ${results.filter(r => r.error).length} errors`);

    if (failed.length > 0) {
      console.log('\nFailed files:');
      failed.forEach(r => console.log(`  - ${r.filename}`));
    }
  }
}

main();
