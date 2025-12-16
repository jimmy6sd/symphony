// Import comp data from Excel into BigQuery
// Reads from "Comps for 25-26 Performances (2).xlsx" in project root
const { BigQuery } = require('@google-cloud/bigquery');
const { v4: uuidv4 } = require('uuid');
const XLSX = require('xlsx');
const path = require('path');

// Excel column structure (new format with Target column):
// 0: Tess Performance Code
// 1: Target (y = this is THE target comp for projections)
// 2: Performance Desc
// 3: Comp Desc
// 4: Comp Date (Excel date number)
// 5-16: Weeks 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, Final
// 17: Subs
// 18: Capacity
// 19: Total OCC %
// 20: ATP

// Clean and parse number
function parseNumber(val) {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number') return val;
  const cleaned = val.toString().replace(/,/g, '').replace('%', '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// Convert Excel date to ISO string
function excelDateToISO(excelDate) {
  if (!excelDate || typeof excelDate !== 'number') return null;
  const d = new Date((excelDate - 25569) * 86400 * 1000);
  return d.toISOString().split('T')[0];
}

// Colors for comp lines
const COLORS = {
  target: '#ff6b35',   // Orange for THE target comp
  alt1: '#4285f4',     // Blue for first alternative
  alt2: '#9c27b0',     // Purple for second alternative
  alt3: '#00acc1'      // Cyan for third alternative
};

async function importComps() {
  try {
    // Allow passing filename as argument, default to the new file
    const filename = process.argv[2] || 'Comps for 25-26 Performances (2).xlsx';
    const excelPath = path.join(__dirname, '..', '..', filename);

    console.log('🚀 Importing comp data from Excel...');
    console.log(`📄 File: ${filename}\n`);

    // Initialize BigQuery
    const bigquery = new BigQuery({
      projectId: 'kcsymphony',
      keyFilename: path.join(__dirname, '..', '..', 'symphony-bigquery-key.json')
    });

    // Read Excel file
    const wb = XLSX.readFile(excelPath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

    console.log(`📊 Loaded ${rows.length} rows from Excel\n`);

    // Get existing comps to avoid duplicates
    const [existingComps] = await bigquery.query({
      query: 'SELECT performance_id, comparison_name FROM kcsymphony.symphony_dashboard.performance_sales_comparisons',
      location: 'US'
    });
    const existingSet = new Set(existingComps.map(e => `${e.performance_id}|${e.comparison_name}`));
    console.log(`📋 Found ${existingComps.length} existing comps in BigQuery\n`);

    // Extract defaults (row 12 = Global Default, row 13 = Piazza Default in 0-indexed)
    const GLOBAL_DEFAULT = rows[12];
    const PIAZZA_DEFAULT = rows[13];

    console.log('📋 Default Curves:');
    console.log(`   Global Default: weeks 10→Final = ${GLOBAL_DEFAULT.slice(5, 17).map(v => Math.round(v || 0)).join(', ')}`);
    console.log(`   Piazza Default: weeks 10→Final = ${PIAZZA_DEFAULT.slice(5, 17).map(v => Math.round(v || 0)).join(', ')}`);
    console.log('');

    // Stats tracking
    const stats = {
      imported: 0,
      skipped: 0,
      alreadyExists: 0,
      noData: 0,
      targets: 0,
      alternatives: 0,
      usedGlobalDefault: 0,
      usedPiazzaDefault: 0,
      errors: []
    };

    // Track alternative comp count per performance for color assignment
    const altCountByPerf = new Map();

    const now = new Date().toISOString();

    // Process data rows (skip headers/notes - start at row 15, index 14)
    for (let i = 14; i < rows.length; i++) {
      const row = rows[i];

      // Skip empty rows
      if (!row[0] || row[0].toString().trim() === '' || row[0] === 'N/A') {
        continue;
      }

      const performanceId = row[0].toString().trim();
      const isTarget = row[1] === 'y';
      const performanceDesc = row[2] ? row[2].toString().trim() : '';
      const compDesc = row[3] ? row[3].toString().trim() : '';

      // Skip if no comp description
      if (!compDesc) {
        console.log(`⚠️  Skipping ${performanceId} (${performanceDesc}) - No comp assigned`);
        stats.noData++;
        continue;
      }

      // Determine comparison name and data source
      let sourceRow = row;
      let comparisonName = compDesc;

      if (compDesc === 'Piazza Default') {
        sourceRow = PIAZZA_DEFAULT;
        comparisonName = 'Piazza Default (Historical Avg)';
        stats.usedPiazzaDefault++;
      } else if (compDesc === 'Global Default') {
        sourceRow = GLOBAL_DEFAULT;
        comparisonName = 'Global Default (Historical Avg)';
        stats.usedGlobalDefault++;
      }

      // Check if already exists
      const key = `${performanceId}|${comparisonName}`;
      if (existingSet.has(key)) {
        stats.alreadyExists++;
        continue;
      }

      // Parse weeks data (columns 5-16: weeks 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, Final)
      const weekValues = [];
      let hasData = false;

      for (let j = 5; j <= 16; j++) {
        const value = parseNumber(sourceRow[j]);
        weekValues.push(value);
        if (value !== null) hasData = true;
      }

      // Skip if no week data at all
      if (!hasData) {
        console.log(`⚠️  Skipping ${performanceId}: ${comparisonName} - No week data`);
        stats.skipped++;
        continue;
      }

      // Create CSV string for weeks_data (empty string for null values)
      const weeksDataCSV = weekValues.map(v => v !== null ? Math.round(v) : '').join(',');

      // Extract metadata from original row (not default row)
      const compDate = excelDateToISO(row[4]);
      const subs = parseNumber(row[17]);
      const capacity = parseNumber(row[18]);
      const occPercent = parseNumber(row[19]);
      const atp = parseNumber(row[20]);

      // Determine color and style based on target status
      let lineColor, lineStyle;
      if (isTarget) {
        lineColor = COLORS.target;
        lineStyle = 'solid';
        stats.targets++;
      } else {
        // Assign different colors to alternative comps
        const altCount = altCountByPerf.get(performanceId) || 0;
        lineColor = altCount === 0 ? COLORS.alt1 : altCount === 1 ? COLORS.alt2 : COLORS.alt3;
        lineStyle = 'dashed';
        altCountByPerf.set(performanceId, altCount + 1);
        stats.alternatives++;
      }

      // Generate comparison ID
      const comparisonId = uuidv4();

      // Build insert query
      const insertQuery = `
        INSERT INTO kcsymphony.symphony_dashboard.performance_sales_comparisons
        (comparison_id, performance_id, comparison_name, weeks_data, line_color, line_style,
         is_target, created_at, updated_at, comp_date, atp, subs, capacity, occupancy_percent)
        VALUES (?, ?, ?, ?, ?, ?, ?, TIMESTAMP(?), TIMESTAMP(?),
                ${compDate ? `DATE('${compDate}')` : 'NULL'},
                ${atp !== null ? atp : 'NULL'},
                ${subs !== null ? Math.round(subs) : 'NULL'},
                ${capacity !== null ? Math.round(capacity) : 'NULL'},
                ${occPercent !== null ? occPercent : 'NULL'})
      `;

      try {
        await bigquery.query({
          query: insertQuery,
          params: [
            comparisonId,
            performanceId,
            comparisonName,
            weeksDataCSV,
            lineColor,
            lineStyle,
            isTarget,
            now,
            now
          ],
          location: 'US'
        });

        const targetMarker = isTarget ? '🎯 [TARGET]' : '   [alt]';
        console.log(`✅ ${targetMarker} ${performanceId}: ${comparisonName}`);
        stats.imported++;
        existingSet.add(key);

      } catch (error) {
        console.error(`❌ Error importing ${performanceId}:`, error.message);
        stats.errors.push({ performanceId, comparisonName, error: error.message });
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Comps imported:        ${stats.imported}`);
    console.log(`   🎯 Target comps:       ${stats.targets}`);
    console.log(`   📊 Alternative comps:  ${stats.alternatives}`);
    console.log(`⏭️  Already existed:      ${stats.alreadyExists}`);
    console.log(`⚠️  Skipped (no data):    ${stats.skipped + stats.noData}`);
    console.log(`🌍 Used Global default:   ${stats.usedGlobalDefault}`);
    console.log(`🎹 Used Piazza default:   ${stats.usedPiazzaDefault}`);

    if (stats.errors.length > 0) {
      console.log(`\n❌ Errors: ${stats.errors.length}`);
      stats.errors.forEach(err => {
        console.log(`   - ${err.performanceId}: ${err.error}`);
      });
    }

    console.log('\n✅ Import complete!');

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

importComps();
