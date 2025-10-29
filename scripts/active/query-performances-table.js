// Query the performances table to see PDF webhook data
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

async function queryPerformancesTable() {
  const bigquery = initializeBigQuery();
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;

  // Check schema
  console.log('🔍 Checking performances table schema...\n');

  const schemaQuery = `
    SELECT column_name, data_type, is_nullable
    FROM \`${projectId}.symphony_dashboard.INFORMATION_SCHEMA.COLUMNS\`
    WHERE table_name = 'performances'
    ORDER BY ordinal_position
  `;

  const [schemaRows] = await bigquery.query({ query: schemaQuery, location: 'US' });
  console.log('📊 performances table columns:');
  console.log('='.repeat(60));
  schemaRows.forEach(row => {
    console.log(`${row.column_name.padEnd(30)} ${row.data_type.padEnd(15)} ${row.is_nullable}`);
  });

  // Check count
  const countQuery = `
    SELECT COUNT(*) as count
    FROM \`${projectId}.symphony_dashboard.performances\`
  `;

  const [countResult] = await bigquery.query({ query: countQuery, location: 'US' });
  console.log(`\n📈 Total records: ${countResult[0].count}`);

  // Get sample data
  if (countResult[0].count > 0) {
    const sampleQuery = `
      SELECT *
      FROM \`${projectId}.symphony_dashboard.performances\`
      ORDER BY created_at DESC
      LIMIT 5
    `;

    const [sampleRows] = await bigquery.query({ query: sampleQuery, location: 'US' });
    console.log('\n📋 Sample records (most recent):');
    console.log('='.repeat(80));
    sampleRows.forEach((row, i) => {
      console.log(`\n${i + 1}. ${JSON.stringify(row, null, 2)}`);
    });
  }
}

queryPerformancesTable().catch(console.error);
