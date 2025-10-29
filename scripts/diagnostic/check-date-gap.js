const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

const bigquery = new BigQuery({
  projectId: 'kcsymphony',
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

async function checkDateGap() {
  console.log('Checking dates around Sept 30 / Oct 1...\n');

  const query = `
    SELECT
      snapshot_date,
      COUNT(*) as snapshot_count,
      COUNT(DISTINCT performance_code) as unique_performances
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    WHERE source = 'historical_pdf_import_v2'
      AND snapshot_date BETWEEN '2025-09-28' AND '2025-10-03'
    GROUP BY snapshot_date
    ORDER BY snapshot_date
  `;

  const [rows] = await bigquery.query({ query, location: 'US' });

  console.log('Date\t\t\tSnapshots\tPerformances');
  console.log('='.repeat(60));
  rows.forEach(r => {
    console.log(`${r.snapshot_date.value}\t\t${r.snapshot_count}\t\t${r.unique_performances}`);
  });

  console.log('\n\nAll dates in historical_pdf_import_v2:');
  console.log('='.repeat(60));

  const allDatesQuery = `
    SELECT
      snapshot_date,
      COUNT(*) as snapshot_count
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    WHERE source = 'historical_pdf_import_v2'
    GROUP BY snapshot_date
    ORDER BY snapshot_date
  `;

  const [allRows] = await bigquery.query({ query: allDatesQuery, location: 'US' });
  allRows.forEach(r => {
    console.log(`${r.snapshot_date.value}\t\t${r.snapshot_count} snapshots`);
  });
}

checkDateGap().catch(console.error);
