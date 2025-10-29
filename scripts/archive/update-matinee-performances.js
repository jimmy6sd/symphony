// Find and update matinee performances with correct capacity/budget from CSV
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

// Parse currency string
function parseCurrency(str) {
  if (!str || str.trim() === '' || str.includes('#') || str === 'N/A') {
    return null;
  }
  const cleaned = str.replace(/[\$,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.round(num);
}

// Parse number string
function parseNumber(str) {
  if (!str || str.trim() === '' || str.includes('#') || str === 'N/A') {
    return null;
  }
  const cleaned = str.replace(/[,\s]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

// Parse CSV line handling quoted fields
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
  result.push(current);
  return result;
}

// Convert date to performance code with M suffix for matinee
function dateToMatineeCode(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;

  const parts = dateStr.trim().split('/');
  if (parts.length !== 3) return null;

  const month = parts[0].padStart(2, '0');
  const day = parts[1].padStart(2, '0');
  const year = parts[2].slice(-2);

  return `${year}${month}${day}M`; // M suffix for matinee
}

async function updateMatinees() {
  const bigquery = initializeBigQuery();
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony';
  const datasetId = 'symphony_dashboard';

  console.log('🎭 Finding and Updating Matinee Performances\n');

  // First, get all matinee performances from database
  const matineeQuery = `
    SELECT performance_code, title, performance_date, capacity, budget_goal
    FROM \`${projectId}.${datasetId}.performances\`
    WHERE performance_code LIKE '%M'
    ORDER BY performance_code
  `;

  const [matinees] = await bigquery.query({ query: matineeQuery, location: 'US' });

  console.log(`📊 Found ${matinees.length} matinee performances in database:\n`);
  matinees.forEach(m => {
    console.log(`  ${m.performance_code}: ${m.title} (${m.performance_date.value}) - Cap: ${m.capacity}, Budget: $${m.budget_goal}`);
  });

  // Now parse CSV to find matching performances
  const csvPath = path.join(__dirname, '../data/source-files/KCS 25-26 Weekly Sales Report - Sep 17.xlsx - Performances by Week.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const lines = csvContent.split('\n');
  const dataRows = lines.slice(7);

  const matineeUpdates = [];

  console.log('\n📋 Searching CSV for matinee performances...\n');

  for (const line of dataRows) {
    if (!line.trim()) continue;

    const columns = parseCSVLine(line);
    const performanceName = columns[3]?.trim();
    const performanceDate = columns[6]?.trim();
    const budgetStr = columns[12];
    const capacityStr = columns[27];

    // Skip invalid rows
    if (!performanceName || performanceName === 'OPEN' || performanceName.includes('CLASSICAL')) {
      continue;
    }

    const matineeCode = dateToMatineeCode(performanceDate);
    const capacity = parseNumber(capacityStr);
    const budget = parseCurrency(budgetStr);

    if (!matineeCode || !capacity || !budget) {
      continue;
    }

    // Check if this matinee code exists in our database
    const dbMatinee = matinees.find(m => m.performance_code === matineeCode);

    if (dbMatinee) {
      console.log(`✅ FOUND MATCH: ${matineeCode}`);
      console.log(`   CSV: ${performanceName} (${performanceDate})`);
      console.log(`   DB:  ${dbMatinee.title}`);
      console.log(`   Old capacity: ${dbMatinee.capacity} → New: ${capacity}`);
      console.log(`   Old budget: $${dbMatinee.budget_goal} → New: $${budget}\n`);

      matineeUpdates.push({
        performance_code: matineeCode,
        capacity,
        budget_goal: budget,
        name: performanceName
      });
    }
  }

  console.log('='.repeat(100));
  console.log(`\n🎯 Found ${matineeUpdates.length} matinee performances to update\n`);

  if (matineeUpdates.length === 0) {
    console.log('⚠️  No matinee performances found in CSV that match database');
    console.log('   This is normal - the CSV may use different date formats or not include matinees\n');
    return;
  }

  console.log('🚀 Ready to update matinee performances');
  console.log('   Press Ctrl+C to cancel, or wait 5 seconds to proceed...\n');
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('📝 Updating matinee performances in BigQuery...\n');

  let successCount = 0;
  let failCount = 0;

  for (const update of matineeUpdates) {
    const query = `
      UPDATE \`${projectId}.${datasetId}.performances\`
      SET
        capacity = ${update.capacity},
        budget_goal = ${update.budget_goal},
        updated_at = CURRENT_TIMESTAMP()
      WHERE performance_code = '${update.performance_code}'
    `;

    try {
      const [job] = await bigquery.query({ query, location: 'US' });

      if (job.statistics?.query?.numDmlAffectedRows === '0') {
        console.log(`⚠️  ${update.performance_code}: No matching row found`);
        failCount++;
      } else {
        console.log(`✅ ${update.performance_code}: capacity=${update.capacity.toLocaleString()}, budget=$${update.budget_goal.toLocaleString()}`);
        successCount++;
      }
    } catch (error) {
      console.error(`❌ Failed to update ${update.performance_code}:`, error.message);
      failCount++;
    }
  }

  console.log(`\n✅ Matinee update complete!`);
  console.log(`   ${successCount} successful, ${failCount} failed`);
}

updateMatinees().catch(console.error);
