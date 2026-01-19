// Generate quintile analysis JSON from all YTD Excel files
// Run: node scripts/active/generate-quintile-json.js
// Output: data/quintile-analysis/quintile-data.json

require('dotenv').config();
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data/YTD-Comp-Data');
const OUTPUT_FILE = path.join(__dirname, '../../data/quintile-analysis/quintile-data.json');

// Quintile definitions (calendar months)
const QUINTILES = {
  'sep-oct': { name: 'Sep-Oct', months: [9, 10] },
  'nov-dec': { name: 'Nov-Dec', months: [11, 12] },
  'jan-feb': { name: 'Jan-Feb', months: [1, 2] },
  'mar-apr': { name: 'Mar-Apr', months: [3, 4] },
  'may-jun': { name: 'May-Jun', months: [5, 6] }
};

// Parse number from Excel
function parseNumber(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const str = String(val).trim();
  if (str === '' || str === '-' || str === '#N/A' || str === '#REF!') return null;
  const cleaned = str.replace(/[$,]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// Parse date from Excel serial
function parseDate(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + val * 24 * 60 * 60 * 1000);
  }
  const str = String(val).trim();
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

// Parse text date like "Sept. 13-15"
function parseDateText(val) {
  if (!val) return null;
  const str = String(val).trim();
  if (!str) return null;

  const months = {
    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'aug': 7, 'sep': 8, 'sept': 8, 'oct': 9, 'nov': 10, 'dec': 11
  };

  const match = str.match(/([a-zA-Z]+)\.?\s*(\d+)/i);
  if (!match) return null;

  const monthStr = match[1].toLowerCase();
  const day = parseInt(match[2]);
  const month = months[monthStr];
  if (month === undefined || isNaN(day)) return null;

  // Use 2024 as base year (doesn't matter for month extraction)
  return new Date(2024, month, day);
}

// Get quintile for a performance date
function getQuintile(perfDate) {
  if (!perfDate) return null;
  const month = perfDate.getMonth() + 1;
  for (const [key, def] of Object.entries(QUINTILES)) {
    if (def.months.includes(month)) return key;
  }
  return null;
}

// Parse date from filename
function parseDateFromFilename(filename) {
  const match = filename.match(/^(\d{4})\.(\d{2})\.(\d{2})/);
  if (!match) return null;
  const [, year, month, day] = match;
  return `${year}-${month}-${day}`;
}

// Extract performances from FY23/FY24 format
function extractFY23FY24(workbook, fiscalYear) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const performances = [];

  let headerRow = -1;
  let cols = {};

  // Search for headers - check multiple rows since structure varies
  for (let r = 3; r <= 5; r++) {
    const row = data[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] || '').toLowerCase().trim();
      if (cell === 'budget' && !cols.budget) cols.budget = c;
      if (cell === 'actual' && !cols.actual) cols.actual = c;
      if (cell === '# sold' && !cols.sold) cols.sold = c;
      // Capacity is in col 15 for FY24 (SELLABLE in row 3, CAPACITY in row 4)
      if ((cell === 'sellable' || cell === 'capacity') && !cols.capacity) cols.capacity = c;
    }
    if (cols.actual || cols.sold) { headerRow = r; break; }
  }

  if (headerRow < 0) return performances;

  // Explicit column mappings based on known formats
  // FY23: No capacity column
  // FY24: Single ticket cols 5-8, capacity at 15
  cols.title = 1;
  cols.date = 3;
  cols.budget = 5;
  cols.actual = 6;
  cols.sold = fiscalYear === 'FY24' ? 8 : 7;  // FY24 has # SOLD at col 8
  cols.capacity = fiscalYear === 'FY24' ? 15 : null;  // FY24 has SELLABLE CAPACITY at col 15

  for (let r = headerRow + 1; r < data.length; r++) {
    const row = data[r];
    if (!row) continue;
    const firstCell = String(row[0] || '').trim();
    if (!firstCell || firstCell.toLowerCase().includes('total')) continue;

    const soldVal = parseNumber(row[cols.sold]);
    const actualVal = parseNumber(row[cols.actual]);
    if (soldVal === null && actualVal === null) continue;

    const perfDate = parseDateText(row[cols.date]);
    performances.push({
      title: String(row[cols.title] || '').trim(),
      date: perfDate,
      budget: parseNumber(row[cols.budget]),
      revenue: actualVal,
      ticketsSold: soldVal,
      capacity: parseNumber(row[cols.capacity]) || null
    });
  }
  return performances;
}

