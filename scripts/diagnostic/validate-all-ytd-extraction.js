// Validate YTD extraction from Excel files for FY23, FY24, FY25
// FY26 uses BigQuery, not Excel
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data/YTD-Comp-Data');

function extractFY23(filePath, filename) {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // FY23: Simple format with GRAND TOTAL row
  // Col 5: BUDGET, Col 6: ACTUAL revenue, Col 7: # SOLD tickets
  for (let r = data.length - 1; r > 20; r--) {
    const row = data[r];
    if (row && String(row[0] || '').toLowerCase().includes('grand total')) {
      return {
        single_tickets: typeof row[7] === 'number' ? row[7] : null,
        single_revenue: typeof row[6] === 'number' ? row[6] : null,
        total_tickets: null, // FY23 doesn't have separate total
        total_revenue: null,
        method: 'GRAND TOTAL (6,7)'
      };
    }
  }
  return null;
}

function extractFY24(filePath, filename) {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // FY24: GRAND TOTAL row with CONDUCTOR column
  // Col 6: Single ACTUAL, Col 8: Single #SOLD, Col 13: Total ACTUAL, Col 14: Total #SOLD
  for (let r = data.length - 1; r > 20; r--) {
    const row = data[r];
    if (row && String(row[0] || '').toLowerCase().includes('grand total')) {
      // Check if this looks like early format (no ticket counts) or later format
      const singleTix = row[8];
      const singleRev = row[6];
      const totalTix = row[14];
      const totalRev = row[13];

      // Validate - ticket counts should be reasonable (< 200,000)
      if (typeof singleTix === 'number' && singleTix > 0 && singleTix < 200000) {
        return {
          single_tickets: singleTix,
          single_revenue: typeof singleRev === 'number' ? singleRev : null,
          total_tickets: typeof totalTix === 'number' ? totalTix : null,
          total_revenue: typeof totalRev === 'number' ? totalRev : null,
          method: 'GRAND TOTAL (6,8,13,14)'
        };
      }
    }
  }
  return null;
}

function extractFY25(filePath, filename) {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // FY25 early: GRAND TOTAL row, cols 6,8,13,14
  // FY25 later: ALL CONCERT row, cols 5,7,12,13

  // Try ALL CONCERT first (later format)
  for (let r = data.length - 1; r > 50; r--) {
    const row = data[r];
    if (row && String(row[0] || '').toLowerCase().includes('all concert')) {
      return {
        single_tickets: typeof row[7] === 'number' ? row[7] : null,
        single_revenue: typeof row[5] === 'number' ? row[5] : null,
        total_tickets: typeof row[13] === 'number' ? row[13] : null,
        total_revenue: typeof row[12] === 'number' ? row[12] : null,
        method: 'ALL CONCERT (5,7,12,13)'
      };
    }
  }

  // Try GRAND TOTAL (early format)
  for (let r = data.length - 1; r > 50; r--) {
    const row = data[r];
    if (row && String(row[0] || '').toLowerCase().includes('grand total')) {
      return {
        single_tickets: typeof row[8] === 'number' ? row[8] : null,
        single_revenue: typeof row[6] === 'number' ? row[6] : null,
        total_tickets: typeof row[14] === 'number' ? row[14] : null,
        total_revenue: typeof row[13] === 'number' ? row[13] : null,
        method: 'GRAND TOTAL (6,8,13,14)'
      };
    }
  }
  return null;
}

function parseDateFromFilename(filename) {
  const match = filename.match(/(\d{4})\.(\d{2})\.(\d{2})/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function processYear(fy, extractFn) {
  const fyDir = path.join(DATA_DIR, fy);
  if (!fs.existsSync(fyDir)) {
    console.log(`\n${fy}: Directory not found`);
    return [];
  }

  const files = fs.readdirSync(fyDir)
    .filter(f => f.endsWith('.xlsx') && !f.startsWith('~'))
    .sort();

  console.log(`\n${'='.repeat(80)}`);
  console.log(`${fy}: ${files.length} files`);
  console.log('='.repeat(80));
  console.log('\nDate       | Single Tix | Single Rev   | Total Tix  | Total Rev    | Method');
  console.log('-'.repeat(85));

  const results = [];

  for (const filename of files) {
    const date = parseDateFromFilename(filename) || 'UNKNOWN';
    try {
      const extracted = extractFn(path.join(fyDir, filename), filename);
      if (extracted) {
        console.log(date + ' | ' +
          String(extracted.single_tickets !== null ? Math.round(extracted.single_tickets) : '-').padStart(10) + ' | ' +
          String(extracted.single_revenue !== null ? Math.round(extracted.single_revenue) : '-').padStart(12) + ' | ' +
          String(extracted.total_tickets !== null ? Math.round(extracted.total_tickets) : '-').padStart(10) + ' | ' +
          String(extracted.total_revenue !== null ? Math.round(extracted.total_revenue) : '-').padStart(12) + ' | ' +
          extracted.method);
        results.push({ date, filename, ...extracted });
      } else {
        console.log(date + ' | --- EXTRACTION FAILED ---');
        results.push({ date, filename, failed: true });
      }
    } catch (e) {
      console.log(date + ' | ERROR: ' + e.message.substring(0, 50));
      results.push({ date, filename, error: e.message });
    }
  }

  const success = results.filter(r => !r.failed && !r.error).length;
  const failed = results.filter(r => r.failed).length;
  const errors = results.filter(r => r.error).length;
  console.log('\n' + '-'.repeat(50));
  console.log(`Summary: ${success} extracted, ${failed} failed, ${errors} errors`);

  return results;
}

// Main
console.log('YTD Data Validation Report - CORRECTED');
console.log('======================================');
console.log('Generated:', new Date().toISOString());
console.log('Note: FY26 should use BigQuery, not Excel files');

const allResults = {
  FY23: processYear('FY23', extractFY23),
  FY24: processYear('FY24', extractFY24),
  FY25: processYear('FY25', extractFY25)
};

// Final summary
console.log('\n\n' + '='.repeat(80));
console.log('FINAL SUMMARY');
console.log('='.repeat(80));

for (const [fy, results] of Object.entries(allResults)) {
  const success = results.filter(r => !r.failed && !r.error).length;
  const total = results.length;
  console.log(`${fy}: ${success}/${total} files extracted successfully`);
}
