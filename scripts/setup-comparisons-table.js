// Setup script to create performance_sales_comparisons table in BigQuery
const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');

async function setupComparisonsTable() {
  try {
    console.log('🚀 Setting up performance_sales_comparisons table...\n');

    // Initialize BigQuery
    const bigquery = new BigQuery({
      projectId: 'kcsymphony',
      keyFilename: path.join(__dirname, '..', 'symphony-bigquery-key.json')
    });

    // Create table
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS \`kcsymphony.symphony_dashboard.performance_sales_comparisons\` (
        comparison_id STRING NOT NULL,
        performance_id STRING NOT NULL,
        comparison_name STRING NOT NULL,
        weeks_data STRING NOT NULL,
        line_color STRING DEFAULT '#4285f4',
        line_style STRING DEFAULT 'dashed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
      )
      OPTIONS(
        description="Custom sales progression comparison lines for individual performances"
      )
    `;

    console.log('📝 Creating table...');
    const [job] = await bigquery.createQueryJob({
      query: createTableQuery,
      location: 'US'
    });

    await job.getQueryResults();
    console.log('✅ Table created successfully!\n');

    // Verify table exists
    console.log('🔍 Verifying table...');
    const dataset = bigquery.dataset('symphony_dashboard');
    const table = dataset.table('performance_sales_comparisons');
    const [exists] = await table.exists();

    if (exists) {
      console.log('✅ Table verified!\n');

      // Get table metadata
      const [metadata] = await table.getMetadata();
      console.log('📋 Table Schema:');
      metadata.schema.fields.forEach(field => {
        console.log(`   - ${field.name} (${field.type})`);
      });
      console.log('');
    } else {
      console.log('❌ Table verification failed');
    }

    console.log('✅ Setup complete!');
    console.log('\n💡 Next steps:');
    console.log('   1. The API is ready at /api/performance-comparisons');
    console.log('   2. Proceed to build the UI components');

  } catch (error) {
    console.error('❌ Error setting up table:', error.message);
    console.error(error);
    process.exit(1);
  }
}

setupComparisonsTable();
