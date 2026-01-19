// Validate FY23 extraction using correct total rows
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../../data/YTD-Comp-Data/FY23');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.xlsx') && !f.startsWith('~')).sort();

console.log('FY23: CORRECTED extraction from total rows');
console.log('Date       | Single Tix | Single Rev   | Total Tix  | Total Rev    | Method');
console.log('-'.repeat(85));

for (const filename of files) {
  try {
    const wb = XLSX.readFile(path.join(dir, filename));
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    const dateMatch = filename.match(/\d{4}\.\d{2}\.\d{2}/);
    const date = dateMatch ? dateMatch[0].replace(/\./g, '-') : 'unknown';

    let singleTix = null, singleRev = null, totalTix = null, totalRev = null, method = '';

    // FY23 format: Look for GRAND TOTAL or ALL CONCERT row
    // Try multiple column configurations
    for (let r = data.length - 1; r > 20; r--) {
      const row = data[r];
      if (!row) continue;
      const cell0 = String(row[0] || '').toLowerCase();

      if (cell0.includes('grand total') || cell0.includes('all concert')) {
        // Determine column layout by checking headers
        // Common layouts: cols 5-8 or 6-8 depending on if CONDUCTOR column exists

        // Try to read based on which columns have numeric values
        // Pattern: BUDGET | ACTUAL | VS.BUDGET/TO GO | #SOLD for single tickets
        // Then BUDGET | ACTUAL | #SOLD for subscription
        // Then BUDGET | ACTUAL | #SOLD for total

        // Look for numeric patterns to determine column offsets
        let found = false;

        // Try layout with CONDUCTOR (cols 6, 8, 13, 14)
        if (typeof row[8] === 'number' && row[8] > 0 && row[8] < 1000000) {
          singleTix = row[8];
          singleRev = row[6];
          totalTix = row[14];
          totalRev = row[13];
          method = cell0.includes('grand') ? 'GRAND TOTAL (6,8,13,14)' : 'ALL CONCERT (6,8,13,14)';
          found = true;
        }

        // Try layout without CONDUCTOR (cols 5, 7, 12, 13)
        if (!found && typeof row[7] === 'number' && row[7] > 0 && row[7] < 1000000) {
          singleTix = row[7];
          singleRev = row[5];
          totalTix = row[13];
          totalRev = row[12];
          method = cell0.includes('grand') ? 'GRAND TOTAL (5,7,12,13)' : 'ALL CONCERT (5,7,12,13)';
          found = true;
        }

        // Fallback: just report what we found
        if (!found) {
          method = 'FOUND ROW but cols unclear';
          console.log('  DEBUG row ' + r + ':', row.slice(0, 15));
        }

        break;
      }
    }

    if (singleTix !== null) {
      console.log(date + ' | ' +
        String(typeof singleTix === 'number' ? Math.round(singleTix) : '-').padStart(10) + ' | ' +
        String(typeof singleRev === 'number' ? Math.round(singleRev) : '-').padStart(12) + ' | ' +
        String(typeof totalTix === 'number' ? Math.round(totalTix) : '-').padStart(10) + ' | ' +
        String(typeof totalRev === 'number' ? Math.round(totalRev) : '-').padStart(12) + ' | ' +
        method);
    } else {
      console.log(date + ' | --- TOTAL ROW NOT FOUND ---');
    }
  } catch (e) {
    const dateMatch = filename.match(/\d{4}\.\d{2}\.\d{2}/);
    const date = dateMatch ? dateMatch[0].replace(/\./g, '-') : 'unknown';
    console.log(date + ' | ERROR: ' + e.message);
  }
}
