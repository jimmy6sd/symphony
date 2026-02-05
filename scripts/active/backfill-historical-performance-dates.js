/**
 * Backfill Historical Performance Dates (FY23-FY25)
 *
 * This script parses Excel files from data/YTD-Comp-Data/FY23, FY24, FY25
 * and populates the BigQuery ytd_historical_performances table with individual
 * performance records including dates, titles, series, and calculated fiscal/ISO weeks.
 *
 * This enables performance-based attribution for YTD segment analysis.
 *
 * Table: kcsymphony.symphony_dashboard.ytd_historical_performances
 *
 * Usage:
 *   node scripts/active/backfill-historical-performance-dates.js [--dry-run] [--year FY25]
 */

require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Configuration
const DATA_DIR = path.join(__dirname, '../../data/YTD-Comp-Data');

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

// Get fiscal year from date (July 1 - June 30)
// Returns season format like '24-25' for FY25 (July 2024 - June 2025)
function getFiscalYear(date) {
  const month = date.getMonth(); // 0-11
  const year = date.getFullYear();
  // fyYear is the ending year of the fiscal year (e.g., 2025 for FY25)
  const fyYear = month >= 6 ? year + 1 : year;
  // Season format: '24-25' means July 2024 - June 2025
  return `${(fyYear - 1).toString().slice(-2)}-${fyYear.toString().slice(-2)}`;
}

