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
const FISCAL_YEARS = ['FY23', 'FY24', 'FY25', 'FY26'];

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
function extractYTDFromWorkbook(workbook, filename) {
  // Strategy 1: Try "Performances by Week" sheet and sum totals
  let result = tryPerformancesByWeekSheet(workbook);
  if (result) return result;

  // Strategy 2: Try "Board" sheet for summary row
  result = tryBoardSheet(workbook);
  if (result) return result;

  // Strategy 3: Try first sheet and look for totals
  result = tryFirstSheet(workbook);
  if (result) return result;

  console.warn(`  ⚠️ Could not parse: ${filename}`);
  return null;
}

// Strategy 1: Parse "Performances by Week" sheet
function tryPerformancesByWeekSheet(workbook) {
  const sheetNames = ['Performances by Week', 'Performances By Week', 'PerformancesByWeek'];

  for (const sheetName of sheetNames) {
    if (!workbook.Sheets[sheetName]) continue;

    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (data.length < 2) continue;

    // Find header row (look for "Actual Tickets" or similar)
    let headerRowIdx = -1;
    let ticketsColIdx = -1;
    let revenueColIdx = -1;
    let singleColIdx = -1;
    let subsColIdx = -1;

    for (let i = 0; i < Math.min(20, data.length); i++) {
      const row = data[i];
      for (let j = 0; j < row.length; j++) {
        const cell = String(row[j] || '').toLowerCase();
        if (cell.includes('actual') && cell.includes('ticket')) {
          headerRowIdx = i;
          ticketsColIdx = j;
        }
        if (cell.includes('actual') && cell.includes('rev')) {
          revenueColIdx = j;
        }
        if (cell.includes('single') && cell.includes('ticket')) {
          singleColIdx = j;
        }
        if (cell.includes('sub') && cell.includes('ticket')) {
          subsColIdx = j;
        }
      }
      if (headerRowIdx >= 0) break;
    }

    if (headerRowIdx < 0) continue;

    // Sum all data rows
    let totalTickets = 0;
    let totalRevenue = 0;
    let totalSingle = 0;
    let totalSubs = 0;
    let performanceCount = 0;

    for (let i = headerRowIdx + 1; i < data.length; i++) {
      const row = data[i];

      // Skip empty rows or total rows
      if (!row[0] || String(row[0]).toLowerCase().includes('total')) continue;

      const tickets = parseNumber(row[ticketsColIdx]);
      if (tickets !== null && tickets > 0) {
        totalTickets += tickets;
        performanceCount++;
      }

      if (revenueColIdx >= 0) {
        const revenue = parseNumber(row[revenueColIdx]);
        if (revenue !== null) totalRevenue += revenue;
      }

      if (singleColIdx >= 0) {
        const single = parseNumber(row[singleColIdx]);
        if (single !== null) totalSingle += single;
      }

      if (subsColIdx >= 0) {
        const subs = parseNumber(row[subsColIdx]);
        if (subs !== null) totalSubs += subs;
      }
    }

    if (totalTickets > 0) {
      return {
        ytd_tickets_sold: totalTickets,
        ytd_single_tickets: totalSingle > 0 ? totalSingle : null,
        ytd_subscription_tickets: totalSubs > 0 ? totalSubs : null,
        ytd_revenue: totalRevenue > 0 ? totalRevenue : null,
        performance_count: performanceCount
      };
    }
  }

  return null;
}

// Strategy 2: Parse "Board" sheet for summary
function tryBoardSheet(workbook) {
  const sheetNames = ['Board', 'Summary', 'Summary (Draft)'];

  for (const sheetName of sheetNames) {
    if (!workbook.Sheets[sheetName]) continue;

    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    // Look for a "Total" row
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const firstCell = String(row[0] || '').toLowerCase();

      if (firstCell.includes('total') || firstCell.includes('grand total')) {
        // Try to find numeric columns
        let maxTickets = 0;
        let revenue = 0;

        for (let j = 1; j < row.length; j++) {
          const val = parseNumber(row[j]);
          if (val !== null && val > maxTickets && val < 1000000) {
            maxTickets = val;
          }
          // Revenue is typically larger
          if (val !== null && val > 1000000) {
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

// Process all Excel files for a fiscal year
async function processFiscalYear(fyDir, fiscalYear) {
  const files = fs.readdirSync(fyDir)
    .filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'))
    .sort(); // Sort by filename (date order)

  console.log(`\n📁 Processing ${fiscalYear}: ${files.length} files`);

  const results = [];

  for (const filename of files) {
    const filePath = path.join(fyDir, filename);
    const reportDate = parseDateFromFilename(filename);

    if (!reportDate) {
      console.warn(`  ⚠️ Could not parse date from: ${filename}`);
      continue;
    }

    try {
      const workbook = XLSX.readFile(filePath);
      const ytdData = extractYTDFromWorkbook(workbook, filename);

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
          source: 'excel_import'
        });

        console.log(`  ✅ ${filename}: FW${fiscalWeek} IW${isoWeek} - ${ytdData.ytd_tickets_sold.toLocaleString()} tickets`);
      }
    } catch (error) {
      console.error(`  ❌ Error processing ${filename}:`, error.message);
    }
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
  console.log('🚀 YTD Excel Processing Script');
  console.log('================================\n');

  const bigquery = initializeBigQuery();

  for (const fy of FISCAL_YEARS) {
    const fyDir = path.join(DATA_DIR, fy);

    if (!fs.existsSync(fyDir)) {
      console.log(`⚠️ Directory not found: ${fyDir}`);
      continue;
    }

    // Clear existing data for this FY
    await clearFiscalYear(bigquery, fy);

    // Process all files
    const records = await processFiscalYear(fyDir, fy);

    // Insert into BigQuery
    if (records.length > 0) {
      await insertRecords(bigquery, records);
    }

    console.log(`✅ ${fy} complete: ${records.length} weekly snapshots`);
  }

  console.log('\n================================');
  console.log('✅ All fiscal years processed!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
