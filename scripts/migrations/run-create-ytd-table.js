// Create YTD Weekly Totals table
// Run with: node scripts/migrations/run-create-ytd-table.js

require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');

// Initialize BigQuery client
function initializeBigQuery() {
  const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!credentialsEnv) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable not set');
  }

  let credentials;

  if (credentialsEnv.startsWith('{')) {
    credentials = JSON.parse(credentialsEnv);
  } else {
    const credentialsFile = path.resolve(credentialsEnv);
    const credentialsJson = fs.readFileSync(credentialsFile, 'utf8');
    credentials = JSON.parse(credentialsJson);
  }

  if (credentials.private_key && credentials.private_key.includes('\\n')) {
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
}

async function createTable() {
  const bigquery = initializeBigQuery();
  const datasetId = process.env.BIGQUERY_DATASET || 'symphony_dashboard';

  const schema = [
    { name: 'record_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'fiscal_year', type: 'STRING', mode: 'REQUIRED' },
    { name: 'fiscal_week', type: 'INT64', mode: 'REQUIRED' },
    { name: 'iso_week', type: 'INT64', mode: 'REQUIRED' },
    { name: 'week_end_date', type: 'DATE', mode: 'REQUIRED' },
    { name: 'ytd_tickets_sold', type: 'INT64', mode: 'REQUIRED' },
    { name: 'ytd_single_tickets', type: 'INT64', mode: 'NULLABLE' },
    { name: 'ytd_subscription_tickets', type: 'INT64', mode: 'NULLABLE' },
    { name: 'ytd_revenue', type: 'FLOAT64', mode: 'NULLABLE' },
    { name: 'performance_count', type: 'INT64', mode: 'NULLABLE' },
    { name: 'source', type: 'STRING', mode: 'NULLABLE' },
    { name: 'created_at', type: 'TIMESTAMP', mode: 'NULLABLE' },
  ];

  const options = {
    schema: schema,
    location: 'US',
  };

  try {
    const [table] = await bigquery
      .dataset(datasetId)
      .createTable('ytd_weekly_totals', options);

    console.log(`✅ Table ${table.id} created successfully.`);
  } catch (error) {
    if (error.code === 409) {
      console.log('ℹ️ Table already exists.');
    } else {
      throw error;
    }
  }
}

createTable()
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
