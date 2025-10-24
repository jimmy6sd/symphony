// Check snapshot timeline to see if we have longitudinal data
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

async function checkSnapshotTimeline() {
  const bigquery = initializeBigQuery();
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const datasetId = process.env.BIGQUERY_DATASET || 'symphony_dashboard';

  console.log('📅 Checking snapshot timeline...\n');

  // Check all unique snapshot dates with source information
  const datesQuery = `
    SELECT
      snapshot_date,
      source,
      COUNT(*) as performance_count,
      COUNT(DISTINCT performance_code) as unique_perfs,
      SUM(total_tickets_sold) as total_tickets,
      SUM(total_revenue) as total_revenue,
      MIN(created_at) as first_created,
      MAX(created_at) as last_created
    FROM \`${projectId}.${datasetId}.performance_sales_snapshots\`
    GROUP BY snapshot_date, source
    ORDER BY snapshot_date DESC, source
    LIMIT 100
  `;

  const [dateRows] = await bigquery.query({ query: datesQuery, location: 'US' });

  console.log(`Found ${dateRows.length} snapshot date/source combinations:\n`);

  // Group by date
  const byDate = {};
  dateRows.forEach(row => {
    const date = typeof row.snapshot_date === 'object' ? row.snapshot_date.value : row.snapshot_date;
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(row);
  });

  Object.keys(byDate).sort().reverse().forEach(date => {
    console.log(`  📅 ${date}:`);
    byDate[date].forEach(row => {
      const created = typeof row.first_created === 'object' ? row.first_created.value : row.first_created;
      console.log(`     [${row.source}] ${row.unique_perfs} performances (${row.performance_count} snapshots)`);
      console.log(`        ${row.total_tickets} tickets, $${Math.round(row.total_revenue).toLocaleString()} revenue`);
      console.log(`        Created: ${created}`);
    });
    console.log('');
  });

  const uniqueDates = Object.keys(byDate).length;
  console.log(`\n📊 Total unique dates: ${uniqueDates}`);

  // Check for performances with multiple snapshots
  const multiSnapshotQuery = `
    SELECT
      performance_code,
      COUNT(DISTINCT snapshot_date) as unique_dates,
      MIN(snapshot_date) as first_snapshot,
      MAX(snapshot_date) as latest_snapshot,
      COUNT(*) as total_snapshots
    FROM \`${projectId}.${datasetId}.performance_sales_snapshots\`
    GROUP BY performance_code
    HAVING COUNT(DISTINCT snapshot_date) > 1
    ORDER BY unique_dates DESC, performance_code
  `;

  const [multiRows] = await bigquery.query({ query: multiSnapshotQuery, location: 'US' });

  if (multiRows.length > 0) {
    console.log(`✅ Found ${multiRows.length} performances with multiple snapshots:\n`);
    multiRows.forEach(row => {
      const first = typeof row.first_snapshot === 'object' ? row.first_snapshot.value : row.first_snapshot;
      const last = typeof row.latest_snapshot === 'object' ? row.latest_snapshot.value : row.latest_snapshot;
      console.log(`  ${row.performance_code}: ${row.unique_dates} dates (${first} to ${last})`);
    });
  } else {
    console.log('❌ No performances have multiple snapshot dates yet.');
    console.log('   All snapshots are from the initial migration.');
    console.log('');
    console.log('💡 To enable longitudinal tracking:');
    console.log('   1. Wait for new PDFs to arrive via webhook');
    console.log('   2. Or manually process a PDF: npm run test-webhook');
    console.log('   3. New snapshots will be added with current date');
  }

  console.log('');
}

checkSnapshotTimeline()
  .then(() => console.log('✅ Snapshot timeline check complete'))
  .catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
