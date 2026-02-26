/**
 * Import YTD Performance Snapshots (FY24 + FY25)
 *
 * Processes ALL Excel files in data/YTD-Comp-Data/FY24 and FY25 directories,
 * extracting per-performance sales data at each snapshot date. This enables
 * series-level filtering on the YTD comparison page.
 *
 * Table: kcsymphony.symphony_dashboard.ytd_performance_snapshots
 *
 * Usage:
 *   node scripts/active/import-ytd-performance-snapshots.js [--dry-run] [--year FY24|FY25] [--clear]
 */

require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data/YTD-Comp-Data');
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony';
const DATASET_ID = 'symphony_dashboard';
const TABLE_ID = 'ytd_performance_snapshots';

// --- Helpers (shared with backfill script) ---

function getFiscalWeek(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  let fyStart;
  if (month >= 6) {
    fyStart = new Date(year, 6, 1);
  } else {
    fyStart = new Date(year - 1, 6, 1);
  }
  const diffDays = Math.floor((date - fyStart) / (24 * 60 * 60 * 1000));
  return Math.floor(diffDays / 7) + 1;
}

function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function parseDateRange(dateText, fiscalYear) {
  if (!dateText || typeof dateText !== 'string') return null;
  const fyNumber = parseInt(fiscalYear.replace('FY', ''));
  const fyStartYear = 2000 + fyNumber - 1;

  const monthMap = {
    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'aug': 7, 'sept': 8, 'oct': 9, 'nov': 10, 'dec': 11,
    'january': 0, 'february': 1, 'march': 2, 'april': 3, 'june': 5,
    'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11
  };

  const match = dateText.match(/([A-Za-z]+)\.?\s+(\d{1,2})/);
  if (!match) return null;

  const monthName = match[1].toLowerCase();
  const day = parseInt(match[2]);
  const month = monthMap[monthName];
  if (month === undefined || isNaN(day)) return null;

  const calendarYear = month >= 6 ? fyStartYear : fyStartYear + 1;
  return new Date(calendarYear, month, day);
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sanitizeTitle(title) {
  return title
    .replace(/^26\s+/, '').replace(/^25\s+/, '')
    .replace(/^24\s+/, '').replace(/^23\s+/, '')
    .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-')
    .toUpperCase()
    // Normalize: strip trailing -SP suffix (single-performance variant naming)
    .replace(/-SP$/, '')
    .substring(0, 50);
}

function generatePerformanceCode(title, date) {
  return `${sanitizeTitle(title)}-${formatDate(date)}`;
}

function parseNumber(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const str = String(val).trim();
  if (str === '' || str === '-' || str === '#N/A' || str === '#REF!') return null;
  const cleaned = str.replace(/[$,]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// --- Section header detection for series inference ---

const SECTION_PATTERNS = [
  { pattern: /^CLASSICAL/i, series: 'Classical' },
  { pattern: /^SYMPHONIC PIAZZA/i, series: 'Piazza' },
  { pattern: /^POPS/i, series: 'Pops' },
  { pattern: /^FAMILY/i, series: 'Family' },
  { pattern: /^FILM/i, series: 'Film' },
  { pattern: /^ON STAGE/i, series: 'Special' },
  { pattern: /^MATTHIAS/i, series: 'Special' },
  { pattern: /^JUKEBOX/i, series: 'Special' },
  { pattern: /^OTHER/i, series: 'Other' },
];

function detectSeries(text) {
  for (const { pattern, series } of SECTION_PATTERNS) {
    if (pattern.test(text)) return series;
  }
  return null;
}

function isSectionHeader(title) {
  const upper = title.toUpperCase().trim();
  return (
    upper.endsWith('SERIES') ||
    upper.endsWith('SERIES TOTAL') ||
    upper.endsWith('CONCERTS') ||
    upper.endsWith('CONCERTS TOTAL') ||
    upper.endsWith('CONCERT TOTAL') ||
    upper.includes('GRAND TOTAL') ||
    upper === 'CLASSICAL' ||
    upper === 'CLASSICAL TRADITIONAL' ||
    upper === 'POPS' ||
    upper === 'FAMILY' ||
    upper === 'FILM' ||
    upper.includes('PIAZZA TOTAL') ||
    upper.includes('ALL CONCERTS') ||
    /^(CLASSICAL|POPS|FAMILY|FILM|ON STAGE|MATTHIAS|JUKEBOX|OTHER|SYMPHONIC PIAZZA)\b/.test(upper) && (
      upper.includes('TOTAL') || upper.includes('SERIES') || upper.includes('CONCERTS') || !upper.includes(' ')
    )
  );
}

function isSkipRow(title) {
  if (!title) return true;
  const upper = title.toUpperCase().trim();
  return (
    upper === '' ||
    upper === 'OPEN' ||
    upper.includes('OPEN -') ||
    upper.includes('RECORDING WEEK') ||
    upper.includes('TOTAL') ||
    upper.includes('GRAND TOTAL') ||
    upper.includes('ALL CONCERTS')
  );
}

// --- Column detection ---

function detectColumns(data) {
  // Find header row by looking for "DATE" column
  let dateColIdx = -1;
  let headerRowIdx = -1;

  // Try rows 3 and 4 for FY23-FY25 format
  for (const rowIdx of [3, 4]) {
    if (data.length <= rowIdx) continue;
    const row = data[rowIdx];
    for (let j = 0; j < (row?.length || 0); j++) {
      const cell = String(row[j] || '').trim().toUpperCase();
      if (cell === 'DATE(S)' || cell === 'DATE') {
        dateColIdx = j;
        headerRowIdx = rowIdx;
        break;
      }
    }
    if (headerRowIdx >= 0) break;
  }

  if (headerRowIdx < 0) return null;

  // Now find ACTUAL and # SOLD columns by scanning the header row
  // Pattern: each section has BUDGET, ACTUAL, [TO GO/OVER], # SOLD
  const headerRow = data[headerRowIdx];
  const sectionHeaderRow = data[headerRowIdx - 2] || data[headerRowIdx - 1] || [];

  const actualCols = [];
  const soldCols = [];

  for (let j = 0; j < (headerRow?.length || 0); j++) {
    const cell = String(headerRow[j] || '').trim().toUpperCase();
    if (cell === 'ACTUAL') actualCols.push(j);
    if (cell === '# SOLD' || cell === '#SOLD') soldCols.push(j);
  }

  // We expect 3 sections: single, subscription, total
  // Each has one ACTUAL (revenue) and one # SOLD (tickets)
  let singleRevenueCol, singleTicketsCol;
  let subRevenueCol, subTicketsCol;
  let totalRevenueCol, totalTicketsCol;

  if (actualCols.length >= 3 && soldCols.length >= 3) {
    singleRevenueCol = actualCols[0];
    singleTicketsCol = soldCols[0];
    subRevenueCol = actualCols[1];
    subTicketsCol = soldCols[1];
    totalRevenueCol = actualCols[2];
    totalTicketsCol = soldCols[2];
  } else if (actualCols.length >= 1 && soldCols.length >= 1) {
    // Fallback: use last ACTUAL/SOLD as total
    totalRevenueCol = actualCols[actualCols.length - 1];
    totalTicketsCol = soldCols[soldCols.length - 1];
    if (actualCols.length >= 2) {
      singleRevenueCol = actualCols[0];
      singleTicketsCol = soldCols[0];
    }
    if (actualCols.length >= 3) {
      subRevenueCol = actualCols[1];
      subTicketsCol = soldCols[1];
    }
  }

  return {
    headerRowIdx,
    dateColIdx,
    titleColIdx: 1,   // Title always in col 1 for Classical, col 0 for others
    seriesColIdx: 0,   // Series prefix in col 0
    singleRevenueCol,
    singleTicketsCol,
    subRevenueCol,
    subTicketsCol,
    totalRevenueCol,
    totalTicketsCol
  };
}

// --- Parse a single Excel file with section-based series tracking ---

function parseExcelForSnapshots(filePath, fiscalYear) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const performances = [];
  const errors = [];

  const cols = detectColumns(data);
  if (!cols) {
    return { performances: [], errors: [`Could not detect columns in ${path.basename(filePath)}`] };
  }

  const startRow = cols.headerRowIdx + 1;
  let currentSeries = 'Unknown';

  for (let i = startRow; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const col0 = String(row[0] || '').trim();
    let title = String(row[cols.titleColIdx] || '').trim();

    // Check if this row is a section header (e.g., "CLASSICAL SERIES", "POPS SERIES")
    const headerText = col0 || title;
    const detectedSeries = detectSeries(headerText);
    if (detectedSeries && isSectionHeader(headerText)) {
      currentSeries = detectedSeries;
      continue;
    }

    // Check for TOTAL rows (end of section, but don't change series yet)
    if (isSkipRow(col0) && isSkipRow(title)) continue;
    if (isSectionHeader(col0) || isSectionHeader(title)) continue;

    // Determine title: Classical uses col 1 (with series prefix in col 0), others use col 0
    if (!title || title === '') {
      title = col0;
      if (!title || title === '') continue;
    }

    // For Classical series, col 0 has "CS1", "CS2" etc. - series is already set by section header
    // For other series, title is in col 0
    let series = currentSeries;

    // Additional series inference from title content as fallback
    if (series === 'Unknown' || series === 'Other') {
      if (title.match(/^(CS|CS\d+)/i) || col0.match(/^CS\d*/i)) series = 'Classical';
      else if (title.toLowerCase().includes('piazza')) series = 'Piazza';
      else if (title.toLowerCase().includes('film:') || title.toLowerCase().includes('silent film:')) series = 'Film';
    }

    // Parse date
    const dateValue = row[cols.dateColIdx];
    if (!dateValue || dateValue === '') continue;

    let performanceDate;
    if (typeof dateValue === 'number') {
      // Excel serial number
      const utcDays = dateValue - 25569;
      const utcValue = utcDays * 86400000;
      const dateInfo = new Date(utcValue);
      performanceDate = new Date(dateInfo.getFullYear(), dateInfo.getMonth(), dateInfo.getDate());
    } else if (typeof dateValue === 'string') {
      performanceDate = parseDateRange(dateValue, fiscalYear);
      if (!performanceDate) {
        errors.push(`Could not parse date: "${dateValue}" for "${title}"`);
        continue;
      }
    }

    if (!performanceDate || isNaN(performanceDate.getTime())) {
      errors.push(`Invalid date for: "${title}" - ${dateValue}`);
      continue;
    }

    // Extract revenue and ticket data using detected column positions
    const singleRevenue = cols.singleRevenueCol != null ? parseNumber(row[cols.singleRevenueCol]) : null;
    const singleTickets = cols.singleTicketsCol != null ? parseNumber(row[cols.singleTicketsCol]) : null;
    const subRevenue = cols.subRevenueCol != null ? parseNumber(row[cols.subRevenueCol]) : null;
    const subTickets = cols.subTicketsCol != null ? parseNumber(row[cols.subTicketsCol]) : null;
    const totalRevenue = cols.totalRevenueCol != null ? parseNumber(row[cols.totalRevenueCol]) : null;
    const totalTickets = cols.totalTicketsCol != null ? parseNumber(row[cols.totalTicketsCol]) : null;

    const performanceCode = generatePerformanceCode(title, performanceDate);

    performances.push({
      performance_code: performanceCode,
      title,
      series: series || 'Unknown',
      performance_date: formatDate(performanceDate),
      performance_fiscal_week: getFiscalWeek(performanceDate),
      performance_iso_week: getISOWeek(performanceDate),
      single_revenue: singleRevenue,
      single_tickets: singleTickets != null ? Math.round(singleTickets) : null,
      subscription_revenue: subRevenue,
      subscription_tickets: subTickets != null ? Math.round(subTickets) : null,
      total_revenue: totalRevenue,
      total_tickets: totalTickets != null ? Math.round(totalTickets) : null,
    });
  }

  return { performances, errors };
}

// --- Parse snapshot date from filename ---

function parseSnapshotDate(filename) {
  // Pattern: "2023.07.27 FY24 Sales Report.xlsx" → 2023-07-27
  const match = filename.match(/^(\d{4})\.(\d{2})\.(\d{2})/);
  if (!match) return null;
  return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
}

// --- Process all files in a year directory ---

function processYearDirectory(fiscalYear) {
  const yearDir = path.join(DATA_DIR, fiscalYear);
  if (!fs.existsSync(yearDir)) {
    console.log(`  Directory not found: ${yearDir}`);
    return { rows: [], errors: [], filesProcessed: 0 };
  }

  const files = fs.readdirSync(yearDir)
    .filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'))
    .sort();

  console.log(`\n  Processing ${fiscalYear}: ${files.length} Excel files`);

  const allRows = [];
  const allErrors = [];
  let filesProcessed = 0;
  let filesSkipped = 0;

  // Files to skip due to known data quality issues (format transitions, etc.)
  const SKIP_FILES = [
    '2024.10.28',  // FY25: transitional file with inflated multi-night values during SP format change
  ];

  for (const file of files) {
    if (SKIP_FILES.some(s => file.startsWith(s))) {
      console.log(`    ${file} → SKIPPED (known data quality issue)`);
      filesSkipped++;
      continue;
    }

    const snapshotDate = parseSnapshotDate(file);
    if (!snapshotDate) {
      allErrors.push(`Could not parse date from filename: ${file}`);
      filesSkipped++;
      continue;
    }

    const snapshotDateStr = formatDate(snapshotDate);
    const snapshotFiscalWeek = getFiscalWeek(snapshotDate);
    const snapshotIsoWeek = getISOWeek(snapshotDate);

    const filePath = path.join(yearDir, file);
    const { performances, errors } = parseExcelForSnapshots(filePath, fiscalYear);

    for (const perf of performances) {
      allRows.push({
        record_id: `${perf.performance_code}_${snapshotDateStr}`,
        performance_code: perf.performance_code,
        title: perf.title,
        series: perf.series,
        snapshot_date: snapshotDateStr,
        performance_date: perf.performance_date,
        fiscal_year: fiscalYear,
        snapshot_fiscal_week: snapshotFiscalWeek,
        snapshot_iso_week: snapshotIsoWeek,
        performance_fiscal_week: perf.performance_fiscal_week,
        performance_iso_week: perf.performance_iso_week,
        single_revenue: perf.single_revenue,
        single_tickets: perf.single_tickets,
        subscription_revenue: perf.subscription_revenue,
        subscription_tickets: perf.subscription_tickets,
        total_revenue: perf.total_revenue,
        total_tickets: perf.total_tickets,
        created_at: new Date().toISOString(),
      });
    }

    if (errors.length > 0) {
      allErrors.push(...errors.map(e => `[${file}] ${e}`));
    }

    filesProcessed++;
    const seriesCounts = {};
    performances.forEach(p => {
      seriesCounts[p.series] = (seriesCounts[p.series] || 0) + 1;
    });
    const seriesSummary = Object.entries(seriesCounts).map(([s, c]) => `${s}:${c}`).join(', ');
    console.log(`    ${file} → ${performances.length} perfs (${seriesSummary})`);
  }

  return { rows: allRows, errors: allErrors, filesProcessed, filesSkipped };
}

// --- BigQuery operations ---

function initializeBigQuery() {
  const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsEnv) throw new Error('GOOGLE_APPLICATION_CREDENTIALS not set');

  let credentials;
  if (credentialsEnv.startsWith('{')) {
    credentials = JSON.parse(credentialsEnv);
  } else {
    credentials = JSON.parse(fs.readFileSync(path.resolve(credentialsEnv), 'utf8'));
  }
  if (credentials.private_key?.includes('\\n')) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  }

  return new BigQuery({
    projectId: PROJECT_ID,
    credentials: { client_email: credentials.client_email, private_key: credentials.private_key },
    location: 'US'
  });
}

