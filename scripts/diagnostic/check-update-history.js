// Check when performances were last updated to find the gap
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

async function checkUpdateHistory() {
  const bigquery = initializeBigQuery();
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const datasetId = 'symphony_dashboard';

  console.log('📅 Checking update history...\n');

  const query = `
    SELECT
      DATE(last_pdf_import_date) as import_date,
      COUNT(*) as updates,
      SUM(total_tickets_sold) as total_tickets
    FROM \`${projectId}.${datasetId}.performances\`
    WHERE last_pdf_import_date IS NOT NULL
    GROUP BY import_date
    ORDER BY import_date DESC
    LIMIT 30
  `;

  const [rows] = await bigquery.query({ query, location: 'US' });

  console.log('Update history (by date):');
  console.log('=' .repeat(60));
  rows.forEach(row => {
    const date = typeof row.import_date === 'object' ? row.import_date.value : row.import_date;
    console.log(`  ${date}: ${row.updates} performances, ${row.total_tickets} tickets`);
  });

  console.log('');
  console.log('📊 Analysis:');
  if (rows.length >= 2) {
    const latest = rows[0];
    const previous = rows[1];
    const latestDate = typeof latest.import_date === 'object' ? latest.import_date.value : latest.import_date;
    const prevDate = typeof previous.import_date === 'object' ? previous.import_date.value : previous.import_date;

    const latestTime = new Date(latestDate);
    const prevTime = new Date(prevDate);
    const daysBetween = Math.floor((latestTime - prevTime) / (1000 * 60 * 60 * 24));

    console.log(`  Latest update: ${latestDate}`);
    console.log(`  Previous update: ${prevDate}`);
    console.log(`  Gap: ${daysBetween} days`);

    if (daysBetween > 7) {
      console.log('');
      console.log('  ⚠️  LARGE GAP DETECTED!');
      console.log(`     No updates for ${daysBetween} days suggests webhook stopped working`);
    }
  }
}

checkUpdateHistory()
  .then(() => console.log('\n✅ History check complete'))
  .catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
