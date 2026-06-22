// Create the email_campaign_snapshots table (Constant Contact campaign stats).
// Append-only: email-sync-cron.js writes one row per campaign per daily run;
// the read layer (lib/bq-email.js) takes the latest snapshot per campaign.
// Run with: node scripts/migrations/run-create-email-table.js

require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');

function initializeBigQuery() {
  const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsEnv) throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable not set');

  let credentials;
  if (credentialsEnv.startsWith('{')) {
    credentials = JSON.parse(credentialsEnv);
  } else {
    credentials = JSON.parse(fs.readFileSync(path.resolve(credentialsEnv), 'utf8'));
  }
  if (credentials.private_key && credentials.private_key.includes('\\n')) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  }

  return new BigQuery({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || credentials.project_id,
    credentials: { client_email: credentials.client_email, private_key: credentials.private_key },
    location: 'US',
  });
}

async function createTable() {
  const bigquery = initializeBigQuery();
  const datasetId = process.env.BIGQUERY_DATASET || 'symphony_dashboard';

  const schema = [
    { name: 'snapshot_date', type: 'DATE', mode: 'REQUIRED' },
    { name: 'campaign_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'campaign_name', type: 'STRING', mode: 'NULLABLE' },
    { name: 'campaign_type', type: 'STRING', mode: 'NULLABLE' },
    { name: 'last_sent_date', type: 'TIMESTAMP', mode: 'NULLABLE' },
    { name: 'sends', type: 'INT64', mode: 'NULLABLE' },
    { name: 'opens', type: 'INT64', mode: 'NULLABLE' },
    { name: 'clicks', type: 'INT64', mode: 'NULLABLE' },
    { name: 'forwards', type: 'INT64', mode: 'NULLABLE' },
    { name: 'optouts', type: 'INT64', mode: 'NULLABLE' },
    { name: 'abuse', type: 'INT64', mode: 'NULLABLE' },
    { name: 'bounces', type: 'INT64', mode: 'NULLABLE' },
    { name: 'not_opened', type: 'INT64', mode: 'NULLABLE' },
    { name: 'created_at', type: 'TIMESTAMP', mode: 'NULLABLE' },
  ];

  try {
    const [table] = await bigquery.dataset(datasetId).createTable('email_campaign_snapshots', {
      schema,
      location: 'US',
    });
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
  .then(() => { console.log('Done.'); process.exit(0); })
  .catch((error) => { console.error('❌ Error:', error.message); process.exit(1); });
