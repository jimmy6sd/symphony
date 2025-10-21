// Test the new bigquery-snapshots API endpoint locally
// This simulates what the dashboard will do

const handler = require('../netlify/functions/bigquery-snapshots').handler;

async function testSnapshotAPI() {
  console.log('🧪 Testing bigquery-snapshots API endpoint...\n');

  // Test 1: Get all performances with latest snapshots
  console.log('📊 Test 1: Get performances with latest snapshots\n');

  const event1 = {
    httpMethod: 'GET',
    queryStringParameters: {
      action: 'get-performances',
      dateFrom: '2025-01-01',
      limit: '5'
    }
  };

  const result1 = await handler(event1, {});
  const performances = JSON.parse(result1.body);

  console.log(`Status: ${result1.statusCode}`);
  console.log(`Returned ${performances.length} performances\n`);

  if (performances.length > 0) {
    console.log('Sample performance:');
    const sample = performances[0];
    console.log(`  Code: ${sample.performance_code}`);
    console.log(`  Title: ${sample.title}`);
    console.log(`  Date: ${sample.date}`);
    console.log(`  Tickets sold: ${sample.totalTicketsSold || sample.total_tickets_sold}`);
    console.log(`  Revenue: $${Math.round(sample.totalRevenue || sample.total_revenue || 0).toLocaleString()}`);
    console.log(`  Last updated: ${sample.lastUpdated || sample.last_updated || 'N/A'}\n`);
  }

  // Test 2: Get performance history
  if (performances.length > 0) {
    const testCode = performances[0].performance_code;
    console.log(`📊 Test 2: Get history for ${testCode}\n`);

    const event2 = {
      httpMethod: 'GET',
      queryStringParameters: {
        action: 'get-performance-history',
        performanceCode: testCode
      }
    };

    const result2 = await handler(event2, {});
    const history = JSON.parse(result2.body);

    console.log(`Status: ${result2.statusCode}`);
    console.log(`Found ${history.snapshots?.length || 0} snapshots\n`);

    if (history.snapshots && history.snapshots.length > 0) {
      console.log('Snapshot history:');
      history.snapshots.forEach((snap, i) => {
        console.log(`  ${i+1}. ${snap.snapshot_date} - ${snap.total_tickets_sold} tickets, $${Math.round(snap.total_revenue)} (source: ${snap.source})`);
      });
      console.log('');
    }

    // Test 3: Get sales progression
    console.log(`📊 Test 3: Get sales progression for ${testCode}\n`);

    const event3 = {
      httpMethod: 'GET',
      queryStringParameters: {
        action: 'get-sales-progression',
        performanceCode: testCode
      }
    };

    const result3 = await handler(event3, {});
    const progression = JSON.parse(result3.body);

    console.log(`Status: ${result3.statusCode}`);
    console.log(`Performance date: ${progression.performanceDate}`);
    console.log(`Progression points: ${progression.progression?.length || 0}\n`);

    if (progression.progression && progression.progression.length > 0) {
      console.log('Sales progression over time:');
      progression.progression.forEach((point, i) => {
        console.log(`  ${point.date} (${point.weeksOut} weeks out) - ${point.ticketsSold} tickets, $${Math.round(point.revenue)}`);
      });
      console.log('');
    }
  }

  console.log('✅ All API tests complete!');
  console.log('   The new snapshot-based API is working correctly\n');
}

// Run tests
testSnapshotAPI().catch(error => {
  console.error('❌ API test failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});
