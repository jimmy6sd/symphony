// Generate validated YTD JSON data from Excel files
// FY23, FY24, FY25 from Excel; FY26 requires BigQuery
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data/YTD-Comp-Data');
const OUTPUT_FILE = path.join(__dirname, '../../data/ytd-validated-data.json');

function extractFY23(filePath) {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  for (let r = data.length - 1; r > 20; r--) {
    const row = data[r];
    if (row && String(row[0] || '').toLowerCase().includes('grand total')) {
      return {
        single_tickets: typeof row[7] === 'number' ? Math.round(row[7]) : null,
        single_revenue: typeof row[6] === 'number' ? Math.round(row[6] * 100) / 100 : null,
        total_tickets: null,
        total_revenue: null,
        method: 'GRAND TOTAL (6,7)'
      };
    }
  }
  return null;
}

function extractFY24(filePath) {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  for (let r = data.length - 1; r > 20; r--) {
    const row = data[r];
    if (row && String(row[0] || '').toLowerCase().includes('grand total')) {
      // Try later FY24 format first (with CONDUCTOR column): cols 6,8,13,14
      const singleTix8 = row[8];
      if (typeof singleTix8 === 'number' && singleTix8 > 0 && singleTix8 < 200000) {
        return {
          single_tickets: Math.round(singleTix8),
          single_revenue: typeof row[6] === 'number' ? Math.round(row[6] * 100) / 100 : null,
          total_tickets: typeof row[14] === 'number' ? Math.round(row[14]) : null,
          total_revenue: typeof row[13] === 'number' ? Math.round(row[13] * 100) / 100 : null,
          method: 'GRAND TOTAL (6,8,13,14)'
        };
      }

      // Try early FY24 format (same as FY23): cols 6,7
      const singleTix7 = row[7];
      if (typeof singleTix7 === 'number' && singleTix7 > 0 && singleTix7 < 200000) {
        return {
          single_tickets: Math.round(singleTix7),
          single_revenue: typeof row[6] === 'number' ? Math.round(row[6] * 100) / 100 : null,
          total_tickets: null,  // Early format doesn't have total columns
          total_revenue: null,
          method: 'GRAND TOTAL (6,7) early'
        };
      }
    }
  }
  return null;
}

function extractFY25(filePath) {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Try ALL CONCERT first (later format)
  for (let r = data.length - 1; r > 50; r--) {
    const row = data[r];
    if (row && String(row[0] || '').toLowerCase().includes('all concert')) {
      return {
        single_tickets: typeof row[7] === 'number' ? Math.round(row[7]) : null,
        single_revenue: typeof row[5] === 'number' ? Math.round(row[5] * 100) / 100 : null,
        total_tickets: typeof row[13] === 'number' ? Math.round(row[13]) : null,
        total_revenue: typeof row[12] === 'number' ? Math.round(row[12] * 100) / 100 : null,
        method: 'ALL CONCERT (5,7,12,13)'
      };
    }
  }

  // Try GRAND TOTAL (early format)
  for (let r = data.length - 1; r > 50; r--) {
    const row = data[r];
    if (row && String(row[0] || '').toLowerCase().includes('grand total')) {
      return {
        single_tickets: typeof row[8] === 'number' ? Math.round(row[8]) : null,
        single_revenue: typeof row[6] === 'number' ? Math.round(row[6] * 100) / 100 : null,
        total_tickets: typeof row[14] === 'number' ? Math.round(row[14]) : null,
        total_revenue: typeof row[13] === 'number' ? Math.round(row[13] * 100) / 100 : null,
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
  if (!fs.existsSync(fyDir)) return [];

  const files = fs.readdirSync(fyDir)
    .filter(f => f.endsWith('.xlsx') && !f.startsWith('~'))
    .sort();

  const results = [];

  for (const filename of files) {
    const date = parseDateFromFilename(filename);
    if (!date) continue;

    try {
      const extracted = extractFn(path.join(fyDir, filename));
      if (extracted) {
        results.push({
          date,
          fiscal_year: fy,
          filename,
          ...extracted
        });
      } else {
        results.push({
          date,
          fiscal_year: fy,
          filename,
          extraction_failed: true
        });
      }
    } catch (e) {
      results.push({
        date,
        fiscal_year: fy,
        filename,
        error: e.message
      });
    }
  }

  return results;
}

// Main
console.log('Generating validated YTD JSON data...');

const data = {
  generated: new Date().toISOString(),
  note: 'FY26 data should come from BigQuery, not Excel files',
  fiscal_years: {
    FY23: processYear('FY23', extractFY23),
    FY24: processYear('FY24', extractFY24),
    FY25: processYear('FY25', extractFY25)
  },
  summary: {}
};

// Add summary stats
for (const [fy, records] of Object.entries(data.fiscal_years)) {
  const successful = records.filter(r => !r.extraction_failed && !r.error);
  const failed = records.filter(r => r.extraction_failed);
  const errors = records.filter(r => r.error);

  data.summary[fy] = {
    total_files: records.length,
    extracted: successful.length,
    failed: failed.length,
    errors: errors.length,
    date_range: successful.length > 0 ? {
      first: successful[0].date,
      last: successful[successful.length - 1].date
    } : null,
    final_values: successful.length > 0 ? {
      single_tickets: successful[successful.length - 1].single_tickets,
      single_revenue: successful[successful.length - 1].single_revenue,
      total_tickets: successful[successful.length - 1].total_tickets,
      total_revenue: successful[successful.length - 1].total_revenue
    } : null
  };
}

// Write JSON
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));
console.log(`\nWritten to: ${OUTPUT_FILE}`);

// Print summary
console.log('\nSummary:');
for (const [fy, stats] of Object.entries(data.summary)) {
  console.log(`  ${fy}: ${stats.extracted}/${stats.total_files} files`);
  if (stats.final_values) {
    console.log(`    Final: ${stats.final_values.single_tickets?.toLocaleString()} tickets, $${stats.final_values.single_revenue?.toLocaleString()} revenue`);
  }
}
