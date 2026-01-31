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
const EXCEL_FILE = path.join(__dirname, '../../KCS 25-26 Sub Tracker.xlsx');
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
 * Add a data point if not already present (dedup by series + season + date)
 */
function addIfNew(allData, entry) {
    if (!entry) return;
    const exists = allData.find(d =>
        d.series === entry.series &&
        d.season === entry.season &&
        d.snapshot_date === entry.snapshot_date
    );
    if (!exists) allData.push(entry);
}

/**
 * Parse all data points from a sheet for a given series
 * Extracts 25-26 (cols 0-7), 24-25 (cols 9-16), and 23-24 (cols 18-25)
 */
function parseDataSheet(workbook, sheetName, series, allData) {
    const ws = workbook.Sheets[sheetName];
    if (!ws) {
        console.log(`  Sheet "${sheetName}" not found, skipping`);
        return;
    }
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    console.log(`  Processing ${series} from ${sheetName} (${data.length} rows)...`);

    let counts = { '25-26': 0, '24-25': 0, '23-24': 0 };

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (!row) continue;

        // 25-26 data in columns 0-7
        const d2526 = parseWeeklyRow(row, 0, series, '25-26');
        if (d2526) { addIfNew(allData, d2526); counts['25-26']++; }

        // 24-25 data in columns 9-16
        if (row.length > 16) {
            const d2425 = parseWeeklyRow(row, 9, series, '24-25');
            if (d2425) { addIfNew(allData, d2425); counts['24-25']++; }
        }

        // 23-24 data in columns 18-25
        if (row.length > 25) {
            const d2324 = parseWeeklyRow(row, 18, series, '23-24');
            if (d2324) { addIfNew(allData, d2324); counts['23-24']++; }
        }
    }

    console.log(`    Found: 25-26=${counts['25-26']}, 24-25=${counts['24-25']}, 23-24=${counts['23-24']}`);
}

/**
 * Parse the Excel file and extract subscription data
 */
function parseExcelFile() {
    console.log('Reading Excel file:', EXCEL_FILE);
    const workbook = XLSX.readFile(EXCEL_FILE);

    const allData = [];

    // Primary sources: CL Data sheet for Classical, Pops sheet for Pops
    // These have the most complete data (28+ rows per season)
    console.log('\nParsing primary data sheets...');
    parseDataSheet(workbook, 'CL Data', 'Classical', allData);
    parseDataSheet(workbook, 'Pops', 'Pops', allData);

    // Secondary source: Sheet1 has recent data that may extend beyond the data sheets
    const sheet1 = workbook.Sheets['Sheet1'];
    if (sheet1) {
        const sheet1Data = XLSX.utils.sheet_to_json(sheet1, { header: 1 });
        console.log('\nParsing Sheet1 for additional data points...');

        // Classical section: rows 8 until "Pops" header
        let classicalAdded = 0;
        for (let i = 8; i < sheet1Data.length; i++) {
            const row = sheet1Data[i];
            if (!row || row.length === 0) continue;
            if (row[0] === 'Pops') break;

            const d2526 = parseWeeklyRow(row, 0, 'Classical', '25-26');
            if (d2526) { addIfNew(allData, d2526); classicalAdded++; }
            const d2425 = parseWeeklyRow(row, 9, 'Classical', '24-25');
            if (d2425) { addIfNew(allData, d2425); classicalAdded++; }
        }

        // Pops section: starts 5 rows after "Pops" header
        let popsStartRow = -1;
        for (let i = 0; i < sheet1Data.length; i++) {
            if (sheet1Data[i] && sheet1Data[i][0] === 'Pops') {
                popsStartRow = i + 5;
                break;
            }
        }

        let popsAdded = 0;
        if (popsStartRow > 0) {
            for (let i = popsStartRow; i < sheet1Data.length; i++) {
                const row = sheet1Data[i];
                if (!row || row.length === 0) continue;

                const d2526 = parseWeeklyRow(row, 0, 'Pops', '25-26');
                if (d2526) { addIfNew(allData, d2526); popsAdded++; }
                const d2425 = parseWeeklyRow(row, 9, 'Pops', '24-25');
                if (d2425) { addIfNew(allData, d2425); popsAdded++; }
            }
        }

        console.log(`  Sheet1 added: Classical=${classicalAdded}, Pops=${popsAdded} (new points only)`);
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
 * Clear existing data from the table for the seasons being imported.
 * Preserves data from other seasons (e.g., 26-27 written by the webhook).
 */
async function clearImportedSeasons(data) {
    const seasons = [...new Set(data.map(d => d.season))];
    console.log(`🗑️  Clearing existing data for seasons: ${seasons.join(', ')}...`);
    const placeholders = seasons.map(s => `'${s}'`).join(', ');
    const query = `DELETE FROM \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\` WHERE season IN (${placeholders})`;
    try {
        await bigquery.query(query);
        console.log('✅ Seasons cleared');
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

        // Clear existing data only for seasons being imported (preserves 26-27 webhook data)
        await clearImportedSeasons(data);

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
