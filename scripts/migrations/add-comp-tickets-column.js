/**
 * Add comp_tickets column to performance_sales_snapshots
 *
 * This migration adds a column to track complimentary tickets
 * from the "Performance Sales Summary by Price Type Category" PDF report.
 */

const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

const CONFIG = {
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony',
  dataset: 'symphony_dashboard',
  table: 'performance_sales_snapshots'
};

async function addCompTicketsColumn() {
  console.log('🎟️  Adding comp_tickets column');
  console.log('━'.repeat(60));
  console.log(`Project: ${CONFIG.projectId}`);
  console.log(`Table: ${CONFIG.dataset}.${CONFIG.table}`);
  console.log('━'.repeat(60));
  console.log('');

  const bigquery = new BigQuery({
    projectId: CONFIG.projectId,
    location: 'US'
  });

  try {
    const query = `
      ALTER TABLE \`${CONFIG.projectId}.${CONFIG.dataset}.${CONFIG.table}\`
      ADD COLUMN IF NOT EXISTS comp_tickets INT64
      OPTIONS(description="Complimentary tickets (comped seats) - from PTC PDF report")
    `;

    console.log('Running migration...');

    const [job] = await bigquery.createQueryJob({
      query,
      location: 'US',
    });

    await job.getQueryResults();

    console.log('✅ comp_tickets column added successfully');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Run process-ptc-pdf.js to import comp data from PDF');
    console.log('  2. Deploy pdf-webhook-ptc GCF for automated imports');

  } catch (error) {
    if (error.message?.includes('already exists')) {
      console.log('ℹ️  comp_tickets column already exists - skipping');
    } else {
      console.error('❌ Migration failed:', error.message);
      process.exit(1);
    }
  }
}

addCompTicketsColumn().catch(console.error);
