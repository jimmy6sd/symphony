const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const initializeBigQuery = () => {
  const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  let credentials;

  if (credentialsEnv.startsWith('{')) {
    credentials = JSON.parse(credentialsEnv);
  } else {
    const credentialsFile = path.resolve(credentialsEnv);
    credentials = JSON.parse(fs.readFileSync(credentialsFile, 'utf8'));
  }

  if (credentials.private_key?.includes('\\n')) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  }

  return new BigQuery({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || credentials.project_id,
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
    location: 'US'
  });
};

async function checkCS02() {
  const bigquery = initializeBigQuery();
  const query = `
    SELECT performance_code, title, performance_date, capacity, budget_goal
    FROM \`kcsymphony.symphony_dashboard.performances\`
    WHERE performance_code IN ('251102E', '251102M')
    ORDER BY performance_code
  `;

  const [rows] = await bigquery.query({ query, location: 'US' });
  console.log(`CS02 Rachmaninoff on Nov 2, 2025:\n`);
  rows.forEach(row => {
    console.log(`  ${row.performance_code}: ${row.title}`);
    console.log(`    Capacity: ${row.capacity}, Budget: $${row.budget_goal?.toLocaleString()}`);
  });
}

checkCS02().catch(console.error);
