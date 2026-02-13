const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
require('dotenv').config();

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './symphony-bigquery-key.json';
const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));

const bigquery = new BigQuery({
  projectId: 'kcsymphony',
  credentials: { client_email: creds.client_email, private_key: creds.private_key },
  location: 'US'
});

async function addColumns() {
  const dataset = bigquery.dataset('symphony_dashboard');
  const table = dataset.table('ytd_historical_performances');

  // Get current schema
  const [metadata] = await table.getMetadata();
  const currentSchema = metadata.schema.fields;

  // Add new revenue/ticket fields
  const newFields = [
    { name: 'single_revenue', type: 'FLOAT', mode: 'NULLABLE' },
    { name: 'subscription_revenue', type: 'FLOAT', mode: 'NULLABLE' },
    { name: 'total_revenue', type: 'FLOAT', mode: 'NULLABLE' },
    { name: 'single_tickets', type: 'INTEGER', mode: 'NULLABLE' },
    { name: 'subscription_tickets', type: 'INTEGER', mode: 'NULLABLE' },
    { name: 'total_tickets', type: 'INTEGER', mode: 'NULLABLE' }
  ];

  // Check if fields already exist
  const existingNames = currentSchema.map(f => f.name);
  const fieldsToAdd = newFields.filter(f => !existingNames.includes(f.name));

  if (fieldsToAdd.length === 0) {
    console.log('✅ All revenue/ticket fields already exist');
    return;
  }

  // Update schema
  metadata.schema.fields = [...currentSchema, ...fieldsToAdd];
  await table.setMetadata(metadata);

  console.log('✅ Added fields to ytd_historical_performances:');
  fieldsToAdd.forEach(f => console.log('  -', f.name));
}

addColumns().catch(console.error);
