const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony',
  keyFilename: './symphony-bigquery-key.json'
});

const DATASET_ID = process.env.BIGQUERY_DATASET || 'symphony_dashboard';
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony';

async function checkLatestData() {
  const query = `
    SELECT
      performance_code,
      title,
      performance_date,
      single_tickets_sold,
      subscription_tickets_sold,
      total_tickets_sold,
      total_revenue,
      capacity_percent,
      budget_percent,
      last_pdf_import_date,
      updated_at
    FROM \`${PROJECT_ID}.${DATASET_ID}.performances\`
    WHERE last_pdf_import_date IS NOT NULL
    ORDER BY updated_at DESC
    LIMIT 10
  `;

  const [rows] = await bigquery.query({ query, location: 'US' });

  console.log('\n📊 Latest PDF-updated performances:\n');
  rows.forEach(row => {
    console.log(`Performance: ${row.performance_code} - ${row.title}`);
    console.log(`  Date: ${row.performance_date?.value || row.performance_date}`);
    console.log(`  Single Tickets: ${row.single_tickets_sold}`);
    console.log(`  Subscription: ${row.subscription_tickets_sold}`);
    console.log(`  Total Sold: ${row.total_tickets_sold}`);
    console.log(`  Revenue: $${row.total_revenue?.toLocaleString() || 0}`);
    console.log(`  Capacity: ${row.capacity_percent}%`);
    console.log(`  Last PDF Import: ${row.last_pdf_import_date?.value || row.last_pdf_import_date}`);
    console.log(`  Updated: ${row.updated_at?.value || row.updated_at}`);
    console.log('');
  });
}

checkLatestData().catch(console.error);
