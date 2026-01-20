// Process YTD Excel files and populate BigQuery ytd_weekly_totals table
// Run with: node scripts/active/process-ytd-excel-files.js
//
// This script processes weekly sales reports from data/YTD-Comp-Data/
// and extracts YTD totals by fiscal week for year-over-year comparison.

require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Configuration
const DATA_DIR = path.join(__dirname, '../../data/YTD-Comp-Data');
const FISCAL_YEARS = ['FY24', 'FY25', 'FY26']; // FY23 excluded - no subscription breakdown

// Initialize BigQuery client
function initializeBigQuery() {
  const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!credentialsEnv) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable not set');
  }

  let credentials;

  if (credentialsEnv.startsWith('{')) {
    credentials = JSON.parse(credentialsEnv);
  } else {
    const credentialsFile = path.resolve(credentialsEnv);
    const credentialsJson = fs.readFileSync(credentialsFile, 'utf8');
    credentials = JSON.parse(credentialsJson);
  }

  if (credentials.private_key && credentials.private_key.includes('\\n')) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  }

  return new BigQuery({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || credentials.project_id,
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
    location: 'US'
  });
}

// Parse number from Excel (handles commas, $, etc.)
function parseNumber(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : Math.round(val);
  const str = String(val).trim();
  if (str === '' || str === '-' || str === '#N/A' || str === '#REF!') return null;
  const cleaned = str.replace(/[$,]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.round(num);
}

// Parse date from filename: "YYYY.MM.DD ... .xlsx"
function parseDateFromFilename(filename) {
  const match = filename.match(/^(\d{4})\.(\d{2})\.(\d{2})/);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}

// Get fiscal year from date (July 1 - June 30)
function getFiscalYear(date) {
  const month = date.getMonth(); // 0-11
  const year = date.getFullYear();
  // FY starts July 1: July-Dec = FYxx+1, Jan-June = FYxx
  const fyYear = month >= 6 ? year + 1 : year;
  return `FY${fyYear.toString().slice(-2)}`;
}

// Get fiscal week (1-52 from July 1)
function getFiscalWeek(date) {
  const year = date.getFullYear();
  const month = date.getMonth();

  // Determine fiscal year start
  let fyStart;
  if (month >= 6) {
    // July or later - FY starts this year
    fyStart = new Date(year, 6, 1); // July 1
  } else {
    // Jan-June - FY started last year
    fyStart = new Date(year - 1, 6, 1); // July 1 of previous year
  }

  const diffDays = Math.floor((date - fyStart) / (24 * 60 * 60 * 1000));
  return Math.floor(diffDays / 7) + 1;
}

// Get ISO week number
function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Extract YTD totals from Excel workbook
// Uses multiple strategies to handle format variations
function extractYTDFromWorkbook(workbook, filename, reportDate) {
  // Strategy 0: FY25 files use hardcoded column positions (verified manually)
  let result = tryFY25Format(workbook, filename, reportDate);
  if (result) return result;

  // Strategy 1: Try to find GRAND TOTAL row on first sheet (FY24 standard)
  result = tryGrandTotalRow(workbook);
  if (result) return result;

  // Strategy 2: Try "Board" sheet for ALL CONCERTS row (FY26 later files)
  result = tryBoardSheet(workbook);
  if (result) return result;

  // Strategy 3: Sum "Performance by Week" sheet (FY26 early files)
  result = tryFY26PerformanceSheet(workbook);
  if (result) return result;

  // Strategy 4: Try first sheet and look for totals
  result = tryFirstSheet(workbook);
  if (result) return result;

  console.warn(`  ⚠️ Could not parse: ${filename}`);
  return null;
}

// Strategy 0: FY25 files with hardcoded column positions (verified manually)
// Group A (Aug 20 - Oct 28): Single (rev=6, tix=8), Sub (rev=10, tix=11), Total (rev=13, tix=14)
// Group B1 (Nov 4): Same as Group A
// Group B2 (Nov 12+): Single (rev=5, tix=7), Sub (rev=9, tix=10), Total (rev=12, tix=13)
function tryFY25Format(workbook, filename, reportDate) {
  if (!filename.includes('FY25')) return null;
  if (!reportDate) return null;

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Find GRAND TOTAL or ALL CONCERTS row
  let summaryRow = null;
  for (const row of data) {
    const firstCell = String(row[0] || '').toLowerCase().trim();
    if (firstCell === 'grand total' || firstCell === 'all concerts') {
      summaryRow = row;
      break;
    }
  }

  if (!summaryRow) return null;

  // Determine which group based on date
  // Nov 12, 2024 is the cutoff for Group B2
  const nov12 = new Date(2024, 10, 12); // Nov 12, 2024

  let singleTix, singleRev, subTix, subRev, totalTix, totalRev;

  if (reportDate >= nov12) {
    // Group B2: Single (rev=5, tix=7), Sub (rev=9, tix=10), Total (rev=12, tix=13)
    singleTix = parseNumber(summaryRow[7]);
    singleRev = parseNumber(summaryRow[5]);
    subTix = parseNumber(summaryRow[10]);
    subRev = parseNumber(summaryRow[9]);
    totalTix = parseNumber(summaryRow[13]);
    totalRev = parseNumber(summaryRow[12]);
  } else {
    // Group A and B1: Single (rev=6, tix=8), Sub (rev=10, tix=11), Total (rev=13, tix=14)
    singleTix = parseNumber(summaryRow[8]);
    singleRev = parseNumber(summaryRow[6]);
    subTix = parseNumber(summaryRow[11]);
    subRev = parseNumber(summaryRow[10]);
    totalTix = parseNumber(summaryRow[14]);
    totalRev = parseNumber(summaryRow[13]);
  }

  // Calculate totals if not found
  if (!totalTix && (singleTix || subTix)) {
    totalTix = (singleTix || 0) + (subTix || 0);
  }
  if (!totalRev && (singleRev || subRev)) {
    totalRev = (singleRev || 0) + (subRev || 0);
  }

  if (totalTix > 0 || totalRev > 0) {
    return {
      ytd_tickets_sold: totalTix,
      ytd_single_tickets: singleTix,
      ytd_subscription_tickets: subTix,
      ytd_revenue: totalRev,
      ytd_single_revenue: singleRev,
      ytd_subscription_revenue: subRev,
      performance_count: null
    };
  }

  return null;
}

// Strategy 1: Find GRAND TOTAL or ALL CONCERTS row and extract values directly
// This is more robust than summing individual rows, as format changes within rows won't affect the total
function tryGrandTotalRow(workbook) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (data.length < 5) return null;

  // Find section header row (contains "SINGLE TICKETS" and "SUBSCRIPTION")
  let sectionRowIdx = -1;
  let singleSectionCol = -1;
  let subSectionCol = -1;
  let totalSectionCol = -1;

  for (let i = 0; i < Math.min(10, data.length); i++) {
    const row = data[i];
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] || '').toLowerCase();
      if (cell.includes('single ticket') && !cell.includes('sub')) {
        sectionRowIdx = i;
        singleSectionCol = j;
      }
      if (cell.includes('subscription ticket') || (cell.includes('sub') && cell.includes('ticket'))) {
        subSectionCol = j;
      }
      if (cell.includes('total sales') || cell.includes('total (single')) {
        totalSectionCol = j;
      }
    }
    if (singleSectionCol >= 0 && subSectionCol >= 0) break;
  }

  if (singleSectionCol < 0) return null;

  // Find column header row (contains BUDGET, ACTUAL, # SOLD)
  let headerRowIdx = -1;
  let columns = {};

  for (let i = sectionRowIdx + 1; i < Math.min(sectionRowIdx + 5, data.length); i++) {
    const row = data[i];

    // Build column map by finding headers
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] || '').toLowerCase().trim();

      // Track which section we're in
      const inSingleSection = j >= singleSectionCol && (subSectionCol < 0 || j < subSectionCol);
      const inSubSection = subSectionCol >= 0 && j >= subSectionCol && (totalSectionCol < 0 || j < totalSectionCol);
      const inTotalSection = totalSectionCol >= 0 && j >= totalSectionCol;

      if (cell === '# sold' || cell === '#sold' || cell.includes('# sold')) {
        if (inSingleSection && !columns.singleTickets) columns.singleTickets = j;
        else if (inSubSection && !columns.subTickets) columns.subTickets = j;
        else if (inTotalSection && !columns.totalTickets) columns.totalTickets = j;
      }

      if (cell === 'actual') {
        if (inSingleSection && !columns.singleRevenue) columns.singleRevenue = j;
        else if (inSubSection && !columns.subRevenue) columns.subRevenue = j;
        else if (inTotalSection && !columns.totalRevenue) columns.totalRevenue = j;
      }
    }

    // Check if this looks like header row
    const rowText = row.map(c => String(c || '').toLowerCase()).join(' ');
    if (rowText.includes('budget') && rowText.includes('actual')) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx < 0) return null;

  // Find GRAND TOTAL or ALL CONCERTS row
  let summaryRow = null;

  for (let i = headerRowIdx + 1; i < data.length; i++) {
    const row = data[i];
    const firstCell = String(row[0] || '').toLowerCase().trim();

    if (firstCell.includes('grand total') || firstCell === 'all concerts') {
      summaryRow = row;
      break;
    }
  }

  if (!summaryRow) return null;

  // Extract values from summary row
  const singleTickets = columns.singleTickets !== undefined ? parseNumber(summaryRow[columns.singleTickets]) : null;
  const singleRevenue = columns.singleRevenue !== undefined ? parseNumber(summaryRow[columns.singleRevenue]) : null;
  const subTickets = columns.subTickets !== undefined ? parseNumber(summaryRow[columns.subTickets]) : null;
  const subRevenue = columns.subRevenue !== undefined ? parseNumber(summaryRow[columns.subRevenue]) : null;
  let totalTickets = columns.totalTickets !== undefined ? parseNumber(summaryRow[columns.totalTickets]) : null;
  let totalRevenue = columns.totalRevenue !== undefined ? parseNumber(summaryRow[columns.totalRevenue]) : null;

  // Calculate totals if not found in dedicated columns
  if (!totalTickets && (singleTickets || subTickets)) {
    totalTickets = (singleTickets || 0) + (subTickets || 0);
  }
  if (!totalRevenue && (singleRevenue || subRevenue)) {
    totalRevenue = (singleRevenue || 0) + (subRevenue || 0);
  }

  if (totalTickets > 0 || totalRevenue > 0) {
    return {
      ytd_tickets_sold: totalTickets,
      ytd_single_tickets: singleTickets,
      ytd_subscription_tickets: subTickets,
      ytd_revenue: totalRevenue,
      ytd_single_revenue: singleRevenue,
      ytd_subscription_revenue: subRevenue,
      performance_count: null
    };
  }

  return null;
}

