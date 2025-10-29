// Update matinee performances (M suffix) with data from CSV
// This script finds matinee performances and updates them with the same capacity/budget as evening performances
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

  if (credentials.private_key?.includes('\\n')) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
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

async function updateMatinees() {
  console.log('📊 Updating matinee performances to match evening performance capacities/budgets...\n');

  const bigquery = initializeBigQuery();
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony';
  const datasetId = 'symphony_dashboard';

  // Query to find all matinee performances and their corresponding evening performances
  const query = `
    WITH evening_perfs AS (
      SELECT
        DATE(performance_date) as perf_date,
        capacity,
        budget_goal
      FROM \`${projectId}.${datasetId}.performances\`
      WHERE performance_code LIKE '%E'
        AND performance_date >= '2025-09-01'
        AND performance_date <= '2026-06-30'
    )
    SELECT
      m.performance_code,
      m.title,
      m.capacity as current_capacity,
      m.budget_goal as current_budget,
      e.capacity as new_capacity,
      e.budget_goal as new_budget
    FROM \`${projectId}.${datasetId}.performances\` m
    JOIN evening_perfs e ON DATE(m.performance_date) = e.perf_date
    WHERE m.performance_code LIKE '%M'
      AND (m.capacity != e.capacity OR m.budget_goal != e.budget_goal OR m.capacity IS NULL OR m.budget_goal IS NULL)
  `;

  const [rows] = await bigquery.query({ query, location: 'US' });

  console.log(`Found ${rows.length} matinee performances to update:\n`);

  if (rows.length === 0) {
    console.log('✅ All matinee performances are already up to date!');
    return;
  }

  let successCount = 0;
  let failCount = 0;

  for (const row of rows) {
    const updateQuery = `
      UPDATE \`${projectId}.${datasetId}.performances\`
      SET
        capacity = ${row.new_capacity},
        budget_goal = ${row.new_budget},
        updated_at = CURRENT_TIMESTAMP()
      WHERE performance_code = '${row.performance_code}'
    `;

    try {
      await bigquery.query({ query: updateQuery, location: 'US' });
      console.log(`✅ ${row.performance_code}: ${row.title}`);
      console.log(`   Updated: capacity ${row.current_capacity} → ${row.new_capacity}, budget $${row.current_budget?.toLocaleString()} → $${row.new_budget?.toLocaleString()}`);
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to update ${row.performance_code}:`, error.message);
      failCount++;
    }
  }

  console.log(`\n✅ Matinee update complete!`);
  console.log(`   ${successCount} successful, ${failCount} failed`);
}

updateMatinees().catch(console.error);
