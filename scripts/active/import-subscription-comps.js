/**
 * Import Subscription Historical Comparisons from Excel to BigQuery
 *
 * Parses the KCS Sub Tracker Excel file and imports historical subscription
 * data into BigQuery for use in the subscription sales curve chart.
 *
 * Usage: node scripts/active/import-subscription-comps.js
 */

const XLSX = require('xlsx');
const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

// Configuration
const EXCEL_FILE = path.join(__dirname, '../../KCS 25-26 Sub Tracker (1).xlsx');
const PROJECT_ID = 'kcsymphony';
const DATASET_ID = 'symphony_dashboard';
const TABLE_ID = 'subscription_historical_data';

// Initialize BigQuery
const bigquery = new BigQuery({ projectId: PROJECT_ID });

/**
 * Convert Excel serial date to JavaScript Date
 */
function excelDateToJS(excelDate) {
    if (!excelDate || typeof excelDate !== 'number') return null;
    const date = new Date((excelDate - 25569) * 86400000);
    return date;
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date) {
    if (!date) return null;
    return date.toISOString().split('T')[0];
}

/**
 * Get ISO week number from date
 */
function getWeekNumber(date) {
    if (!date) return null;
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Determine season from date (e.g., "24-25" for dates from July 2024 to June 2025)
 */
function getSeason(date) {
    if (!date) return null;
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-11

    // Season runs roughly July to June
    // If month is July (6) or later, it's the start of a new season
    if (month >= 6) {
        // July 2024 -> "24-25"
        return `${String(year).slice(-2)}-${String(year + 1).slice(-2)}`;
    } else {
        // January 2025 -> "24-25"
        return `${String(year - 1).slice(-2)}-${String(year).slice(-2)}`;
    }
}

/**
 * Parse a row of weekly data
 * @param {Array} row - The Excel row data
 * @param {number} startCol - Starting column index
 * @param {string} series - 'Classical' or 'Pops'
 * @param {string} seasonOverride - Optional season override (for when date parsing fails)
 */
function parseWeeklyRow(row, startCol, series, seasonOverride = null) {
    const dateValue = row[startCol];
    const date = excelDateToJS(dateValue);

    if (!date) return null;

    const newUnits = row[startCol + 1] || 0;
    const newRevenue = row[startCol + 2] || 0;
    const renewalUnits = row[startCol + 3] || 0;
    const renewalRevenue = row[startCol + 4] || 0;
    const totalUnits = row[startCol + 5] || 0;
    const totalRevenue = row[startCol + 6] || 0;

    // Skip rows with no meaningful data
    if (totalUnits === 0 && totalRevenue === 0) return null;

    return {
        series: series,
        season: seasonOverride || getSeason(date),
        snapshot_date: formatDate(date),
        new_units: Math.round(newUnits),
        new_revenue: Math.round(newRevenue * 100) / 100,
        renewal_units: Math.round(renewalUnits),
        renewal_revenue: Math.round(renewalRevenue * 100) / 100,
        total_units: Math.round(totalUnits),
        total_revenue: Math.round(totalRevenue * 100) / 100,
        week_number: getWeekNumber(date),
        is_final: false
    };
}

/**
 * Parse the Excel file and extract subscription data
 */
function parseExcelFile() {
    console.log('📖 Reading Excel file:', EXCEL_FILE);
    const workbook = XLSX.readFile(EXCEL_FILE);

    const allData = [];

    // Parse Sheet1 for Classical and Pops current year
    const sheet1 = workbook.Sheets['Sheet1'];
    const sheet1Data = XLSX.utils.sheet_to_json(sheet1, { header: 1 });

    console.log('\n📊 Parsing Sheet1...');

    // Classical section starts at row 3, data starts at row 8
    // 25-26 data: columns 0-7
    // 24-25 data: columns 9-16
    console.log('  Processing Classical from Sheet1...');
    for (let i = 8; i < sheet1Data.length; i++) {
        const row = sheet1Data[i];
        if (!row || row.length === 0) continue;

        // Check if we've hit the Pops section (row with "Pops" header)
        if (row[0] === 'Pops') break;

        // 25-26 Classical data
        const data2526 = parseWeeklyRow(row, 0, 'Classical', '25-26');
        if (data2526) allData.push(data2526);

        // 24-25 Classical data
        const data2425 = parseWeeklyRow(row, 9, 'Classical', '24-25');
        if (data2425) allData.push(data2425);
    }

    // Pops section starts around row 21, data starts at row 26
    console.log('  Processing Pops from Sheet1...');
    let popsStartRow = -1;
    for (let i = 0; i < sheet1Data.length; i++) {
        if (sheet1Data[i] && sheet1Data[i][0] === 'Pops') {
            popsStartRow = i + 5; // Data starts 5 rows after header
            break;
        }
    }

    if (popsStartRow > 0) {
        for (let i = popsStartRow; i < sheet1Data.length; i++) {
            const row = sheet1Data[i];
            if (!row || row.length === 0) continue;

            // 25-26 Pops data
            const data2526 = parseWeeklyRow(row, 0, 'Pops', '25-26');
            if (data2526) allData.push(data2526);

            // 24-25 Pops data
            const data2425 = parseWeeklyRow(row, 9, 'Pops', '24-25');
            if (data2425) allData.push(data2425);
        }
    }

    // Parse Pops sheet for additional historical data (23-24)
    const popsSheet = workbook.Sheets['Pops'];
    if (popsSheet) {
        const popsData = XLSX.utils.sheet_to_json(popsSheet, { header: 1 });
        console.log('\n📊 Parsing Pops sheet for 23-24 historical data...');

        for (let i = 0; i < popsData.length; i++) {
            const row = popsData[i];
            if (!row || row.length < 26) continue;

            // 23-24 data is in columns 18-25
            const data2324 = parseWeeklyRow(row, 18, 'Pops', '23-24');
            if (data2324) allData.push(data2324);

            // Also get 25-26 and 24-25 from this sheet if present (more complete data)
            const data2526 = parseWeeklyRow(row, 0, 'Pops', '25-26');
            const data2425 = parseWeeklyRow(row, 9, 'Pops', '24-25');

            // Only add if not already present (avoid duplicates)
            if (data2526 && !allData.find(d =>
                d.series === 'Pops' &&
                d.season === '25-26' &&
                d.snapshot_date === data2526.snapshot_date
            )) {
                allData.push(data2526);
            }
            if (data2425 && !allData.find(d =>
                d.series === 'Pops' &&
                d.season === '24-25' &&
                d.snapshot_date === data2425.snapshot_date
            )) {
                allData.push(data2425);
            }
        }
    }

    // Check for CL Data sheet for Classical 23-24 data
    const clSheet = workbook.Sheets['CL Data'];
    if (clSheet) {
        const clData = XLSX.utils.sheet_to_json(clSheet, { header: 1 });
        console.log('\n📊 Parsing CL Data sheet for Classical 23-24 historical data...');

        for (let i = 0; i < clData.length; i++) {
            const row = clData[i];
            if (!row || row.length < 18) continue;

            // Try to find 23-24 data
            const data2324 = parseWeeklyRow(row, 18, 'Classical', '23-24');
            if (data2324) {
                if (!allData.find(d =>
                    d.series === 'Classical' &&
                    d.season === '23-24' &&
                    d.snapshot_date === data2324.snapshot_date
                )) {
                    allData.push(data2324);
                }
            }
        }
    }

    // Add final totals from summary rows
    console.log('\n📊 Adding season final totals...');

    // Classical finals (from Sheet1 rows 1-2, 6)
    const classicalFinals = [
        { season: '22-23', newUnits: 408, newRevenue: 154568, renewalUnits: 2833, renewalRevenue: 1402198, totalUnits: 3241, totalRevenue: 1556766 },
        { season: '23-24', newUnits: 539, newRevenue: 172394, renewalUnits: 2903, renewalRevenue: 1485806, totalUnits: 3442, totalRevenue: 1658200 },
        { season: '24-25', newUnits: 206, newRevenue: 66280, renewalUnits: 2697, renewalRevenue: 1429445, totalUnits: 2903, totalRevenue: 1495725 }
    ];

    // Pops finals (from Sheet1 rows 19-20, 24)
    const popsFinals = [
        { season: '22-23', newUnits: 263, newRevenue: 61720, renewalUnits: 1393, renewalRevenue: 402346, totalUnits: 1656, totalRevenue: 464066 },
        { season: '23-24', newUnits: 363, newRevenue: 87113, renewalUnits: 1458, renewalRevenue: 497816, totalUnits: 1821, totalRevenue: 584929 },
        { season: '24-25', newUnits: 234, newRevenue: 66814, renewalUnits: 1450, renewalRevenue: 515169, totalUnits: 1684, totalRevenue: 581983 }
    ];

    // Add finals as week 52 entries (end of season)
    classicalFinals.forEach(f => {
        allData.push({
            series: 'Classical',
            season: f.season,
            snapshot_date: null, // Final totals don't have specific date
            new_units: f.newUnits,
            new_revenue: f.newRevenue,
            renewal_units: f.renewalUnits,
            renewal_revenue: f.renewalRevenue,
            total_units: f.totalUnits,
            total_revenue: f.totalRevenue,
            week_number: 52, // Mark as end of season
            is_final: true
        });
    });

    popsFinals.forEach(f => {
        allData.push({
            series: 'Pops',
            season: f.season,
            snapshot_date: null,
            new_units: f.newUnits,
            new_revenue: f.newRevenue,
            renewal_units: f.renewalUnits,
            renewal_revenue: f.renewalRevenue,
            total_units: f.totalUnits,
            total_revenue: f.totalRevenue,
            week_number: 52,
            is_final: true
        });
    });

    return allData;
}

/**
 * Create the BigQuery table if it doesn't exist
 */
async function createTable() {
    const schema = [
        { name: 'series', type: 'STRING', mode: 'REQUIRED' },
        { name: 'season', type: 'STRING', mode: 'REQUIRED' },
        { name: 'snapshot_date', type: 'DATE', mode: 'NULLABLE' },
        { name: 'new_units', type: 'INTEGER', mode: 'NULLABLE' },
        { name: 'new_revenue', type: 'FLOAT', mode: 'NULLABLE' },
        { name: 'renewal_units', type: 'INTEGER', mode: 'NULLABLE' },
        { name: 'renewal_revenue', type: 'FLOAT', mode: 'NULLABLE' },
        { name: 'total_units', type: 'INTEGER', mode: 'NULLABLE' },
        { name: 'total_revenue', type: 'FLOAT', mode: 'NULLABLE' },
        { name: 'week_number', type: 'INTEGER', mode: 'NULLABLE' },
        { name: 'is_final', type: 'BOOLEAN', mode: 'NULLABLE' }
    ];

    const tableRef = bigquery.dataset(DATASET_ID).table(TABLE_ID);

    try {
        const [exists] = await tableRef.exists();
        if (exists) {
            console.log(`📋 Table ${TABLE_ID} already exists`);
            return;
        }
    } catch (e) {
        // Table doesn't exist, create it
    }

    console.log(`📋 Creating table ${TABLE_ID}...`);
    await bigquery.dataset(DATASET_ID).createTable(TABLE_ID, { schema });
    console.log(`✅ Table ${TABLE_ID} created`);
}

/**
 * Clear existing data from the table
 */
async function clearTable() {
    console.log('🗑️  Clearing existing data...');
    const query = `DELETE FROM \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\` WHERE TRUE`;
    try {
        await bigquery.query(query);
        console.log('✅ Table cleared');
    } catch (e) {
        console.log('ℹ️  Table was empty or does not exist yet');
    }
}

/**
 * Insert data into BigQuery
 */
async function insertData(data) {
    console.log(`\n📤 Inserting ${data.length} rows into BigQuery...`);

    const tableRef = bigquery.dataset(DATASET_ID).table(TABLE_ID);

    // Insert in batches of 500
    const batchSize = 500;
    for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        try {
            await tableRef.insert(batch);
            console.log(`  Inserted rows ${i + 1} to ${Math.min(i + batchSize, data.length)}`);
        } catch (err) {
            if (err.name === 'PartialFailureError' && err.errors) {
                console.error('  ❌ Insert errors:');
                err.errors.forEach((e, idx) => {
                    console.error(`    Row ${i + idx}:`, JSON.stringify(e.row));
                    e.errors.forEach(error => {
                        console.error(`      - ${error.message}`);
                    });
                });
            }
            throw err;
        }
    }

    console.log('✅ All data inserted successfully');
}

/**
 * Main function
 */
async function main() {
    console.log('🎵 Subscription Comparisons Import Tool');
    console.log('=' .repeat(50));

    try {
        // Parse Excel file
        const data = parseExcelFile();

        // Summary
        console.log('\n📊 Data Summary:');
        const bySeries = {};
        const bySeason = {};
        data.forEach(d => {
            bySeries[d.series] = (bySeries[d.series] || 0) + 1;
            bySeason[d.season] = (bySeason[d.season] || 0) + 1;
        });
        console.log('  By Series:', bySeries);
        console.log('  By Season:', bySeason);

        // Create table
        await createTable();

        // Clear existing data
        await clearTable();

        // Insert new data
        await insertData(data);

        console.log('\n✅ Import complete!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { parseExcelFile, main };
