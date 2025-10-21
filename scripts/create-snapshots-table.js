// Create performance_sales_snapshots table for longitudinal tracking
// This script creates the new table WITHOUT modifying existing tables

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

async function createSnapshotsTable() {
  const bigquery = initializeBigQuery();
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const datasetId = process.env.BIGQUERY_DATASET || 'symphony_dashboard';

  console.log('📋 Creating performance_sales_snapshots table...\n');

  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS \`${projectId}.${datasetId}.performance_sales_snapshots\` (
      snapshot_id STRING NOT NULL,
      performance_id INT64 NOT NULL,
      performance_code STRING NOT NULL,
      snapshot_date DATE NOT NULL,

      -- Sales data (what changes over time)
      single_tickets_sold INT64,
      subscription_tickets_sold INT64,
      total_tickets_sold INT64,
      total_revenue FLOAT64,
      capacity_percent FLOAT64,
      budget_percent FLOAT64,

      -- Metadata
      source STRING,  -- 'pdf_webhook', 'manual_entry', 'historical_import', 'migration'
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
    )
    PARTITION BY snapshot_date
    CLUSTER BY performance_code, snapshot_date
    OPTIONS(
      description="Daily snapshots of performance sales data for longitudinal tracking. Each row represents the sales state on a specific date."
    )
  `;

  try {
    await bigquery.query({ query: createTableQuery, location: 'US' });
    console.log('✅ Table created successfully: performance_sales_snapshots');
    console.log('   - Partitioned by: snapshot_date');
    console.log('   - Clustered by: performance_code, snapshot_date');
    console.log('   - Ready for data migration\n');

    // Verify table exists
    const [exists] = await bigquery
      .dataset(datasetId)
      .table('performance_sales_snapshots')
      .exists();

    if (exists) {
      console.log('✅ Verification: Table exists in BigQuery');

      // Get row count
      const countQuery = `
        SELECT COUNT(*) as count
        FROM \`${projectId}.${datasetId}.performance_sales_snapshots\`
      `;
      const [rows] = await bigquery.query({ query: countQuery, location: 'US' });
      console.log(`   Current row count: ${rows[0].count}\n`);
    }

  } catch (error) {
    console.error('❌ Error creating table:', error.message);
    throw error;
  }
}

// Run the script
createSnapshotsTable()
  .then(() => {
    console.log('🎉 Phase 1 complete: Snapshots table ready');
    console.log('   Next step: Run migrate-to-snapshots.js to copy existing data');
  })
  .catch(error => {
    console.error('💥 Failed:', error.message);
    process.exit(1);
  });
