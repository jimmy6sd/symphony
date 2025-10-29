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

const query = `
  SELECT performance_code, title, series, updated_at
  FROM \`kcsymphony.symphony_dashboard.performances\`
  WHERE updated_at > TIMESTAMP('2025-10-21 19:00:00')
  ORDER BY updated_at DESC
  LIMIT 10
`;

bigquery.query({ query, location: 'US' })
  .then(([rows]) => {
    console.log('Performances updated during testing:\n');
    if (rows.length === 0) {
      console.log('✅ No unexpected changes found');
    } else {
      rows.forEach(row => {
        const updatedAt = typeof row.updated_at === 'object' ? row.updated_at.value : row.updated_at;
        console.log(`  ${row.performance_code}: ${row.title}`);
        console.log(`    Series: ${row.series}`);
        console.log(`    Updated: ${updatedAt}`);
        console.log('');
      });
    }
  })
  .catch(console.error);
