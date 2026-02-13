const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony',
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

async function checkCompTimeline() {
  console.log('\n=== COMP_TICKETS TIMELINE ===\n');

  const query = `
    SELECT
      snapshot_date,
      COUNT(*) as total_snapshots,
      COUNT(comp_tickets) as snapshots_with_comp,
      MIN(comp_tickets) as min_comp,
      MAX(comp_tickets) as max_comp,
      SUM(comp_tickets) as total_comp
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    WHERE source = 'pdf_webhook'
    GROUP BY snapshot_date
    ORDER BY snapshot_date DESC
    LIMIT 20
  `;

  const [rows] = await bigquery.query(query);
  console.table(rows);

  console.log('\n=== DETAILED VIEW: FEB 12 vs FEB 13 ===\n');

  const detailQuery = `
    SELECT
      snapshot_date,
      performance_code,
      comp_tickets,
      single_tickets_sold,
      created_at
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    WHERE source = 'pdf_webhook'
    AND snapshot_date IN ('2026-02-12', '2026-02-13')
    AND performance_code = '251215M'
    ORDER BY snapshot_date DESC, created_at DESC
  `;

  const [details] = await bigquery.query(detailQuery);
  console.table(details);
}

checkCompTimeline().catch(console.error);
