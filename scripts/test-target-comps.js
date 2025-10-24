// Test script to verify target comps are working
const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

async function testTargetComps() {
  try {
    console.log('🧪 Testing target comp functionality...\n');

    const bigquery = new BigQuery({
      projectId: 'kcsymphony',
      keyFilename: path.join(__dirname, '..', 'symphony-bigquery-key.json')
    });

    // Test 1: Check that all performances have at most 1 target
    console.log('📋 Test 1: Verifying target comp constraints...');
    const constraintQuery = `
      SELECT
        performance_id,
        COUNT(*) as target_count
      FROM \`kcsymphony.symphony_dashboard.performance_sales_comparisons\`
      WHERE is_target = TRUE
      GROUP BY performance_id
      HAVING COUNT(*) > 1
    `;

    const [violations] = await bigquery.query({
      query: constraintQuery,
      location: 'US'
    });

    if (violations.length > 0) {
      console.log('❌ VIOLATION: Multiple targets found for performances:');
      violations.forEach(v => {
        console.log(`   - ${v.performance_id}: ${v.target_count} targets`);
      });
    } else {
      console.log('✅ All performances have at most 1 target comp\n');
    }

    // Test 2: Count total comps and targets
    console.log('📊 Test 2: Summary statistics...');
    const statsQuery = `
      SELECT
        COUNT(*) as total_comps,
        SUM(CASE WHEN is_target = TRUE THEN 1 ELSE 0 END) as target_comps,
        COUNT(DISTINCT performance_id) as performances_with_comps
      FROM \`kcsymphony.symphony_dashboard.performance_sales_comparisons\`
    `;

    const [stats] = await bigquery.query({
      query: statsQuery,
      location: 'US'
    });

    const summary = stats[0];
    console.log(`   Total comps: ${summary.total_comps}`);
    console.log(`   Target comps: ${summary.target_comps}`);
    console.log(`   Performances with comps: ${summary.performances_with_comps}`);
    console.log('');

    // Test 3: Show sample performance with comp details
    console.log('📋 Test 3: Sample performance comp data...');
    const sampleQuery = `
      SELECT
        performance_id,
        comparison_name,
        is_target,
        line_color,
        line_style,
        weeks_data
      FROM \`kcsymphony.symphony_dashboard.performance_sales_comparisons\`
      WHERE performance_id = '251101E'
      ORDER BY is_target DESC
    `;

    const [samples] = await bigquery.query({
      query: sampleQuery,
      location: 'US'
    });

    console.log('   Performance: 251101E (CS2 Rach Sat)');
    samples.forEach(comp => {
      const targetMarker = comp.is_target ? '🎯 [TARGET]' : '  ';
      const weeksPreview = comp.weeks_data.split(',').slice(0, 5).join(',') + '...';
      console.log(`   ${targetMarker} ${comp.comparison_name}`);
      console.log(`      Color: ${comp.line_color}, Style: ${comp.line_style}`);
      console.log(`      Weeks: ${weeksPreview}`);
    });
    console.log('');

    // Test 4: Verify orange color for targets
    console.log('📋 Test 4: Checking target comp styling...');
    const styleQuery = `
      SELECT
        performance_id,
        comparison_name,
        line_color,
        line_style
      FROM \`kcsymphony.symphony_dashboard.performance_sales_comparisons\`
      WHERE is_target = TRUE
      LIMIT 5
    `;

    const [styleTests] = await bigquery.query({
      query: styleQuery,
      location: 'US'
    });

    styleTests.forEach(comp => {
      const colorOk = comp.line_color === '#ff6b35' ? '✅' : '❌';
      const styleOk = comp.line_style === 'solid' ? '✅' : '❌';
      console.log(`   ${colorOk} ${styleOk} ${comp.performance_id}: ${comp.comparison_name}`);
      console.log(`      Color: ${comp.line_color} (expected #ff6b35)`);
      console.log(`      Style: ${comp.line_style} (expected solid)`);
    });
    console.log('');

    console.log('✅ All tests complete!');
    console.log('\n💡 Next: Open http://localhost:8888 and click on a performance to see the target comp visualization');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testTargetComps();
