// Generate quintile analysis CSVs from YTD Excel files + BigQuery
// Run: node scripts/active/generate-quintile-analysis.js
// Or for specific quintile: node scripts/active/generate-quintile-analysis.js nov-dec
// Or with custom snapshot: node scripts/active/generate-quintile-analysis.js --snapshot 2025-11-16

require('dotenv').config();
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { BigQuery } = require('@google-cloud/bigquery');

const DATA_DIR = path.join(__dirname, '../../data/YTD-Comp-Data');
const OUTPUT_DIR = path.join(__dirname, '../../data/quintile-analysis');

// Initialize BigQuery client
function initBigQuery() {
  const credentialsPath = path.resolve(__dirname, '../../symphony-bigquery-key.json');
  if (!fs.existsSync(credentialsPath)) {
    console.warn('⚠️ BigQuery credentials not found, using Excel only');
    return null;
  }

  const creds = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
  return new BigQuery({
    projectId: 'kcsymphony',
    credentials: { client_email: creds.client_email, private_key: creds.private_key }
  });
}

// Fetch FY26 data from BigQuery for a given snapshot date
async function fetchBigQueryFY26(bigquery, snapshotDate) {
  if (!bigquery) return [];

  const query = `
    SELECT
      p.title,
      p.performance_date,
      p.single_budget_goal as budget,
      p.capacity,
      s.single_revenue as revenue,
      s.single_tickets_sold as ticketsSold,
      s.snapshot_date
    FROM kcsymphony.symphony_dashboard.performances p
    INNER JOIN kcsymphony.symphony_dashboard.performance_sales_snapshots s
      ON p.performance_id = s.performance_id
    WHERE p.season LIKE '25-26%'
      AND s.snapshot_date = (
        SELECT MAX(s2.snapshot_date)
        FROM kcsymphony.symphony_dashboard.performance_sales_snapshots s2
        WHERE s2.performance_id = p.performance_id
          AND s2.snapshot_date <= @snapshotDate
      )
    ORDER BY p.performance_date
  `;

  try {
    const [rows] = await bigquery.query({
      query,
      params: { snapshotDate }
    });

    return rows.map(r => ({
      title: r.title,
      date: r.performance_date?.value ? new Date(r.performance_date.value) : null,
      budget: r.budget,
      revenue: r.revenue,
      ticketsSold: r.ticketsSold,
      capacity: r.capacity,
      source: 'bigquery'
    }));
  } catch (error) {
    console.warn('⚠️ BigQuery query failed:', error.message);
    return [];
  }
}

// Quintile definitions (calendar months)
const QUINTILES = {
  'sep-oct': { name: 'Sep-Oct', months: [9, 10] },
  'nov-dec': { name: 'Nov-Dec (Holiday)', months: [11, 12] },
  'jan-feb': { name: 'Jan-Feb', months: [1, 2] },
  'mar-apr': { name: 'Mar-Apr', months: [3, 4] },
  'may-jun': { name: 'May-Jun', months: [5, 6] }
};