async function clearTable(bigquery, fiscalYear) {
  const condition = fiscalYear ? `WHERE fiscal_year = '${fiscalYear}'` : '';
  const query = `DELETE FROM \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\` ${condition}`;
  console.log(`  Clearing table${fiscalYear ? ` for ${fiscalYear}` : ''}...`);
  await bigquery.query({ query, location: 'US' });
  console.log('  Table cleared.');
}

async function insertRows(bigquery, rows) {
  if (rows.length === 0) return { inserted: 0 };

  const table = bigquery.dataset(DATASET_ID).table(TABLE_ID);
  const BATCH_SIZE = 500;
  let totalInserted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    try {
      await table.insert(batch);
      totalInserted += batch.length;
      if (rows.length > BATCH_SIZE) {
        console.log(`    Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(rows.length / BATCH_SIZE)} (${totalInserted}/${rows.length})`);
      }
    } catch (error) {
      if (error.name === 'PartialFailureError') {
        const failedCount = error.errors?.length || 0;
        console.error(`    Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${failedCount} rows failed`);
        error.errors?.slice(0, 3).forEach((err, idx) => {
          console.error(`      Row: ${JSON.stringify(err.row?.record_id)}, Error: ${JSON.stringify(err.errors)}`);
        });
        totalInserted += (batch.length - failedCount);
      } else {
        throw error;
      }
    }
  }

  return { inserted: totalInserted };
}

