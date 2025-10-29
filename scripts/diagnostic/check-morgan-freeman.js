const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const credentialsFile = path.resolve(credentialsEnv);
const credentials = JSON.parse(fs.readFileSync(credentialsFile, 'utf8'));

if (credentials.private_key?.includes('\\\\n')) {
  credentials.private_key = credentials.private_key.replace(/\\\\n/g, '\n');
}

const bigquery = new BigQuery({
  projectId: 'kcsymphony',
  credentials: {
    client_email: credentials.client_email,
    private_key: credentials.private_key,
  },
  location: 'US'
});

const query = `
  SELECT performance_code, title, series, single_tickets_sold, subscription_tickets_sold, total_revenue
  FROM \`kcsymphony.symphony_dashboard.performances\`
  WHERE performance_code LIKE '25090%'
  ORDER BY performance_code
`;

bigquery.query({ query, location: 'US' }).then(([rows]) => {
  console.log('Morgan Freeman performances:\n');
  rows.forEach(row => {
    console.log(`${row.performance_code}: ${row.title}`);
    console.log(`  Series: ${row.series}`);
    console.log(`  Tickets: ${row.single_tickets_sold + row.subscription_tickets_sold}`);
    console.log(`  Revenue: $${Math.round(row.total_revenue)}`);
    console.log('');
  });
}).catch(console.error);
