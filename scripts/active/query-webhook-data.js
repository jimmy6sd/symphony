// Quick script to query what's in the webhook data table
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

  if (credentials.private_key?.includes('\\\\n')) {
    credentials.private_key = credentials.private_key.replace(/\\\\n/g, '\n');
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

async function queryWebhookData() {
  const bigquery = initializeBigQuery();
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;

  // Check what tables exist
  console.log('🔍 Checking available tables...\n');

  const tablesQuery = `
    SELECT table_name
    FROM \`${projectId}.symphony_dashboard.INFORMATION_SCHEMA.TABLES\`
  `;

  const [tables] = await bigquery.query({ query: tablesQuery, location: 'US' });
  console.log('📊 Available tables:');
  tables.forEach(t => console.log(`  - ${t.table_name}`));

  // Check weekly_sales count
  const countQuery = `
    SELECT COUNT(*) as count
    FROM \`${projectId}.symphony_dashboard.weekly_sales\`
  `;

  const [countResult] = await bigquery.query({ query: countQuery, location: 'US' });
  console.log(`\n📈 weekly_sales record count: ${countResult[0].count}`);

  // Get sample data
  if (countResult[0].count > 0) {
    const sampleQuery = `
      SELECT *
      FROM \`${projectId}.symphony_dashboard.weekly_sales\`
      ORDER BY created_at DESC
      LIMIT 5
    `;

    const [sampleRows] = await bigquery.query({ query: sampleQuery, location: 'US' });
    console.log('\n📋 Sample records (most recent):');
    console.log('='.repeat(80));
    sampleRows.forEach((row, i) => {
      console.log(`\n${i + 1}. Performance Code: ${row.performance_code}`);
      console.log(`   Week: ${row.week_number} (${row.weeks_until_performance} weeks until)`);
      console.log(`   Single Tickets: ${row.single_tickets_sold}`);
      console.log(`   Subscription Tickets: ${row.subscription_tickets_sold}`);
      console.log(`   Total Revenue: $${row.total_revenue?.toLocaleString() || 0}`);
      console.log(`   Import Date: ${row.import_date}`);
    });
  }
}

queryWebhookData().catch(console.error);