// --- Main ---

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const doClear = args.includes('--clear');
  const yearArg = args.find(a => a.startsWith('--year=') || a.startsWith('--year '));
  const specificYear = yearArg ? yearArg.split('=')[1] || args[args.indexOf(yearArg) + 1] : null;

  const yearsToProcess = specificYear ? [specificYear] : ['FY24', 'FY25'];

  console.log('='.repeat(80));
  console.log('Import YTD Performance Snapshots');
  if (isDryRun) console.log('DRY RUN - no data will be written');
  if (doClear) console.log('CLEAR mode - existing data will be deleted first');
  console.log('='.repeat(80));

  let totalRows = [];
  let totalErrors = [];
  let totalFiles = 0;

  for (const fy of yearsToProcess) {
    const result = processYearDirectory(fy);
    totalRows.push(...result.rows);
    totalErrors.push(...result.errors);
    totalFiles += result.filesProcessed;
  }

  // Spike detection: flag individual performance snapshots where revenue jumps
  // more than 3x the previous value AND drops back down at the next snapshot.
  // These are likely data entry errors in the source Excel files.
  const byPerf = {};
  totalRows.forEach(r => {
    if (!byPerf[r.performance_code]) byPerf[r.performance_code] = [];
    byPerf[r.performance_code].push(r);
  });
  let spikeCount = 0;
  for (const [code, rows] of Object.entries(byPerf)) {
    rows.sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
    for (let i = 1; i < rows.length - 1; i++) {
      const prev = rows[i - 1].total_revenue || 0;
      const curr = rows[i].total_revenue || 0;
      const next = rows[i + 1].total_revenue || 0;
      // Spike: jumps >3x previous AND next value is back near previous level
      if (prev > 0 && curr > prev * 3 && next < curr * 0.5) {
        console.log(`  Spike detected: ${code} at ${rows[i].snapshot_date} ($${Math.round(prev).toLocaleString()} → $${Math.round(curr).toLocaleString()} → $${Math.round(next).toLocaleString()}) — replacing with previous`);
        rows[i].total_revenue = prev;
        rows[i].single_revenue = rows[i - 1].single_revenue;
        rows[i].subscription_revenue = rows[i - 1].subscription_revenue;
        rows[i].total_tickets = rows[i - 1].total_tickets;
        rows[i].single_tickets = rows[i - 1].single_tickets;
        rows[i].subscription_tickets = rows[i - 1].subscription_tickets;
        spikeCount++;
      }
    }
  }
  if (spikeCount > 0) {
    console.log(`\n  Spike fixes: ${spikeCount} data entry errors corrected`);
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('PARSING SUMMARY');
  console.log('='.repeat(80));
  console.log(`  Files processed: ${totalFiles}`);
  console.log(`  Total rows: ${totalRows.length}`);
  console.log(`  Parsing errors: ${totalErrors.length}`);

  // Series distribution
  const seriesDist = {};
  totalRows.forEach(r => { seriesDist[r.series] = (seriesDist[r.series] || 0) + 1; });
  console.log('\n  Series distribution:');
  Object.entries(seriesDist).sort((a, b) => b[1] - a[1]).forEach(([s, c]) => {
    console.log(`    ${s}: ${c} rows`);
  });

  // Show unique snapshot dates per year
  for (const fy of yearsToProcess) {
    const dates = [...new Set(totalRows.filter(r => r.fiscal_year === fy).map(r => r.snapshot_date))].sort();
    console.log(`\n  ${fy}: ${dates.length} snapshot dates (${dates[0]} to ${dates[dates.length - 1]})`);
  }

  if (totalErrors.length > 0) {
    console.log(`\n  Errors (first 20):`);
    totalErrors.slice(0, 20).forEach(e => console.log(`    - ${e}`));
  }

  // Sample rows
  console.log('\n  Sample rows:');
  totalRows.slice(0, 5).forEach(r => {
    console.log(`    ${r.record_id}: ${r.series} | rev=${r.total_revenue} | tix=${r.total_tickets}`);
  });

  if (isDryRun) {
    console.log('\nDry run complete. Run without --dry-run to insert into BigQuery.');
    return;
  }

  // Insert into BigQuery
  const bigquery = initializeBigQuery();

  if (doClear) {
    for (const fy of yearsToProcess) {
      await clearTable(bigquery, fy);
    }
  }

  console.log(`\n  Inserting ${totalRows.length} rows into BigQuery...`);
  const result = await insertRows(bigquery, totalRows);

  console.log('\n' + '='.repeat(80));
  console.log('IMPORT COMPLETE');
  console.log('='.repeat(80));
  console.log(`  Rows inserted: ${result.inserted}`);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { parseExcelForSnapshots, parseSnapshotDate };
