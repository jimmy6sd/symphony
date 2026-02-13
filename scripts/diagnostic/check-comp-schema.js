const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony',
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

async function checkCompSchema() {
  console.log('\n=== COMP_TICKETS COLUMN SCHEMA ===\n');

  const query = `
    SELECT column_name, data_type, is_nullable
    FROM \`kcsymphony.symphony_dashboard.INFORMATION_SCHEMA.COLUMNS\`
    WHERE table_name = 'performance_sales_snapshots'
    AND column_name LIKE '%comp%'
  `;

  const [rows] = await bigquery.query(query);
  console.table(rows);

  console.log('\n=== SAMPLE COMP_TICKETS DATA ===\n');

  const sampleQuery = `
    SELECT
      performance_code,
      snapshot_date,
      comp_tickets,
      single_tickets_sold,
      source
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    WHERE comp_tickets > 0
    ORDER BY snapshot_date DESC
    LIMIT 5
  `;

  const [samples] = await bigquery.query(sampleQuery);
  console.table(samples);
}

checkCompSchema().catch(console.error);
