// Check when performances were last updated (to see if webhook is working)
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

async function checkRecentUpdates() {
  const bigquery = initializeBigQuery();
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const datasetId = process.env.BIGQUERY_DATASET || 'symphony_dashboard';

  console.log('🔍 Checking recent performance updates...\n');

  // Check performances table for recent updates
  const perfQuery = `
    SELECT
      performance_code,
      title,
      total_tickets_sold,
      total_revenue,
      last_pdf_import_date,
      updated_at
    FROM \`${projectId}.${datasetId}.performances\`
    WHERE last_pdf_import_date IS NOT NULL
    ORDER BY last_pdf_import_date DESC
    LIMIT 10
  `;

  const [perfRows] = await bigquery.query({ query: perfQuery, location: 'US' });

  if (perfRows.length > 0) {
    console.log('📊 Most recently updated performances:\n');
    perfRows.forEach((row, i) => {
      const lastImport = typeof row.last_pdf_import_date === 'object' ? row.last_pdf_import_date.value : row.last_pdf_import_date;
      const updated = typeof row.updated_at === 'object' ? row.updated_at.value : row.updated_at;
      console.log(`  ${i+1}. ${row.performance_code} - ${row.title?.substring(0, 30) || 'Unknown'}`);
      console.log(`     Tickets: ${row.total_tickets_sold}, Revenue: $${Math.round(row.total_revenue || 0).toLocaleString()}`);
      console.log(`     Last PDF import: ${lastImport}`);
      console.log(`     Updated: ${updated}`);
      console.log('');
    });
  } else {
    console.log('❌ No performances have last_pdf_import_date set\n');
  }

  // Check snapshot creation dates
  const snapQuery = `
    SELECT
      COUNT(*) as total_snapshots,
      COUNT(DISTINCT snapshot_date) as unique_dates,
      MIN(snapshot_date) as earliest_date,
      MAX(snapshot_date) as latest_date,
      MAX(created_at) as most_recent_creation
    FROM \`${projectId}.${datasetId}.performance_sales_snapshots\`
  `;

  const [snapRows] = await bigquery.query({ query: snapQuery, location: 'US' });
  const snap = snapRows[0];

  console.log('📸 Snapshot summary:\n');
  console.log(`  Total snapshots: ${snap.total_snapshots}`);
  console.log(`  Unique dates: ${snap.unique_dates}`);

  const earliest = typeof snap.earliest_date === 'object' ? snap.earliest_date.value : snap.earliest_date;
  const latest = typeof snap.latest_date === 'object' ? snap.latest_date.value : snap.latest_date;
  const mostRecent = typeof snap.most_recent_creation === 'object' ? snap.most_recent_creation.value : snap.most_recent_creation;

  console.log(`  Earliest snapshot date: ${earliest}`);
  console.log(`  Latest snapshot date: ${latest}`);
  console.log(`  Most recent creation: ${mostRecent}`);
  console.log('');

  // Diagnosis
  if (perfRows.length > 0) {
    const lastImport = typeof perfRows[0].last_pdf_import_date === 'object' ?
      perfRows[0].last_pdf_import_date.value : perfRows[0].last_pdf_import_date;
    const lastImportDate = new Date(lastImport);
    const today = new Date();
    const daysSince = Math.floor((today - lastImportDate) / (1000 * 60 * 60 * 24));

    console.log('🔍 Diagnosis:\n');
    console.log(`  ✅ Performances are being updated (last update: ${daysSince} days ago)`);

    if (snap.unique_dates === 1) {
      console.log(`  ❌ BUT snapshots are NOT being created`);
      console.log(`  ⚠️  Webhook is updating performances table but skipping snapshot creation`);
      console.log('');
      console.log('💡 Solution:');
      console.log('  The dual-write code in pdf-webhook.js may be failing silently');
      console.log('  Check Netlify function logs for errors during snapshot INSERT');
    } else {
      console.log(`  ✅ Snapshots are being created (${snap.unique_dates} unique dates)`);
    }
  } else {
    console.log('🔍 Diagnosis:\n');
    console.log('  ❌ Webhook has NOT updated any performances recently');
    console.log('  ⚠️  Either webhook is not receiving PDFs, or it\'s failing');
  }
}

checkRecentUpdates()
  .then(() => console.log('\n✅ Recent updates check complete'))
  .catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
