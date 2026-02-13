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

async function clearFY25() {
  // First check how many records exist
  const [countResult] = await bigquery.query({
    query: `SELECT COUNT(*) as cnt FROM \`kcsymphony.symphony_dashboard.ytd_historical_performances\` WHERE season = '24-25'`,
    location: 'US'
  });
  console.log('FY25 records before delete:', countResult[0].cnt);

  // Delete FY25 data only (season = '24-25')
  const query = `DELETE FROM \`kcsymphony.symphony_dashboard.ytd_historical_performances\` WHERE season = '24-25'`;
  await bigquery.query({ query, location: 'US' });
  console.log('✅ Cleared FY25 (season 24-25) from ytd_historical_performances');
}

clearFY25().catch(console.error);
