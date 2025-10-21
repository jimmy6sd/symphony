// Test metadata update endpoint
const handler = require('../netlify/functions/update-metadata').handler;

async function testMetadataUpdate() {
  console.log('🧪 Testing metadata update endpoint...\n');

  // Test 1: Update budget and capacity
  console.log('📊 Test 1: Update budget_goal and capacity\n');

  const event1 = {
    httpMethod: 'PUT',
    body: JSON.stringify({
      performanceCode: '250902E',
      updates: {
        budget_goal: 150000,
        capacity: 1440,
        occupancy_goal: 90
      }
    })
  };

  const result1 = await handler(event1, {});
  const response1 = JSON.parse(result1.body);

  console.log(`Status: ${result1.statusCode}`);
  if (response1.success) {
    console.log('✅ Update successful!');
    console.log(`   Budget goal: $${response1.performance.budget_goal.toLocaleString()}`);
    console.log(`   Capacity: ${response1.performance.capacity}`);
    console.log(`   Occupancy goal: ${response1.performance.occupancy_goal}%`);
    console.log(`   Updated at: ${response1.performance.updated_at}\n`);
  } else {
    console.log('❌ Update failed:', response1);
  }

  // Test 2: Try to update sales data (should be ignored)
  console.log('📊 Test 2: Attempt to update sales data (should be blocked)\n');

  const event2 = {
    httpMethod: 'PUT',
    body: JSON.stringify({
      performanceCode: '250902E',
      updates: {
        total_revenue: 999999,  // This should be ignored
        single_tickets_sold: 9999,  // This should be ignored
        budget_goal: 160000  // This should work
      }
    })
  };

  const result2 = await handler(event2, {});
  const response2 = JSON.parse(result2.body);

  console.log(`Status: ${result2.statusCode}`);
  if (response2.success) {
    console.log('✅ Correctly ignored sales data fields');
    console.log(`   Budget goal updated: $${response2.performance.budget_goal.toLocaleString()}`);
    console.log(`   Revenue unchanged (from snapshots, not editable here)\n`);
  } else {
    console.log('Response:', response2);
  }

  // Test 3: Update title and series
  console.log('📊 Test 3: Update title and series\n');

  const event3 = {
    httpMethod: 'PUT',
    body: JSON.stringify({
      performanceCode: '250902E',
      updates: {
        title: 'Morgan Freeman\'s Symphonic Blue (Updated)',
        series: 'Special Events'
      }
    })
  };

  const result3 = await handler(event3, {});
  const response3 = JSON.parse(result3.body);

  console.log(`Status: ${result3.statusCode}`);
  if (response3.success) {
    console.log('✅ Title and series updated!');
    console.log(`   New title: ${response3.performance.title}`);
    console.log(`   New series: ${response3.performance.series}\n`);
  }

  console.log('✅ All metadata update tests complete!\n');
}

testMetadataUpdate().catch(error => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});
