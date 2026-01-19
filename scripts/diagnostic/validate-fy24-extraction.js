// Validate FY24 extraction using correct total rows
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../../data/YTD-Comp-Data/FY24');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.xlsx') && !f.startsWith('~')).sort();

console.log('FY24: CORRECTED extraction from total rows');
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

    // FY24 has "GRAND TOTAL" row like early FY25
    // Structure: Col 6=Single ACTUAL, Col 8=Single #SOLD, Col 13=Total ACTUAL, Col 14=Total #SOLD
    for (let r = data.length - 1; r > 20; r--) {
      const row = data[r];
      if (!row) continue;
      const cell0 = String(row[0] || '').toLowerCase();

      if (cell0.includes('grand total')) {
        singleTix = row[8];
        singleRev = row[6];
        totalTix = row[14];
        totalRev = row[13];
        method = 'GRAND TOTAL';
        break;
      }

      if (cell0.includes('all concert')) {
        singleTix = row[7];
        singleRev = row[5];
        totalTix = row[13];
        totalRev = row[12];
        method = 'ALL CONCERT';
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
      console.log(date + ' | --- NOT FOUND ---');
    }
  } catch (e) {
    const dateMatch = filename.match(/\d{4}\.\d{2}\.\d{2}/);
    const date = dateMatch ? dateMatch[0].replace(/\./g, '-') : 'unknown';
    console.log(date + ' | ERROR: ' + e.message);
  }
}
