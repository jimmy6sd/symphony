// Check the actual schema of weekly_sales table
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

async function checkTableSchema() {
  console.log('🔍 Checking weekly_sales table schema...\n');

  const bigquery = initializeBigQuery();

  // Check table schema
  const schemaQuery = `
    SELECT column_name, data_type, is_nullable
    FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.symphony_dashboard.INFORMATION_SCHEMA.COLUMNS\`
    WHERE table_name = 'weekly_sales'
    ORDER BY ordinal_position
  `;

  try {
    const [schemaRows] = await bigquery.query({ query: schemaQuery, location: 'US' });

    console.log('📊 weekly_sales table columns:');
    console.log('='.repeat(50));
    schemaRows.forEach(row => {
      console.log(`${row.column_name.padEnd(25)} ${row.data_type.padEnd(15)} ${row.is_nullable}`);
    });

    // Also check a sample row to see actual data
    const sampleQuery = `
      SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.symphony_dashboard.weekly_sales\`
      WHERE performance_code = '251010E' OR performance_code = '250903E'
      LIMIT 1
    `;

    const [sampleRows] = await bigquery.query({ query: sampleQuery, location: 'US' });

    if (sampleRows.length > 0) {
      console.log('\n📋 Sample row structure:');
      console.log('='.repeat(50));
      console.log(JSON.stringify(sampleRows[0], null, 2));
    } else {
      console.log('\n❌ No sample rows found');
    }

  } catch (error) {
    console.error('Error checking schema:', error.message);
  }
}

checkTableSchema().catch(console.error);