// Extract performances from FY25/FY26 format
function extractFY25FY26(workbook, fiscalYear) {
  const sheetCandidates = ['24 25', '25 26', 'Sheet1'];
  let sheet = null;
  for (const name of sheetCandidates) {
    if (workbook.Sheets[name]) { sheet = workbook.Sheets[name]; break; }
  }
  if (!sheet) sheet = workbook.Sheets[workbook.SheetNames[0]];

  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const performances = [];

  let headerRow = 4;
  let cols = {};

  // FY25 has two formats:
  // Early files: Col 15 = SELLABLE CAPACITY (row 3: SELLABLE, row 4: CAPACITY)
  // Late files: Col 14 = CAP (row 3: CAP)
  // Detect by checking row 3 for "CAP" at col 14 vs "SELLABLE" at col 15

  const row3 = data[3] || [];
  const hasNewFormat = String(row3[14] || '').toLowerCase() === 'cap';

  for (let r = 3; r <= 5; r++) {
    const row = data[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] || '').toLowerCase().trim();
      if (cell === 'date' && !cols.date) cols.date = c;
      if (cell === 'budget' && !cols.budget) cols.budget = c;
      if (cell === 'actual' && !cols.actual) cols.actual = c;
      if (cell === '# sold' && !cols.sold) cols.sold = c;
    }
    if (cols.actual || cols.sold || cols.budget) { headerRow = r; break; }
  }

  if (!cols.date) cols.date = 3;
  if (!cols.budget) cols.budget = 5;
  if (!cols.actual) cols.actual = 6;
  if (!cols.sold) cols.sold = 8;
  // Capacity column depends on file format
  cols.capacity = hasNewFormat ? 14 : 15;
  cols.title = 1;

  for (let r = headerRow + 1; r < data.length; r++) {
    const row = data[r];
    if (!row) continue;
    const firstCell = String(row[0] || '').trim();
    const titleCell = String(row[cols.title] || '').trim();

    if (!firstCell && !titleCell) continue;
    if (firstCell.toLowerCase().includes('total') || firstCell.toLowerCase().includes('grand')) continue;
    if (firstCell && firstCell.toUpperCase() === firstCell && firstCell.includes(' ')) continue;

    const soldVal = parseNumber(row[cols.sold]);
    const actualVal = parseNumber(row[cols.actual]);
    if (soldVal === null && actualVal === null) continue;

    const perfDate = parseDateText(row[cols.date]);
    performances.push({
      title: titleCell || firstCell,
      date: perfDate,
      budget: parseNumber(row[cols.budget]),
      revenue: actualVal,
      ticketsSold: soldVal,
      capacity: parseNumber(row[cols.capacity]) || null
    });
  }
  return performances;
}

// Extract from FY26 "Performances by Week" format
function extractFY26PerformancesByWeek(workbook) {
  // Handle both singular and plural naming
  const sheet = workbook.Sheets['Performances by Week'] || workbook.Sheets['Performance by Week'];
  if (!sheet) return null;

  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const performances = [];

  for (let r = 5; r < data.length; r++) {
    const row = data[r];
    if (!row) continue;

    const title = String(row[3] || '').trim();
    const dateVal = row[6];
    const ticketsSold = parseNumber(row[18]);
    const revenue = parseNumber(row[24]);
    const budget = parseNumber(row[25]);

    if (!title || (ticketsSold === null && revenue === null)) continue;
    if (title.toLowerCase().includes('total')) continue;

    const perfDate = parseDate(dateVal);
    const capacity = parseNumber(row[19]); // Col 19: Maximum Single Ticket Capacity
    performances.push({ title, date: perfDate, budget, revenue, ticketsSold, capacity });
  }
  return performances;
}