// Get fiscal week (1-52 from July 1)
function getFiscalWeek(date) {
  const year = date.getFullYear();
  const month = date.getMonth();

  let fyStart;
  if (month >= 6) {
    fyStart = new Date(year, 6, 1); // July 1
  } else {
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

// Convert Excel date serial to JavaScript Date
function excelSerialToDate(serial) {
  if (typeof serial !== 'number') return null;
  const utcDays = serial - 25569;
  const utcValue = utcDays * 86400000;
  const dateInfo = new Date(utcValue);
  return new Date(dateInfo.getFullYear(), dateInfo.getMonth(), dateInfo.getDate());
}

// Parse text date range like "Sept. 13-15" or "Oct. 4-6" to start date
function parseDateRange(dateText, fiscalYear) {
  if (!dateText || typeof dateText !== 'string') return null;

  // Determine the calendar year based on fiscal year and month
  // FY25 = July 2024 - June 2025
  // FY24 = July 2023 - June 2024
  // FY23 = July 2022 - June 2023
  const fyNumber = parseInt(fiscalYear.replace('FY', ''));
  const fyStartYear = 2000 + fyNumber - 1; // FY25 starts in 2024

  const monthMap = {
    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'aug': 7, 'sept': 8, 'oct': 9, 'nov': 10, 'dec': 11,
    'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
    'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11
  };

  // Match patterns like "Sept. 13-15" or "Oct. 4-6" or "Jan. 17-19"
  const match = dateText.match(/([A-Za-z]+)\.?\s+(\d{1,2})/);
  if (!match) return null;

  const monthName = match[1].toLowerCase();
  const day = parseInt(match[2]);
  const month = monthMap[monthName];

  if (month === undefined || isNaN(day)) return null;

  // Determine calendar year: July-Dec use fyStartYear, Jan-June use fyStartYear+1
  const calendarYear = month >= 6 ? fyStartYear : fyStartYear + 1;

  return new Date(calendarYear, month, day);
}

// Format date as YYYY-MM-DD
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Sanitize title for performance code
function sanitizeTitle(title) {
  return title
    .replace(/^26\s+/, '') // Remove "26 " prefix
    .replace(/^25\s+/, '') // Remove "25 " prefix
    .replace(/^24\s+/, '') // Remove "24 " prefix
    .replace(/^23\s+/, '') // Remove "23 " prefix
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .toUpperCase()
    .substring(0, 50); // Limit length
}

// Generate performance code from title and date
function generatePerformanceCode(title, date) {
  const sanitized = sanitizeTitle(title);
  const dateStr = formatDate(date);
  return `${sanitized}-${dateStr}`;
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

// Parse a single Excel file and extract performance records
function parseExcelFile(filePath, fiscalYear) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0]; // First sheet
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const performances = [];
  const errors = [];

  // Detect format: FY26 vs FY23-FY25
  // FY26: Has "Performance Date(s)" in row 4
  // FY23-FY25: Has "DATE(S)" in row 3
  let dateColIdx = -1;
  let titleColIdx = -1;
  let seriesColIdx = -1;
  let headerRowIdx = -1;

  // Try FY26 format first (row 4, "Performance Date(s)")
  if (data.length > 4) {
    const row4 = data[4];
    for (let j = 0; j < row4.length; j++) {
      const cell = String(row4[j] || '').trim();
      if (cell.includes('Performance Date')) {
        dateColIdx = j;
        headerRowIdx = 4;
      }
      if (cell === 'Performance') {
        titleColIdx = j;
      }
      if (cell.includes('Performance Type')) {
        seriesColIdx = j;
      }
    }
  }

  // Try FY23-FY25 format (row 3 or row 4, "DATE(S)" or "DATE")
  if (headerRowIdx < 0 && data.length > 3) {
    // Try row 3 first
    let row3 = data[3];
    for (let j = 0; j < row3.length; j++) {
      const cell = String(row3[j] || '').trim().toUpperCase();
      if (cell === 'DATE(S)' || cell === 'DATE') {
        dateColIdx = j;
        headerRowIdx = 3;
      }
    }

    // Try row 4 if row 3 didn't work (FY24 format)
    if (headerRowIdx < 0 && data.length > 4) {
      const row4 = data[4];
      for (let j = 0; j < row4.length; j++) {
        const cell = String(row4[j] || '').trim().toUpperCase();
        if (cell === 'DATE(S)' || cell === 'DATE') {
          dateColIdx = j;
          headerRowIdx = 4;
        }
      }
    }

    // For FY23-FY25, title is in column 1, series is in column 0
    if (dateColIdx >= 0) {
      titleColIdx = 1;
      seriesColIdx = 0;
    }
  }

  if (headerRowIdx < 0 || dateColIdx < 0 || titleColIdx < 0) {
    return { performances: [], errors: [`Could not find required columns in ${path.basename(filePath)}`] };
  }

  // Parse data rows (start from header + 2 for FY26, header + 1 for FY23-FY25)
  const startRow = (headerRowIdx === 3 || headerRowIdx === 4) ? headerRowIdx + 1 : headerRowIdx + 2;

  for (let i = startRow; i < data.length; i++) {
    const row = data[i];

    // Skip empty rows
    if (!row || row.length === 0) continue;

    let title = String(row[titleColIdx] || '').trim();
    const dateValue = row[dateColIdx];
    let series = seriesColIdx >= 0 ? String(row[seriesColIdx] || '').trim() : '';

    // Handle different column structures:
    // Classical: Series in col 0, Title in col 1
    // Pops/Family/Film: Title in col 0, col 1 is empty
    if (!title || title === '') {
      // Try column 0 if column 1 is empty (Pops/Family/Film format)
      title = String(row[0] || '').trim();

      // In this case, series is determined by section context
      if (title && title.length > 0) {
        // Will set series based on title content below
        series = 'Other';
      }
    }

    // Skip if no title or title is a summary/section header row
    if (!title ||
        title === '' ||
        title === 'OPEN' ||
        title.includes('OPEN -') ||
        title.includes('Recording Week') ||
        title.includes('Total') ||
        title.includes('TOTAL') ||
        title.includes('GRAND TOTAL') ||
        title.includes('ALL CONCERTS') ||
        title.toUpperCase() === 'CLASSICAL' ||
        title.toUpperCase() === 'CLASSICAL TRADITIONAL' ||
        title.toUpperCase() === 'SYMPHONIC PIAZZA' ||
        title.toUpperCase().includes('PIAZZA') && title.toUpperCase().includes('TOTAL') ||
        title.toUpperCase() === 'POPS' ||
        title.toUpperCase() === 'FAMILY' ||
        title.toUpperCase() === 'FAMILY SERIES' ||
        title.toUpperCase() === 'FILM' ||
        title.toUpperCase() === 'SERIES') {
      continue;
    }

    // Infer series from title prefix if series is 'Other'
    if (series === 'Other') {
      if (title.match(/^(CS|CS\d+)/)) series = 'Classical';
      else if (title.toLowerCase().includes('piazza')) series = 'Piazza';
      else if (title.toLowerCase().includes('pops') || i >= 31 && i <= 37) series = 'Pops';
      else if (i >= 39 && i <= 44) series = 'Family';
      else if (i >= 46 && i <= 57) series = 'Film';
    }

    // Skip if no date
    if (!dateValue || dateValue === '') continue;

    // Parse date
    let performanceDate;
    if (typeof dateValue === 'number') {
      // Excel serial number (FY26 format)
      performanceDate = excelSerialToDate(dateValue);
    } else if (typeof dateValue === 'string') {
      // Text date (FY23-FY25 format)
      performanceDate = parseDateRange(dateValue, fiscalYear);

      if (!performanceDate) {
        errors.push(`Could not parse date: "${dateValue}" for "${title}"`);
        continue;
      }
    }

    if (!performanceDate || isNaN(performanceDate.getTime())) {
      errors.push(`Invalid date for performance: "${title}" - ${dateValue}`);
      continue;
    }

    // Generate performance code
    const performanceCode = generatePerformanceCode(title, performanceDate);

    // Calculate weeks
    const fiscalWeek = getFiscalWeek(performanceDate);
    const isoWeek = getISOWeek(performanceDate);
    const season = getFiscalYear(performanceDate);

    // Extract revenue and ticket data (FY23-FY25 final reports)
    // Column structure: 5=single revenue, 7=single tickets, 9=subscription revenue,
    // 10=subscription tickets, 12=total revenue, 13=total tickets
    const singleRevenue = parseNumber(row[5]);
    const singleTickets = parseNumber(row[7]);
    const subscriptionRevenue = parseNumber(row[9]);
    const subscriptionTickets = parseNumber(row[10]);
    const totalRevenue = parseNumber(row[12]);
    const totalTickets = parseNumber(row[13]);

    performances.push({
      performance_code: performanceCode,
      title: title,
      performance_date: formatDate(performanceDate),
      season: season,
      series: series || 'Unknown',
      fiscal_week: fiscalWeek,
      iso_week: isoWeek,
      venue: 'Helzberg Hall',
      single_revenue: singleRevenue,
      single_tickets: singleTickets,
      subscription_revenue: subscriptionRevenue,
      subscription_tickets: subscriptionTickets,
      total_revenue: totalRevenue,
      total_tickets: totalTickets
    });
  }

  return { performances, errors };
}

// Process all Excel files in a fiscal year directory
function processYearDirectory(fiscalYear) {
  const yearDir = path.join(DATA_DIR, fiscalYear);

  if (!fs.existsSync(yearDir)) {
    console.log(`⚠️  Directory not found: ${yearDir}`);
    return { performances: [], errors: [], filesProcessed: 0 };
  }

  const files = fs.readdirSync(yearDir)
    .filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'))
    .sort();

  console.log(`\n📁 Processing ${fiscalYear}: ${files.length} Excel files`);

  const allPerformances = new Map(); // Use Map to deduplicate by performance_code
  const allErrors = [];
  let filesProcessed = 0;

  // Process only the LATEST file to get most complete data
  const latestFile = files[files.length - 1];

  if (latestFile) {
    const filePath = path.join(yearDir, latestFile);
    console.log(`   📄 Parsing: ${latestFile}`);

    const { performances, errors } = parseExcelFile(filePath, fiscalYear);

    // Deduplicate by performance_code
    performances.forEach(perf => {
      if (!allPerformances.has(perf.performance_code)) {
        allPerformances.set(perf.performance_code, perf);
      }
    });

    allErrors.push(...errors);
    filesProcessed++;

    console.log(`      ✅ Found ${performances.length} performances`);
    if (errors.length > 0) {
      console.log(`      ⚠️  ${errors.length} parsing errors`);
    }
  }

  return {
    performances: Array.from(allPerformances.values()),
    errors: allErrors,
    filesProcessed
  };
}

// Check for conflicts with existing performance codes
async function checkForConflicts(bigquery, performances) {
  if (performances.length === 0) return [];

  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony';
  const datasetId = 'symphony_dashboard';

  const codes = performances.map(p => `'${p.performance_code}'`).join(',');

  const query = `
    SELECT performance_code
    FROM \`${projectId}.${datasetId}.ytd_historical_performances\`
    WHERE performance_code IN (${codes})
  `;

  const [rows] = await bigquery.query({ query, location: 'US' });
  return rows.map(r => r.performance_code);
}

// Insert performances into BigQuery
async function insertPerformances(bigquery, performances, isDryRun) {
  if (performances.length === 0) {
    console.log('\nℹ️  No performances to insert');
    return { inserted: 0, skipped: 0 };
  }

  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony';
  const datasetId = 'symphony_dashboard';
  const tableId = 'ytd_historical_performances';

  if (isDryRun) {
    console.log('\n🔍 DRY RUN - Would insert:');
    performances.slice(0, 5).forEach(perf => {
      console.log(`   ${perf.performance_code}: ${perf.title} (${perf.performance_date})`);
    });
    if (performances.length > 5) {
      console.log(`   ... and ${performances.length - 5} more`);
    }
    return { inserted: 0, skipped: performances.length };
  }

  // Check for existing performance codes to avoid conflicts
  console.log('\n🔍 Checking for conflicts with existing performance codes...');
  const existingCodes = await checkForConflicts(bigquery, performances);

  if (existingCodes.length > 0) {
    console.log(`⚠️  Found ${existingCodes.length} existing performance codes - skipping those`);
    performances = performances.filter(p => !existingCodes.includes(p.performance_code));
  }

  if (performances.length === 0) {
    console.log('ℹ️  All performances already exist - nothing to insert');
    return { inserted: 0, skipped: existingCodes.length };
  }

  console.log(`\n📝 Inserting ${performances.length} performances into BigQuery...`);

  const table = bigquery.dataset(datasetId).table(tableId);

  // Add created_at timestamp to each row
  const rows = performances.map(p => ({
    ...p,
    created_at: new Date().toISOString()
  }));

  try {
    await table.insert(rows);
    console.log(`✅ Successfully inserted ${rows.length} performances`);
    return { inserted: rows.length, skipped: existingCodes.length };
  } catch (error) {
    if (error.name === 'PartialFailureError') {
      console.error('❌ Some rows failed to insert:');
      error.errors.forEach((err, idx) => {
        console.error(`   Row ${idx}:`, err.errors);
      });
      return { inserted: 0, skipped: existingCodes.length, errors: error.errors };
    }
    throw error;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const yearArg = args.find(arg => arg.startsWith('--year='));
  const specificYear = yearArg ? yearArg.split('=')[1] : null;

  const yearsToProcess = specificYear ? [specificYear] : ['FY23', 'FY24', 'FY25'];

  console.log('═'.repeat(80));
  console.log('📊 Backfill Historical Performance Dates');
  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No data will be inserted into BigQuery');
  }
  console.log('═'.repeat(80));

  const allPerformances = [];
  const allErrors = [];
  let totalFilesProcessed = 0;

  // Process each fiscal year
  for (const fiscalYear of yearsToProcess) {
    const result = processYearDirectory(fiscalYear);
    allPerformances.push(...result.performances);
    allErrors.push(...result.errors);
    totalFilesProcessed += result.filesProcessed;
  }

  console.log('\n' + '═'.repeat(80));
  console.log('📈 PARSING SUMMARY');
  console.log('═'.repeat(80));
  console.log(`   Files processed: ${totalFilesProcessed}`);
  console.log(`   Performances extracted: ${allPerformances.length}`);
  console.log(`   Parsing errors: ${allErrors.length}`);

  // Show errors if any
  if (allErrors.length > 0 && allErrors.length <= 20) {
    console.log('\n⚠️  Parsing errors:');
    allErrors.forEach(err => console.log(`   - ${err}`));
  } else if (allErrors.length > 20) {
    console.log(`\n⚠️  ${allErrors.length} parsing errors (showing first 20):`);
    allErrors.slice(0, 20).forEach(err => console.log(`   - ${err}`));
  }

  // Show sample of performances
  if (allPerformances.length > 0) {
    console.log('\n📊 Sample performances (first 10):');
    allPerformances.slice(0, 10).forEach(perf => {
      console.log(`   ${perf.performance_code}`);
      console.log(`      Title: ${perf.title}`);
      console.log(`      Date: ${perf.performance_date} (FW: ${perf.fiscal_week}, IW: ${perf.iso_week})`);
      console.log(`      Series: ${perf.series}, Venue: ${perf.venue}`);
    });

    if (allPerformances.length > 10) {
      console.log(`   ... and ${allPerformances.length - 10} more`);
    }
  }

  // Insert into BigQuery
  const bigquery = initializeBigQuery();
  const result = await insertPerformances(bigquery, allPerformances, isDryRun);

  console.log('\n' + '═'.repeat(80));
  console.log('✅ BACKFILL COMPLETE');
  console.log('═'.repeat(80));
  console.log(`   Performances inserted: ${result.inserted}`);
  console.log(`   Performances skipped: ${result.skipped}`);

  if (isDryRun) {
    console.log('\n🎯 Next step: Run without --dry-run to insert into BigQuery');
  } else {
    console.log('\n🎯 Next steps:');
    console.log('   1. Verify data: Check BigQuery ytd_historical_performances table');
    console.log('   2. Update API: Modify getYTDComparison() to support performance attribution');
    console.log('   3. Add UI toggle: Update ytd-comparison.html and JavaScript');
  }
}

// Run if executed directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Fatal error:', error);
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = { parseExcelFile, generatePerformanceCode };
