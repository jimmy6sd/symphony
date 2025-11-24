/**
 * Import Budget Breakdown from CSV
 *
 * Parses the "Performances by Week" CSV to extract singles and subscription budget goals,
 * then updates BigQuery performances table with the budget breakdown.
 *
 * Usage: node scripts/import-budget-breakdown.js
 */

const fs = require('fs');
const path = require('path');
const { BigQuery } = require('@google-cloud/bigquery');

// Configuration
const CSV_PATH = path.join(__dirname, '../data/source-files/KCS 25-26 Weekly Sales Report - Sep 17.xlsx - Performances by Week.csv');
const PROJECT_ID = 'kcsymphony';
const DATASET_ID = 'symphony_dashboard';

// Parse currency string like "$ 59,333" or "$59,333" to number
function parseCurrency(value) {
    if (!value || value === '' || value === '-' || value === 'N/A') return null;
    const cleaned = value.replace(/[$,\s]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
}

// Parse date string like "9/19/2025" to YYYY-MM-DD
function parseDate(value) {
    if (!value || value === '') return null;
    const parts = value.split('/');
    if (parts.length !== 3) return null;
    const month = parts[0].padStart(2, '0');
    const day = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
}

async function main() {
    console.log('📊 Budget Breakdown Import Script');
    console.log('='.repeat(50));

    // Read CSV file
    if (!fs.existsSync(CSV_PATH)) {
        console.error(`❌ CSV file not found: ${CSV_PATH}`);
        process.exit(1);
    }

    const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
    const lines = csvContent.split('\n');

    console.log(`📄 Read ${lines.length} lines from CSV`);

    // Parse header to find column indices
    // Based on the CSV structure (rows 4-7 are headers):
    // The data rows start at row 8 (index 7)
    // Columns (0-indexed):
    // - Column 6: Performance Date(s)
    // - Column 3: Performance name
    // - Column 19: Singles Actual Revenue
    // - Column 20: Singles BUDGET  <-- This is what we need
    // - Column 23: Subs Actual Revenue
    // - Column 24: Subs BUDGET  <-- This is what we need

    const budgetData = [];

    // Process data rows (skip header rows 0-7)
    for (let i = 7; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        // Parse CSV (handle quoted fields with commas)
        const fields = parseCSVLine(line);

        // Skip rows that don't have performance data
        const perfDate = fields[6];
        const perfName = fields[3];

        if (!perfDate || !perfName || perfName === 'OPEN' || perfName.includes('OPEN')) continue;

        // Extract budget values
        // Column 20 = Singles BUDGET, Column 25 = Subs BUDGET
        const singlesBudget = parseCurrency(fields[20]);
        const subsBudget = parseCurrency(fields[25]);
        const dateFormatted = parseDate(perfDate);

        if (!dateFormatted) continue;

        // Only add if we have at least one budget value
        if (singlesBudget !== null || subsBudget !== null) {
            budgetData.push({
                performance_date: dateFormatted,
                title: perfName.trim(),
                single_budget_goal: singlesBudget,
                subscription_budget_goal: subsBudget
            });
        }
    }

    console.log(`\n📋 Parsed ${budgetData.length} performances with budget data`);

    // Show first few entries for verification
    console.log('\n🔍 Sample data (first 5):');
    budgetData.slice(0, 5).forEach(d => {
        console.log(`  ${d.performance_date} | ${d.title.substring(0, 30).padEnd(30)} | Singles: $${d.single_budget_goal?.toLocaleString() || 'N/A'} | Subs: $${d.subscription_budget_goal?.toLocaleString() || 'N/A'}`);
    });

    // Initialize BigQuery
    const bigquery = new BigQuery({
        projectId: PROJECT_ID,
        keyFilename: path.join(__dirname, '../symphony-bigquery-key.json')
    });

    // Update each performance in BigQuery
    console.log('\n📤 Updating BigQuery...');

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const perf of budgetData) {
        try {
            // Build SET clause only for non-null values
            const setClauses = [];
            const params = {
                perf_date: perf.performance_date
            };

            if (perf.single_budget_goal !== null) {
                setClauses.push('single_budget_goal = @single_budget');
                params.single_budget = perf.single_budget_goal;
            }

            if (perf.subscription_budget_goal !== null) {
                setClauses.push('subscription_budget_goal = @sub_budget');
                params.sub_budget = perf.subscription_budget_goal;
            }

            if (setClauses.length === 0) {
                skipped++;
                continue;
            }

            const query = `
                UPDATE \`${PROJECT_ID}.${DATASET_ID}.performances\`
                SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP()
                WHERE performance_date = @perf_date
            `;

            const [job] = await bigquery.createQueryJob({
                query,
                params,
                location: 'US'
            });

            const [rows] = await job.getQueryResults();
            updated++;

        } catch (error) {
            console.error(`  ❌ Error updating ${perf.performance_date}: ${error.message}`);
            errors++;
        }
    }

    console.log('\n✅ Import complete!');
    console.log(`  Updated: ${updated}`);
    console.log(`  Skipped: ${skipped}`);
    console.log(`  Errors: ${errors}`);

    // Verify by querying a few records
    console.log('\n🔍 Verification - checking updated records:');
    const verifyQuery = `
        SELECT performance_date, title, single_budget_goal, subscription_budget_goal
        FROM \`${PROJECT_ID}.${DATASET_ID}.performances\`
        WHERE single_budget_goal IS NOT NULL OR subscription_budget_goal IS NOT NULL
        ORDER BY performance_date
        LIMIT 5
    `;

    const [verifyRows] = await bigquery.query({
        query: verifyQuery,
        location: 'US'
    });

    verifyRows.forEach(row => {
        console.log(`  ${row.performance_date.value} | ${row.title?.substring(0, 25).padEnd(25) || ''} | Singles: $${row.single_budget_goal?.toLocaleString() || 'N/A'} | Subs: $${row.subscription_budget_goal?.toLocaleString() || 'N/A'}`);
    });
}

// Parse a CSV line handling quoted fields
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

// Run the import
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
