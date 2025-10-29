// Check what was actually parsed in the latest webhook snapshot
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

async function checkParsedData() {
  console.log('🔍 Checking parsed data from latest webhook snapshot...\n');

  const bigquery = initializeBigQuery();

  // Get the latest snapshot
  const snapshotQuery = `
    SELECT
      snapshot_id,
      source_identifier,
      raw_data,
      processed_data
    FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.symphony_dashboard.data_snapshots\`
    WHERE source_type = 'pdf_webhook'
    ORDER BY snapshot_id DESC
    LIMIT 1
  `;

  try {
    const [snapshotRows] = await bigquery.query({ query: snapshotQuery, location: 'US' });

    if (snapshotRows.length > 0) {
      const snapshot = snapshotRows[0];
      console.log(`📋 Latest Snapshot: ${snapshot.snapshot_id}`);
      console.log(`📁 File: ${snapshot.source_identifier}`);

      console.log('\n📊 Raw Data (input):');
      console.log('='.repeat(50));
      try {
        const rawData = JSON.parse(snapshot.raw_data);
        console.log(JSON.stringify(rawData, null, 2));
      } catch (error) {
        console.log('Raw data (not JSON):', snapshot.raw_data);
      }

      console.log('\n🎯 Processed Data (parsed performances):');
      console.log('='.repeat(50));
      try {
        const processedData = JSON.parse(snapshot.processed_data);
        console.log(JSON.stringify(processedData, null, 2));
      } catch (error) {
        console.log('Processed data (not JSON):', snapshot.processed_data);
      }

    } else {
      console.log('❌ No webhook snapshots found');
    }

  } catch (error) {
    console.error('Error checking parsed data:', error.message);
  }
}

checkParsedData().catch(console.error);