const { BigQuery } = require('@google-cloud/bigquery');

async function verifySnapshots() {
  const bigquery = new BigQuery({
    projectId: 'kcsymphony',
    location: 'US'
  });

  const query = `
    SELECT
      snapshot_date,
      COUNT(*) as num_performances,
      COUNT(DISTINCT performance_code) as unique_performances
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    WHERE source = 'pdf_reprocess'
    GROUP BY snapshot_date
    ORDER BY snapshot_date
  `;

  console.log('📅 Snapshot Dates Summary:\n');

  const [rows] = await bigquery.query({ query });

  rows.forEach(row => {
    console.log(`  ${row.snapshot_date.value}: ${row.num_performances} snapshots (${row.unique_performances} unique performances)`);
  });

  console.log(`\n✅ Total: ${rows.length} unique snapshot dates`);
}

verifySnapshots().catch(console.error);
