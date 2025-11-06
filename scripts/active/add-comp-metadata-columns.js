// Add new metadata columns to performance_sales_comparisons table
// New columns: comp_date, atp, subs, capacity, occupancy_percent
const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

async function addCompMetadataColumns() {
  try {
    console.log('🚀 Adding metadata columns to performance_sales_comparisons table...\n');

    // Initialize BigQuery
    const bigquery = new BigQuery({
      projectId: 'kcsymphony',
      keyFilename: path.join(__dirname, '..', '..', 'symphony-bigquery-key.json')
    });

    const tableName = '`kcsymphony.symphony_dashboard.performance_sales_comparisons`';

    // Define new columns
    const newColumns = [
      { name: 'comp_date', type: 'DATE', description: 'Date of the comparison performance' },
      { name: 'atp', type: 'FLOAT64', description: 'Average ticket price for comparison' },
      { name: 'subs', type: 'INT64', description: 'Subscription tickets for comparison' },
      { name: 'capacity', type: 'INT64', description: 'Venue capacity for comparison' },
      { name: 'occupancy_percent', type: 'FLOAT64', description: 'Final occupancy percentage for comparison' }
    ];

    // Add each column
    for (const col of newColumns) {
      console.log(`📝 Adding column: ${col.name} (${col.type})...`);

      const addColumnQuery = `
        ALTER TABLE ${tableName}
        ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
      `;

      try {
        const [job] = await bigquery.createQueryJob({
          query: addColumnQuery,
          location: 'US'
        });
        await job.getQueryResults();
        console.log(`✅ ${col.name} added!\n`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`⚠️  ${col.name} already exists, skipping...\n`);
        } else {
          throw error;
        }
      }
    }

    // Verify updated schema
    console.log('🔍 Verifying updated schema...\n');
    const dataset = bigquery.dataset('symphony_dashboard');
    const table = dataset.table('performance_sales_comparisons');
    const [metadata] = await table.getMetadata();

    console.log('📋 Complete Table Schema:');
    metadata.schema.fields.forEach(field => {
      const isNew = newColumns.find(col => col.name === field.name);
      const marker = isNew ? '  ← NEW' : '';
      console.log(`   - ${field.name} (${field.type})${marker}`);
    });
    console.log('');

    console.log('✅ Schema update complete!');
    console.log('\n💡 Next step: Run import script to populate comps with new metadata');
    console.log('   node scripts/active/import-historical-comps.js');

  } catch (error) {
    console.error('❌ Error adding columns:', error.message);
    console.error(error);
    process.exit(1);
  }
}

addCompMetadataColumns();
