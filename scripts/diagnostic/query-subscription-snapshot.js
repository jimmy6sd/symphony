require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');

const bq = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony',
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || './symphony-bigquery-key.json'
});

const query = `
SELECT
  category,
  package_name,
  SUM(package_seats) as total_seats,
  SUM(total_amount) as total_amount,
  SUM(paid_amount) as paid_amount,
  SUM(orders) as total_orders
FROM \`kcsymphony.symphony_dashboard.subscription_sales_snapshots\`
WHERE season = '26-27'
AND snapshot_date = '2026-03-05'
GROUP BY category, package_name
ORDER BY category, package_name
`;

bq.query(query).then(([rows]) => {
  console.log('ROW COUNT:', rows.length);
  rows.forEach(row => {
    console.log(JSON.stringify(row));
  });
}).catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
