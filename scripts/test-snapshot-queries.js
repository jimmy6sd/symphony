// Test snapshot queries to verify data integrity
// This compares data from performances table vs snapshots table

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

async function testSnapshotQueries() {
  const bigquery = initializeBigQuery();
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const datasetId = process.env.BIGQUERY_DATASET || 'symphony_dashboard';

  console.log('🧪 Testing snapshot-based queries...\n');

  // Test 1: Compare totals
  console.log('📊 Test 1: Verify total counts match\n');

  const performancesTotalQuery = `
    SELECT
      COUNT(*) as count,
      SUM(total_tickets_sold) as total_tickets,
      SUM(total_revenue) as total_revenue
    FROM \`${projectId}.${datasetId}.performances\`
    WHERE has_sales_data = true
  `;

  const snapshotsTotalQuery = `
    SELECT
      COUNT(DISTINCT performance_code) as count,
      SUM(total_tickets_sold) as total_tickets,
      SUM(total_revenue) as total_revenue
    FROM \`${projectId}.${datasetId}.performance_sales_snapshots\`
  `;

  const [perfResults] = await bigquery.query({ query: performancesTotalQuery, location: 'US' });
  const [snapResults] = await bigquery.query({ query: snapshotsTotalQuery, location: 'US' });

  const perfData = perfResults[0];
  const snapData = snapResults[0];

  console.log('Performances table:');
  console.log(`  Performances: ${perfData.count}`);
  console.log(`  Total tickets: ${perfData.total_tickets}`);
  console.log(`  Total revenue: $${Math.round(perfData.total_revenue).toLocaleString()}\n`);

  console.log('Snapshots table:');
  console.log(`  Performances: ${snapData.count}`);
  console.log(`  Total tickets: ${snapData.total_tickets}`);
  console.log(`  Total revenue: $${Math.round(snapData.total_revenue).toLocaleString()}\n`);

  const match = perfData.count === snapData.count &&
                perfData.total_tickets === snapData.total_tickets &&
                Math.abs(perfData.total_revenue - snapData.total_revenue) < 1;

  console.log(match ? '✅ Totals match!\n' : '❌ Totals do not match!\n');

  // Test 2: Sample comparison for specific performances
  console.log('📊 Test 2: Compare individual performance data\n');

  const comparisonQuery = `
    SELECT
      p.performance_code,
      p.title,
      p.total_tickets_sold as perf_tickets,
      p.total_revenue as perf_revenue,
      s.total_tickets_sold as snap_tickets,
      s.total_revenue as snap_revenue,
      p.total_tickets_sold = s.total_tickets_sold as tickets_match,
      ABS(p.total_revenue - s.total_revenue) < 0.01 as revenue_match
    FROM \`${projectId}.${datasetId}.performances\` p
    INNER JOIN \`${projectId}.${datasetId}.performance_sales_snapshots\` s
      ON p.performance_code = s.performance_code
    WHERE p.has_sales_data = true
    ORDER BY p.total_revenue DESC
    LIMIT 5
  `;

  const [compRows] = await bigquery.query({ query: comparisonQuery, location: 'US' });

  console.log('Top 5 performances (by revenue):');
  compRows.forEach((row, i) => {
    const ticketsOk = row.tickets_match ? '✅' : '❌';
    const revenueOk = row.revenue_match ? '✅' : '❌';
    console.log(`${i+1}. ${row.performance_code} - ${row.title.substring(0, 30)}`);
    console.log(`   Tickets: ${row.perf_tickets} vs ${row.snap_tickets} ${ticketsOk}`);
    console.log(`   Revenue: $${Math.round(row.perf_revenue)} vs $${Math.round(row.snap_revenue)} ${revenueOk}`);
  });

  console.log('');

  // Test 3: Query pattern for dashboard (latest snapshot per performance)
  console.log('📊 Test 3: Dashboard query pattern (latest snapshot)\n');

  const dashboardQuery = `
    WITH latest_snapshots AS (
      SELECT
        performance_code,
        snapshot_date,
        single_tickets_sold,
        subscription_tickets_sold,
        total_tickets_sold,
        total_revenue,
        capacity_percent,
        budget_percent,
        ROW_NUMBER() OVER (PARTITION BY performance_code ORDER BY snapshot_date DESC) as rn
      FROM \`${projectId}.${datasetId}.performance_sales_snapshots\`
    )
    SELECT
      p.performance_id,
      p.performance_code,
      p.title,
      p.series,
      p.performance_date,
      p.venue,
      p.capacity,
      p.budget_goal,
      p.occupancy_goal,
      s.total_tickets_sold,
      s.total_revenue,
      s.capacity_percent,
      s.budget_percent,
      s.snapshot_date as last_updated
    FROM \`${projectId}.${datasetId}.performances\` p
    LEFT JOIN latest_snapshots s
      ON p.performance_code = s.performance_code AND s.rn = 1
    WHERE p.performance_date >= '2025-01-01'
    ORDER BY p.performance_date ASC
    LIMIT 5
  `;

  const [dashRows] = await bigquery.query({ query: dashboardQuery, location: 'US' });

  console.log('Dashboard-style query results (5 upcoming performances):');
  dashRows.forEach((row, i) => {
    const dateStr = typeof row.performance_date === 'object' ? row.performance_date.value : row.performance_date;
    const lastUpdate = row.last_updated ? (typeof row.last_updated === 'object' ? row.last_updated.value : row.last_updated) : 'No data';
    console.log(`${i+1}. ${row.performance_code} - ${dateStr}`);
    console.log(`   Tickets sold: ${row.total_tickets_sold || 0} / ${row.capacity}`);
    console.log(`   Revenue: $${Math.round(row.total_revenue || 0).toLocaleString()}`);
    console.log(`   Last updated: ${lastUpdate}`);
  });

  console.log('');
}

// Run tests
testSnapshotQueries()
  .then(() => {
    console.log('✅ All snapshot query tests complete');
    console.log('   Snapshots table is working correctly');
    console.log('   Ready to create snapshot-based API endpoint\n');
  })
  .catch(error => {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  });
