// Parse CSV and populate performance metadata (capacity, budget_goal) from Weekly Sales Report
const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const initializeBigQuery = () => {
  const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  let credentials;

  if (credentialsEnv.startsWith('{')) {
    credentials = JSON.parse(credentialsEnv);
  } else {
    const credentialsFile = path.resolve(credentialsEnv);
    credentials = JSON.parse(fs.readFileSync(credentialsFile, 'utf8'));
  }

  if (credentials.private_key?.includes('\\\\n')) {
    credentials.private_key = credentials.private_key.replace(/\\\\n/g, '\n');
  }

  return new BigQuery({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || credentials.project_id,
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
    location: 'US'
  });
};

// Parse currency string like " $ 100,000 " to number
function parseCurrency(str) {
  if (!str || str.trim() === '' || str.includes('#') || str === 'N/A') {
    return null;
  }
  const cleaned = str.replace(/[\$,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.round(num);
}

// Parse number string like "  1,302 " to integer
function parseNumber(str) {
  if (!str || str.trim() === '' || str.includes('#') || str === 'N/A') {
    return null;
  }
  const cleaned = str.replace(/[,\s]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

// Convert performance date like "9/2/2025" to performance code like "250902E"
function dateToPerformanceCode(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;

  // Parse date in format M/D/YYYY or MM/DD/YYYY
  const parts = dateStr.trim().split('/');
  if (parts.length !== 3) return null;

  const month = parts[0].padStart(2, '0');
  const day = parts[1].padStart(2, '0');
  const year = parts[2].slice(-2); // Last 2 digits of year

  // Format: YYMMDD + E (evening performance)
  return `${year}${month}${day}E`;
}

// Parse a CSV line handling quoted fields properly
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current); // Add the last field

  return result;
}

async function parseAndPopulateMetadata() {
  console.log('📊 Parsing Weekly Sales Report CSV...\n');

  // Read the CSV file
  const csvPath = path.join(__dirname, '../KCS 25-26 Weekly Sales Report - 20250925.xlsx - Performances by Week.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const lines = csvContent.split('\n');

  // Skip header rows (first 6 lines are headers)
  const dataRows = lines.slice(6);

  const metadataUpdates = [];
  const skipped = [];

  for (const line of dataRows) {
    if (!line.trim()) continue;

    // Parse CSV line properly handling quoted fields
    const columns = parseCSVLine(line);

    // Column indices based on CSV structure:
    // 3 = Performance name (Column D)
    // 6 = Performance Date (Column G)
    // 12 = TOTAL BUDGET (Column M)
    // 32 = Max CAP (Column AG)

    const performanceName = columns[3]?.trim();
    const performanceDate = columns[6]?.trim();
    const budgetStr = columns[12];
    const capacityStr = columns[32];

    // Skip OPEN weeks, summary rows, and empty rows
    if (!performanceName ||
        performanceName === 'OPEN' ||
        performanceName === 'CLASSICAL' ||
        performanceName === 'PIAZZA' ||
        performanceName === 'POPS' ||
        performanceName === 'FAMILY' ||
        performanceName === 'FILM' ||
        performanceName === 'ON STAGE' ||
        performanceName === 'OTHER' ||
        performanceName === 'ALL CONCERTS' ||
        performanceName === 'Performance') {
      continue;
    }

    const performanceCode = dateToPerformanceCode(performanceDate);
    const capacity = parseNumber(capacityStr);
    const budget = parseCurrency(budgetStr);

    if (!performanceCode || !capacity || !budget) {
      skipped.push({
        name: performanceName,
        date: performanceDate,
        code: performanceCode,
        capacity,
        budget,
        reason: !performanceCode ? 'No date' : !capacity ? 'No capacity' : 'No budget'
      });
      continue;
    }

    metadataUpdates.push({
      performance_code: performanceCode,
      capacity,
      budget_goal: budget,
      name: performanceName
    });
  }

  console.log(`✅ Parsed ${metadataUpdates.length} performances from CSV`);
  console.log(`⚠️  Skipped ${skipped.length} rows\n`);

  if (skipped.length > 0) {
    console.log('Skipped rows:');
    skipped.forEach(s => {
      console.log(`  - ${s.name} (${s.date}): ${s.reason}`);
    });
    console.log('');
  }

  // Show sample of what we parsed
  console.log('Sample of parsed data (first 5):');
  metadataUpdates.slice(0, 5).forEach(u => {
    console.log(`  ${u.performance_code}: ${u.name}`);
    console.log(`    Capacity: ${u.capacity.toLocaleString()}, Budget: $${u.budget_goal.toLocaleString()}`);
  });
  console.log('');

  // Ask for confirmation before updating
  console.log('🚀 Ready to update BigQuery with this metadata');
  console.log('   Press Ctrl+C to cancel, or wait 5 seconds to proceed...\n');

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Now update BigQuery
  const bigquery = initializeBigQuery();
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony';
  const datasetId = 'symphony_dashboard';

  console.log(`📋 Updating ${metadataUpdates.length} performances in BigQuery...\n`);

  let successCount = 0;
  let failCount = 0;

  for (const update of metadataUpdates) {
    // Extract the date portion (YYMMDD) from the performance code
    // This allows us to update ALL performances on that date (both M and E)
    const datePattern = update.performance_code.substring(0, 6); // YYMMDD

    const query = `
      UPDATE \`${projectId}.${datasetId}.performances\`
      SET
        capacity = ${update.capacity},
        budget_goal = ${update.budget_goal},
        updated_at = CURRENT_TIMESTAMP()
      WHERE performance_code LIKE '${datePattern}%'
    `;

    try {
      const [job] = await bigquery.query({ query, location: 'US' });

      // Check how many rows were updated
      const numUpdated = parseInt(job.statistics?.query?.numDmlAffectedRows || '0');
      if (numUpdated === 0) {
        console.log(`⚠️  ${datePattern}*: No matching row found (${update.name})`);
        failCount++;
      } else {
        const perfLabel = numUpdated === 1 ? 'perf' : 'perfs';
        console.log(`✅ ${datePattern}* (${numUpdated} ${perfLabel}): capacity=${update.capacity.toLocaleString()}, budget=$${update.budget_goal.toLocaleString()}`);
        successCount += numUpdated;
      }
    } catch (error) {
      console.error(`❌ Failed to update ${datePattern}*:`, error.message);
      failCount++;
    }
  }

  console.log(`\n✅ Metadata population complete!`);
  console.log(`   ${successCount} successful, ${failCount} failed/not found`);
  console.log('   These values can now be edited via the /update-metadata endpoint\n');
}

parseAndPopulateMetadata().catch(console.error);
