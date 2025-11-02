const { BigQuery } = require('@google-cloud/bigquery');

async function verifyAllSnapshots() {
  const bigquery = new BigQuery({
    projectId: 'kcsymphony',
    location: 'US'
  });

  // Check all snapshots by source
  const query1 = `
    SELECT
      source,
      COUNT(*) as total_snapshots,
      COUNT(DISTINCT snapshot_date) as unique_dates,
      COUNT(DISTINCT performance_code) as unique_performances,
      MIN(snapshot_date) as earliest_date,
      MAX(snapshot_date) as latest_date
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    GROUP BY source
    ORDER BY source
  `;

  console.log('📊 Snapshot Summary by Source:\n');
  const [rows1] = await bigquery.query({ query: query1 });

  rows1.forEach(row => {
    console.log(`  ${row.source}:`);
    console.log(`    Total snapshots: ${row.total_snapshots}`);
    console.log(`    Unique dates: ${row.unique_dates}`);
    console.log(`    Unique performances: ${row.unique_performances}`);
    console.log(`    Date range: ${row.earliest_date?.value} to ${row.latest_date?.value}`);
    console.log('');
  });

  // Check pdf_reprocess snapshots by date
  const query2 = `
    SELECT
      snapshot_date,
      COUNT(*) as num_snapshots
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    WHERE source = 'pdf_reprocess'
    GROUP BY snapshot_date
    ORDER BY snapshot_date
    LIMIT 50
  `;

  console.log('📅 PDF Reprocess Snapshots by Date:\n');
  const [rows2] = await bigquery.query({ query: query2 });

  rows2.forEach(row => {
    console.log(`  ${row.snapshot_date.value}: ${row.num_snapshots} snapshots`);
  });
}

verifyAllSnapshots().catch(console.error);
