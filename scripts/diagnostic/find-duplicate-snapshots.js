const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony',
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

async function findDuplicates() {
  console.log('=== FINDING DUPLICATE SNAPSHOTS ===\n');

  // Find dates with multiple snapshots for the same performance
  const query = `
    SELECT
      performance_code,
      snapshot_date,
      COUNT(*) as snapshot_count,
      STRING_AGG(CONCAT('comp:', CAST(COALESCE(comp_tickets, 0) AS STRING), ' | singles:', CAST(single_tickets_sold AS STRING)), ' || ') as variations,
      STRING_AGG(source, ' | ') as sources,
      STRING_AGG(CAST(created_at AS STRING), ' | ') as created_times
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    WHERE performance_code = '251215M'
    GROUP BY performance_code, snapshot_date
    HAVING COUNT(*) > 1
    ORDER BY snapshot_date DESC
    LIMIT 30
  `;

  try {
    const [rows] = await bigquery.query(query);

    if (rows.length === 0) {
      console.log('No duplicate snapshots found for performance 251215M');
      return;
    }

    console.log(`Found ${rows.length} dates with duplicate snapshots:\n`);

    console.table(rows.map(row => ({
      performance_code: row.performance_code,
      snapshot_date: row.snapshot_date.value,
      count: row.snapshot_count,
      variations: row.variations,
      sources: row.sources
    })));

    // Get detailed view of one duplicate date
    console.log('\n\nDetailed view of most recent duplicate:\n');

    const detailQuery = `
      SELECT
        snapshot_id,
        snapshot_date,
        comp_tickets,
        single_tickets_sold,
        total_tickets_sold,
        source,
        created_at
      FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
      WHERE performance_code = '251215M'
      AND snapshot_date = '${rows[0].snapshot_date.value}'
      ORDER BY created_at
    `;

    const [detailRows] = await bigquery.query(detailQuery);

    console.table(detailRows.map(row => ({
      snapshot_id: row.snapshot_id,
      snapshot_date: row.snapshot_date.value,
      comp_tickets: row.comp_tickets,
      single_tickets_sold: row.single_tickets_sold,
      total_tickets_sold: row.total_tickets_sold,
      source: row.source,
      created_at: row.created_at.value
    })));

  } catch (error) {
    console.error('Error querying BigQuery:', error);
    throw error;
  }
}

findDuplicates().catch(console.error);
