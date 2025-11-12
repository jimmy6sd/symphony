const XLSX = require('xlsx');
const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

// Parse number (handle spaces, commas)
function parseNumber(str) {
  if (!str) return null;
  if (typeof str === 'number') return str;
  const strVal = str.toString().trim();
  if (strVal === '' || strVal === '-') return null;
  const cleaned = strVal.replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// Parse percentage
function parsePercent(str) {
  if (!str) return null;
  if (typeof str === 'number') return str;
  const strVal = str.toString().trim();
  if (strVal === '' || strVal === '-') return null;
  const cleaned = strVal.replace(/%/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// Parse ATP
function parseATP(str) {
  if (!str) return null;
  if (typeof str === 'number') return str;
  const strVal = str.toString().trim();
  if (strVal === '' || strVal === '-') return null;
  const cleaned = strVal.replace(/\$/g, '').replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// Parse date
function parseDate(str) {
  if (!str) return null;
  const strVal = str.toString().trim();
  if (strVal === '' || strVal === '-') return null;
  try {
    const date = new Date(strVal);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  } catch (error) {
    return null;
  }
}

async function compareCompValues() {
  try {
    console.log('🔍 Reading Excel file and comparing with BigQuery data...\n');

    // Initialize BigQuery
    const bigquery = new BigQuery({
      projectId: 'kcsymphony',
      keyFilename: path.join(__dirname, '..', 'symphony-bigquery-key.json')
    });

    // Read Excel file
    const excelPath = path.join(__dirname, '..', 'Comps for 25-26 Performances.xlsx');
    const workbook = XLSX.readFile(excelPath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const range = XLSX.utils.decode_range(sheet['!ref']);

    // Get defaults
    const GLOBAL_DEFAULT = [];
    const PIAZZA_DEFAULT = [];
    for (let col = 0; col <= 19; col++) {
      const globalCell = sheet[XLSX.utils.encode_cell({ r: 12, c: col })];
      const piazzaCell = sheet[XLSX.utils.encode_cell({ r: 13, c: col })];
      GLOBAL_DEFAULT.push(globalCell ? globalCell.v : '');
      PIAZZA_DEFAULT.push(piazzaCell ? piazzaCell.v : '');
    }

    // Parse Excel data
    const excelComps = new Map(); // performanceId -> comp data

    for (let row = 14; row <= range.e.r; row++) {
      const cells = [];
      for (let col = 0; col <= 19; col++) {
        const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
        cells.push(cell ? cell.v : '');
      }

      const performanceId = cells[0] ? cells[0].toString().trim() : '';
      const compDesc = cells[2] ? cells[2].toString().trim() : '';

      if (!performanceId || !compDesc) continue;

      // Determine source row
      let sourceRow = cells;
      if (compDesc === 'Piazza Default') {
        sourceRow = PIAZZA_DEFAULT;
      } else if (compDesc === 'Global Default') {
        sourceRow = GLOBAL_DEFAULT;
      }

      // Parse weeks data (columns E-P: indices 4-15)
      const weekValues = [];
      for (let j = 4; j <= 15; j++) {
        const value = parseNumber(sourceRow[j]);
        weekValues.push(value);
      }
      const weeksDataCSV = weekValues.map(v => v !== null ? v : '').join(',');

      // Parse metadata
      const compDate = parseDate(cells[3]);
      const subs = parseNumber(sourceRow[16]);
      const capacity = parseNumber(sourceRow[17]);
      const occPercent = parsePercent(sourceRow[18]);
      const atp = parseATP(sourceRow[19]);

      excelComps.set(performanceId, {
        performanceId,
        comparisonName: compDesc === 'Piazza Default' ? 'Piazza Default (Historical Avg)' :
                        compDesc === 'Global Default' ? 'Global Default (Historical Avg)' : compDesc,
        weeksData: weeksDataCSV,
        compDate,
        atp,
        subs,
        capacity,
        occupancyPercent: occPercent
      });
    }

    console.log(`📄 Parsed ${excelComps.size} performances from Excel\n`);

    // Query BigQuery for current data
    const query = `
      SELECT
        performance_id,
        comparison_name,
        weeks_data,
        comp_date,
        atp,
        subs,
        capacity,
        occupancy_percent,
        is_target
      FROM \`kcsymphony.symphony_dashboard.performance_sales_comparisons\`
      WHERE is_target = TRUE
      ORDER BY performance_id
    `;

    const [rows] = await bigquery.query({ query, location: 'US' });
    console.log(`💾 Retrieved ${rows.length} target comps from BigQuery\n`);

    // Compare
    const differences = [];
    const newPerformances = [];
    const removedPerformances = [];

    // Check for changes and new performances
    for (const [perfId, excelData] of excelComps.entries()) {
      const dbRow = rows.find(r => r.performance_id === perfId);

      if (!dbRow) {
        newPerformances.push(perfId);
        continue;
      }

      const diffs = [];

      if (excelData.weeksData !== dbRow.weeks_data) {
        diffs.push(`weeks_data: "${dbRow.weeks_data}" -> "${excelData.weeksData}"`);
      }

      if (excelData.compDate !== (dbRow.comp_date ? dbRow.comp_date.value : null)) {
        diffs.push(`comp_date: ${dbRow.comp_date ? dbRow.comp_date.value : 'null'} -> ${excelData.compDate || 'null'}`);
      }

      if (excelData.atp !== dbRow.atp) {
        diffs.push(`atp: ${dbRow.atp} -> ${excelData.atp}`);
      }

      if (excelData.subs !== dbRow.subs) {
        diffs.push(`subs: ${dbRow.subs} -> ${excelData.subs}`);
      }

      if (excelData.capacity !== dbRow.capacity) {
        diffs.push(`capacity: ${dbRow.capacity} -> ${excelData.capacity}`);
      }

      if (excelData.occupancyPercent !== dbRow.occupancy_percent) {
        diffs.push(`occupancy_percent: ${dbRow.occupancy_percent} -> ${excelData.occupancyPercent}`);
      }

      if (diffs.length > 0) {
        differences.push({ performanceId: perfId, changes: diffs });
      }
    }

    // Check for removed performances
    for (const dbRow of rows) {
      if (!excelComps.has(dbRow.performance_id)) {
        removedPerformances.push(dbRow.performance_id);
      }
    }

    // Report findings
    console.log('='.repeat(100));
    console.log('📊 COMPARISON RESULTS');
    console.log('='.repeat(100));
    console.log('');

    if (newPerformances.length > 0) {
      console.log(`✨ NEW PERFORMANCES IN EXCEL (${newPerformances.length}):`);
      newPerformances.forEach(p => console.log(`   - ${p}`));
      console.log('');
    }

    if (removedPerformances.length > 0) {
      console.log(`❌ REMOVED FROM EXCEL (${removedPerformances.length}):`);
      removedPerformances.forEach(p => console.log(`   - ${p}`));
      console.log('');
    }

    if (differences.length > 0) {
      console.log(`🔄 CHANGED VALUES (${differences.length} performances):`);
      differences.forEach(({ performanceId, changes }) => {
        console.log(`\n   ${performanceId}:`);
        changes.forEach(change => console.log(`      • ${change}`));
      });
      console.log('');
    }

    if (differences.length === 0 && newPerformances.length === 0 && removedPerformances.length === 0) {
      console.log('✅ NO CHANGES - Excel data matches BigQuery exactly');
      console.log('');
    }

    console.log('='.repeat(100));
    console.log('📋 SUMMARY:');
    console.log(`   New performances: ${newPerformances.length}`);
    console.log(`   Removed performances: ${removedPerformances.length}`);
    console.log(`   Changed values: ${differences.length}`);
    console.log(`   Total changes: ${newPerformances.length + removedPerformances.length + differences.length}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

compareCompValues();
