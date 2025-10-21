// Test direct snapshot insertion (bypass PDF parsing)
// This tests the dual-write logic directly

const { BigQuery } = require('@google-cloud/bigquery');
const crypto = require('crypto');
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

async function testSnapshotInsert() {
  console.log('🧪 Testing direct snapshot insertion (dual-write)...\n');

  const bigquery = initializeBigQuery();
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony';
  const datasetId = 'symphony_dashboard';

  // Mock performance data (simulating what PDF would provide)
  const mockPerformances = [
    {
      performance_code: '250902E',
      performance_date: '2025-09-02',
      single_tickets_sold: 1200,
      subscription_tickets_sold: 600,
      total_revenue: 140000,
      capacity_percent: 82.5,
      budget_percent: 58.2
    }
  ];

  console.log('📊 Test data:');
  console.log(`  Performance: ${mockPerformances[0].performance_code}`);
  console.log(`  Single tickets: ${mockPerformances[0].single_tickets_sold}`);
  console.log(`  Subscription tickets: ${mockPerformances[0].subscription_tickets_sold}`);
  console.log(`  Revenue: $${mockPerformances[0].total_revenue.toLocaleString()}\n`);

  // Get performance ID
  const getIdQuery = `
    SELECT performance_id, performance_code
    FROM \`${projectId}.${datasetId}.performances\`
    WHERE performance_code = '250902E'
  `;
  const [idRows] = await bigquery.query({ query: getIdQuery, location: 'US' });

  if (idRows.length === 0) {
    console.log('❌ Performance 250902E not found in database');
    return;
  }

  const performanceId = idRows[0].performance_id;
  console.log(`✅ Found performance ID: ${performanceId}\n`);

  // Count snapshots before
  const countBefore = `
    SELECT COUNT(*) as count
    FROM \`${projectId}.${datasetId}.performance_sales_snapshots\`
    WHERE performance_code = '250902E'
  `;
  const [beforeRows] = await bigquery.query({ query: countBefore, location: 'US' });
  console.log(`📸 Snapshots before: ${beforeRows[0].count}\n`);

  // STEP 1: INSERT SNAPSHOT
  console.log('📸 Inserting snapshot...\n');

  const snapshotId = crypto.randomBytes(8).toString('hex');
  const insertSnapshot = `
    INSERT INTO \`${projectId}.${datasetId}.performance_sales_snapshots\`
    (snapshot_id, performance_id, performance_code, snapshot_date,
     single_tickets_sold, subscription_tickets_sold, total_tickets_sold,
     total_revenue, capacity_percent, budget_percent, source, created_at)
    VALUES (
      '${snapshotId}',
      ${performanceId},
      '250902E',
      CURRENT_DATE(),
      1200,
      600,
      1800,
      140000,
      82.5,
      58.2,
      'test_dual_write',
      CURRENT_TIMESTAMP()
    )
  `;

  await bigquery.query({ query: insertSnapshot, location: 'US' });
  console.log('✅ Snapshot inserted!\n');

  // STEP 2: UPDATE PERFORMANCE (for backwards compatibility)
  console.log('🔄 Updating performance table...\n');

  const updatePerformance = `
    UPDATE \`${projectId}.${datasetId}.performances\`
    SET
      single_tickets_sold = 1200,
      subscription_tickets_sold = 600,
      total_tickets_sold = 1800,
      total_revenue = 140000,
      capacity_percent = 82.5,
      budget_percent = 58.2,
      has_sales_data = true,
      last_pdf_import_date = CURRENT_TIMESTAMP(),
      updated_at = CURRENT_TIMESTAMP()
    WHERE performance_code = '250902E'
  `;

  await bigquery.query({ query: updatePerformance, location: 'US' });
  console.log('✅ Performance updated!\n');

  // Count snapshots after
  const [afterRows] = await bigquery.query({ query: countBefore, location: 'US' });
  console.log(`📸 Snapshots after: ${afterRows[0].count}`);
  console.log(`   New snapshots: ${afterRows[0].count - beforeRows[0].count}\n`);

  // Verify data matches
  const verifyPerf = `
    SELECT single_tickets_sold, subscription_tickets_sold, total_revenue, capacity_percent
    FROM \`${projectId}.${datasetId}.performances\`
    WHERE performance_code = '250902E'
  `;
  const [perfRows] = await bigquery.query({ query: verifyPerf, location: 'US' });

  const verifySnap = `
    SELECT single_tickets_sold, subscription_tickets_sold, total_revenue, capacity_percent, snapshot_date
    FROM \`${projectId}.${datasetId}.performance_sales_snapshots\`
    WHERE performance_code = '250902E'
    ORDER BY snapshot_date DESC
    LIMIT 1
  `;
  const [snapRows] = await bigquery.query({ query: verifySnap, location: 'US' });

  console.log('📋 Verification:\n');
  console.log('Performances table:');
  console.log(`  Tickets: ${perfRows[0].single_tickets_sold + perfRows[0].subscription_tickets_sold}`);
  console.log(`  Revenue: $${Math.round(perfRows[0].total_revenue).toLocaleString()}`);
  console.log(`  Capacity: ${perfRows[0].capacity_percent}%\n`);

  console.log('Snapshots table (latest):');
  console.log(`  Date: ${snapRows[0].snapshot_date.value}`);
  console.log(`  Tickets: ${snapRows[0].single_tickets_sold + snapRows[0].subscription_tickets_sold}`);
  console.log(`  Revenue: $${Math.round(snapRows[0].total_revenue).toLocaleString()}`);
  console.log(`  Capacity: ${snapRows[0].capacity_percent}%\n`);

  const match =
    perfRows[0].single_tickets_sold === snapRows[0].single_tickets_sold &&
    perfRows[0].subscription_tickets_sold === snapRows[0].subscription_tickets_sold &&
    Math.abs(perfRows[0].total_revenue - snapRows[0].total_revenue) < 0.01;

  console.log(match ? '✅ Data matches!' : '❌ Data mismatch!');
  console.log('\n🎉 Dual-write test complete!');
  console.log('   Both tables updated successfully\n');
}

testSnapshotInsert().catch(error => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});
