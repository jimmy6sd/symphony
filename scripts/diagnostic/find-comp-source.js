const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony',
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

async function findCompSource() {
  console.log('\n=== CHECKING FOR TRIGGERS AND VIEWS ===\n');

  // Check for SQL views
  const viewsQuery = `
    SELECT table_name, view_definition
    FROM \`kcsymphony.symphony_dashboard.INFORMATION_SCHEMA.VIEWS\`
    WHERE view_definition LIKE '%comp_tickets%'
  `;

  try {
    const [views] = await bigquery.query(viewsQuery);
    console.log('Views with comp_tickets:');
    console.table(views);
  } catch (err) {
    console.log('No views found or error:', err.message);
  }

  // Check table schema with generation expression
  console.log('\n=== TABLE SCHEMA ===\n');
  const schemaQuery = `
    SELECT column_name, data_type, is_generated, generation_expression
    FROM \`kcsymphony.symphony_dashboard.INFORMATION_SCHEMA.COLUMNS\`
    WHERE table_name = 'performance_sales_snapshots'
    AND column_name = 'comp_tickets'
  `;

  try {
    const [schema] = await bigquery.query(schemaQuery);
    console.table(schema);
  } catch (err) {
    console.log('Error checking schema:', err.message);
  }

  // Check for any scripts or functions that reference comp_tickets
  console.log('\n=== ROUTINES (FUNCTIONS/PROCEDURES) ===\n');
  const routinesQuery = `
    SELECT routine_name, routine_type, routine_definition
    FROM \`kcsymphony.symphony_dashboard.INFORMATION_SCHEMA.ROUTINES\`
    WHERE routine_definition LIKE '%comp_tickets%'
  `;

  try {
    const [routines] = await bigquery.query(routinesQuery);
    if (routines.length > 0) {
      console.table(routines);
    } else {
      console.log('No routines found with comp_tickets');
    }
  } catch (err) {
    console.log('No routines found or error:', err.message);
  }

  // Query to understand the relationship between comp_tickets and other fields
  console.log('\n=== ANALYZING COMP_TICKETS PATTERNS ===\n');
  const patternQuery = `
    SELECT
      source,
      COUNT(*) as total_rows,
      COUNT(DISTINCT CASE
        WHEN comp_tickets = single_tickets_sold THEN 1
      END) as comp_equals_single,
      COUNT(DISTINCT CASE
        WHEN comp_tickets != single_tickets_sold THEN 1
      END) as comp_not_equals_single,
      COUNT(DISTINCT CASE
        WHEN comp_tickets IS NULL THEN 1
      END) as comp_is_null
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    WHERE comp_tickets IS NOT NULL OR comp_tickets > 0
    GROUP BY source
  `;

  const [patterns] = await bigquery.query(patternQuery);
  console.table(patterns);

  // Sample data comparison
  console.log('\n=== SAMPLE DATA: COMP vs SINGLE TICKETS ===\n');
  const sampleQuery = `
    SELECT
      performance_code,
      snapshot_date,
      comp_tickets,
      single_tickets_sold,
      fixed_tickets_sold,
      non_fixed_tickets_sold,
      source,
      CASE
        WHEN comp_tickets = single_tickets_sold THEN 'EQUAL'
        WHEN comp_tickets > single_tickets_sold THEN 'COMP > SINGLE'
        WHEN comp_tickets < single_tickets_sold THEN 'COMP < SINGLE'
        ELSE 'COMP IS NULL'
      END as relationship
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    WHERE source = 'pdf_webhook'
    ORDER BY snapshot_date DESC
    LIMIT 10
  `;

  const [samples] = await bigquery.query(sampleQuery);
  console.table(samples);
}

findCompSource().catch(console.error);
