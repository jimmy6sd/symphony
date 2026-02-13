const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony',
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

async function traceCompTickets() {
  console.log('\n=== COMP TICKETS BY SOURCE ===\n');

  const query1 = `
    SELECT
      source,
      COUNT(*) as total_rows,
      COUNTIF(comp_tickets > 0) as rows_with_comps,
      COUNTIF(comp_tickets IS NULL) as rows_null_comps,
      MAX(comp_tickets) as max_comps,
      MIN(CASE WHEN comp_tickets > 0 THEN snapshot_date END) as first_comp_date,
      MAX(CASE WHEN comp_tickets > 0 THEN snapshot_date END) as last_comp_date
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    GROUP BY source
    ORDER BY rows_with_comps DESC
  `;

  const [rows1] = await bigquery.query(query1);
  console.table(rows1);

  console.log('\n=== COMP TICKETS FOR PERFORMANCE 251215M ===\n');

  const query2 = `
    SELECT snapshot_date, comp_tickets, single_tickets_sold, source
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    WHERE performance_code = '251215M'
    AND comp_tickets IS NOT NULL AND comp_tickets > 0
    ORDER BY snapshot_date
    LIMIT 10
  `;

  const [rows2] = await bigquery.query(query2);
  console.table(rows2);
}

traceCompTickets().catch(console.error);