// Strategy 3: Parse FY26 "Performance by Week" sheet by summing all performances
// Column positions vary between file formats:
// - Aug files: Sub section at col 21 -> Single rev at 17, Sub tix at 21, Sub rev at 22
// - Sep files: Sub section at col 23 -> Single rev at 19, Sub tix at 23, Sub rev at 24
function tryFY26PerformanceSheet(workbook) {
  // Find the "Performance by Week" sheet
  let sheetName = workbook.SheetNames.find(name =>
    name.toLowerCase().includes('performance') && name.toLowerCase().includes('week')
  );
  if (!sheetName) return null;

  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (data.length < 10) return null;

  // Find where Subscription section starts in row 3 to detect format
  let subSectionStart = 21; // default for Aug files
  const row3 = data[3] || [];
  for (let j = 20; j < 30; j++) {
    const val = String(row3[j] || '').toLowerCase();
    if (val.includes('subscription')) {
      subSectionStart = j;
      break;
    }
  }

  // Determine column positions based on format
  const columns = {
    totalTickets: 8,
    totalRevenue: 11,
    singleTickets: 15,
    singleRevenue: subSectionStart === 21 ? 17 : 19,
    subTickets: subSectionStart,
    subRevenue: subSectionStart + 1
  };

  const headerRowIdx = 4; // Data starts at row 5 (index 5)

  // Sum all performance rows
  let totalTickets = 0, totalRevenue = 0;
  let singleTickets = 0, singleRevenue = 0;
  let subTickets = 0, subRevenue = 0;
  let performanceCount = 0;

  for (let i = headerRowIdx + 1; i < data.length; i++) {
    const row = data[i];

    // Skip empty rows or non-data rows (data rows have week number in col 0)
    const wkNum = row[0];
    if (!wkNum || isNaN(parseInt(wkNum))) continue;

    performanceCount++;

    if (columns.totalTickets !== undefined) {
      const val = parseNumber(row[columns.totalTickets]);
      if (val !== null && val > 0) totalTickets += val;
    }
    if (columns.totalRevenue !== undefined) {
      const val = parseNumber(row[columns.totalRevenue]);
      if (val !== null && val > 0) totalRevenue += val;
    }
    if (columns.singleTickets !== undefined) {
      const val = parseNumber(row[columns.singleTickets]);
      if (val !== null && val > 0) singleTickets += val;
    }
    if (columns.singleRevenue !== undefined) {
      const val = parseNumber(row[columns.singleRevenue]);
      if (val !== null && val > 0) singleRevenue += val;
    }
    if (columns.subTickets !== undefined) {
      const val = parseNumber(row[columns.subTickets]);
      if (val !== null && val > 0) subTickets += val;
    }
    if (columns.subRevenue !== undefined) {
      const val = parseNumber(row[columns.subRevenue]);
      if (val !== null && val > 0) subRevenue += val;
    }
  }

  // Calculate totals if not found directly
  if (totalTickets === 0 && (singleTickets > 0 || subTickets > 0)) {
    totalTickets = singleTickets + subTickets;
  }
  if (totalRevenue === 0 && (singleRevenue > 0 || subRevenue > 0)) {
    totalRevenue = singleRevenue + subRevenue;
  }

  if (totalTickets > 0 || totalRevenue > 0) {
    return {
      ytd_tickets_sold: totalTickets,
      ytd_single_tickets: singleTickets > 0 ? singleTickets : null,
      ytd_subscription_tickets: subTickets > 0 ? subTickets : null,
      ytd_revenue: totalRevenue > 0 ? totalRevenue : null,
      ytd_single_revenue: singleRevenue > 0 ? singleRevenue : null,
      ytd_subscription_revenue: subRevenue > 0 ? subRevenue : null,
      performance_count: performanceCount
    };
  }

  return null;
}

