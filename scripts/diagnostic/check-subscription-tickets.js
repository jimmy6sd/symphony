const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');
require('dotenv').config();

const bigquery = new BigQuery({
  projectId: 'kcsymphony',
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, '..', '..', 'symphony-bigquery-key.json')
});

async function checkSubscriptionTickets() {
  console.log('\n=== SUBSCRIPTION TICKETS CHECK ===\n');

  const query = `
    SELECT
      performance_code,
      snapshot_date,
      single_tickets_sold,
      subscription_tickets_sold,
      comp_tickets,
      total_tickets_sold,
      source
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    WHERE subscription_tickets_sold IS NOT NULL
    AND subscription_tickets_sold > 0
    AND snapshot_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 5 DAY)
    ORDER BY snapshot_date DESC
    LIMIT 10
  `;

  const [rows] = await bigquery.query(query);

  if (rows.length > 0) {
    console.table(rows.map(row => ({
      performance_code: row.performance_code,
      snapshot_date: row.snapshot_date.value,
      single_tickets: row.single_tickets_sold,
      subscription_tickets: row.subscription_tickets_sold,
      comp_tickets: row.comp_tickets || 0,
      total_tickets: row.total_tickets_sold,
      source: row.source
    })));
  } else {
    console.log('⚠️  No subscription tickets found in last 5 days');
  }
}

checkSubscriptionTickets().catch(console.error);
