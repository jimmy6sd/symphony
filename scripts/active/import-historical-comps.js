// Import historical comp data from CSV into BigQuery
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

async function importHistoricalComps() {
  try {
    console.log('🚀 Importing historical comp data from CSV...\n');

    // Initialize BigQuery
    const bigquery = new BigQuery({
      projectId: 'kcsymphony',
      keyFilename: path.join(__dirname, '..', 'symphony-bigquery-key.json')
    });

    // Read CSV file
    const csvPath = path.join(__dirname, '..', 'Comps for 25-26 Performances.xlsx - Sheet1.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n');

    console.log(`📄 Loaded CSV with ${lines.length} lines\n`);

    // Parse lines
    const rows = lines.map(line => parseCSVLine(line));

    // Extract defaults (row 13 = Global Default, row 14 = Piazza Default)
    const GLOBAL_DEFAULT = rows[12]; // 0-indexed, so row 13 is index 12
    const PIAZZA_DEFAULT = rows[13]; // row 14 is index 13

    console.log('📋 Default Values:');
    console.log(`   Global Default: ${GLOBAL_DEFAULT[2]} (${GLOBAL_DEFAULT[3]} -> ${GLOBAL_DEFAULT[14]})`);
    console.log(`   Piazza Default: ${PIAZZA_DEFAULT[2]} (${PIAZZA_DEFAULT[3]} -> ${PIAZZA_DEFAULT[14]})`);
    console.log('');

    // Stats tracking
    const stats = {
      imported: 0,
      skipped: 0,
      partialData: 0,
      usedGlobalDefault: 0,
      usedPiazzaDefault: 0,
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
      let weeksData;
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

      // Parse weeks data (columns D-O: indices 3-14)
      // Weeks: 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, Final
      const weekValues = [];
      let hasData = false;
      let hasPartialData = false;

      for (let j = 3; j <= 14; j++) {
        const value = parseNumber(sourceRow[j]);
        weekValues.push(value);
        if (value !== null) {
          hasData = true;
          // Check if we have partial data (only week 0 and Final)
          if (j >= 13) { // indices 13-14 are week 0 and Final
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

      // Extract metadata (optional)
      const subs = parseNumber(sourceRow[15]); // Column P
      const capacity = parseNumber(sourceRow[16]); // Column Q
      const occPercent = sourceRow[17] ? sourceRow[17].replace('%', '').trim() : null; // Column R

      // Determine if this should be the target comp
      // First comp for each performance is the target
      const compCount = performanceComps.get(performanceId) || 0;
      const isTarget = compCount === 0;
      performanceComps.set(performanceId, compCount + 1);

      // Generate comparison ID
      const comparisonId = uuidv4();
      const now = new Date().toISOString();

      // Insert into BigQuery
      const insertQuery = `
        INSERT INTO \`kcsymphony.symphony_dashboard.performance_sales_comparisons\`
        (comparison_id, performance_id, comparison_name, weeks_data, line_color, line_style, is_target, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, TIMESTAMP(?), TIMESTAMP(?))
      `;

      try {
        await bigquery.query({
          query: insertQuery,
          params: [
            comparisonId,
            performanceId,
            comparisonName,
            weeksDataCSV,
            isTarget ? '#ff6b35' : '#4285f4', // Orange for target, blue for others
            isTarget ? 'solid' : 'dashed',
            isTarget,
            now,
            now
          ],
          location: 'US'
        });

        const targetMarker = isTarget ? '🎯 [TARGET]' : '  ';
        const dataType = !hasFullData && hasPartialData ? '[PARTIAL]' : '';
        console.log(`✅ ${targetMarker} ${performanceId}: ${comparisonName} ${dataType}`);
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

    if (stats.errors.length > 0) {
      console.log(`\n❌ Errors: ${stats.errors.length}`);
      stats.errors.forEach(err => {
        console.log(`   - ${err.performanceId}: ${err.error}`);
      });
    }

    console.log('\n✅ Import complete!');
    console.log('💡 Next step: Update API to support is_target flag');

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

importHistoricalComps();
