// Add cancelled column to performances table
const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

async function addCancelledColumn() {
  const bigquery = new BigQuery({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
  });

  const dataset = process.env.BIGQUERY_DATASET || 'symphony_dashboard';
  const table = 'performances';
  const tableRef = `${process.env.GOOGLE_CLOUD_PROJECT_ID}.${dataset}.${table}`;

  console.log(`Adding 'cancelled' column to ${dataset}.${table}...`);

  try {
    // Step 1: Add the column
    console.log('Step 1: Adding column...');
    const query1 = `ALTER TABLE \`${tableRef}\` ADD COLUMN IF NOT EXISTS cancelled BOOL`;

    const [job1] = await bigquery.createQueryJob({ query: query1, location: 'US' });
    await job1.getQueryResults();
    console.log('✅ Column added');

    // Step 2: Set default value
    console.log('Step 2: Setting default value...');
    const query2 = `ALTER TABLE \`${tableRef}\` ALTER COLUMN cancelled SET DEFAULT FALSE`;

    const [job2] = await bigquery.createQueryJob({ query: query2, location: 'US' });
    await job2.getQueryResults();
    console.log('✅ Default value set');

    // Step 3: Update existing rows
    console.log('Step 3: Updating existing rows...');
    const query3 = `UPDATE \`${tableRef}\` SET cancelled = FALSE WHERE cancelled IS NULL`;

    const [job3] = await bigquery.createQueryJob({ query: query3, location: 'US' });
    const [rows] = await job3.getQueryResults();
    console.log(`✅ Updated existing rows`);

    console.log('\n✅ Successfully added cancelled column');
    console.log('   - Column: cancelled');
    console.log('   - Type: BOOLEAN');
    console.log('   - Default: FALSE');
    console.log('   - All existing rows set to FALSE');
  } catch (error) {
    if (error.message.includes('Column already exists')) {
      console.log('✅ Column already exists, skipping...');
    } else {
      console.error('❌ Error adding column:', error.message);
      process.exit(1);
    }
  }
}

addCancelledColumn();