// Strategy 2: Parse "Board" sheet for ALL CONCERTS summary row (FY26 format)
// Board sheet has section headers, then column headers, then data rows ending with ALL CONCERTS
function tryBoardSheet(workbook) {
  if (!workbook.Sheets['Board']) return null;

  const sheet = workbook.Sheets['Board'];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Find section header row (contains SINGLE TICKETS and SUBSCRIPTION TICKETS)
  let sectionRowIdx = -1;
  let singleSectionCol = -1;
  let subSectionCol = -1;

  for (let i = 0; i < Math.min(10, data.length); i++) {
    const row = data[i];
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] || '').toLowerCase();
      if (cell.includes('single ticket') && !cell.includes('sub')) {
        sectionRowIdx = i;
        singleSectionCol = j;
      }
      if (cell.includes('subscription ticket') || (cell.includes('sub') && cell.includes('ticket'))) {
        subSectionCol = j;
      }
    }
    if (singleSectionCol >= 0 && subSectionCol >= 0) break;
  }

  if (singleSectionCol < 0 || subSectionCol < 0) return null;

  // Find column header row (contains BUDGET, ACTUAL, # SOLD)
  let headerRowIdx = -1;
  let columns = {};

  for (let i = sectionRowIdx + 1; i < Math.min(sectionRowIdx + 3, data.length); i++) {
    const row = data[i];
    const rowText = row.map(c => String(c || '').toLowerCase()).join(' ');

    if (rowText.includes('budget') && rowText.includes('actual')) {
      headerRowIdx = i;

      // Map columns - FY26 Board format:
      // Single: BUDGET, ACTUAL, VS. BUDGET, # SOLD
      // Sub: BUDGET, ACTUAL, # SOLD
      // Total: BUDGET, ACTUAL, # SOLD
      for (let j = 0; j < row.length; j++) {
        const cell = String(row[j] || '').toLowerCase().trim();

        const inSingleSection = j >= singleSectionCol && j < subSectionCol;
        const inSubSection = j >= subSectionCol;

        if (cell === '# sold' || cell === '#sold') {
          if (inSingleSection && columns.singleTickets === undefined) columns.singleTickets = j;
          else if (inSubSection && columns.subTickets === undefined) columns.subTickets = j;
          else if (columns.totalTickets === undefined) columns.totalTickets = j;
        }

        if (cell === 'actual') {
          if (inSingleSection && columns.singleRevenue === undefined) columns.singleRevenue = j;
          else if (inSubSection && columns.subRevenue === undefined) columns.subRevenue = j;
          else if (columns.totalRevenue === undefined) columns.totalRevenue = j;
        }
      }
      break;
    }
  }

  if (headerRowIdx < 0) return null;

  // Find ALL CONCERTS row (final summary row)
  let summaryRow = null;

  for (let i = headerRowIdx + 1; i < data.length; i++) {
    const row = data[i];
    const firstCell = String(row[0] || '').toLowerCase().trim();

    if (firstCell === 'all concerts' || firstCell.includes('grand total')) {
      summaryRow = row;
      break;
    }
  }

  if (!summaryRow) return null;

  // Extract values from summary row
  const singleTickets = columns.singleTickets !== undefined ? parseNumber(summaryRow[columns.singleTickets]) : null;
  const singleRevenue = columns.singleRevenue !== undefined ? parseNumber(summaryRow[columns.singleRevenue]) : null;
  const subTickets = columns.subTickets !== undefined ? parseNumber(summaryRow[columns.subTickets]) : null;
  const subRevenue = columns.subRevenue !== undefined ? parseNumber(summaryRow[columns.subRevenue]) : null;
  let totalTickets = columns.totalTickets !== undefined ? parseNumber(summaryRow[columns.totalTickets]) : null;
  let totalRevenue = columns.totalRevenue !== undefined ? parseNumber(summaryRow[columns.totalRevenue]) : null;

  // Calculate totals if not found
  if (!totalTickets && (singleTickets || subTickets)) {
    totalTickets = (singleTickets || 0) + (subTickets || 0);
  }
  if (!totalRevenue && (singleRevenue || subRevenue)) {
    totalRevenue = (singleRevenue || 0) + (subRevenue || 0);
  }

  if (totalTickets > 0 || totalRevenue > 0) {
    return {
      ytd_tickets_sold: totalTickets,
      ytd_single_tickets: singleTickets,
      ytd_subscription_tickets: subTickets,
      ytd_revenue: totalRevenue,
      ytd_single_revenue: singleRevenue,
      ytd_subscription_revenue: subRevenue,
      performance_count: null
    };
  }

  return null;
}

