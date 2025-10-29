// Check what data the webhook actually inserted
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

async function checkWebhookData() {
  const bigquery = initializeBigQuery();
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;

  console.log('🔍 Checking for data inserted by webhook...\n');

  // Check for performances WITH sales data
  const query = `
    SELECT *
    FROM \`${projectId}.symphony_dashboard.performances\`
    WHERE has_sales_data = true
    ORDER BY updated_at DESC
  `;

  const [rows] = await bigquery.query({ query, location: 'US' });

  if (rows.length > 0) {
    console.log(`✅ Found ${rows.length} performances with sales data!\n`);

    rows.forEach((row, i) => {
      console.log(`${i + 1}. ${row.title}`);
      console.log(`   Code: ${row.performance_code}`);
      console.log(`   Date: ${row.performance_date.value}`);
      console.log(`   Single Tickets: ${row.single_tickets_sold}`);
      console.log(`   Subscription Tickets: ${row.subscription_tickets_sold}`);
      console.log(`   Total Revenue: $${row.total_revenue?.toLocaleString()}`);
      console.log(`   Last PDF Import: ${row.last_pdf_import_date?.value || 'N/A'}`);
      console.log(`   Updated: ${row.updated_at.value}\n`);
    });
  } else {
    console.log('❌ No performances with sales data found.');
    console.log('\nThis means the webhook tests ran but didn\'t persist data to BigQuery.');
    console.log('Possible reasons:');
    console.log('  1. Webhook test data didn\'t match existing performances');
    console.log('  2. Test data was different from production schema');
    console.log('  3. Need to run webhook with real PDF data');
  }

  // Check all tables for any recent activity
  console.log('\n' + '='.repeat(60));
  console.log('Checking all tables for recent activity...\n');

  const tables = ['performances', 'weekly_sales'];

  for (const table of tables) {
    const countQuery = `
      SELECT COUNT(*) as count,
             MAX(created_at) as last_created
      FROM \`${projectId}.symphony_dashboard.${table}\`
    `;

    const [result] = await bigquery.query({ query: countQuery, location: 'US' });
    console.log(`📊 ${table}:`);
    console.log(`   Total records: ${result[0].count}`);
    console.log(`   Last created: ${result[0].last_created?.value || 'Never'}`);
  }
}

checkWebhookData().catch(console.error);