// Process a single file
function processFile(filePath, filename, fiscalYear) {
  const workbook = XLSX.readFile(filePath);

  let performances;
  // FY26 uses "Performance(s) by Week" sheet
  const hasPerfByWeek = workbook.Sheets['Performances by Week'] || workbook.Sheets['Performance by Week'];
  if (fiscalYear === 'FY26' && hasPerfByWeek) {
    performances = extractFY26PerformancesByWeek(workbook);
  } else if (fiscalYear === 'FY23' || fiscalYear === 'FY24') {
    performances = extractFY23FY24(workbook, fiscalYear);
  } else {
    performances = extractFY25FY26(workbook, fiscalYear);
  }

  return performances || [];
}

// Aggregate by quintile
function aggregateByQuintile(performances) {
  const result = {};

  for (const [qKey, qDef] of Object.entries(QUINTILES)) {
    const qPerfs = performances.filter(p => getQuintile(p.date) === qKey);

    if (qPerfs.length === 0) {
      result[qKey] = null;
      continue;
    }

    const totalRevenue = qPerfs.reduce((sum, p) => sum + (p.revenue || 0), 0);
    const totalBudget = qPerfs.reduce((sum, p) => sum + (p.budget || 0), 0);
    const totalSold = qPerfs.reduce((sum, p) => sum + (p.ticketsSold || 0), 0);
    const totalCapacity = qPerfs.reduce((sum, p) => sum + (p.capacity || 0), 0);

    // Programming list
    const titleCounts = {};
    qPerfs.forEach(p => {
      if (p.title) {
        const t = p.title.replace(/\s+/g, ' ').trim();
        titleCounts[t] = (titleCounts[t] || 0) + 1;
      }
    });
    const programming = Object.entries(titleCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([t, c]) => `${t} (${c})`)
      .join('; ');

    result[qKey] = {
      actual_revenue: Math.round(totalRevenue),
      pct_budget: totalBudget > 0 ? Math.round(totalRevenue / totalBudget * 1000) / 10 : 0,
      num_performances: qPerfs.length,
      budget: Math.round(totalBudget),
      total_seats: Math.round(totalCapacity),
      seats_sold: Math.round(totalSold),
      capacity_pct: totalCapacity > 0 ? Math.round(totalSold / totalCapacity * 1000) / 10 : 0,
      atp: totalSold > 0 ? Math.round(totalRevenue / totalSold * 100) / 100 : 0,
      programming
    };
  }

  return result;
}

// Main
async function main() {
  console.log('Generating quintile JSON from all Excel files...\n');

  const allData = [];
  const fiscalYears = ['FY23', 'FY24', 'FY25', 'FY26'];

  for (const fy of fiscalYears) {
    const fyDir = path.join(DATA_DIR, fy);
    if (!fs.existsSync(fyDir)) {
      console.log(`⚠️ ${fy} directory not found`);
      continue;
    }

    const files = fs.readdirSync(fyDir)
      .filter(f => (f.endsWith('.xlsx') || f.endsWith('.xls')) && !f.startsWith('~'))
      .sort();

    console.log(`📁 ${fy}: ${files.length} files`);

    for (const filename of files) {
      const snapshotDate = parseDateFromFilename(filename);
      if (!snapshotDate) continue;

      try {
        const performances = processFile(path.join(fyDir, filename), filename, fy);
        const quintileData = aggregateByQuintile(performances);

        // Create one entry per quintile
        for (const [qKey, qData] of Object.entries(quintileData)) {
          if (!qData) continue;

          allData.push({
            date: snapshotDate,
            fiscal_year: fy,
            quintile: qKey,
            quintile_name: QUINTILES[qKey].name,
            source_file: filename,
            ...qData
          });
        }
      } catch (error) {
        console.error(`   ❌ Error processing ${filename}: ${error.message}`);
      }
    }
  }

  // Sort by date, then fiscal year, then quintile
  allData.sort((a, b) => {
    if (a.fiscal_year !== b.fiscal_year) return a.fiscal_year.localeCompare(b.fiscal_year);
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.quintile.localeCompare(b.quintile);
  });

  // Write JSON
  const output = {
    generated: new Date().toISOString(),
    note: 'Quintile-level data extracted from YTD Excel files. One entry per (snapshot_date, quintile).',
    record_count: allData.length,
    data: allData
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\n✅ Written ${allData.length} records to ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
