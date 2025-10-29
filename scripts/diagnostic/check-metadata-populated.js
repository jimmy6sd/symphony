// Check if metadata was successfully populated
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

async function checkMetadata() {
  const bigquery = initializeBigQuery();
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony';
  const datasetId = 'symphony_dashboard';

  console.log('📊 Checking metadata population status...\n');

  // Check total count with budget_goal > 1000
  const countQuery = `
    SELECT COUNT(*) as count
    FROM \`${projectId}.${datasetId}.performances\`
    WHERE budget_goal > 1000
  `;

  const [countResults] = await bigquery.query({ query: countQuery, location: 'US' });
  const totalWithBudget = countResults[0].count;

  console.log(`✅ Found ${totalWithBudget} performances with budget_goal > $1,000\n`);

  // Get sample of updated performances
  const sampleQuery = `
    SELECT
      performance_code,
      title,
      capacity,
      budget_goal,
      FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', updated_at) as updated_at
    FROM \`${projectId}.${datasetId}.performances\`
    WHERE budget_goal > 1000
    ORDER BY updated_at DESC
    LIMIT 20
  `;

  const [sampleResults] = await bigquery.query({ query: sampleQuery, location: 'US' });

  console.log('📋 Sample of recently updated performances:');
  console.log('='.repeat(100));
  sampleResults.forEach((row, i) => {
    console.log(`${i + 1}. ${row.performance_code}: ${row.title}`);
    console.log(`   Capacity: ${row.capacity.toLocaleString()}, Budget: $${row.budget_goal.toLocaleString()}`);
    console.log(`   Updated: ${row.updated_at}`);
  });

  // Check for performances that still need metadata
  const missingQuery = `
    SELECT COUNT(*) as count
    FROM \`${projectId}.${datasetId}.performances\`
    WHERE budget_goal <= 1000 OR budget_goal IS NULL
  `;

  const [missingResults] = await bigquery.query({ query: missingQuery, location: 'US' });
  const stillMissing = missingResults[0].count;

  console.log(`\n⚠️  Still need metadata: ${stillMissing} performances\n`);

  if (stillMissing > 0) {
    const missingSampleQuery = `
      SELECT performance_code, title, budget_goal
      FROM \`${projectId}.${datasetId}.performances\`
      WHERE budget_goal <= 1000 OR budget_goal IS NULL
      LIMIT 10
    `;

    const [missingSample] = await bigquery.query({ query: missingSampleQuery, location: 'US' });

    console.log('Sample of performances still needing metadata:');
    missingSample.forEach(row => {
      console.log(`  - ${row.performance_code}: ${row.title} (budget: $${row.budget_goal || 0})`);
    });
  }
}

checkMetadata().catch(console.error);
