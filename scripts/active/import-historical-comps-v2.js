// Import historical comp data from CSV into BigQuery
// Version 2: Includes new metadata fields (comp_date, atp, subs, capacity, occupancy_percent)
const { BigQuery } = require('@google-cloud/bigquery');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

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

// Clean and parse number (handle spaces, commas)
function parseNumber(str) {
  if (!str || str.trim() === '' || str.trim() === '-') {
    return null;
  }
  const cleaned = str.replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// Parse percentage (remove % sign)
function parsePercent(str) {
  if (!str || str.trim() === '' || str.trim() === '-') {
    return null;
  }
  const cleaned = str.replace(/%/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// Parse ATP (remove $ sign)
function parseATP(str) {
  if (!str || str.trim() === '' || str.trim() === '-') {
    return null;
  }
  const cleaned = str.replace(/\$/g, '').replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// Parse date (format: M/D/YYYY)
function parseDate(str) {
  if (!str || str.trim() === '' || str.trim() === '-') {
    return null;
  }
  try {
    const cleaned = str.trim();
    const date = new Date(cleaned);
    if (isNaN(date.getTime())) {
      return null;
    }
    // Return in YYYY-MM-DD format for BigQuery DATE type
    return date.toISOString().split('T')[0];
  } catch (error) {
    return null;
  }
}

async function clearExistingComps(bigquery) {
  console.log('🗑️  Clearing existing comp data...');

  const deleteQuery = `
    DELETE FROM \`kcsymphony.symphony_dashboard.performance_sales_comparisons\`
    WHERE TRUE
  `;

  await bigquery.query({
    query: deleteQuery,
    location: 'US'
  });

  console.log('✅ Existing comp data cleared!\n');
}

async function importHistoricalComps() {
  try {
    console.log('🚀 Importing historical comp data from CSV (v2 with metadata)...\n');

    // Initialize BigQuery
    const bigquery = new BigQuery({
      projectId: 'kcsymphony',
      keyFilename: path.join(__dirname, '..', '..', 'symphony-bigquery-key.json')
    });

    // Check if we should clear before importing
    const shouldClear = process.argv.includes('--clear') || process.env.CLEAR_BEFORE_IMPORT === 'true';

    if (shouldClear) {
      await clearExistingComps(bigquery);
    }

    // Read NEW CSV file from root
    const csvPath = path.join(__dirname, '..', '..', 'Comps for 25-26 Performances(Sheet1).csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n');

    console.log(`📄 Loaded CSV with ${lines.length} lines\n`);

    // Parse lines
    const rows = lines.map(line => parseCSVLine(line));

    // Extract defaults (row 13 = Global Default, row 14 = Piazza Default)
    const GLOBAL_DEFAULT = rows[12]; // 0-indexed, so row 13 is index 12
    const PIAZZA_DEFAULT = rows[13]; // row 14 is index 13

    console.log('📋 Default Values:');
    console.log(`   Global Default: ${GLOBAL_DEFAULT[2]} (week 10: ${GLOBAL_DEFAULT[4]} -> Final: ${GLOBAL_DEFAULT[15]})`);
    console.log(`   Piazza Default: ${PIAZZA_DEFAULT[2]} (week 10: ${PIAZZA_DEFAULT[4]} -> Final: ${PIAZZA_DEFAULT[15]})`);
    console.log('');

    // Stats tracking
    const stats = {
      imported: 0,
      skipped: 0,
      partialData: 0,
      usedGlobalDefault: 0,
      usedPiazzaDefault: 0,
      withMetadata: 0,
      errors: []
    };

    // Track which performances already have comps to set is_target appropriately
    const performanceComps = new Map(); // performanceId -> count of comps

    // Process data rows (skip headers, notes, defaults - start at row 15, index 14)
    for (let i = 14; i < rows.length; i++) {
      const row = rows[i];

      // Skip empty rows
      if (!row[0] || row[0].trim() === '') {
        continue;
      }

      const performanceId = row[0].trim();
      const performanceDesc = row[1].trim();
      const compDesc = row[2].trim();

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

      // NEW: Parse comp_date from column D (index 3)
      const compDate = parseDate(row[3]);

      // Parse weeks data (columns E-P: indices 4-15)
      // NEW POSITIONS: Column D is comp_date, so weeks start at E (index 4)
      // Weeks: 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, Final
      const weekValues = [];
      let hasData = false;
      let hasPartialData = false;

      for (let j = 4; j <= 15; j++) {
        const value = parseNumber(sourceRow[j]);
        weekValues.push(value);
        if (value !== null) {
          hasData = true;
          // Check if we have partial data (only week 0 and Final)
          if (j >= 14) { // indices 14-15 are week 0 and Final
            hasPartialData = true;
          }
        }
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

      // NEW: Parse metadata (columns P, Q, R, S: indices 16, 17, 18, 19)
      const subs = parseNumber(sourceRow[16]); // Column P
      const capacity = parseNumber(sourceRow[17]); // Column Q
      const occPercent = parsePercent(sourceRow[18]); // Column R
      const atp = parseATP(sourceRow[19]); // Column S

      // Track if we have metadata
      if (compDate || atp || subs || capacity || occPercent) {
        stats.withMetadata++;
      }

      // Determine if this should be the target comp
      // First comp for each performance is the target
      const compCount = performanceComps.get(performanceId) || 0;
      const isTarget = compCount === 0;
      performanceComps.set(performanceId, compCount + 1);

      // Generate comparison ID
      const comparisonId = uuidv4();
      const now = new Date().toISOString();

      // Insert into BigQuery with new metadata fields
      const insertQuery = `
        INSERT INTO \`kcsymphony.symphony_dashboard.performance_sales_comparisons\`
        (comparison_id, performance_id, comparison_name, weeks_data, line_color, line_style, is_target,
         comp_date, atp, subs, capacity, occupancy_percent, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TIMESTAMP(?), TIMESTAMP(?))
      `;

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
            compDate, // NEW
            atp, // NEW
            subs, // NEW
            capacity, // NEW
            occPercent, // NEW
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
            'STRING',  // created_at
            'STRING'   // updated_at
          ],
          location: 'US'
        });

        const targetMarker = isTarget ? '🎯 [TARGET]' : '  ';
        const dataType = !hasFullData && hasPartialData ? '[PARTIAL]' : '';
        const metadataMarker = (compDate || atp) ? '📊' : '';
        console.log(`✅ ${targetMarker} ${performanceId}: ${comparisonName} ${dataType} ${metadataMarker}`);
        stats.imported++;

      } catch (error) {
        console.error(`❌ Error importing ${performanceId}:`, error.message);
        stats.errors.push({ performanceId, error: error.message });
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
    console.log(`🎯 Target comps set:      ${performanceComps.size}`);
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