// Strategy 3: Try first sheet
function tryFirstSheet(workbook) {
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Look for any recognizable totals pattern
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const firstCell = String(row[0] || '').toLowerCase();

    if (firstCell.includes('total') || firstCell.includes('ytd')) {
      // Find the largest reasonable number (likely ticket count)
      let maxTickets = 0;
      let revenue = 0;

      for (let j = 1; j < row.length; j++) {
        const val = parseNumber(row[j]);
        if (val !== null && val > 100 && val < 500000) {
          if (val > maxTickets) maxTickets = val;
        }
        if (val !== null && val > 500000) {
          revenue = val;
        }
      }

      if (maxTickets > 0) {
        return {
          ytd_tickets_sold: maxTickets,
          ytd_single_tickets: null,
          ytd_subscription_tickets: null,
          ytd_revenue: revenue > 0 ? revenue : null,
          performance_count: null
        };
      }
    }
  }

  return null;
}

// Check if file should be skipped due to known format issues
function shouldSkipFile(reportDate, fiscalYear) {
  // FY25 Oct 28 file has anomalous subscription data - skip it
  if (fiscalYear === 'FY25' && reportDate.getFullYear() === 2024 &&
      reportDate.getMonth() === 9 && reportDate.getDate() === 28) {
    return 'anomalous subscription data';
  }
  return null;
}

