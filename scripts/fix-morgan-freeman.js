// Fix the Morgan Freeman performance that was modified during testing
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

async function fixMorganFreeman() {
  console.log('🔧 Restoring original data for 250902E...\n');

  // Restore to original title and series
  const updateQuery = `
    UPDATE \`kcsymphony.symphony_dashboard.performances\`
    SET
      title = 'Morgan Freeman\\'s Symphonic Blu',
      series = 'Special Event',
      single_tickets_sold = 1164,
      subscription_tickets_sold = 0,
      total_tickets_sold = 1164,
      total_revenue = 137168,
      capacity_percent = 80.8,
      budget_percent = 0,
      updated_at = CURRENT_TIMESTAMP()
    WHERE performance_code = '250902E'
  `;

  await bigquery.query({ query: updateQuery, location: 'US' });

  console.log('✅ Restored 250902E to original data\n');

  // Verify
  const verifyQuery = `
    SELECT performance_code, title, series, total_tickets_sold, total_revenue
    FROM \`kcsymphony.symphony_dashboard.performances\`
    WHERE performance_code = '250902E'
  `;

  const [rows] = await bigquery.query({ query: verifyQuery, location: 'US' });
  const row = rows[0];

  console.log('📋 Verified:');
  console.log(`  Code: ${row.performance_code}`);
  console.log(`  Title: ${row.title}`);
  console.log(`  Series: ${row.series}`);
  console.log(`  Tickets: ${row.total_tickets_sold}`);
  console.log(`  Revenue: $${Math.round(row.total_revenue).toLocaleString()}\n`);

  console.log('✅ Fix complete!');
}

fixMorganFreeman().catch(console.error);
