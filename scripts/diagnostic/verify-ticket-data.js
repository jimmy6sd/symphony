// Verify ticket data in performance_sales_snapshots
const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');
require('dotenv').config();

const initializeBigQuery = () => {
  const config = {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony',
    location: 'US'
  };

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    config.credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const keyFilePath = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    config.keyFilename = keyFilePath;
  } else {
    const fallbackKeyPath = path.join(__dirname, '..', '..', 'symphony-bigquery-key.json');
    config.keyFilename = fallbackKeyPath;
  }

  return new BigQuery(config);
};

async function verifyTicketData() {
  const bigquery = initializeBigQuery();
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony';
  const datasetId = process.env.BIGQUERY_DATASET || 'symphony_dashboard';

  console.log('Verifying ticket data in performance_sales_snapshots...\n');

  // Main verification query
  const query = `
    SELECT
      snapshot_date,
      performance_code,
      single_tickets_sold,
      fixed_tickets_sold,
      non_fixed_tickets_sold,
      subscription_tickets_sold,
      total_tickets_sold,
      (single_tickets_sold + fixed_tickets_sold + non_fixed_tickets_sold) as calculated_total,
      total_tickets_sold - (single_tickets_sold + fixed_tickets_sold + non_fixed_tickets_sold) as diff
    FROM \`${projectId}.${datasetId}.performance_sales_snapshots\`
    WHERE snapshot_date = '2025-11-17'
      AND performance_code IN ('251010E', '251011E', '251012M', '250919E', '250902E')
    ORDER BY performance_code
  `;

  try {
    const [rows] = await bigquery.query(query);

    console.log('Results for snapshot_date = 2025-11-17:\n');
    console.log('Performance | Single | Fixed | Non-Fixed | Subscription | Total | Calc | Diff');
    console.log('-'.repeat(85));

    let allPopulated = true;
    let mathCorrect = true;
    let subscriptionNull = true;

    rows.forEach(row => {
      const single = row.single_tickets_sold ?? 'NULL';
      const fixed = row.fixed_tickets_sold ?? 'NULL';
      const nonFixed = row.non_fixed_tickets_sold ?? 'NULL';
      const subscription = row.subscription_tickets_sold ?? 'NULL';
      const total = row.total_tickets_sold ?? 'NULL';
      const calc = row.calculated_total ?? 'NULL';
      const diff = row.diff ?? 'NULL';

      console.log(`${row.performance_code.padEnd(12)} | ${String(single).padStart(6)} | ${String(fixed).padStart(5)} | ${String(nonFixed).padStart(9)} | ${String(subscription).padStart(12)} | ${String(total).padStart(5)} | ${String(calc).padStart(4)} | ${String(diff).padStart(4)}`);

      // Check conditions
      if (row.single_tickets_sold === null || row.fixed_tickets_sold === null || row.non_fixed_tickets_sold === null) {
        allPopulated = false;
      }
      if (row.diff !== 0 && row.diff !== null) {
        mathCorrect = false;
      }
      if (row.subscription_tickets_sold !== null) {
        subscriptionNull = false;
      }
    });

    console.log('\n' + '='.repeat(85));
    console.log('\nVERIFICATION RESULTS:');
    console.log(`1. Are single, fixed, non_fixed ALL populated? ${allPopulated ? 'YES' : 'NO'}`);
    console.log(`2. Does single + fixed + non_fixed = total? ${mathCorrect ? 'YES' : 'NO'}`);
    console.log(`3. Is subscription_tickets_sold NULL (but fixed has data)? ${subscriptionNull ? 'YES' : 'NO'}`);

    if (allPopulated && mathCorrect && subscriptionNull) {
      console.log('\n*** CONCLUSION: This is a QUERY PROBLEM, not a data problem! ***');
      console.log('The API is likely selecting subscription_tickets_sold (NULL) instead of fixed_tickets_sold.');
    } else {
      console.log('\n*** CONCLUSION: There may be a data issue that needs investigation. ***');
    }

    // Also show what columns actually exist
    console.log('\n\nChecking actual column values for one performance...\n');
    const detailQuery = `
      SELECT *
      FROM \`${projectId}.${datasetId}.performance_sales_snapshots\`
      WHERE snapshot_date = '2025-11-17'
        AND performance_code = '251010E'
      LIMIT 1
    `;

    const [detailRows] = await bigquery.query(detailQuery);
    if (detailRows.length > 0) {
      console.log('All columns for 251010E:');
      Object.entries(detailRows[0]).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    }

  } catch (error) {
    console.error('Query failed:', error.message);
    process.exit(1);
  }
}

verifyTicketData().catch(console.error);
