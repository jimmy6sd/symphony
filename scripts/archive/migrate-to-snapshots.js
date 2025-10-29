// Migrate existing performance sales data to snapshots table
// This creates the initial snapshot from current performance data
// SAFE: Only reads from performances, writes to new snapshots table

const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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

async function migrateToSnapshots() {
  const bigquery = initializeBigQuery();
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const datasetId = process.env.BIGQUERY_DATASET || 'symphony_dashboard';

  console.log('📦 Migrating existing performance data to snapshots...\n');

  // Step 1: Check how many performances have sales data
  const checkQuery = `
    SELECT COUNT(*) as count
    FROM \`${projectId}.${datasetId}.performances\`
    WHERE has_sales_data = true
  `;

  const [checkResult] = await bigquery.query({ query: checkQuery, location: 'US' });
  const performancesWithData = checkResult[0].count;

  console.log(`📊 Found ${performancesWithData} performances with sales data`);

  if (performancesWithData === 0) {
    console.log('⚠️  No sales data to migrate. This is normal if you haven\'t received PDFs yet.');
    console.log('   The snapshots table is ready for when PDFs arrive.\n');
    return;
  }

  // Step 2: Migrate data (creates first snapshot dated today)
  console.log('🚀 Creating initial snapshots (dated today)...\n');

  const migrateQuery = `
    INSERT INTO \`${projectId}.${datasetId}.performance_sales_snapshots\`
    (snapshot_id, performance_id, performance_code, snapshot_date,
     single_tickets_sold, subscription_tickets_sold, total_tickets_sold,
     total_revenue, capacity_percent, budget_percent, source, created_at)
    SELECT
      GENERATE_UUID() as snapshot_id,
      performance_id,
      performance_code,
      CURRENT_DATE() as snapshot_date,
      COALESCE(single_tickets_sold, 0) as single_tickets_sold,
      COALESCE(subscription_tickets_sold, 0) as subscription_tickets_sold,
      COALESCE(total_tickets_sold, 0) as total_tickets_sold,
      COALESCE(total_revenue, 0) as total_revenue,
      COALESCE(capacity_percent, 0) as capacity_percent,
      COALESCE(budget_percent, 0) as budget_percent,
      'migration' as source,
      CURRENT_TIMESTAMP() as created_at
    FROM \`${projectId}.${datasetId}.performances\`
    WHERE has_sales_data = true
  `;

  try {
    await bigquery.query({ query: migrateQuery, location: 'US' });

    // Verify migration
    const verifyQuery = `
      SELECT
        COUNT(*) as total_snapshots,
        COUNT(DISTINCT performance_code) as unique_performances,
        MIN(snapshot_date) as earliest_date,
        MAX(snapshot_date) as latest_date,
        SUM(total_tickets_sold) as total_tickets,
        SUM(total_revenue) as total_revenue
      FROM \`${projectId}.${datasetId}.performance_sales_snapshots\`
    `;

    const [verifyResult] = await bigquery.query({ query: verifyQuery, location: 'US' });
    const stats = verifyResult[0];

    console.log('✅ Migration complete!\n');
    console.log('📈 Snapshots Summary:');
    console.log(`   Total snapshots: ${stats.total_snapshots}`);
    console.log(`   Unique performances: ${stats.unique_performances}`);
    console.log(`   Snapshot date: ${stats.earliest_date.value}`);
    console.log(`   Total tickets tracked: ${stats.total_tickets}`);
    console.log(`   Total revenue tracked: $${Math.round(stats.total_revenue).toLocaleString()}\n`);

    // Show sample snapshot
    const sampleQuery = `
      SELECT
        snapshot_id,
        performance_code,
        snapshot_date,
        total_tickets_sold,
        total_revenue,
        capacity_percent,
        source
      FROM \`${projectId}.${datasetId}.performance_sales_snapshots\`
      WHERE total_tickets_sold > 0
      ORDER BY total_revenue DESC
      LIMIT 3
    `;

    const [sampleRows] = await bigquery.query({ query: sampleQuery, location: 'US' });

    if (sampleRows.length > 0) {
      console.log('📋 Sample snapshots (top 3 by revenue):');
      sampleRows.forEach((row, i) => {
        console.log(`   ${i+1}. ${row.performance_code} - ${row.total_tickets_sold} tickets, $${Math.round(row.total_revenue)}, ${row.capacity_percent}% capacity`);
      });
      console.log('');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

// Run the migration
migrateToSnapshots()
  .then(() => {
    console.log('🎉 Phase 2 complete: Initial snapshots created');
    console.log('   ✅ Existing system still works (performances table unchanged)');
    console.log('   ✅ New snapshot system ready for testing');
    console.log('   Next: Test querying snapshots to verify data integrity\n');
  })
  .catch(error => {
    console.error('💥 Failed:', error.message);
    process.exit(1);
  });
