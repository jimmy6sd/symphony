const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');
require('dotenv').config();

const bigquery = new BigQuery({
  projectId: 'kcsymphony',
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, '..', '..', 'symphony-bigquery-key.json')
});

async function generateCompSummary() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║        COMP TICKETS DATA IMPORT - SUMMARY REPORT             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // 1. Get overall stats
  console.log('📊 OVERALL STATISTICS:\n');
  const statsQuery = `
    SELECT
      COUNT(DISTINCT performance_code) as total_performances,
      COUNT(*) as total_snapshots,
      COUNTIF(comp_tickets IS NOT NULL) as snapshots_with_comp_data,
      COUNTIF(comp_tickets > 0) as snapshots_with_actual_comps,
      COUNTIF(comp_tickets = 0) as snapshots_with_zero_comps,
      MIN(CASE WHEN comp_tickets IS NOT NULL THEN snapshot_date END) as first_comp_date,
      MAX(CASE WHEN comp_tickets IS NOT NULL THEN snapshot_date END) as latest_comp_date,
      SUM(comp_tickets) as total_comp_tickets_issued
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
  `;

  const [statsRows] = await bigquery.query(statsQuery);
  const stats = statsRows[0];

  console.log(`Total Performances:               ${stats.total_performances}`);
  console.log(`Total Snapshots:                  ${stats.total_snapshots}`);
  console.log(`Snapshots with Comp Data:         ${stats.snapshots_with_comp_data}`);
  console.log(`  - With Actual Comps (> 0):      ${stats.snapshots_with_actual_comps}`);
  console.log(`  - With Zero Comps:              ${stats.snapshots_with_zero_comps}`);
  console.log(`Total Comp Tickets Issued:        ${stats.total_comp_tickets_issued}`);
  console.log(`First Comp Date:                  ${stats.first_comp_date?.value || 'N/A'}`);
  console.log(`Latest Comp Date:                 ${stats.latest_comp_date?.value || 'N/A'}`);

  // 2. Check today's comp import status
  console.log('\n📅 TODAY\'S COMP DATA STATUS:\n');
  const todayQuery = `
    SELECT
      COUNT(DISTINCT performance_code) as performances_tracked,
      COUNT(*) as snapshots_today,
      COUNTIF(comp_tickets IS NOT NULL) as snapshots_with_comp_data,
      COUNTIF(comp_tickets > 0) as performances_with_comps,
      SUM(comp_tickets) as total_comps_today,
      ROUND(AVG(CASE WHEN comp_tickets > 0 THEN comp_tickets END), 1) as avg_comps_per_perf
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    WHERE snapshot_date = CURRENT_DATE()
  `;

  const [todayRows] = await bigquery.query(todayQuery);
  const today = todayRows[0];

  console.log(`Performances Tracked Today:       ${today.performances_tracked}`);
  console.log(`Snapshots Today:                  ${today.snapshots_today}`);
  console.log(`Snapshots with Comp Data:         ${today.snapshots_with_comp_data}`);
  console.log(`Performances with Comps:          ${today.performances_with_comps}`);
  console.log(`Total Comps Today:                ${today.total_comps_today}`);
  console.log(`Avg Comps per Performance:        ${today.avg_comps_per_perf || 0}`);

  // 3. Check for data quality issues
  console.log('\n🔍 DATA QUALITY CHECKS:\n');

  // Check for "all comps" pattern (past performances where single/sub = 0)
  const qualityQuery = `
    SELECT COUNT(*) as suspicious_count
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    WHERE comp_tickets > 0
    AND single_tickets_sold = 0
    AND subscription_tickets_sold = 0
    AND snapshot_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  `;

  const [qualityRows] = await bigquery.query(qualityQuery);
  const suspicious = qualityRows[0].suspicious_count;

  if (suspicious > 0) {
    console.log(`⚠️  Found ${suspicious} snapshots with "all comps" pattern`);
    console.log('    (This happens when Tessitura reclassifies past performance tickets)');
  } else {
    console.log('✅ No suspicious "all comps" patterns detected (last 30 days)');
  }

  // 4. Recent import trend
  console.log('\n📈 IMPORT TREND (Last 7 Days):\n');
  const trendQuery = `
    SELECT
      snapshot_date,
      COUNT(DISTINCT performance_code) as performances,
      COUNTIF(comp_tickets > 0) as with_comps,
      SUM(comp_tickets) as total_comps
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    WHERE snapshot_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
    AND comp_tickets IS NOT NULL
    GROUP BY snapshot_date
    ORDER BY snapshot_date DESC
  `;

  const [trendRows] = await bigquery.query(trendQuery);
  console.table(trendRows.map(row => ({
    date: row.snapshot_date.value,
    performances: row.performances,
    with_comps: row.with_comps,
    total_comps: row.total_comps
  })));

  // 5. Sample recent performances with comps
  console.log('\n📋 SAMPLE PERFORMANCES WITH COMPS (Today):\n');
  const sampleQuery = `
    SELECT
      performance_code,
      single_tickets_sold,
      comp_tickets,
      total_tickets_sold,
      ROUND(comp_tickets * 100.0 / NULLIF(total_tickets_sold, 0), 1) as comp_percent
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    WHERE snapshot_date = CURRENT_DATE()
    AND comp_tickets > 0
    ORDER BY comp_tickets DESC
    LIMIT 10
  `;

  const [sampleRows] = await bigquery.query(sampleQuery);
  console.table(sampleRows.map(row => ({
    performance_code: row.performance_code,
    single_tickets: row.single_tickets_sold,
    comp_tickets: row.comp_tickets,
    total_tickets: row.total_tickets_sold,
    comp_percent: row.comp_percent + '%'
  })));

  // 6. Import source breakdown
  console.log('\n📦 DATA SOURCE BREAKDOWN:\n');
  const sourceQuery = `
    SELECT
      source,
      COUNT(*) as total_snapshots,
      COUNTIF(comp_tickets IS NOT NULL) as with_comp_data,
      COUNTIF(comp_tickets > 0) as with_actual_comps,
      ROUND(COUNTIF(comp_tickets IS NOT NULL) * 100.0 / COUNT(*), 1) as comp_data_coverage_pct
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    GROUP BY source
    ORDER BY with_comp_data DESC
  `;

  const [sourceRows] = await bigquery.query(sourceQuery);
  console.table(sourceRows.map(row => ({
    source: row.source,
    total_snapshots: row.total_snapshots,
    with_comp_data: row.with_comp_data,
    with_actual_comps: row.with_actual_comps,
    coverage: row.comp_data_coverage_pct + '%'
  })));

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    SUMMARY COMPLETE                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Final assessment
  const coveragePercent = (stats.snapshots_with_comp_data / stats.total_snapshots) * 100;
  const recentCoverage = today.snapshots_with_comp_data / today.snapshots_today * 100;

  console.log('🎯 ASSESSMENT:\n');
  console.log(`Overall Comp Data Coverage:       ${coveragePercent.toFixed(1)}%`);
  console.log(`Today's Comp Data Coverage:       ${recentCoverage.toFixed(1)}%`);

  if (suspicious === 0 && recentCoverage > 90) {
    console.log('\n✅ STATUS: Comp data import is working correctly!');
    console.log('   - No data quality issues detected');
    console.log('   - Good coverage on recent imports');
    console.log('   - "All comps" fix appears to be working\n');
  } else if (suspicious > 0) {
    console.log('\n⚠️  STATUS: Some data quality issues detected');
    console.log('   - Review the "all comps" pattern findings above\n');
  } else {
    console.log('\n⚠️  STATUS: Coverage could be improved');
    console.log(`   - Only ${recentCoverage.toFixed(1)}% of today's snapshots have comp data\n`);
  }
}

generateCompSummary().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
