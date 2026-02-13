const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony',
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

async function getSchema() {
  const dataset = bigquery.dataset('symphony_dashboard');
  const table = dataset.table('performance_sales_snapshots');
  const [metadata] = await table.getMetadata();
  console.log('Schema for performance_sales_snapshots:\n');
  metadata.schema.fields.forEach(field => {
    console.log(`  ${field.name.padEnd(30)} ${field.type.padEnd(10)} ${field.mode || 'NULLABLE'}`);
  });
}

getSchema().catch(console.error);
