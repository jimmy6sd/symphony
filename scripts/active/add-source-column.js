// Add 'source' column to performance_sales_comparisons table
// Tracks whether rows were created by excel_import or manual API usage
const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

async function addSourceColumn() {
  try {
    console.log('Adding source column to performance_sales_comparisons table...\n');

    const bigquery = new BigQuery({
      projectId: 'kcsymphony',
      keyFilename: path.join(__dirname, '..', '..', 'symphony-bigquery-key.json')
    });

    const tableName = '`kcsymphony.symphony_dashboard.performance_sales_comparisons`';

    // Add source column
    console.log('Adding column: source (STRING)...');

    const addColumnQuery = `
      ALTER TABLE ${tableName}
      ADD COLUMN IF NOT EXISTS source STRING
    `;

    try {
      const [job] = await bigquery.createQueryJob({
        query: addColumnQuery,
        location: 'US'
      });
      await job.getQueryResults();
      console.log('source column added!\n');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('source column already exists, skipping...\n');
      } else {
        throw error;
      }
    }

    // Backfill existing rows with 'excel_import'
    console.log('Backfilling existing rows with source = "excel_import"...');

    const backfillQuery = `
      UPDATE ${tableName}
      SET source = 'excel_import'
      WHERE source IS NULL
    `;

    const [backfillJob] = await bigquery.createQueryJob({
      query: backfillQuery,
      location: 'US'
    });
    const [backfillResult] = await backfillJob.getQueryResults();
    console.log(`Backfill complete! (${backfillJob.metadata.statistics.query.numDmlAffectedRows || 0} rows updated)\n`);

    // Verify
    console.log('Verifying...');
    const dataset = bigquery.dataset('symphony_dashboard');
    const table = dataset.table('performance_sales_comparisons');
    const [metadata] = await table.getMetadata();

    console.log('\nTable Schema:');
    metadata.schema.fields.forEach(field => {
      const marker = field.name === 'source' ? '  <-- NEW' : '';
      console.log(`   - ${field.name} (${field.type})${marker}`);
    });

    console.log('\nDone! All existing rows now have source = "excel_import".');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

addSourceColumn();
