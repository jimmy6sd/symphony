// Import historical comp data from Excel into BigQuery
// Version 2: Includes new metadata fields (comp_date, atp, subs, capacity, occupancy_percent)
// Updated: Now reads Excel (xlsx) files directly instead of CSV
const { BigQuery } = require('@google-cloud/bigquery');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Parse CSV line (handle quoted values with commas)
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}

// Clean and parse number (handle Excel numeric values or string values)
// Rounds to integer since BigQuery expects INT64 for ticket counts
function parseNumber(val) {
  if (val === null || val === undefined || val === '') return null;
  // If already a number, round it to integer
  if (typeof val === 'number') return isNaN(val) ? null : Math.round(val);
  // Handle string values
  const str = String(val).trim();
  if (str === '' || str === '-') return null;
  const cleaned = str.replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.round(num);
}

// Parse percentage (handle Excel decimal or string %)
function parsePercent(val) {
  if (val === null || val === undefined || val === '') return null;
  // If already a number (Excel stores % as decimal, e.g., 0.85 for 85%)
  if (typeof val === 'number') return isNaN(val) ? null : val * 100;
  // Handle string values
  const str = String(val).trim();
  if (str === '' || str === '-') return null;
  const cleaned = str.replace(/%/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// Parse ATP (handle Excel numeric or string $)
function parseATP(val) {
  if (val === null || val === undefined || val === '') return null;
  // If already a number, return it
  if (typeof val === 'number') return isNaN(val) ? null : val;
  // Handle string values
  const str = String(val).trim();
  if (str === '' || str === '-') return null;
  const cleaned = str.replace(/\$/g, '').replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// Parse date (handle Excel serial numbers or string dates)
function parseDate(val) {
  if (val === null || val === undefined || val === '') return null;

  try {
    // If it's a number, it's an Excel serial date (days since Jan 1, 1900)
    if (typeof val === 'number') {
      // Excel date serial to JS date
      // Excel incorrectly treats 1900 as a leap year, so subtract 1 for dates after Feb 28, 1900
      const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
      const date = new Date(excelEpoch.getTime() + val * 24 * 60 * 60 * 1000);
      if (isNaN(date.getTime())) return null;
      return date.toISOString().split('T')[0];
    }

    // Handle string values
    const str = String(val).trim();
    if (str === '' || str === '-') return null;
    const date = new Date(str);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  } catch (error) {
    return null;
  }
}

async function clearExistingComps(bigquery) {
  console.log('🗑️  Clearing imported comp data (preserving manual comparisons)...');

  const deleteQuery = `
    DELETE FROM \`kcsymphony.symphony_dashboard.performance_sales_comparisons\`
    WHERE source = 'excel_import' OR source IS NULL
  `;

  await bigquery.query({
    query: deleteQuery,
    location: 'US'
  });

  console.log('✅ Imported comp data cleared!\n');
}

async function importHistoricalComps() {
  try {
    console.log('🚀 Importing historical comp data from CSV (v2 with metadata)...\n');

    // Initialize BigQuery
    const bigquery = new BigQuery({
      projectId: 'kcsymphony',
      keyFilename: path.join(__dirname, '..', '..', 'symphony-bigquery-key.json')
    });

    // Check flags
    const shouldClear = process.argv.includes('--clear') || process.env.CLEAR_BEFORE_IMPORT === 'true';
    const isDryRun = process.argv.includes('--dry-run');
    const fileArg = process.argv.find(a => a.startsWith('--file='));
    const fileName = fileArg ? fileArg.split('=').slice(1).join('=') : 'Comps for 25-26 Performances.xlsx';

    if (isDryRun) {
      console.log('🔍 DRY RUN MODE - No data will be written to BigQuery\n');
    }

    if (shouldClear && !isDryRun) {
      await clearExistingComps(bigquery);
    }

    // Read Excel file from root
    const excelPath = path.join(__dirname, '..', '..', fileName);
    console.log(`📄 Loading Excel file: ${excelPath}`);

    const workbook = XLSX.readFile(excelPath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    // Convert to array of arrays (each row is an array of cell values)
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    console.log(`📄 Loaded Excel with ${rows.length} rows\n`);

    // Extract defaults (row 13 = Global Default, row 14 = Piazza Default)
    const GLOBAL_DEFAULT = rows[12]; // 0-indexed, so row 13 is index 12
    const PIAZZA_DEFAULT = rows[13]; // row 14 is index 13

    console.log('📋 Default Values:');
    console.log(`   Global Default: ${GLOBAL_DEFAULT[3]} (week 10: ${GLOBAL_DEFAULT[5]} -> week 0: ${GLOBAL_DEFAULT[15]} -> Final: ${GLOBAL_DEFAULT[16]})`);
    console.log(`   Piazza Default: ${PIAZZA_DEFAULT[3]} (week 10: ${PIAZZA_DEFAULT[5]} -> week 0: ${PIAZZA_DEFAULT[15]} -> Final: ${PIAZZA_DEFAULT[16]})`);
    console.log('');

    // Stats tracking
    const stats = {
      imported: 0,
      skipped: 0,
      partialData: 0,
      usedGlobalDefault: 0,
      usedPiazzaDefault: 0,
      withMetadata: 0,
      targetComps: 0,
      errors: []
    };

    // Process data rows (skip headers, notes, defaults - start at row 15, index 14)
    for (let i = 14; i < rows.length; i++) {
      const row = rows[i];

      // Skip empty rows
      if (!row[0] || row[0].trim() === '') {
        continue;
      }

      const performanceId = row[0].trim();
      const targetFlag = String(row[1] || '').trim().toLowerCase(); // Column B - Target designation
      const performanceDesc = row[2] ? String(row[2]).trim() : ''; // Column C - PerfDesc
      const compDesc = row[3] ? String(row[3]).trim() : ''; // Column D - CompDesc

      // Skip if no comp description
      if (!compDesc || compDesc === '') {
        console.log(`⚠️  Skipping ${performanceId} (${performanceDesc}) - No comp data`);
        stats.skipped++;
        continue;
      }

      // Determine weeks data source
      let sourceRow;
      let comparisonName;

      if (compDesc === 'Piazza Default') {
        // Use Piazza Default values
        sourceRow = PIAZZA_DEFAULT;
        comparisonName = 'Piazza Default (Historical Avg)';
        stats.usedPiazzaDefault++;
      } else if (compDesc === 'Global Default') {
        // Use Global Default values
        sourceRow = GLOBAL_DEFAULT;
        comparisonName = 'Global Default (Historical Avg)';
        stats.usedGlobalDefault++;
      } else {
        // Use this row's data
        sourceRow = row;
        comparisonName = compDesc;
      }

      // Parse comp_date from column E (index 4)
      // Column layout: A=PerfCode, B=Target, C=PerfDesc, D=CompDesc, E=CompDate, F-P=Weeks(10-0), Q=Final, R=Subs, S=Capacity, T=OCC%, U=ATP
      const compDate = parseDate(row[4]);

      // Parse weeks data (columns F-P: indices 5-15 for weeks 10-0)
      // Optionally include Final (column Q, index 16) in the array
      // Weeks: 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, [Final]
      const weekValues = [];
      let hasData = false;
      let hasPartialData = false;

      // Weeks 10-0 are in columns F-P (indices 5-15)
      for (let j = 5; j <= 15; j++) {
        const value = parseNumber(sourceRow[j]);
        weekValues.push(value);
        if (value !== null) {
          hasData = true;
          // Check if we have partial data (only week 0)
          if (j >= 15) { // index 15 is week 0
            hasPartialData = true;
          }
        }
      }

      // Also include Final (column Q, index 16) in weeks array for completeness
      const finalValue = parseNumber(sourceRow[16]);
      if (finalValue !== null) {
        weekValues.push(finalValue);
        hasData = true;
      }

      // Skip if no data at all
      if (!hasData) {
        console.log(`⚠️  Skipping ${performanceId} (${performanceDesc}) - No numeric data`);
        stats.skipped++;
        continue;
      }

      // Check if it's only partial data (week 0 + Final)
      const hasFullData = weekValues.slice(0, 11).some(v => v !== null);
      if (!hasFullData && hasPartialData) {
        stats.partialData++;
      }

      // Create CSV string for weeks_data
      // Keep nulls as empty values for partial data
      const weeksDataCSV = weekValues.map(v => v !== null ? v : '').join(',');

      // Parse metadata (columns R, S, T, U: indices 17, 18, 19, 20)
      const subs = parseNumber(sourceRow[17]); // Column R - Subs
      const capacity = parseNumber(sourceRow[18]); // Column S - Capacity
      const occPercent = parsePercent(sourceRow[19]); // Column T - Total OCC %
      const atp = parseATP(sourceRow[20]); // Column U - ATP

      // Track if we have metadata
      if (compDate || atp || subs || capacity || occPercent) {
        stats.withMetadata++;
      }

      // Determine if this should be the target comp using explicit Target column (B)
      // Any non-empty value in Target column marks it as target
      const isTarget = targetFlag !== '';
      if (isTarget) stats.targetComps++;

      // Generate comparison ID
      const comparisonId = uuidv4();
      const now = new Date().toISOString();

      // Insert into BigQuery with new metadata fields
      const insertQuery = `
        INSERT INTO \`kcsymphony.symphony_dashboard.performance_sales_comparisons\`
        (comparison_id, performance_id, comparison_name, weeks_data, line_color, line_style, is_target,
         comp_date, atp, subs, capacity, occupancy_percent, source, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TIMESTAMP(?), TIMESTAMP(?))
      `;

      const targetMarker = isTarget ? '🎯 [TARGET]' : '  ';
      const dataType = !hasFullData && hasPartialData ? '[PARTIAL]' : '';
      const metadataMarker = (compDate || atp) ? '📊' : '';

      if (isDryRun) {
        // Dry run - just show what would be imported
        console.log(`📝 ${targetMarker} ${performanceId}: ${comparisonName} ${dataType} ${metadataMarker}`);
        stats.imported++;
      } else {
        try {
          await bigquery.query({
            query: insertQuery,
            params: [
              comparisonId,
              String(performanceId), // Convert to string for BigQuery
              comparisonName,
              weeksDataCSV,
              isTarget ? '#ff6b35' : '#4285f4', // Orange for target, blue for others
              isTarget ? 'solid' : 'dashed',
              isTarget,
              compDate,
              atp,
              subs,
              capacity,
              occPercent,
              'excel_import', // source
              now,
              now
            ],
            types: [
              'STRING',  // comparison_id
              'STRING',  // performance_id
              'STRING',  // comparison_name
              'STRING',  // weeks_data
              'STRING',  // line_color
              'STRING',  // line_style
              'BOOL',    // is_target
              'DATE',    // comp_date
              'FLOAT64', // atp
              'INT64',   // subs
              'INT64',   // capacity
              'FLOAT64', // occupancy_percent
              'STRING',  // source
              'STRING',  // created_at
              'STRING'   // updated_at
            ],
            location: 'US'
          });

          console.log(`✅ ${targetMarker} ${performanceId}: ${comparisonName} ${dataType} ${metadataMarker}`);
          stats.imported++;

        } catch (error) {
          console.error(`❌ Error importing ${performanceId}:`, error.message);
          stats.errors.push({ performanceId, error: error.message });
        }
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Comps imported:        ${stats.imported}`);
    console.log(`⚠️  Performances skipped: ${stats.skipped} (no comp data)`);
    console.log(`📝 Partial data imports:  ${stats.partialData} (only week 0 + Final)`);
    console.log(`🌍 Global defaults used:  ${stats.usedGlobalDefault}`);
    console.log(`🎹 Piazza defaults used:  ${stats.usedPiazzaDefault}`);
    console.log(`🎯 Target comps set:      ${stats.targetComps}`);
    console.log(`📊 With metadata:         ${stats.withMetadata} (comp_date, ATP, etc.)`);

    if (stats.errors.length > 0) {
      console.log(`\n❌ Errors: ${stats.errors.length}`);
      stats.errors.forEach(err => {
        console.log(`   - ${err.performanceId}: ${err.error}`);
      });
    }

    console.log('\n✅ Import complete!');
    console.log('💡 New metadata fields imported: comp_date, atp, subs, capacity, occupancy_percent');

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

importHistoricalComps();
