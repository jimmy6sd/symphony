// Add is_target column to performance_sales_comparisons table
const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

async function addTargetColumn() {
  try {
    console.log('🚀 Adding is_target column to performance_sales_comparisons table...\n');

    // Initialize BigQuery
    const bigquery = new BigQuery({
      projectId: 'kcsymphony',
      keyFilename: path.join(__dirname, '..', 'symphony-bigquery-key.json')
    });

    // Step 1: Add column without default
    console.log('📝 Step 1: Adding is_target column...');
    const addColumnQuery = `
      ALTER TABLE \`kcsymphony.symphony_dashboard.performance_sales_comparisons\`
      ADD COLUMN IF NOT EXISTS is_target BOOL
    `;

    const [job1] = await bigquery.createQueryJob({
      query: addColumnQuery,
      location: 'US'
    });
    await job1.getQueryResults();
    console.log('✅ Column added!\n');

    // Step 2: Set default value
    console.log('📝 Step 2: Setting default value to FALSE...');
    const setDefaultQuery = `
      ALTER TABLE \`kcsymphony.symphony_dashboard.performance_sales_comparisons\`
      ALTER COLUMN is_target SET DEFAULT FALSE
    `;

    const [job2] = await bigquery.createQueryJob({
      query: setDefaultQuery,
      location: 'US'
    });
    await job2.getQueryResults();
    console.log('✅ Default value set!\n');

    // Step 3: Update existing rows
    console.log('📝 Step 3: Updating existing rows to FALSE...');
    const updateQuery = `
      UPDATE \`kcsymphony.symphony_dashboard.performance_sales_comparisons\`
      SET is_target = FALSE
      WHERE TRUE
    `;

    const [job3] = await bigquery.createQueryJob({
      query: updateQuery,
      location: 'US'
    });
    const [rows] = await job3.getQueryResults();
    console.log('✅ Existing rows updated!\n');

    // Verify schema
    console.log('🔍 Verifying updated schema...');
    const dataset = bigquery.dataset('symphony_dashboard');
    const table = dataset.table('performance_sales_comparisons');
    const [metadata] = await table.getMetadata();

    console.log('📋 Updated Table Schema:');
    metadata.schema.fields.forEach(field => {
      const marker = field.name === 'is_target' ? '  ← NEW' : '';
      console.log(`   - ${field.name} (${field.type})${marker}`);
    });
    console.log('');

    console.log('✅ Schema update complete!');
    console.log('\n💡 Next step: Run import script to populate comps from CSV');

  } catch (error) {
    console.error('❌ Error adding column:', error.message);
    console.error(error);
    process.exit(1);
  }
}

addTargetColumn();
