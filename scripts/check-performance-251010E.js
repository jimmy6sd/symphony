// Check if performance 251010E was updated with the new data
const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Initialize BigQuery with same logic as webhook
const initializeBigQuery = () => {
  try {
    const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (!credentialsEnv) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable not set');
    }

    let credentials;

    // Check if it's a file path or JSON content
    if (credentialsEnv.startsWith('{')) {
      credentials = JSON.parse(credentialsEnv);
    } else {
      const credentialsFile = path.resolve(credentialsEnv);
      const credentialsJson = fs.readFileSync(credentialsFile, 'utf8');
      credentials = JSON.parse(credentialsJson);
    }

    if (credentials.private_key && credentials.private_key.includes('\\\\n')) {
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
  } catch (error) {
    console.error('BigQuery initialization error:', error.message);
    throw error;
  }
};

async function checkPerformance() {
  console.log('🔍 Checking performance 251010E data...\n');

  const bigquery = initializeBigQuery();

  // Check if performance 251010E exists and its current data
  const query = `
    SELECT
      performance_id,
      performance_code,
      title,
      performance_date,
      single_tickets_sold,
      subscription_tickets_sold,
      total_revenue,
      updated_at
    FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.symphony_dashboard.performances\`
    WHERE performance_code = '251010E'
    ORDER BY updated_at DESC
    LIMIT 5
  `;

  try {
    const [rows] = await bigquery.query({ query: query, location: 'US' });

    if (rows.length > 0) {
      console.log(`📋 Found ${rows.length} records for performance 251010E:`);
      console.log('='.repeat(80));
      rows.forEach((row, index) => {
        console.log(`Record ${index + 1}:`);
        console.log(`  Performance ID: ${row.performance_id}`);
        console.log(`  Code: ${row.performance_code}`);
        console.log(`  Title: ${row.title}`);
        console.log(`  Date: ${row.performance_date}`);
        console.log(`  Single Tickets: ${row.single_tickets_sold}`);
        console.log(`  Subscription Tickets: ${row.subscription_tickets_sold}`);
        console.log(`  Total Revenue: $${row.total_revenue}`);
        console.log(`  Updated: ${row.updated_at}`);
        console.log('');
      });
    } else {
      console.log('❌ No records found for performance 251010E');
    }

  } catch (error) {
    console.error('Error checking performance:', error.message);
  }
}

checkPerformance().catch(console.error);