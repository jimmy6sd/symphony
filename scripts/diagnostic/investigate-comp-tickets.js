const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony',
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

async function investigateCompTickets() {
  console.log('=== INVESTIGATING COMP TICKETS DATA ISSUE ===\n');

  // Query 1: Check if comp_tickets matches previous day's single_tickets_sold
  console.log('Query 1: Checking if comp_tickets = previous day single_tickets_sold\n');

  const query1 = `
    SELECT
      snapshot_date,
      comp_tickets,
      single_tickets_sold,
      LAG(single_tickets_sold) OVER (ORDER BY snapshot_date) as prev_day_singles,
      CASE
        WHEN comp_tickets = LAG(single_tickets_sold) OVER (ORDER BY snapshot_date)
        THEN 'MATCH'
        ELSE 'no match'
      END as lag_check
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    WHERE performance_code = '251215M'
    AND comp_tickets > 0
    ORDER BY snapshot_date
    LIMIT 20
  `;

  try {
    const [rows1] = await bigquery.query(query1);

    console.table(rows1.map(row => ({
      snapshot_date: row.snapshot_date.value,
      comp_tickets: row.comp_tickets,
      single_tickets_sold: row.single_tickets_sold,
      prev_day_singles: row.prev_day_singles,
      lag_check: row.lag_check
    })));

    // Query 2: Show early snapshots to see when comp_tickets became non-zero
    console.log('\n\nQuery 2: First 30 snapshots for performance 251215M\n');

    const query2 = `
      SELECT
        snapshot_date,
        comp_tickets,
        single_tickets_sold,
        total_tickets_sold,
        single_revenue,
        total_revenue
      FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
      WHERE performance_code = '251215M'
      ORDER BY snapshot_date
      LIMIT 30
    `;

    const [rows2] = await bigquery.query(query2);

    console.table(rows2.map(row => ({
      snapshot_date: row.snapshot_date.value,
      comp_tickets: row.comp_tickets,
      single_tickets_sold: row.single_tickets_sold,
      total_tickets_sold: row.total_tickets_sold,
      single_revenue: row.single_revenue ? `$${row.single_revenue.toFixed(2)}` : '$0.00',
      total_revenue: row.total_revenue ? `$${row.total_revenue.toFixed(2)}` : '$0.00'
    })));

    console.log('\n=== ANALYSIS COMPLETE ===');

  } catch (error) {
    console.error('Error querying BigQuery:', error);
    throw error;
  }
}

investigateCompTickets().catch(console.error);
