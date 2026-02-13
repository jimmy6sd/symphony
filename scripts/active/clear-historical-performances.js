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

async function clear() {
  const query = `DELETE FROM \`kcsymphony.symphony_dashboard.ytd_historical_performances\` WHERE 1=1`;
  await bigquery.query({ query, location: 'US' });
  console.log('✅ Cleared ytd_historical_performances table');
}

clear().catch(console.error);
