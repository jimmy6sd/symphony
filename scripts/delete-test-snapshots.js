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
  credentials: { client_email: credentials.client_email, private_key: credentials.private_key },
  location: 'US'
});

const deleteQuery = `
  DELETE FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
  WHERE performance_code = '250902E' AND source != 'migration'
`;

bigquery.query({ query: deleteQuery, location: 'US' })
  .then(() => console.log('✅ Deleted test snapshots for 250902E'))
  .catch(console.error);
