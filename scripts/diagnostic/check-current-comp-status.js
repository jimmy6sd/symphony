const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');
require('dotenv').config();

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony',
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, '..', '..', 'symphony-bigquery-key.json')
});

async function checkCompStatus() {
  console.log('=== COMP TICKETS DATA STATUS ===\n');

  // 1. Overall comp data by source
  console.log('1. COMP TICKETS BY SOURCE:\n');
  const query1 = `
    SELECT
      source,
      COUNT(*) as total_snapshots,
      COUNTIF(comp_tickets > 0) as snapshots_with_comps,
      COUNTIF(comp_tickets = 0) as snapshots_zero_comps,
      COUNTIF(comp_tickets IS NULL) as snapshots_null_comps,
      MIN(CASE WHEN comp_tickets > 0 THEN comp_tickets END) as min_comp_value,
      MAX(comp_tickets) as max_comp_value,
      ROUND(AVG(comp_tickets), 2) as avg_comp_value
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    GROUP BY source
    ORDER BY snapshots_with_comps DESC
  `;

  const [rows1] = await bigquery.query(query1);
  console.table(rows1);

  // 2. Recent comp imports (last 7 days)
  console.log('\n2. RECENT COMP DATA IMPORTS (last 7 days):\n');
  const query2 = `
    SELECT
      snapshot_date,
      source,
      COUNT(*) as performances_count,
      SUM(comp_tickets) as total_comp_tickets,
      COUNTIF(comp_tickets > 0) as performances_with_comps,
      COUNTIF(single_tickets_sold = 0 AND subscription_tickets_sold = 0 AND comp_tickets > 0) as suspicious_all_comp_performances
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    WHERE snapshot_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
    AND comp_tickets IS NOT NULL
    GROUP BY snapshot_date, source
    ORDER BY snapshot_date DESC, source
    LIMIT 20
  `;

  const [rows2] = await bigquery.query(query2);
  console.table(rows2.map(row => ({
    snapshot_date: row.snapshot_date.value,
    source: row.source,
    performances_count: row.performances_count,
    total_comp_tickets: row.total_comp_tickets,
    performances_with_comps: row.performances_with_comps,
    suspicious_all_comp: row.suspicious_all_comp_performances
  })));

  // 3. Check for the "all comps" issue (past performances where Package/Single/Discount = 0)
  console.log('\n3. PERFORMANCES WITH "ALL COMPS" PATTERN (potential data quality issue):\n');
  const query3 = `
    SELECT
      performance_code,
      snapshot_date,
      single_tickets_sold,
      subscription_tickets_sold,
      comp_tickets,
      total_tickets_sold,
      source
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    WHERE comp_tickets > 0
    AND single_tickets_sold = 0
    AND subscription_tickets_sold = 0
    AND snapshot_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    ORDER BY snapshot_date DESC
    LIMIT 20
  `;

  const [rows3] = await bigquery.query(query3);
  if (rows3.length > 0) {
    console.table(rows3.map(row => ({
      performance_code: row.performance_code,
      snapshot_date: row.snapshot_date.value,
      single_tickets: row.single_tickets_sold,
      subscription_tickets: row.subscription_tickets_sold,
      comp_tickets: row.comp_tickets,
      total_tickets: row.total_tickets_sold,
      source: row.source
    })));
    console.log(`\n⚠️  Found ${rows3.length} snapshots with "all comps" pattern`);
    console.log('This typically happens when Tessitura reclassifies past performance tickets.');
  } else {
    console.log('✅ No "all comps" issues found in last 30 days!');
  }

  // 4. Sample of good comp data
  console.log('\n4. SAMPLE OF VALID COMP DATA (last 5 days):\n');
  const query4 = `
    SELECT
      performance_code,
      snapshot_date,
      single_tickets_sold,
      subscription_tickets_sold,
      comp_tickets,
      total_tickets_sold,
      source
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    WHERE comp_tickets > 0
    AND (single_tickets_sold > 0 OR subscription_tickets_sold > 0)
    AND snapshot_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 5 DAY)
    ORDER BY snapshot_date DESC
    LIMIT 10
  `;

  const [rows4] = await bigquery.query(query4);
  console.table(rows4.map(row => ({
    performance_code: row.performance_code,
    snapshot_date: row.snapshot_date.value,
    single_tickets: row.single_tickets_sold,
    package_tickets: row.package_tickets_sold,
    comp_tickets: row.comp_tickets,
    total_tickets: row.total_tickets_sold,
    source: row.source
  })));

  console.log('\n✅ Comp status check complete!\n');
}

checkCompStatus().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