// Snapshot dates for comparison (from Danny's CSV)
const SNAPSHOT_DATES = {
  'FY23': '2022-11-22',
  'FY24': '2023-11-06',
  'FY25': '2024-11-04',
  'FY26': '2025-11-05'
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

// Parse date from Excel serial or string
function parseDate(val) {
  if (!val) return null;

  // Excel serial date
  if (typeof val === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + val * 24 * 60 * 60 * 1000);
  }

  // String date
  const str = String(val).trim();
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

// Parse text date formats like "Sept. 13-15", "Nov. 1-3", "Jan. 24-26"
// Returns first date of the range for quintile assignment
function parseDateText(val, fiscalYear) {
  if (!val) return null;
  const str = String(val).trim();
  if (!str) return null;

  // Try as standard date first
  const directParse = new Date(str);
  if (!isNaN(directParse.getTime())) {
    return directParse;
  }

  // Month abbreviations
  const months = {
    'jan': 0, 'january': 0,
    'feb': 1, 'february': 1,
    'mar': 2, 'march': 2,
    'apr': 3, 'april': 3,
    'may': 4,
    'jun': 5, 'june': 5,
    'jul': 6, 'july': 6,
    'aug': 7, 'august': 7,
    'sep': 8, 'sept': 8, 'september': 8,
    'oct': 9, 'october': 9,
    'nov': 10, 'november': 10,
    'dec': 11, 'december': 11
  };

  // Pattern: "Month. DD-DD" or "Month DD-DD"
  const match = str.match(/([a-zA-Z]+)\.?\s*(\d+)/i);
  if (!match) return null;

  const monthStr = match[1].toLowerCase();
  const day = parseInt(match[2]);

  const month = months[monthStr];
  if (month === undefined || isNaN(day)) return null;

  // Determine year based on fiscal year and month
  // FY25 = July 2024 - June 2025
  const currentYear = new Date().getFullYear();
  let year;

  // If month is July-Dec, it's the first half of the fiscal year (calendar year before FY year)
  // If month is Jan-June, it's the second half (same as FY year)
  if (month >= 6) { // July-Dec
    year = currentYear; // Use current year as default
  } else { // Jan-June
    year = currentYear + 1;
  }

  return new Date(year, month, day);
}

// Get quintile for a performance date
function getQuintile(perfDate) {
  if (!perfDate) return null;
  const month = perfDate.getMonth() + 1; // 1-12

  for (const [key, def] of Object.entries(QUINTILES)) {
    if (def.months.includes(month)) {
      return key;
    }
  }
  return null;
}

// Parse date from filename: "YYYY.MM.DD ... .xlsx"
function parseDateFromFilename(filename) {
  const match = filename.match(/^(\d{4})\.(\d{2})\.(\d{2})/);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}

// Extract per-performance data from FY23/FY24 format
// These have simpler structure: Row 4-5 header with BUDGET | ACTUAL | # SOLD | %CAP
function extractFY23FY24(workbook, filename) {
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const performances = [];

  // Find header row (rows 4-5, 0-indexed 3-4)
  let headerRow = -1;
  let cols = {};

  for (let r = 3; r <= 5; r++) {
    const row = data[r];
    if (!row) continue;

    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] || '').toLowerCase().trim();

      if (cell === 'budget' && !cols.budget) cols.budget = c;
      if (cell === 'actual' && !cols.actual) cols.actual = c;
      if (cell === '# sold' && !cols.sold) cols.sold = c;
      if (cell === '%cap' && !cols.cap) cols.cap = c;
      if (cell === 'title' && !cols.title) cols.title = c;
      if (cell === 'date' && !cols.date) cols.date = c;
      if (cell === 'sellable' || cell.includes('capacity')) {
        if (!cols.capacity) cols.capacity = c;
      }
    }

    if (cols.actual || cols.sold) {
      headerRow = r;
      break;
    }
  }

  if (headerRow < 0) {
    console.log(`  ⚠️ No header found in ${filename}`);
    return performances;
  }

  // Defaults based on FY23/24 typical layout
  if (!cols.title) cols.title = 1;
  if (!cols.date) cols.date = 3;
  if (!cols.budget) cols.budget = 5;
  if (!cols.actual) cols.actual = 6;
  if (!cols.sold) cols.sold = 7;

  // Parse performance rows
  for (let r = headerRow + 1; r < data.length; r++) {
    const row = data[r];
    if (!row) continue;

    const firstCell = String(row[0] || '').trim();

    // Skip empty rows and total rows
    if (!firstCell || firstCell.toLowerCase().includes('total') ||
        firstCell.toLowerCase().includes('all concert')) {
      continue;
    }

    // Skip if no numeric data
    const soldVal = parseNumber(row[cols.sold]);
    const actualVal = parseNumber(row[cols.actual]);
    if (soldVal === null && actualVal === null) continue;

    const perfDate = parseDate(row[cols.date]);

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

// Extract per-performance data from FY25/FY26 format
// FY25/26 layout (based on actual inspection):
// Row 4: Headers - Col 0: Series, Col 1: Title, Col 3: DATE, Col 5: BUDGET, Col 6: ACTUAL, Col 8: # SOLD
function extractFY25FY26(workbook, filename) {
  // Find the right sheet
  const sheetCandidates = ['24 25', '25 26', 'Performances by Week', 'Sheet1'];
  let sheet = null;
  let sheetName = null;

  for (const name of sheetCandidates) {
    if (workbook.Sheets[name]) {
      sheet = workbook.Sheets[name];
      sheetName = name;
      break;
    }
  }
  if (!sheet) {
    sheet = workbook.Sheets[workbook.SheetNames[0]];
    sheetName = workbook.SheetNames[0];
  }

  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const performances = [];

  // Find header row (usually row 4, index 4)
  let headerRow = 4;
  let cols = {};

  // Search rows 3-5 for headers
  for (let r = 3; r <= 5; r++) {
    const row = data[r];
    if (!row) continue;

    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] || '').toLowerCase().trim();

      // Match various header names
      if (cell === 'date' && !cols.date) cols.date = c;
      if (cell === 'budget' && !cols.budget) cols.budget = c;
      if (cell === 'actual' && !cols.actual) cols.actual = c;
      if (cell === '# sold' && !cols.sold) cols.sold = c;
      if (cell.includes('sellable') || cell === 'capacity') cols.capacity = c;
    }

    // If we found key columns, this is our header row
    if (cols.actual || cols.sold || cols.budget) {
      headerRow = r;
      break;
    }
  }

  // Default column positions based on observed FY25 structure
  if (!cols.date) cols.date = 3;
  if (!cols.budget) cols.budget = 5;
  if (!cols.actual) cols.actual = 6;
  if (!cols.sold) cols.sold = 8;
  cols.title = 1; // Title is always col 1

  // Parse performance rows
  for (let r = headerRow + 1; r < data.length; r++) {
    const row = data[r];
    if (!row) continue;

    const firstCell = String(row[0] || '').trim();
    const titleCell = String(row[cols.title] || '').trim();

    // Skip empty rows and total rows
    if (!firstCell && !titleCell) continue;
    if (firstCell.toLowerCase().includes('total') ||
        firstCell.toLowerCase().includes('all concert') ||
        firstCell.toLowerCase().includes('grand total')) {
      continue;
    }

    // Skip section header rows (like "CLASSICAL SERIES", "POPS SERIES", etc.)
    if (firstCell && firstCell.toUpperCase() === firstCell && firstCell.includes(' ')) {
      continue;
    }

    // Get values
    const soldVal = parseNumber(row[cols.sold]);
    const actualVal = parseNumber(row[cols.actual]);

    // Skip if no numeric data
    if (soldVal === null && actualVal === null) continue;

    // Parse the date from text format like "Sept. 13-15" or "Nov. 1-3"
    const perfDate = parseDateText(row[cols.date]);

    performances.push({
      title: titleCell || String(row[1] || '').trim(),
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
function extractFY26PerformancesByWeek(workbook, filename) {
  const sheet = workbook.Sheets['Performances by Week'];
  if (!sheet) return null;

  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const performances = [];

  // FY26 columns (based on inspection):
  // Col 3: Performance title
  // Col 6: Performance Date(s) - Excel serial
  // Col 18: Actual Single Tickets Sold
  // Col 24: Actual Revenue (single)
  // Col 25: BUDGET (single)

  // Start at row 5 (index 5), skip header rows
  for (let r = 5; r < data.length; r++) {
    const row = data[r];
    if (!row) continue;

    const title = String(row[3] || '').trim();
    const dateVal = row[6];
    const ticketsSold = parseNumber(row[18]);
    const revenue = parseNumber(row[24]);
    const budget = parseNumber(row[25]);

    // Skip if no title or no data
    if (!title || (ticketsSold === null && revenue === null)) continue;

    // Skip total/summary rows
    if (title.toLowerCase().includes('total') || title.toLowerCase().includes('grand')) continue;

    // Parse date (Excel serial)
    const perfDate = parseDate(dateVal);

    performances.push({
      title,
      date: perfDate,
      budget,
      revenue,
      ticketsSold,
      capacity: null
    });
  }

  return performances;
}

// Process a single Excel file
function processFile(filePath, filename, fiscalYear) {
  const workbook = XLSX.readFile(filePath);

  let performances;

  // FY26 uses "Performances by Week" sheet format
  if (fiscalYear === 'FY26' && workbook.Sheets['Performances by Week']) {
    performances = extractFY26PerformancesByWeek(workbook, filename);
  } else if (fiscalYear === 'FY23' || fiscalYear === 'FY24') {
    performances = extractFY23FY24(workbook, filename);
  } else {
    performances = extractFY25FY26(workbook, filename);
  }

  return performances;
}

// Aggregate performances by quintile
function aggregateByQuintile(performances, fiscalYear) {
  const quintileData = {};

  for (const perf of performances) {
    const q = getQuintile(perf.date);
    if (!q) continue;

    if (!quintileData[q]) {
      quintileData[q] = {
        performances: [],
        totalRevenue: 0,
        totalBudget: 0,
        totalTickets: 0,
        totalCapacity: 0,
        titles: {}
      };
    }

    const qd = quintileData[q];
    qd.performances.push(perf);
    qd.totalRevenue += perf.revenue || 0;
    qd.totalBudget += perf.budget || 0;
    qd.totalTickets += perf.ticketsSold || 0;
    qd.totalCapacity += perf.capacity || 0;

    // Track title counts
    if (perf.title) {
      const title = perf.title.replace(/\s+/g, ' ').trim();
      qd.titles[title] = (qd.titles[title] || 0) + 1;
    }
  }

  return quintileData;
}

// Format programming list (title counts)
function formatProgramming(titles) {
  return Object.entries(titles)
    .sort((a, b) => b[1] - a[1])
    .map(([title, count]) => `${title} (${count})`)
    .join('; ');
}

// Main
async function main() {
  // Parse command line args
  let targetQuintile = null;
  let customSnapshotDate = null;

  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--snapshot' && process.argv[i + 1]) {
      customSnapshotDate = process.argv[i + 1];
      i++;
    } else if (!process.argv[i].startsWith('--')) {
      targetQuintile = process.argv[i];
    }
  }

  console.log('Quintile Analysis Generator');
  console.log('===========================\n');

  // Initialize BigQuery for FY26 supplemental data
  const bigquery = initBigQuery();
  if (bigquery) {
    console.log('✓ BigQuery connected (supplemental data source)\n');
  }

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const allResults = {};

  // Process each fiscal year
  for (const fy of ['FY23', 'FY24', 'FY25', 'FY26']) {
    // Use custom snapshot date if provided, otherwise use default
    const snapshotDate = customSnapshotDate || SNAPSHOT_DATES[fy];
    if (!snapshotDate) {
      console.log(`⚠️ No snapshot date for ${fy}`);
      continue;
    }

    let performances = [];
    let dataSource = 'excel';

    // For FY26, try BigQuery first if snapshot date is Nov 16+
    if (fy === 'FY26' && bigquery) {
      const bqPerfs = await fetchBigQueryFY26(bigquery, snapshotDate);
      if (bqPerfs.length > 0) {
        performances = bqPerfs;
        dataSource = 'bigquery';
        console.log(`📊 ${fy}: Loaded ${performances.length} performances from BigQuery (snapshot <= ${snapshotDate})`);
      }
    }

    // Fallback to Excel if BigQuery didn't return data
    if (performances.length === 0) {
      const fyDir = path.join(DATA_DIR, fy);
      if (!fs.existsSync(fyDir)) {
        console.log(`⚠️ ${fy} directory not found`);
        continue;
      }

      const snapshotPrefix = snapshotDate.replace(/-/g, '.');
      const files = fs.readdirSync(fyDir).filter(f => f.startsWith(snapshotPrefix));

      if (files.length === 0) {
        console.log(`⚠️ No file found for ${fy} snapshot ${snapshotDate}`);
        continue;
      }

      const filename = files[0];
      console.log(`📁 ${fy}: Processing ${filename} (Excel)`);

      try {
        performances = processFile(path.join(fyDir, filename), filename, fy);
      } catch (error) {
        console.error(`   ❌ Error reading Excel: ${error.message}`);
        continue;
      }
    }

    // Process the performances (from either BigQuery or Excel)
    if (performances.length === 0) {
      console.log(`   ⚠️ No performances found for ${fy}`);
      continue;
    }

    console.log(`   Found ${performances.length} performances`);

    const quintileData = aggregateByQuintile(performances, fy);

    for (const [q, data] of Object.entries(quintileData)) {
      if (!allResults[q]) allResults[q] = {};

      const perfCount = data.performances.length;
      allResults[q][fy] = {
        reportDate: snapshotDate,
        revenue: data.totalRevenue,
        budget: data.totalBudget,
        pctBudget: data.totalBudget > 0 ? (data.totalRevenue / data.totalBudget * 100) : 0,
        perfCount,
        totalSeats: data.totalCapacity,
        seatsSold: data.totalTickets,
        capacityPct: data.totalCapacity > 0 ? (data.totalTickets / data.totalCapacity * 100) : 0,
        atp: data.totalTickets > 0 ? (data.totalRevenue / data.totalTickets) : 0,
        programming: formatProgramming(data.titles),
        dataSource: performances[0]?.source || 'excel',
        // Per-performance normalized
        revenuePerPerf: perfCount > 0 ? data.totalRevenue / perfCount : 0,
        budgetPerPerf: perfCount > 0 ? data.totalBudget / perfCount : 0,
        seatsPerPerf: perfCount > 0 ? data.totalCapacity / perfCount : 0,
        soldPerPerf: perfCount > 0 ? data.totalTickets / perfCount : 0
      };

      console.log(`   ${q}: ${perfCount} perfs, $${Math.round(data.totalRevenue).toLocaleString()} revenue`);
    }
  }

  // Generate CSV for each quintile
  console.log('\n📊 Generating CSVs...\n');

  for (const [quintile, fyData] of Object.entries(allResults)) {
    if (targetQuintile && quintile !== targetQuintile) continue;

    const outputFile = path.join(OUTPUT_DIR, `${quintile}.csv`);

    // Build CSV content
    const lines = [];
    lines.push('FY,Reported Date,Actual Revenue,% to Budget,# Performances,Budget,Total Seats,Seats Sold,Capacity %,ATP,Programming');

    for (const fy of ['FY23', 'FY24', 'FY25', 'FY26']) {
      const d = fyData[fy];
      if (!d) continue;

      lines.push([
        fy,
        d.reportDate,
        Math.round(d.revenue),
        d.pctBudget.toFixed(1) + '%',
        d.perfCount,
        Math.round(d.budget),
        Math.round(d.totalSeats),
        Math.round(d.seatsSold),
        d.capacityPct.toFixed(1) + '%',
        '$' + d.atp.toFixed(2),
        `"${d.programming}"`
      ].join(','));
    }

    // Add per-performance section
    lines.push('');
    lines.push('Per-Performance Normalized');
    lines.push('FY,Revenue/Perf,Budget/Perf,Seats/Perf,Sold/Perf');

    for (const fy of ['FY23', 'FY24', 'FY25', 'FY26']) {
      const d = fyData[fy];
      if (!d) continue;

      lines.push([
        fy,
        Math.round(d.revenuePerPerf),
        Math.round(d.budgetPerPerf),
        Math.round(d.seatsPerPerf),
        Math.round(d.soldPerPerf)
      ].join(','));
    }

    fs.writeFileSync(outputFile, lines.join('\n'));
    console.log(`✅ ${quintile}.csv written`);
  }

  // Generate combined CSV with all quintiles
  const combinedFile = path.join(OUTPUT_DIR, 'all-quintiles-combined.csv');
  const combinedLines = [];

  // Header
  combinedLines.push('Quintile,FY,Reported Date,Actual Revenue,% to Budget,# Performances,Budget,Total Seats,Seats Sold,Capacity %,ATP,Revenue/Perf,Budget/Perf,Sold/Perf');

  // Data rows for each quintile
  const quintileOrder = ['sep-oct', 'nov-dec', 'jan-feb', 'mar-apr', 'may-jun'];
  for (const quintile of quintileOrder) {
    const fyData = allResults[quintile];
    if (!fyData) continue;

    for (const fy of ['FY23', 'FY24', 'FY25', 'FY26']) {
      const d = fyData[fy];
      if (!d) continue;

      combinedLines.push([
        QUINTILES[quintile].name,
        fy,
        d.reportDate,
        Math.round(d.revenue),
        d.pctBudget.toFixed(1) + '%',
        d.perfCount,
        Math.round(d.budget),
        Math.round(d.totalSeats),
        Math.round(d.seatsSold),
        d.capacityPct.toFixed(1) + '%',
        '$' + d.atp.toFixed(2),
        Math.round(d.revenuePerPerf),
        Math.round(d.budgetPerPerf),
        Math.round(d.soldPerPerf)
      ].join(','));
    }
  }

  fs.writeFileSync(combinedFile, combinedLines.join('\n'));
  console.log(`✅ all-quintiles-combined.csv written`);

  console.log('\n✅ Done!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