// Process all Excel files for a fiscal year
async function processFiscalYear(fyDir, fiscalYear) {
  const files = fs.readdirSync(fyDir)
    .filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'))
    .sort(); // Sort by filename (date order)

  console.log(`\n📁 Processing ${fiscalYear}: ${files.length} files`);

  const results = [];
  let skippedCount = 0;

  for (const filename of files) {
    const filePath = path.join(fyDir, filename);
    const reportDate = parseDateFromFilename(filename);

    if (!reportDate) {
      console.warn(`  ⚠️ Could not parse date from: ${filename}`);
      continue;
    }

    // Check if file should be skipped
    const skipReason = shouldSkipFile(reportDate, fiscalYear);
    if (skipReason) {
      skippedCount++;
      continue;
    }

    try {
      const workbook = XLSX.readFile(filePath);
      const ytdData = extractYTDFromWorkbook(workbook, filename, reportDate);

      if (ytdData) {
        const fiscalWeek = getFiscalWeek(reportDate);
        const isoWeek = getISOWeek(reportDate);

        results.push({
          record_id: `${fiscalYear}_FW${fiscalWeek}_${reportDate.toISOString().split('T')[0]}`,
          fiscal_year: fiscalYear,
          fiscal_week: fiscalWeek,
          iso_week: isoWeek,
          week_end_date: reportDate.toISOString().split('T')[0],
          ...ytdData,
          source: 'excel-validated-json'
        });

        console.log(`  ✅ ${filename}: FW${fiscalWeek} IW${isoWeek} - ${ytdData.ytd_tickets_sold.toLocaleString()} tickets`);
      }
    } catch (error) {
      console.error(`  ❌ Error processing ${filename}:`, error.message);
    }
  }

  if (skippedCount > 0) {
    console.log(`  ⏭️ Skipped ${skippedCount} files (incompatible format)`);
  }

  return results;
}

