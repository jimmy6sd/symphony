require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');

const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
let credentials;
if (credentialsEnv.startsWith('{')) {
  credentials = JSON.parse(credentialsEnv);
} else {
  credentials = JSON.parse(fs.readFileSync(path.resolve(credentialsEnv), 'utf8'));
}

const bq = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || credentials.project_id,
  credentials: { client_email: credentials.client_email, private_key: credentials.private_key },
  location: 'US',
});

async function main() {
  // Query 1: Top funnel landing pages that look like concert pages (30 days)
  console.log('=== QUERY 1: Top funnel landing pages with add_to_cart (30 days) ===\n');
  const [landingPages] = await bq.query({
    query: `
      SELECT
        REGEXP_EXTRACT(
          (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location'),
          r'https?://[^/]+(/[^?#]*)'
        ) AS path,
        COUNT(*) AS events,
        COUNTIF(event_name = 'add_to_cart') AS atc_events
      FROM \`kcsymphony.analytics_445499663.events_*\`
      WHERE _TABLE_SUFFIX >= FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY))
        AND event_name IN ('session_start', 'add_to_cart')
      GROUP BY path
      HAVING atc_events > 5
      ORDER BY atc_events DESC
      LIMIT 40
    `,
  });

  for (const row of landingPages) {
    console.log(`  ${String(row.atc_events).padStart(5)} atc | ${String(row.events).padStart(6)} events | ${row.path}`);
  }
  console.log(`\n  Total rows: ${landingPages.length}\n`);

  // Query 2: Performance table schema
  console.log('=== QUERY 2: performances table schema ===\n');
  const [schemaCols] = await bq.query({
    query: `
      SELECT column_name, data_type
      FROM \`kcsymphony.symphony_dashboard.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = 'performances'
      ORDER BY ordinal_position
    `,
  });

  for (const col of schemaCols) {
    console.log(`  ${col.column_name.padEnd(35)} ${col.data_type}`);
  }
  console.log(`\n  Total columns: ${schemaCols.length}\n`);

  // Query 3: Sample performance data (20 most recent)
  console.log('=== QUERY 3: 20 most recent performances ===\n');
  const [perfRows] = await bq.query({
    query: `
      SELECT *
      FROM \`kcsymphony.symphony_dashboard.performances\`
      ORDER BY performance_date DESC
      LIMIT 20
    `,
  });

  if (perfRows.length > 0) {
    const cols = Object.keys(perfRows[0]);
    console.log(`  Columns: ${cols.join(', ')}\n`);
    for (const row of perfRows) {
      console.log('  ---');
      for (const col of cols) {
        const val = row[col];
        const display = val && typeof val === 'object' && val.value !== undefined ? val.value : val;
        console.log(`    ${col}: ${display}`);
      }
    }
  }
  console.log(`\n  Total rows: ${perfRows.length}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
