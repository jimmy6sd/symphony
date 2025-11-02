const { BigQuery } = require('@google-cloud/bigquery');

async function checkPerformanceProgression() {
  const bigquery = new BigQuery({
    projectId: 'kcsymphony',
    location: 'US'
  });

  // Check a specific performance across all dates
  const query = `
    SELECT
      snapshot_date,
      source,
      total_tickets_sold,
      total_revenue,
      capacity_percent
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    WHERE performance_code = '251011E'
    ORDER BY snapshot_date
    LIMIT 50
  `;

  console.log('📈 Performance 251011E Sales Progression:\n');
  const [rows] = await bigquery.query({ query });

  rows.forEach(row => {
    console.log(
      `  ${row.snapshot_date.value}: ` +
      `${row.total_tickets_sold} tickets, ` +
      `$${row.total_revenue.toFixed(2)}, ` +
      `${row.capacity_percent.toFixed(1)}% capacity ` +
      `[source: ${row.source}]`
    );
  });

  console.log(`\n✅ Total snapshots for this performance: ${rows.length}`);
}

checkPerformanceProgression().catch(console.error);
