const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony',
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

async function analyzeCompSource() {
  console.log('=== ANALYZING COMP_TICKETS DATA SOURCE ===\n');

  // Get a sample of snapshots with comp_tickets from pdf_webhook source
  const query = `
    SELECT
      snapshot_id,
      performance_code,
      snapshot_date,
      comp_tickets,
      single_tickets_sold,
      total_tickets_sold,
      source,
      created_at,
      LAG(single_tickets_sold) OVER (PARTITION BY performance_code ORDER BY snapshot_date) as prev_day_singles
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    WHERE performance_code = '251215M'
    AND source = 'pdf_webhook'
    AND comp_tickets IS NOT NULL
    ORDER BY snapshot_date
    LIMIT 20
  `;

  try {
    const [rows] = await bigquery.query(query);

    console.log('PDF_WEBHOOK snapshots with comp_tickets:\n');

    console.table(rows.map(row => ({
      snapshot_date: row.snapshot_date.value,
      comp_tickets: row.comp_tickets,
      single_tickets_sold: row.single_tickets_sold,
      prev_day_singles: row.prev_day_singles,
      matches_current_singles: row.comp_tickets === row.single_tickets_sold ? 'YES' : 'no',
      matches_prev_singles: row.comp_tickets === row.prev_day_singles ? 'YES' : 'no',
      created_at: row.created_at.value
    })));

    // Check if comp_tickets column has a default value or is computed
    console.log('\n\nChecking table schema for comp_tickets column:\n');

    const dataset = bigquery.dataset('symphony_dashboard');
    const table = dataset.table('performance_sales_snapshots');
    const [metadata] = await table.getMetadata();

    const compField = metadata.schema.fields.find(f => f.name === 'comp_tickets');
    console.log('comp_tickets field definition:');
    console.log(JSON.stringify(compField, null, 2));

  } catch (error) {
    console.error('Error querying BigQuery:', error);
    throw error;
  }
}

analyzeCompSource().catch(console.error);
