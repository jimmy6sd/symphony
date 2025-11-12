const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

async function checkATP() {
  const bigquery = new BigQuery({ projectId: 'kcsymphony', location: 'US' });

  const query = `
    SELECT
      performance_code,
      snapshot_date,
      single_tickets_sold,
      total_tickets_sold,
      single_revenue,
      total_revenue,
      single_atp,
      overall_atp,
      fixed_atp,
      non_fixed_atp,
      fixed_tickets_sold,
      non_fixed_tickets_sold,
      fixed_revenue,
      non_fixed_revenue
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    WHERE performance_code = '251122E'
    ORDER BY snapshot_date DESC
    LIMIT 5
  `;

  const [rows] = await bigquery.query({ query });

  console.log('\n📊 ATP Data for 251122E (most recent 5 snapshots):\n');
  console.log('━'.repeat(120));

  rows.forEach((row, idx) => {
    console.log(`\nSnapshot ${idx + 1}: ${row.snapshot_date.value}`);
    console.log('  Tickets:');
    console.log(`    Fixed: ${row.fixed_tickets_sold}, Non-Fixed: ${row.non_fixed_tickets_sold}, Single: ${row.single_tickets_sold}, Total: ${row.total_tickets_sold}`);
    console.log('  Revenue:');
    console.log(`    Fixed: $${row.fixed_revenue}, Non-Fixed: $${row.non_fixed_revenue}, Single: $${row.single_revenue}, Total: $${row.total_revenue}`);
    console.log('  ATP (from BigQuery):');
    console.log(`    Single ATP: $${row.single_atp}`);
    console.log(`    Overall ATP: $${row.overall_atp}`);
    console.log(`    Fixed ATP: $${row.fixed_atp}`);
    console.log(`    Non-Fixed ATP: $${row.non_fixed_atp}`);
    console.log('  Manual Verification:');
    console.log(`    Single ATP (calculated): $${row.single_tickets_sold > 0 ? (row.single_revenue / row.single_tickets_sold).toFixed(2) : 'N/A'}`);
    console.log(`    Overall ATP (calculated): $${row.total_tickets_sold > 0 ? (row.total_revenue / row.total_tickets_sold).toFixed(2) : 'N/A'}`);
    console.log(`    Revenue sum check: $${row.fixed_revenue} + $${row.non_fixed_revenue} + $${row.single_revenue} = $${row.fixed_revenue + row.non_fixed_revenue + row.single_revenue} (should equal $${row.total_revenue})`);
  });
}

checkATP().catch(console.error);
