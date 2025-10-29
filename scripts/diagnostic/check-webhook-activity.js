// Check recent webhook activity in BigQuery
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
      // It's JSON content
      credentials = JSON.parse(credentialsEnv);
    } else {
      // It's a file path
      const credentialsFile = path.resolve(credentialsEnv);
      console.log(`🔐 Loading credentials from file: ${credentialsFile}`);
      const credentialsJson = fs.readFileSync(credentialsFile, 'utf8');
      credentials = JSON.parse(credentialsJson);
    }

    // Fix escaped newlines, which is common in env vars
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

async function checkRecentWebhookActivity() {
  console.log('🔍 Checking recent webhook activity...\n');

  const bigquery = initializeBigQuery();

  // Check pipeline execution log for recent webhook executions
  const pipelineQuery = `
    SELECT
      execution_id,
      start_time,
      end_time,
      status,
      records_processed,
      records_inserted,
      records_updated
    FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.symphony_dashboard.pipeline_execution_log\`
    WHERE pipeline_type = 'pdf_webhook'
    ORDER BY start_time DESC
    LIMIT 10
  `;

  try {
    const [pipelineRows] = await bigquery.query({ query: pipelineQuery, location: 'US' });

    console.log('📊 Recent Pipeline Executions:');
    console.log('='.repeat(80));
    pipelineRows.forEach(row => {
      const startTime = new Date(row.start_time.value).toLocaleString();
      const endTime = row.end_time ? new Date(row.end_time.value).toLocaleString() : 'running';
      console.log(`🚀 ${row.execution_id}`);
      console.log(`   Status: ${row.status}`);
      console.log(`   Time: ${startTime} → ${endTime}`);
      console.log(`   Records: ${row.records_processed || 0} processed, ${row.records_inserted || 0} inserted, ${row.records_updated || 0} updated\n`);
    });

    if (pipelineRows.length === 0) {
      console.log('   No webhook executions found in pipeline_execution_log\n');
    }

  } catch (error) {
    console.error('Error checking pipeline log:', error.message);
  }

  // Check data snapshots for recent webhook snapshots
  const snapshotQuery = `
    SELECT
      snapshot_id,
      snapshot_date,
      source_identifier,
      performance_count,
      total_tickets_in_snapshot,
      total_revenue_in_snapshot,
      processing_status
    FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.symphony_dashboard.data_snapshots\`
    WHERE source_type = 'pdf_webhook'
    ORDER BY snapshot_id DESC
    LIMIT 5
  `;

  try {
    const [snapshotRows] = await bigquery.query({ query: snapshotQuery, location: 'US' });

    console.log('📸 Recent Data Snapshots:');
    console.log('='.repeat(80));
    snapshotRows.forEach(row => {
      console.log(`📋 ${row.snapshot_id}`);
      console.log(`   File: ${row.source_identifier}`);
      console.log(`   Date: ${row.snapshot_date}`);
      console.log(`   Data: ${row.performance_count} performances, ${row.total_tickets_in_snapshot || 0} tickets, $${row.total_revenue_in_snapshot || 0} revenue`);
      console.log(`   Status: ${row.processing_status}\n`);
    });

    if (snapshotRows.length === 0) {
      console.log('   No webhook snapshots found\n');
    }

  } catch (error) {
    console.error('Error checking snapshots:', error.message);
  }
}

// Run the check
checkRecentWebhookActivity().catch(console.error);