const { BigQuery } = require('@google-cloud/bigquery');

async function getTableDetails() {
  const bigquery = new BigQuery({
    projectId: 'kcsymphony',
    keyFilename: './symphony-bigquery-key.json'
  });

  const tables = ['performances', 'weekly_sales', 'performance_sales_snapshots', 'performance_sales_comparisons'];

  for (const tableName of tables) {
    console.log(`\n📊 TABLE: ${tableName}`);
    console.log('='.repeat(60));

    try {
      const table = bigquery.dataset('symphony_dashboard').table(tableName);
      const [metadata] = await table.getMetadata();

      console.log('Description:', metadata.description || 'N/A');
      console.log('\nColumns:');
      metadata.schema.fields.forEach(field => {
        const nullable = field.mode === 'NULLABLE' ? '(nullable)' : '(required)';
        console.log(`  - ${field.name}: ${field.type} ${nullable}`);
      });

      // Get sample data
      const query = `SELECT * FROM \`kcsymphony.symphony_dashboard.${tableName}\` LIMIT 2`;
      const [rows] = await bigquery.query({ query, location: 'US' });

      console.log(`\nSample data (${rows.length} rows):`);
      if (rows.length > 0) {
        console.log(JSON.stringify(rows[0], null, 2));
      }

      // Get row count
      const countQuery = `SELECT COUNT(*) as count FROM \`kcsymphony.symphony_dashboard.${tableName}\``;
      const [countRows] = await bigquery.query({ query: countQuery, location: 'US' });
      console.log(`\nTotal rows: ${countRows[0].count}`);

    } catch (error) {
      console.error(`Error: ${error.message}`);
    }
  }
}

getTableDetails().catch(console.error);
