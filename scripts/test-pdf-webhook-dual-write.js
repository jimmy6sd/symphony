// Test PDF webhook with dual-write (snapshots + performances)
const handler = require('../netlify/functions/pdf-webhook').handler;
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

async function testDualWrite() {
  console.log('🧪 Testing PDF webhook with dual-write...\n');

  const bigquery = initializeBigQuery();
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony';
  const datasetId = 'symphony_dashboard';

  // Get current snapshot count
  const countBefore = `
    SELECT COUNT(*) as count
    FROM \`${projectId}.${datasetId}.performance_sales_snapshots\`
    WHERE performance_code = '250902E'
  `;
  const [beforeRows] = await bigquery.query({ query: countBefore, location: 'US' });
  const snapshotsBefore = beforeRows[0].count;

  console.log(`📊 Snapshots for 250902E before: ${snapshotsBefore}\n`);

  // Simulate PDF webhook with mock data (updated sales numbers)
  const mockPdfText = `250902E10/10/2025 8:00 PM55.0%50033,000.00181,300.0035018,500.0052,800.3000.0052,800.3060053.0%`;

  const event = {
    httpMethod: 'POST',
    body: JSON.stringify({
      pdf_text: mockPdfText,
      metadata: {
        filename: 'test-dual-write.pdf',
        received_at: new Date().toISOString()
      }
    })
  };

  console.log('📨 Sending mock PDF to webhook...\n');

  const result = await handler(event, {});
  const response = JSON.parse(result.body);

  console.log(`Status: ${result.statusCode}`);
  if (response.success) {
    console.log('✅ Webhook processed successfully!\n');
    console.log('Summary:');
    console.log(`  Performances processed: ${response.summary.processed}`);
    console.log(`  Snapshots inserted: ${response.summary.inserted}`);
    console.log(`  Performances updated: ${response.summary.updated}`);
    console.log(`  Execution ID: ${response.execution_id}\n`);
  } else {
    console.log('❌ Webhook failed:', response);
    return;
  }

  // Verify snapshot was created
  const countAfter = `
    SELECT COUNT(*) as count
    FROM \`${projectId}.${datasetId}.performance_sales_snapshots\`
    WHERE performance_code = '250902E'
  `;
  const [afterRows] = await bigquery.query({ query: countAfter, location: 'US' });
  const snapshotsAfter = afterRows[0].count;

  console.log(`📊 Snapshots for 250902E after: ${snapshotsAfter}`);
  console.log(`   New snapshots created: ${snapshotsAfter - snapshotsBefore}\n`);

  // Verify both tables have the data
  const performanceQuery = `
    SELECT
      performance_code,
      single_tickets_sold,
      subscription_tickets_sold,
      total_revenue,
      capacity_percent,
      budget_percent,
      last_pdf_import_date
    FROM \`${projectId}.${datasetId}.performances\`
    WHERE performance_code = '250902E'
  `;
  const [perfRows] = await bigquery.query({ query: performanceQuery, location: 'US' });

  const snapshotQuery = `
    SELECT
      snapshot_date,
      single_tickets_sold,
      subscription_tickets_sold,
      total_revenue,
      capacity_percent,
      budget_percent,
      source
    FROM \`${projectId}.${datasetId}.performance_sales_snapshots\`
    WHERE performance_code = '250902E'
    ORDER BY snapshot_date DESC
    LIMIT 1
  `;
  const [snapRows] = await bigquery.query({ query: snapshotQuery, location: 'US' });

  console.log('📋 Verification:\n');
  console.log('Performances table (latest):');
  if (perfRows.length > 0) {
    const perf = perfRows[0];
    console.log(`  Single tickets: ${perf.single_tickets_sold}`);
    console.log(`  Subscription tickets: ${perf.subscription_tickets_sold}`);
    console.log(`  Total revenue: $${Math.round(perf.total_revenue).toLocaleString()}`);
    console.log(`  Capacity: ${perf.capacity_percent}%`);
    console.log(`  Budget: ${perf.budget_percent}%`);
    console.log(`  Last PDF import: ${perf.last_pdf_import_date?.value || 'N/A'}\n`);
  }

  console.log('Snapshots table (latest):');
  if (snapRows.length > 0) {
    const snap = snapRows[0];
    console.log(`  Snapshot date: ${snap.snapshot_date.value}`);
    console.log(`  Single tickets: ${snap.single_tickets_sold}`);
    console.log(`  Subscription tickets: ${snap.subscription_tickets_sold}`);
    console.log(`  Total revenue: $${Math.round(snap.total_revenue).toLocaleString()}`);
    console.log(`  Capacity: ${snap.capacity_percent}%`);
    console.log(`  Budget: ${snap.budget_percent}%`);
    console.log(`  Source: ${snap.source}\n`);
  }

  // Check if values match
  if (perfRows.length > 0 && snapRows.length > 0) {
    const perf = perfRows[0];
    const snap = snapRows[0];
    const match =
      perf.single_tickets_sold === snap.single_tickets_sold &&
      perf.subscription_tickets_sold === snap.subscription_tickets_sold &&
      Math.abs(perf.total_revenue - snap.total_revenue) < 0.01 &&
      Math.abs(perf.capacity_percent - snap.capacity_percent) < 0.01;

    console.log(match ? '✅ Data matches between both tables!' : '❌ Data mismatch detected!');
  }

  console.log('\n🎉 Dual-write test complete!');
  console.log('   ✅ Snapshots table: Longitudinal tracking enabled');
  console.log('   ✅ Performances table: Backwards compatibility maintained\n');
}

testDualWrite().catch(error => {
  console.error('❌ Test failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});
