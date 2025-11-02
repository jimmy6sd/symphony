const { BigQuery } = require('@google-cloud/bigquery');

async function checkNov2() {
  const bigquery = new BigQuery({
    projectId: 'kcsymphony',
    location: 'US'
  });

  // Check all data for Nov 2 regardless of source
  const query = `
    SELECT
      snapshot_date,
      source,
      COUNT(*) as count
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    WHERE snapshot_date = '2025-11-02'
    GROUP BY snapshot_date, source
    ORDER BY source
  `;

  console.log('🔍 Checking November 2nd data in all sources...\n');

  const [rows] = await bigquery.query({ query });

  if (rows.length === 0) {
    console.log('❌ No November 2nd data found in any source\n');

    // Check what the latest date is
    const latestQuery = `
      SELECT MAX(snapshot_date) as latest_date
      FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    `;
    const [latest] = await bigquery.query({ query: latestQuery });
    console.log(`📅 Latest snapshot date: ${latest[0].latest_date.value}\n`);
  } else {
    console.log('✅ November 2nd data found:\n');
    rows.forEach(row => {
      console.log(`  Source: ${row.source}, Count: ${row.count}`);
    });
    console.log();
  }
}

checkNov2().catch(console.error);
