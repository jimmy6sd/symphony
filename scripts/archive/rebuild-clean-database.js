// Rebuild BigQuery Database - Clean Slate
// Drops everything, creates fresh performances table, loads dashboard.json

const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');

const bigquery = new BigQuery({
  projectId: 'kcsymphony',
  keyFilename: '../symphony-bigquery-key.json'
});

const DATASET = 'symphony_dashboard';

async function rebuildDatabase() {
  console.log('═'.repeat(80));
  console.log('🔨 REBUILDING BIGQUERY DATABASE - CLEAN SLATE');
  console.log('═'.repeat(80));
  console.log('');

  try {
    // Step 1: List and drop all existing tables
    console.log('1️⃣  Dropping all existing tables...');
    const dataset = bigquery.dataset(DATASET);
    const [tables] = await dataset.getTables();

    console.log(`   Found ${tables.length} tables to drop`);

    for (const table of tables) {
      await table.delete();
      console.log(`   ✓ Dropped table: ${table.id}`);
    }

    console.log(`   ✅ All tables dropped\n`);

    // Step 2: Create clean performances table
    console.log('2️⃣  Creating fresh performances table...');

    const performancesSchema = {
      fields: [
        { name: 'performance_id', type: 'INTEGER', mode: 'REQUIRED' },
        { name: 'performance_code', type: 'STRING', mode: 'REQUIRED' },
        { name: 'title', type: 'STRING', mode: 'REQUIRED' },
        { name: 'series', type: 'STRING', mode: 'NULLABLE' },
        { name: 'performance_date', type: 'DATE', mode: 'REQUIRED' },
        { name: 'venue', type: 'STRING', mode: 'REQUIRED' },
        { name: 'season', type: 'STRING', mode: 'REQUIRED' },
        { name: 'capacity', type: 'INTEGER', mode: 'REQUIRED' },
        { name: 'single_tickets_sold', type: 'INTEGER', mode: 'NULLABLE' },
        { name: 'subscription_tickets_sold', type: 'INTEGER', mode: 'NULLABLE' },
        { name: 'total_tickets_sold', type: 'INTEGER', mode: 'NULLABLE' },
        { name: 'total_revenue', type: 'FLOAT', mode: 'NULLABLE' },
        { name: 'occupancy_goal', type: 'FLOAT', mode: 'NULLABLE' },
        { name: 'budget_goal', type: 'FLOAT', mode: 'NULLABLE' },
        { name: 'capacity_percent', type: 'FLOAT', mode: 'NULLABLE' },
        { name: 'budget_percent', type: 'FLOAT', mode: 'NULLABLE' },
        { name: 'has_sales_data', type: 'BOOLEAN', mode: 'NULLABLE' },
        { name: 'created_at', type: 'TIMESTAMP', mode: 'NULLABLE' },
        { name: 'updated_at', type: 'TIMESTAMP', mode: 'NULLABLE' }
      ]
    };

    const [performancesTable] = await dataset.createTable('performances', {
      schema: performancesSchema
    });

    console.log(`   ✅ Created table: performances\n`);

    // Step 3: Load data from dashboard.json
    console.log('3️⃣  Loading data from dashboard.json...');

    const dashboardPath = path.resolve('../data/dashboard.json');
    const dashboardData = JSON.parse(fs.readFileSync(dashboardPath, 'utf8'));

    console.log(`   Found ${dashboardData.length} performances in dashboard.json`);

    // Prepare rows for BigQuery insert
    const rows = dashboardData.map(perf => ({
      performance_id: perf.performanceId || 0,
      performance_code: perf.id,
      title: perf.title,
      series: perf.series || null,
      performance_date: perf.date,
      venue: perf.venue,
      season: perf.season,
      capacity: perf.capacity,
      single_tickets_sold: perf.singleTicketsSold || 0,
      subscription_tickets_sold: perf.subscriptionTicketsSold || 0,
      total_tickets_sold: (perf.singleTicketsSold || 0) + (perf.subscriptionTicketsSold || 0),
      total_revenue: perf.totalRevenue || 0,
      occupancy_goal: perf.occupancyGoal || 85,
      budget_goal: perf.budgetGoal || 0,
      capacity_percent: perf.capacityPercent || 0,
      budget_percent: perf.budgetPercent || 0,
      has_sales_data: perf.hasSalesData || false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    // Insert in batches of 50
    const batchSize = 50;
    let inserted = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      await performancesTable.insert(batch);
      inserted += batch.length;
      console.log(`   ✓ Inserted ${inserted}/${rows.length} performances`);
    }

    console.log(`   ✅ Loaded ${rows.length} performances\n`);

    // Step 4: Verify the data
    console.log('4️⃣  Verifying loaded data...\n');

    const verifyQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(DISTINCT performance_code) as unique_codes,
        COUNTIF(has_sales_data = true) as with_sales,
        COUNTIF(has_sales_data = false) as without_sales,
        MIN(performance_date) as earliest_date,
        MAX(performance_date) as latest_date,
        SUM(single_tickets_sold) as total_single,
        SUM(subscription_tickets_sold) as total_sub,
        SUM(total_revenue) as total_revenue,
        AVG(capacity_percent) as avg_capacity
      FROM \`kcsymphony.${DATASET}.performances\`
    `;

    const [verify] = await bigquery.query({ query: verifyQuery, location: 'US' });
    const v = verify[0];

    console.log('📊 DATABASE STATUS:');
    console.log(`   Total Performances: ${v.total}`);
    console.log(`   Unique Codes: ${v.unique_codes}`);
    console.log(`   ${v.total === v.unique_codes ? '✅' : '⚠️ '} Duplicates: ${v.total === v.unique_codes ? 'None' : (v.total - v.unique_codes)}`);
    console.log(`   With Sales Data: ${v.with_sales}`);
    console.log(`   Without Sales Data: ${v.without_sales}`);
    console.log(`   Date Range: ${v.earliest_date?.value} to ${v.latest_date?.value}`);
    console.log(`   Total Single Tickets: ${v.total_single?.toLocaleString() || 0}`);
    console.log(`   Total Subscription Tickets: ${v.total_sub?.toLocaleString() || 0}`);
    console.log(`   Total Revenue: $${v.total_revenue?.toLocaleString() || 0}`);
    console.log(`   Average Capacity: ${v.avg_capacity?.toFixed(1)}%`);

    console.log('');
    console.log('═'.repeat(80));
    console.log('✅ DATABASE REBUILD COMPLETE!');
    console.log('═'.repeat(80));

  } catch (error) {
    console.error('❌ Rebuild failed:', error.message);
    throw error;
  }
}

rebuildDatabase().catch(console.error);
