// Test BigQuery integration with sample queries
const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');
require('dotenv').config();

const initializeBigQuery = () => {
  const config = {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    location: 'US'
  };

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    config.credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const keyFilePath = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    console.log(`🔐 Loading credentials from: ${keyFilePath}`);
    config.keyFilename = keyFilePath;
  } else {
    const fallbackKeyPath = path.join(__dirname, '..', 'symphony-bigquery-key.json');
    console.log(`🔐 Using fallback credentials from: ${fallbackKeyPath}`);
    config.keyFilename = fallbackKeyPath;
  }

  return new BigQuery(config);
};

const DATASET_ID = process.env.BIGQUERY_DATASET || 'symphony_dashboard';

async function runTestQueries() {
  try {
    console.log('🎭 Testing BigQuery integration for Symphony Dashboard...\n');

    const bigquery = initializeBigQuery();

    // Test 1: Count total performances
    console.log('📊 Test 1: Count total performances');
    const countQuery = `
      SELECT COUNT(*) as total_performances
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.performances\`
    `;

    const [countRows] = await bigquery.query(countQuery);
    console.log(`✅ Total performances: ${countRows[0].total_performances}\n`);

    // Test 2: Get performances with sales data
    console.log('💰 Test 2: Performances with sales data');
    const salesQuery = `
      SELECT
        performance_code,
        title,
        series,
        performance_date,
        total_revenue,
        total_tickets_sold,
        occupancy_percent
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.performances\`
      WHERE has_sales_data = TRUE
      ORDER BY total_revenue DESC
      LIMIT 5
    `;

    const [salesRows] = await bigquery.query(salesQuery);
    console.log('Top 5 performances by revenue:');
    salesRows.forEach((row, index) => {
      console.log(`  ${index + 1}. ${row.title} (${row.series})`);
      console.log(`     Date: ${row.performance_date}, Revenue: $${row.total_revenue?.toLocaleString()}`);
      console.log(`     Tickets: ${row.total_tickets_sold}, Occupancy: ${row.occupancy_percent?.toFixed(1)}%`);
    });
    console.log('');

    // Test 3: Series breakdown
    console.log('🎵 Test 3: Performance breakdown by series');
    const seriesQuery = `
      SELECT
        series,
        COUNT(*) as performance_count,
        SUM(total_revenue) as total_revenue,
        AVG(occupancy_percent) as avg_occupancy
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.performances\`
      WHERE series IS NOT NULL
      GROUP BY series
      ORDER BY performance_count DESC
    `;

    const [seriesRows] = await bigquery.query(seriesQuery);
    console.log('Series breakdown:');
    seriesRows.forEach(row => {
      console.log(`  • ${row.series}: ${row.performance_count} performances`);
      console.log(`    Revenue: $${row.total_revenue?.toLocaleString() || '0'}, Avg Occupancy: ${row.avg_occupancy?.toFixed(1) || '0'}%`);
    });
    console.log('');

    // Test 4: Weekly sales data
    console.log('📈 Test 4: Weekly sales progression sample');
    const weeklyQuery = `
      SELECT
        p.title,
        p.series,
        ws.week_number,
        ws.tickets_sold,
        ws.percentage,
        ws.cumulative_tickets
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.weekly_sales\` ws
      JOIN \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.performances\` p
        ON ws.performance_id = p.performance_id
      WHERE p.has_sales_data = TRUE
      ORDER BY p.performance_id, ws.week_number
      LIMIT 10
    `;

    const [weeklyRows] = await bigquery.query(weeklyQuery);
    console.log('Sample weekly sales progression:');
    let currentPerf = '';
    weeklyRows.forEach(row => {
      if (row.title !== currentPerf) {
        currentPerf = row.title;
        console.log(`  ${row.title} (${row.series}):`);
      }
      console.log(`    Week ${row.week_number}: ${row.tickets_sold} tickets (${row.percentage?.toFixed(1)}%), Total: ${row.cumulative_tickets}`);
    });
    console.log('');

    // Test 5: Lookup tables
    console.log('📋 Test 5: Lookup tables verification');

    const seasonsQuery = `SELECT COUNT(*) as count FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.seasons\``;
    const seriesLookupQuery = `SELECT COUNT(*) as count FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.series\``;
    const venuesQuery = `SELECT COUNT(*) as count FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.venues\``;

    const [seasonsCount] = await bigquery.query(seasonsQuery);
    const [seriesCount] = await bigquery.query(seriesLookupQuery);
    const [venuesCount] = await bigquery.query(venuesQuery);

    console.log(`✅ Seasons: ${seasonsCount[0].count} records`);
    console.log(`✅ Series: ${seriesCount[0].count} records`);
    console.log(`✅ Venues: ${venuesCount[0].count} records`);

    console.log('\n🎉 All BigQuery tests completed successfully!');
    console.log('\n✅ Your Symphony Dashboard is ready for BigQuery integration!');
    console.log('\nNext steps:');
    console.log('1. Update your frontend to use: /.netlify/functions/bigquery-data');
    console.log('2. Configure Netlify environment variables for production');
    console.log('3. Test the dashboard with live BigQuery data');

  } catch (error) {
    console.error('❌ BigQuery test failed:', error);
    process.exit(1);
  }
}

// Run the tests
if (require.main === module) {
  runTestQueries().catch(console.error);
}

module.exports = { runTestQueries };