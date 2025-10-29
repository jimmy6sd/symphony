#!/usr/bin/env node
/**
 * BigQuery Setup Script for Symphony Dashboard
 *
 * This script creates the BigQuery dataset and tables needed for the analytics pipeline.
 *
 * Prerequisites:
 * 1. Google Cloud project created
 * 2. BigQuery API enabled
 * 3. Service account with BigQuery permissions
 * 4. Service account key file downloaded
 *
 * Usage: node scripts/setup-bigquery.js
 */

const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

// Configuration - Update these values
const CONFIG = {
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'symphony-analytics-demo',
  datasetId: 'symphony_analytics',
  location: 'US', // or 'EU', 'asia-northeast1', etc.
  keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE, // Path to service account JSON
};

console.log('🎭 Symphony Dashboard - BigQuery Setup');
console.log('=====================================');
console.log(`Project ID: ${CONFIG.projectId}`);
console.log(`Dataset: ${CONFIG.datasetId}`);
console.log(`Location: ${CONFIG.location}`);
console.log('');

// Initialize BigQuery client
const bigquery = new BigQuery({
  projectId: CONFIG.projectId,
  keyFilename: CONFIG.keyFilename,
});

// Table schemas
const SCHEMAS = {
  // 1. Raw daily reports from PDF
  daily_reports: [
    { name: 'report_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'report_date', type: 'DATE', mode: 'REQUIRED' },
    { name: 'report_time', type: 'TIME', mode: 'REQUIRED' },
    { name: 'season', type: 'STRING', mode: 'NULLABLE' },
    { name: 'raw_pdf_data', type: 'JSON', mode: 'NULLABLE' },
    { name: 'total_performances', type: 'INTEGER', mode: 'NULLABLE' },
    { name: 'total_revenue', type: 'FLOAT', mode: 'NULLABLE' },
    { name: 'avg_capacity', type: 'FLOAT', mode: 'NULLABLE' },
    { name: 'ingestion_timestamp', type: 'TIMESTAMP', mode: 'REQUIRED', defaultValueExpression: 'CURRENT_TIMESTAMP()' },
  ],

  // 2. Performance master table
  performances: [
    { name: 'performance_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'perf_code', type: 'STRING', mode: 'REQUIRED' },
    { name: 'title', type: 'STRING', mode: 'REQUIRED' },
    { name: 'series_code', type: 'STRING', mode: 'NULLABLE' },
    { name: 'series_title', type: 'STRING', mode: 'NULLABLE' },
    { name: 'season', type: 'STRING', mode: 'NULLABLE' },
    { name: 'performance_date', type: 'DATETIME', mode: 'NULLABLE' },
    { name: 'venue', type: 'STRING', mode: 'NULLABLE' },
    { name: 'venue_capacity', type: 'INTEGER', mode: 'NULLABLE' },
    { name: 'created_date', type: 'DATE', mode: 'REQUIRED', defaultValueExpression: 'CURRENT_DATE()' },
    { name: 'last_updated', type: 'TIMESTAMP', mode: 'REQUIRED', defaultValueExpression: 'CURRENT_TIMESTAMP()' },
  ],

  // 3. Daily sales time series
  daily_sales: [
    { name: 'performance_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'report_date', type: 'DATE', mode: 'REQUIRED' },
    { name: 'snapshot_time', type: 'TIME', mode: 'REQUIRED' },

    // Sales metrics
    { name: 'budget_percent', type: 'FLOAT', mode: 'NULLABLE' },
    { name: 'fixed_packages_count', type: 'INTEGER', mode: 'NULLABLE' },
    { name: 'fixed_packages_revenue', type: 'FLOAT', mode: 'NULLABLE' },
    { name: 'non_fixed_packages_count', type: 'INTEGER', mode: 'NULLABLE' },
    { name: 'non_fixed_packages_revenue', type: 'FLOAT', mode: 'NULLABLE' },
    { name: 'single_tickets_count', type: 'INTEGER', mode: 'NULLABLE' },
    { name: 'single_tickets_revenue', type: 'FLOAT', mode: 'NULLABLE' },
    { name: 'reserved_count', type: 'INTEGER', mode: 'NULLABLE' },
    { name: 'reserved_revenue', type: 'FLOAT', mode: 'NULLABLE' },
    { name: 'subtotal_revenue', type: 'FLOAT', mode: 'NULLABLE' },
    { name: 'total_revenue', type: 'FLOAT', mode: 'NULLABLE' },
    { name: 'available_seats', type: 'INTEGER', mode: 'NULLABLE' },
    { name: 'capacity_percent', type: 'FLOAT', mode: 'NULLABLE' },

    // Calculated fields
    { name: 'total_tickets_sold', type: 'INTEGER', mode: 'NULLABLE' },
    { name: 'days_until_performance', type: 'INTEGER', mode: 'NULLABLE' },
    { name: 'is_weekend', type: 'BOOLEAN', mode: 'NULLABLE' },

    { name: 'ingestion_timestamp', type: 'TIMESTAMP', mode: 'REQUIRED', defaultValueExpression: 'CURRENT_TIMESTAMP()' },
  ],
};

async function createDataset() {
  console.log(`📁 Creating dataset: ${CONFIG.datasetId}`);

  try {
    const dataset = bigquery.dataset(CONFIG.datasetId);
    const [exists] = await dataset.exists();

    if (exists) {
      console.log(`   ✅ Dataset ${CONFIG.datasetId} already exists`);
      return dataset;
    }

    const [createdDataset] = await bigquery.createDataset(CONFIG.datasetId, {
      location: CONFIG.location,
      description: 'Symphony Dashboard analytics data - performance sales, trends, and forecasting',
    });

    console.log(`   ✅ Dataset ${CONFIG.datasetId} created successfully`);
    return createdDataset;
  } catch (error) {
    console.error(`   ❌ Error creating dataset: ${error.message}`);
    throw error;
  }
}

async function createTable(dataset, tableName, schema) {
  console.log(`📊 Creating table: ${tableName}`);

  try {
    const table = dataset.table(tableName);
    const [exists] = await table.exists();

    if (exists) {
      console.log(`   ✅ Table ${tableName} already exists`);
      return table;
    }

    // Table options
    const options = {
      schema: schema,
      location: CONFIG.location,
    };

    // Add partitioning and clustering for performance
    if (tableName === 'daily_reports') {
      options.timePartitioning = {
        type: 'DAY',
        field: 'report_date',
      };
      options.clustering = {
        fields: ['season', 'report_date'],
      };
    }

    if (tableName === 'daily_sales') {
      options.timePartitioning = {
        type: 'DAY',
        field: 'report_date',
      };
      options.clustering = {
        fields: ['performance_id', 'report_date'],
      };
    }

    if (tableName === 'performances') {
      options.clustering = {
        fields: ['series_code', 'performance_date'],
      };
    }

    const [createdTable] = await dataset.createTable(tableName, options);
    console.log(`   ✅ Table ${tableName} created successfully`);
    return createdTable;
  } catch (error) {
    console.error(`   ❌ Error creating table ${tableName}: ${error.message}`);
    throw error;
  }
}

async function createViews(dataset) {
  console.log('📈 Creating analytical views');

  const views = [
    {
      name: 'current_performance_status',
      query: `
        WITH latest_snapshots AS (
          SELECT
            performance_id,
            MAX(report_date) as latest_date
          FROM \`${CONFIG.projectId}.${CONFIG.datasetId}.daily_sales\`
          GROUP BY performance_id
        )
        SELECT
          p.performance_id,
          p.title,
          p.series_code,
          p.performance_date,
          p.venue,
          p.venue_capacity,
          ds.total_revenue,
          ds.total_tickets_sold,
          ds.capacity_percent,
          ds.budget_percent,
          ds.available_seats,
          ds.days_until_performance,
          ds.report_date as last_updated
        FROM \`${CONFIG.projectId}.${CONFIG.datasetId}.performances\` p
        JOIN latest_snapshots ls ON p.performance_id = ls.performance_id
        JOIN \`${CONFIG.projectId}.${CONFIG.datasetId}.daily_sales\` ds ON (
          p.performance_id = ds.performance_id
          AND ls.latest_date = ds.report_date
        )
      `
    },
    {
      name: 'daily_changes',
      query: `
        SELECT
          today.performance_id,
          today.report_date,
          today.total_revenue - COALESCE(yesterday.total_revenue, 0) as revenue_change_1d,
          today.total_tickets_sold - COALESCE(yesterday.total_tickets_sold, 0) as tickets_change_1d,
          today.capacity_percent - COALESCE(yesterday.capacity_percent, 0) as capacity_change_1d,
          today.available_seats - COALESCE(yesterday.available_seats, 0) as available_change_1d
        FROM \`${CONFIG.projectId}.${CONFIG.datasetId}.daily_sales\` today
        LEFT JOIN \`${CONFIG.projectId}.${CONFIG.datasetId}.daily_sales\` yesterday ON (
          today.performance_id = yesterday.performance_id
          AND yesterday.report_date = DATE_SUB(today.report_date, INTERVAL 1 DAY)
        )
      `
    }
  ];

  for (const view of views) {
    try {
      const viewTable = dataset.table(view.name);
      const [exists] = await viewTable.exists();

      if (exists) {
        console.log(`   ✅ View ${view.name} already exists`);
        continue;
      }

      await dataset.createTable(view.name, {
        view: { query: view.query, useLegacySql: false }
      });

      console.log(`   ✅ View ${view.name} created successfully`);
    } catch (error) {
      console.error(`   ❌ Error creating view ${view.name}: ${error.message}`);
    }
  }
}

async function validateSetup() {
  console.log('🔍 Validating BigQuery setup');

  try {
    // Test query
    const query = `SELECT COUNT(*) as table_count FROM \`${CONFIG.projectId}.${CONFIG.datasetId}.__TABLES__\``;
    const [rows] = await bigquery.query({ query });
    const tableCount = rows[0].table_count;

    console.log(`   ✅ BigQuery setup validated - ${tableCount} tables created`);

    // List tables
    const dataset = bigquery.dataset(CONFIG.datasetId);
    const [tables] = await dataset.getTables();
    console.log(`   📋 Tables created: ${tables.map(t => t.id).join(', ')}`);

  } catch (error) {
    console.error(`   ❌ Validation error: ${error.message}`);
  }
}

async function main() {
  try {
    // Check configuration
    if (!CONFIG.projectId || !CONFIG.keyFilename) {
      console.error('❌ Missing configuration:');
      console.error('   - Set GOOGLE_CLOUD_PROJECT_ID environment variable');
      console.error('   - Set GOOGLE_CLOUD_KEY_FILE environment variable');
      console.error('   - Or update CONFIG in this script');
      process.exit(1);
    }

    console.log('🚀 Starting BigQuery setup...\n');

    // 1. Create dataset
    const dataset = await createDataset();
    console.log('');

    // 2. Create tables
    for (const [tableName, schema] of Object.entries(SCHEMAS)) {
      await createTable(dataset, tableName, schema);
    }
    console.log('');

    // 3. Create views
    await createViews(dataset);
    console.log('');

    // 4. Validate setup
    await validateSetup();
    console.log('');

    console.log('🎉 BigQuery setup completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Add your service account key to netlify environment variables');
    console.log('2. Test the connection with: npm run test-bigquery');
    console.log('3. Migrate existing data with: npm run migrate-to-bigquery');

  } catch (error) {
    console.error('\n💥 Setup failed:', error.message);
    process.exit(1);
  }
}

// Run setup
if (require.main === module) {
  main();
}

module.exports = { CONFIG, SCHEMAS };