// Clear existing data for a fiscal year
async function clearFiscalYear(bigquery, fiscalYear) {
  const datasetId = process.env.BIGQUERY_DATASET || 'symphony_dashboard';
  const query = `DELETE FROM \`kcsymphony.${datasetId}.ytd_weekly_totals\` WHERE fiscal_year = '${fiscalYear}'`;

  try {
    await bigquery.query({ query, location: 'US' });
    console.log(`  🗑️ Cleared existing ${fiscalYear} data`);
  } catch (error) {
    // Table might be empty, that's fine
    if (!error.message.includes('Not found')) {
      console.warn(`  ⚠️ Could not clear ${fiscalYear}:`, error.message);
    }
  }
}

// Insert records into BigQuery
async function insertRecords(bigquery, records) {
  if (records.length === 0) return;

  const datasetId = process.env.BIGQUERY_DATASET || 'symphony_dashboard';
  const tableId = 'ytd_weekly_totals';

  // Add created_at timestamp
  const rows = records.map(r => ({
    ...r,
    created_at: new Date().toISOString()
  }));

  try {
    await bigquery.dataset(datasetId).table(tableId).insert(rows);
    console.log(`  📥 Inserted ${rows.length} records`);
  } catch (error) {
    console.error('❌ Insert error:', error.message);
    if (error.errors) {
      error.errors.forEach((e, i) => {
        console.error(`  Row ${i}:`, e);
      });
    }
    throw error;
  }
}

// Main function
async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('🚀 YTD Excel Processing Script');
  if (dryRun) {
    console.log('🏃 DRY RUN MODE - No data will be written to BigQuery');
  }
  console.log('================================\n');

  const bigquery = dryRun ? null : initializeBigQuery();

  for (const fy of FISCAL_YEARS) {
    const fyDir = path.join(DATA_DIR, fy);

    if (!fs.existsSync(fyDir)) {
      console.log(`⚠️ Directory not found: ${fyDir}`);
      continue;
    }

    // Clear existing data for this FY (skip in dry run)
    if (!dryRun) {
      await clearFiscalYear(bigquery, fy);
    }

    // Process all files
    const records = await processFiscalYear(fyDir, fy);

    // Insert into BigQuery (skip in dry run)
    if (records.length > 0 && !dryRun) {
      await insertRecords(bigquery, records);
    }

    console.log(`✅ ${fy} complete: ${records.length} weekly snapshots`);
  }

  console.log('\n================================');
  console.log(dryRun ? '✅ Dry run complete!' : '✅ All fiscal years processed!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
