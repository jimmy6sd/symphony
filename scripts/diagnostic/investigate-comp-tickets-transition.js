const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony',
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

async function investigateTransition() {
  console.log('=== INVESTIGATING COMP TICKETS TRANSITION ===\n');

  // Show snapshots around when comp_tickets first became non-null
  const query = `
    SELECT
      snapshot_date,
      comp_tickets,
      single_tickets_sold,
      total_tickets_sold,
      LAG(single_tickets_sold) OVER (ORDER BY snapshot_date) as prev_single_tickets,
      single_tickets_sold - COALESCE(LAG(single_tickets_sold) OVER (ORDER BY snapshot_date), 0) as single_tickets_change,
      comp_tickets - COALESCE(LAG(comp_tickets) OVER (ORDER BY snapshot_date), 0) as comp_tickets_change
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    WHERE performance_code = '251215M'
    AND snapshot_date >= '2025-11-25'
    AND snapshot_date <= '2025-12-20'
    ORDER BY snapshot_date
  `;

  try {
    const [rows] = await bigquery.query(query);

    console.table(rows.map(row => ({
      snapshot_date: row.snapshot_date.value,
      comp_tickets: row.comp_tickets || 0,
      single_tickets_sold: row.single_tickets_sold,
      total_tickets_sold: row.total_tickets_sold,
      prev_single_tickets: row.prev_single_tickets,
      single_change: row.single_tickets_change,
      comp_change: row.comp_tickets_change || 0
    })));

    console.log('\n=== KEY FINDINGS ===');
    console.log('Looking for the exact date comp_tickets first appeared...\n');

    // Find first non-null comp_tickets
    const firstCompQuery = `
      SELECT
        MIN(snapshot_date) as first_comp_date,
        (SELECT comp_tickets FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
         WHERE performance_code = '251215M' AND comp_tickets IS NOT NULL
         ORDER BY snapshot_date LIMIT 1) as first_comp_value,
        (SELECT single_tickets_sold FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
         WHERE performance_code = '251215M'
         AND snapshot_date = (
           SELECT DATE_SUB(MIN(snapshot_date), INTERVAL 1 DAY)
           FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
           WHERE performance_code = '251215M' AND comp_tickets IS NOT NULL
         )
         LIMIT 1) as prev_day_single_tickets
      FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
      WHERE performance_code = '251215M'
      AND comp_tickets IS NOT NULL
    `;

    const [firstCompRows] = await bigquery.query(firstCompQuery);
    console.log('First comp_tickets date:', firstCompRows[0].first_comp_date.value);
    console.log('First comp_tickets value:', firstCompRows[0].first_comp_value);
    console.log('Previous day single_tickets_sold:', firstCompRows[0].prev_day_single_tickets);

  } catch (error) {
    console.error('Error querying BigQuery:', error);
    throw error;
  }
}

investigateTransition().catch(console.error);
