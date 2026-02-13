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

async function check() {
  const [rows] = await bigquery.query({
    query: `
      SELECT season, COUNT(*) as cnt
      FROM \`kcsymphony.symphony_dashboard.ytd_historical_performances\`
      GROUP BY season
      ORDER BY season
    `,
    location: 'US'
  });
  console.log('Records by season:');
  rows.forEach(r => console.log('  ' + r.season + ': ' + r.cnt));

  // Check for STRAVINSKYS-FIREBIRD
  const [firebird] = await bigquery.query({
    query: `
      SELECT performance_code, season, single_tickets, subscription_tickets
      FROM \`kcsymphony.symphony_dashboard.ytd_historical_performances\`
      WHERE performance_code LIKE '%FIREBIRD%'
    `,
    location: 'US'
  });
  console.log('');
  console.log('Firebird records:');
  firebird.forEach(r => console.log('  ', r.performance_code, '| season:', r.season, '| single:', r.single_tickets, '| sub:', r.subscription_tickets));
}

check().catch(console.error);
