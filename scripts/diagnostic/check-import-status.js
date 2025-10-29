const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

const bigquery = new BigQuery({
  projectId: 'kcsymphony',
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

async function checkStatus() {
  const query = `
    SELECT
      source,
      COUNT(*) as count,
      COUNT(DISTINCT snapshot_date) as unique_dates,
      MIN(snapshot_date) as earliest,
      MAX(snapshot_date) as latest
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    GROUP BY source
  `;

  const [rows] = await bigquery.query({ query, location: 'US' });

  console.log('Snapshots by source:');
  rows.forEach(r => {
    console.log(`  ${r.source}: ${r.count} snapshots`);
    console.log(`    Dates: ${r.unique_dates} unique (${r.earliest.value} to ${r.latest.value})`);
  });
}

checkStatus().catch(console.error);
