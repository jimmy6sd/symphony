const { BigQuery } = require('@google-cloud/bigquery');

const DATASET_ID = 'symphony_dashboard';
const TABLE_ID = 'weekly_sales';

async function createWeeklySalesTable() {
  const bigquery = new BigQuery({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
  });

  console.log('🔧 Creating weekly_sales table...\n');

  const schema = [
    { name: 'performance_code', type: 'STRING', mode: 'REQUIRED' },
    { name: 'week_number', type: 'INTEGER', mode: 'REQUIRED' },
    { name: 'weeks_until_performance', type: 'INTEGER', mode: 'REQUIRED' },
    { name: 'single_tickets_sold', type: 'INTEGER', mode: 'NULLABLE' },
    { name: 'subscription_tickets_sold', type: 'INTEGER', mode: 'NULLABLE' },
    { name: 'total_tickets_sold', type: 'INTEGER', mode: 'NULLABLE' },
    { name: 'total_revenue', type: 'FLOAT', mode: 'NULLABLE' },
    { name: 'import_date', type: 'TIMESTAMP', mode: 'REQUIRED' },
    { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' }
  ];

  try {
    const dataset = bigquery.dataset(DATASET_ID);

    // Check if table already exists
    const [exists] = await dataset.table(TABLE_ID).exists();

    if (exists) {
      console.log('⚠️  Table already exists. Skipping creation.');
      return;
    }

    // Create table
    const options = {
      schema: schema,
      location: 'US',
    };

    const [table] = await dataset.createTable(TABLE_ID, options);
    console.log(`✅ Table ${table.id} created successfully!\n`);

    // Display schema
    console.log('📋 Table schema:');
    schema.forEach(field => {
      console.log(`  - ${field.name}: ${field.type}${field.mode === 'REQUIRED' ? ' (required)' : ''}`);
    });

    console.log('\n✨ Ready to store weekly sales progression data!');

  } catch (error) {
    console.error('❌ Error creating table:', error);
    throw error;
  }
}

if (require.main === module) {
  createWeeklySalesTable().catch(console.error);
}

module.exports = { createWeeklySalesTable };
