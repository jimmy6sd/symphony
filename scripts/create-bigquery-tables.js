// Create BigQuery tables for Symphony Dashboard
// Run this after creating the dataset in web console

const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

const initializeBigQuery = () => {
  return new BigQuery({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    location: 'US'
  });
};

const DATASET_ID = process.env.BIGQUERY_DATASET || 'symphony_dashboard';

async function createTables() {
  try {
    console.log('🎭 Creating BigQuery tables for Symphony Dashboard...\n');

    const bigquery = initializeBigQuery();
    const dataset = bigquery.dataset(DATASET_ID);

    // Check if dataset exists
    const [datasetExists] = await dataset.exists();
    if (!datasetExists) {
      console.error(`❌ Dataset ${DATASET_ID} does not exist. Create it first in the web console.`);
      process.exit(1);
    }

    console.log(`✅ Dataset ${DATASET_ID} found`);

    // Table schemas
    const tables = [
      {
        name: 'performances',
        schema: [
          { name: 'performance_id', type: 'INTEGER', mode: 'REQUIRED' },
          { name: 'performance_code', type: 'STRING', mode: 'REQUIRED' },
          { name: 'title', type: 'STRING', mode: 'REQUIRED' },
          { name: 'series', type: 'STRING', mode: 'NULLABLE' },
          { name: 'performance_date', type: 'DATE', mode: 'REQUIRED' },
          { name: 'venue', type: 'STRING', mode: 'REQUIRED' },
          { name: 'season', type: 'STRING', mode: 'REQUIRED' },
          { name: 'capacity', type: 'INTEGER', mode: 'REQUIRED' },
          { name: 'single_tickets_sold', type: 'INTEGER', mode: 'NULLABLE', defaultValueExpression: '0' },
          { name: 'subscription_tickets_sold', type: 'INTEGER', mode: 'NULLABLE', defaultValueExpression: '0' },
          { name: 'total_revenue', type: 'FLOAT', mode: 'NULLABLE', defaultValueExpression: '0' },
          { name: 'occupancy_goal', type: 'FLOAT', mode: 'NULLABLE', defaultValueExpression: '85' },
          { name: 'budget_goal', type: 'FLOAT', mode: 'NULLABLE', defaultValueExpression: '0' },
          { name: 'capacity_percent', type: 'FLOAT', mode: 'NULLABLE', defaultValueExpression: '0' },
          { name: 'budget_percent', type: 'FLOAT', mode: 'NULLABLE', defaultValueExpression: '0' },
          { name: 'has_sales_data', type: 'BOOLEAN', mode: 'NULLABLE', defaultValueExpression: 'FALSE' },
          { name: 'created_at', type: 'TIMESTAMP', mode: 'NULLABLE', defaultValueExpression: 'CURRENT_TIMESTAMP()' },
          { name: 'updated_at', type: 'TIMESTAMP', mode: 'NULLABLE', defaultValueExpression: 'CURRENT_TIMESTAMP()' },
          { name: 'total_tickets_sold', type: 'INTEGER', mode: 'NULLABLE' },
          { name: 'occupancy_percent', type: 'FLOAT', mode: 'NULLABLE' }
        ],
        options: {
          timePartitioning: {
            type: 'DAY',
            field: 'performance_date'
          },
          clustering: {
            fields: ['series', 'season']
          },
          description: 'Main table for symphony performance data with sales metrics'
        }
      },
      {
        name: 'weekly_sales',
        schema: [
          { name: 'performance_id', type: 'INTEGER', mode: 'REQUIRED' },
          { name: 'week_number', type: 'INTEGER', mode: 'REQUIRED' },
          { name: 'tickets_sold', type: 'INTEGER', mode: 'REQUIRED' },
          { name: 'percentage', type: 'FLOAT', mode: 'REQUIRED' },
          { name: 'cumulative_tickets', type: 'INTEGER', mode: 'NULLABLE' },
          { name: 'cumulative_percentage', type: 'FLOAT', mode: 'NULLABLE' },
          { name: 'created_at', type: 'TIMESTAMP', mode: 'NULLABLE', defaultValueExpression: 'CURRENT_TIMESTAMP()' }
        ],
        options: {
          clustering: {
            fields: ['performance_id', 'week_number']
          },
          description: 'Weekly sales progression data for performances'
        }
      },
      {
        name: 'data_sources',
        schema: [
          { name: 'performance_id', type: 'INTEGER', mode: 'REQUIRED' },
          { name: 'source_name', type: 'STRING', mode: 'REQUIRED' },
          { name: 'source_priority', type: 'INTEGER', mode: 'NULLABLE', defaultValueExpression: '1' },
          { name: 'last_updated', type: 'TIMESTAMP', mode: 'NULLABLE', defaultValueExpression: 'CURRENT_TIMESTAMP()' }
        ],
        options: {
          clustering: {
            fields: ['performance_id']
          },
          description: 'Tracking of data sources for each performance'
        }
      },
      {
        name: 'seasons',
        schema: [
          { name: 'season_id', type: 'STRING', mode: 'REQUIRED' },
          { name: 'season_name', type: 'STRING', mode: 'REQUIRED' },
          { name: 'fiscal_year', type: 'INTEGER', mode: 'NULLABLE' },
          { name: 'start_date', type: 'DATE', mode: 'NULLABLE' },
          { name: 'end_date', type: 'DATE', mode: 'NULLABLE' },
          { name: 'is_current', type: 'BOOLEAN', mode: 'NULLABLE', defaultValueExpression: 'FALSE' },
          { name: 'created_at', type: 'TIMESTAMP', mode: 'NULLABLE', defaultValueExpression: 'CURRENT_TIMESTAMP()' }
        ],
        options: {
          description: 'Season definitions and metadata'
        }
      },
      {
        name: 'series',
        schema: [
          { name: 'series_id', type: 'STRING', mode: 'REQUIRED' },
          { name: 'series_name', type: 'STRING', mode: 'REQUIRED' },
          { name: 'series_type', type: 'STRING', mode: 'NULLABLE' },
          { name: 'season_id', type: 'STRING', mode: 'NULLABLE' },
          { name: 'created_at', type: 'TIMESTAMP', mode: 'NULLABLE', defaultValueExpression: 'CURRENT_TIMESTAMP()' }
        ],
        options: {
          description: 'Series definitions and categorization'
        }
      },
      {
        name: 'venues',
        schema: [
          { name: 'venue_id', type: 'STRING', mode: 'REQUIRED' },
          { name: 'venue_name', type: 'STRING', mode: 'REQUIRED' },
          { name: 'default_capacity', type: 'INTEGER', mode: 'NULLABLE' },
          { name: 'location', type: 'STRING', mode: 'NULLABLE' },
          { name: 'venue_type', type: 'STRING', mode: 'NULLABLE' },
          { name: 'created_at', type: 'TIMESTAMP', mode: 'NULLABLE', defaultValueExpression: 'CURRENT_TIMESTAMP()' }
        ],
        options: {
          description: 'Venue information and capacities'
        }
      },
      {
        name: 'refresh_log',
        schema: [
          { name: 'refresh_id', type: 'STRING', mode: 'REQUIRED' },
          { name: 'refresh_type', type: 'STRING', mode: 'REQUIRED' },
          { name: 'start_time', type: 'TIMESTAMP', mode: 'REQUIRED' },
          { name: 'end_time', type: 'TIMESTAMP', mode: 'NULLABLE' },
          { name: 'records_processed', type: 'INTEGER', mode: 'NULLABLE' },
          { name: 'records_inserted', type: 'INTEGER', mode: 'NULLABLE' },
          { name: 'records_updated', type: 'INTEGER', mode: 'NULLABLE' },
          { name: 'status', type: 'STRING', mode: 'REQUIRED' },
          { name: 'error_message', type: 'STRING', mode: 'NULLABLE' },
          { name: 'created_at', type: 'TIMESTAMP', mode: 'NULLABLE', defaultValueExpression: 'CURRENT_TIMESTAMP()' }
        ],
        options: {
          timePartitioning: {
            type: 'DAY',
            field: 'start_time'
          },
          description: 'Log of data refresh operations'
        }
      }
    ];

    // Create tables
    for (const tableConfig of tables) {
      const table = dataset.table(tableConfig.name);
      const [exists] = await table.exists();

      if (exists) {
        console.log(`⚠️  Table ${tableConfig.name} already exists, skipping...`);
        continue;
      }

      console.log(`📊 Creating table: ${tableConfig.name}...`);

      try {
        await table.create({
          schema: tableConfig.schema,
          ...tableConfig.options
        });

        console.log(`✅ Created table: ${tableConfig.name}`);
      } catch (error) {
        console.error(`❌ Failed to create table ${tableConfig.name}:`, error.message);
        throw error;
      }
    }

    console.log('\n🎉 All BigQuery tables created successfully!');
    console.log('\n📋 Created tables:');
    tables.forEach(table => {
      console.log(`  ✓ ${table.name} - ${table.options.description}`);
    });

    console.log('\n🚀 Ready for data migration! Run: npm run migrate-to-bigquery');

  } catch (error) {
    console.error('❌ Table creation failed:', error);
    process.exit(1);
  }
}

// Run the table creation
if (require.main === module) {
  createTables().catch(console.error);
}

module.exports = { createTables };