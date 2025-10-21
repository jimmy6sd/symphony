// Populate performance metadata (capacity, budget_goal) from Weekly Sales Report
// This script sets the initial values that can then be edited via the metadata endpoint

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

async function populateMetadata() {
  const bigquery = initializeBigQuery();
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony';
  const datasetId = 'symphony_dashboard';

  console.log('📊 Populating metadata from Weekly Sales Report...\n');

  // This would typically read from your Weekly Sales Report spreadsheet
  // For now, showing the structure with example data

  // Example metadata structure (from "Performances by Week" worksheet):
  const metadataUpdates = [
    {
      performance_code: '251010E',
      capacity: 1440,      // From Column AG
      budget_goal: 122000  // From Column M
    },
    {
      performance_code: '251011E',
      capacity: 1440,
      budget_goal: 132000
    }
    // ... add more performances
  ];

  console.log(`📋 Updating ${metadataUpdates.length} performances with metadata...\n`);

  for (const update of metadataUpdates) {
    const query = `
      UPDATE \`${projectId}.${datasetId}.performances\`
      SET
        capacity = ${update.capacity},
        budget_goal = ${update.budget_goal},
        updated_at = CURRENT_TIMESTAMP()
      WHERE performance_code = '${update.performance_code}'
    `;

    try {
      await bigquery.query({ query, location: 'US' });
      console.log(`✅ ${update.performance_code}: capacity=${update.capacity}, budget=$${update.budget_goal.toLocaleString()}`);
    } catch (error) {
      console.error(`❌ Failed to update ${update.performance_code}:`, error.message);
    }
  }

  console.log(`\n✅ Metadata population complete!`);
  console.log('   These values can now be edited via the /update-metadata endpoint\n');
}

populateMetadata().catch(console.error);
