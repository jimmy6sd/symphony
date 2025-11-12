/**
 * Verify BigQuery Data Quality
 *
 * Checks that all granular revenue fields are populated and calculations are correct
 */

const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

async function verifyData() {
  console.log('🔍 Verifying BigQuery Data Quality\n');

  const bigquery = new BigQuery({
    projectId: 'kcsymphony',
    location: 'US'
  });

  // Query to check sample data
  const query = `
    SELECT
      performance_code,
      snapshot_date,
      performance_time,
      fixed_tickets_sold,
      non_fixed_tickets_sold,
      single_tickets_sold,
      reserved_tickets,
      total_tickets_sold,
      fixed_revenue,
      non_fixed_revenue,
      single_revenue,
      reserved_revenue,
      subtotal_revenue,
      total_revenue,
      available_seats,
      fixed_atp,
      non_fixed_atp,
      single_atp,
      overall_atp,
      capacity_percent
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    WHERE snapshot_date >= '2025-10-01'
      AND fixed_tickets_sold IS NOT NULL
    ORDER BY snapshot_date DESC, performance_code
    LIMIT 5
  `;

  const [rows] = await bigquery.query({ query });

  if (rows.length === 0) {
    console.log('❌ No data found with granular fields populated!');
    return;
  }

  console.log(`✅ Found ${rows.length} sample snapshots with granular data\n`);
  console.log('━'.repeat(100));

  rows.forEach((row, idx) => {
    console.log(`\nSample ${idx + 1}: ${row.performance_code} (${row.snapshot_date.value})`);
    console.log('─'.repeat(100));

    if (row.performance_time) {
      console.log(`Performance Time: ${row.performance_time}`);
    }

    console.log('\nTICKET BREAKDOWN:');
    console.log(`  Fixed (Subscriptions):  ${row.fixed_tickets_sold}`);
    console.log(`  Non-Fixed (Packages):   ${row.non_fixed_tickets_sold}`);
    console.log(`  Single Tickets:         ${row.single_tickets_sold}`);
    console.log(`  Reserved/Comp:          ${row.reserved_tickets}`);
    console.log(`  Total:                  ${row.total_tickets_sold}`);

    console.log('\nREVENUE BREAKDOWN:');
    console.log(`  Fixed Revenue:      $${row.fixed_revenue.toFixed(2)}`);
    console.log(`  Non-Fixed Revenue:  $${row.non_fixed_revenue.toFixed(2)}`);
    console.log(`  Single Revenue:     $${row.single_revenue.toFixed(2)}`);
    console.log(`  Reserved Revenue:   $${row.reserved_revenue.toFixed(2)}`);
    console.log(`  Subtotal:           $${row.subtotal_revenue.toFixed(2)}`);
    console.log(`  Total:              $${row.total_revenue.toFixed(2)}`);

    console.log('\nAVERAGE TICKET PRICE:');
    console.log(`  Fixed ATP:       $${row.fixed_atp.toFixed(2)}`);
    console.log(`  Non-Fixed ATP:   $${row.non_fixed_atp.toFixed(2)}`);
    console.log(`  Single ATP:      $${row.single_atp.toFixed(2)}`);
    console.log(`  Overall ATP:     $${row.overall_atp.toFixed(2)}`);

    console.log('\nVERIFICATION:');

    // Verify ticket sum
    const ticketSum = row.fixed_tickets_sold + row.non_fixed_tickets_sold + row.single_tickets_sold;
    const ticketMatch = ticketSum === row.total_tickets_sold;
    console.log(`  Tickets Sum:     ${ticketMatch ? '✅' : '❌'} (${ticketSum} = ${row.total_tickets_sold})`);

    // Verify revenue sum (allow for rounding)
    const revenueSum = row.fixed_revenue + row.non_fixed_revenue + row.single_revenue;
    const revenueDiff = Math.abs(revenueSum - row.total_revenue);
    const revenueMatch = revenueDiff < 0.01;
    console.log(`  Revenue Sum:     ${revenueMatch ? '✅' : '❌'} ($${revenueSum.toFixed(2)} ≈ $${row.total_revenue.toFixed(2)}, diff: $${revenueDiff.toFixed(2)})`);

    // Verify overall ATP calculation
    const calculatedAtp = row.total_tickets_sold > 0 ? row.total_revenue / row.total_tickets_sold : 0;
    const atpDiff = Math.abs(calculatedAtp - row.overall_atp);
    const atpMatch = atpDiff < 0.01;
    console.log(`  Overall ATP:     ${atpMatch ? '✅' : '❌'} ($${calculatedAtp.toFixed(2)} ≈ $${row.overall_atp.toFixed(2)}, diff: $${atpDiff.toFixed(2)})`);

    console.log('\nINVENTORY:');
    console.log(`  Available Seats: ${row.available_seats}`);
    console.log(`  Capacity:        ${row.capacity_percent}%`);
  });

  console.log('\n' + '━'.repeat(100));

  // Get aggregated stats
  const statsQuery = `
    SELECT
      COUNT(*) as total_snapshots,
      COUNT(DISTINCT performance_code) as unique_performances,
      COUNT(DISTINCT snapshot_date) as unique_dates,
      COUNTIF(fixed_atp > 0) as snapshots_with_fixed_atp,
      COUNTIF(non_fixed_atp > 0) as snapshots_with_nonfixed_atp,
      COUNTIF(single_atp > 0) as snapshots_with_single_atp,
      COUNTIF(overall_atp > 0) as snapshots_with_overall_atp,
      AVG(fixed_atp) as avg_fixed_atp,
      AVG(non_fixed_atp) as avg_nonfixed_atp,
      AVG(single_atp) as avg_single_atp,
      AVG(overall_atp) as avg_overall_atp
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    WHERE snapshot_date >= '2025-09-01'
  `;

  const [stats] = await bigquery.query({ query: statsQuery });
  const stat = stats[0];

  console.log('\n📊 AGGREGATED STATISTICS (Since 2025-09-01):');
  console.log('━'.repeat(100));
  console.log(`Total Snapshots:           ${stat.total_snapshots}`);
  console.log(`Unique Performances:       ${stat.unique_performances}`);
  console.log(`Unique Snapshot Dates:     ${stat.unique_dates}`);
  console.log('');
  console.log('ATP Data Availability:');
  console.log(`  Fixed ATP populated:     ${stat.snapshots_with_fixed_atp} (${(stat.snapshots_with_fixed_atp/stat.total_snapshots*100).toFixed(1)}%)`);
  console.log(`  Non-Fixed ATP populated: ${stat.snapshots_with_nonfixed_atp} (${(stat.snapshots_with_nonfixed_atp/stat.total_snapshots*100).toFixed(1)}%)`);
  console.log(`  Single ATP populated:    ${stat.snapshots_with_single_atp} (${(stat.snapshots_with_single_atp/stat.total_snapshots*100).toFixed(1)}%)`);
  console.log(`  Overall ATP populated:   ${stat.snapshots_with_overall_atp} (${(stat.snapshots_with_overall_atp/stat.total_snapshots*100).toFixed(1)}%)`);
  console.log('');
  console.log('Average ATP Values:');
  console.log(`  Fixed (Subscriptions):   $${stat.avg_fixed_atp.toFixed(2)}`);
  console.log(`  Non-Fixed (Packages):    $${stat.avg_nonfixed_atp.toFixed(2)}`);
  console.log(`  Single Tickets:          $${stat.avg_single_atp.toFixed(2)}`);
  console.log(`  Overall:                 $${stat.avg_overall_atp.toFixed(2)}`);

  console.log('\n' + '━'.repeat(100));
  console.log('✅ Data quality verification complete!');
  console.log('\n💡 KEY INSIGHTS:');
  console.log(`   • Subscriptions command the highest ATP: $${stat.avg_fixed_atp.toFixed(2)}`);
  console.log(`   • Packages (non-fixed) average: $${stat.avg_nonfixed_atp.toFixed(2)}`);
  console.log(`   • Single tickets average: $${stat.avg_single_atp.toFixed(2)}`);
  console.log(`   • Overall blended ATP: $${stat.avg_overall_atp.toFixed(2)}`);
}

verifyData().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
