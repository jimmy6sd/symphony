// Migration script to transfer dashboard.json data to BigQuery
// Run this once after setting up BigQuery to populate initial data

const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs').promises;
const path = require('path');

// Initialize BigQuery client
const initializeBigQuery = () => {
  const config = {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    location: 'US'
  };

  // Try different credential loading methods
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    // For production/Netlify
    config.credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // For local development - use absolute path
    const keyFilePath = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    console.log(`🔐 Loading credentials from: ${keyFilePath}`);
    config.keyFilename = keyFilePath;
  } else {
    // Fallback - try to load from symphony-bigquery-key.json
    const fallbackKeyPath = path.join(__dirname, '..', 'symphony-bigquery-key.json');
    console.log(`🔐 Using fallback credentials from: ${fallbackKeyPath}`);
    config.keyFilename = fallbackKeyPath;
  }

  return new BigQuery(config);
};

const DATASET_ID = process.env.BIGQUERY_DATASET || 'symphony_dashboard';

async function migrateDashboardData() {
  try {
    console.log('🎭 Starting Symphony Dashboard data migration to BigQuery...\n');

    // Initialize BigQuery client
    const bigquery = initializeBigQuery();

    // Read the dashboard data
    const dataPath = path.join(__dirname, '..', 'data', 'dashboard.json');
    const rawData = await fs.readFile(dataPath, 'utf8');
    const performances = JSON.parse(rawData);

    console.log(`📊 Found ${performances.length} performances to migrate`);

    // Prepare data for BigQuery insertion
    const performanceRows = [];
    const weeklySalesRows = [];
    const dataSourceRows = [];

    for (const perf of performances) {
      // Main performance data
      performanceRows.push({
        performance_id: perf.performanceId || generatePerformanceId(perf.id),
        performance_code: perf.id,
        title: perf.title,
        series: perf.series,
        performance_date: perf.date,
        venue: perf.venue,
        season: perf.season,
        capacity: perf.capacity,
        single_tickets_sold: perf.singleTicketsSold || 0,
        subscription_tickets_sold: perf.subscriptionTicketsSold || 0,
        total_revenue: perf.totalRevenue || 0,
        occupancy_goal: perf.occupancyGoal || 85,
        budget_goal: perf.budgetGoal || 0,
        capacity_percent: perf.capacityPercent || 0,
        budget_percent: perf.budgetPercent || 0,
        has_sales_data: perf.hasSalesData || false
      });

      // Weekly sales data
      if (perf.weeklySales && perf.weeklySales.length > 0) {
        for (const week of perf.weeklySales) {
          weeklySalesRows.push({
            performance_id: perf.performanceId || generatePerformanceId(perf.id),
            week_number: week.week,
            tickets_sold: week.ticketsSold,
            percentage: week.percentage,
            cumulative_tickets: calculateCumulativeTickets(perf.weeklySales, week.week),
            cumulative_percentage: calculateCumulativePercentage(perf.weeklySales, week.week)
          });
        }
      }

      // Data sources
      if (perf.dataSources && perf.dataSources.length > 0) {
        for (let i = 0; i < perf.dataSources.length; i++) {
          dataSourceRows.push({
            performance_id: perf.performanceId || generatePerformanceId(perf.id),
            source_name: perf.dataSources[i],
            source_priority: i + 1
          });
        }
      }
    }

    // Insert data into BigQuery tables
    console.log('\n📥 Inserting performance data...');
    await insertInBatches(bigquery, 'performances', performanceRows);

    if (weeklySalesRows.length > 0) {
      console.log('📈 Inserting weekly sales data...');
      await insertInBatches(bigquery, 'weekly_sales', weeklySalesRows);
    }

    if (dataSourceRows.length > 0) {
      console.log('🔗 Inserting data source tracking...');
      await insertInBatches(bigquery, 'data_sources', dataSourceRows);
    }

    // Insert lookup data
    await insertLookupData(bigquery, performances);

    // Log the migration
    const refreshId = `migration_${Date.now()}`;
    await bigquery
      .dataset(DATASET_ID)
      .table('refresh_log')
      .insert([{
        refresh_id: refreshId,
        refresh_type: 'initial_migration',
        start_time: new Date().toISOString(),
        end_time: new Date().toISOString(),
        records_processed: performances.length,
        records_inserted: performanceRows.length,
        records_updated: 0,
        status: 'completed'
      }]);

    console.log('\n✅ Migration completed successfully!');
    console.log(`📊 Migrated ${performanceRows.length} performances`);
    console.log(`📈 Migrated ${weeklySalesRows.length} weekly sales records`);
    console.log(`🔗 Migrated ${dataSourceRows.length} data source records`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Insert data in batches to handle BigQuery limits
async function insertInBatches(bigquery, tableName, rows, batchSize = 1000) {
  const table = bigquery.dataset(DATASET_ID).table(tableName);

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    try {
      await table.insert(batch, {
        skipInvalidRows: false,
        ignoreUnknownValues: false
      });

      console.log(`  ✓ Inserted batch ${Math.floor(i / batchSize) + 1} (${batch.length} records)`);
    } catch (error) {
      console.error(`  ❌ Failed to insert batch starting at index ${i}:`, error);

      // Log the problematic rows for debugging
      if (error.name === 'PartialFailureError') {
        console.error('Problematic rows:', error.errors);
      }

      throw error;
    }
  }
}

// Insert lookup data (seasons, series, venues)
async function insertLookupData(bigquery, performances) {
  console.log('📋 Creating lookup data...');

  // Extract unique seasons
  const seasons = [...new Set(performances.map(p => p.season))]
    .filter(Boolean)
    .map(season => ({
      season_id: season.toLowerCase().replace(/\s+/g, '_'),
      season_name: season,
      fiscal_year: extractFiscalYear(season),
      is_current: season.includes('25-26') || season.includes('2025')
    }));

  // Extract unique series
  const series = [...new Set(performances.map(p => p.series))]
    .filter(Boolean)
    .map(seriesName => ({
      series_id: seriesName.toLowerCase().replace(/\s+/g, '_'),
      series_name: seriesName,
      series_type: categorizeSeriesType(seriesName)
    }));

  // Extract unique venues
  const venues = [...new Set(performances.map(p => p.venue))]
    .filter(Boolean)
    .map(venueName => ({
      venue_id: venueName.toLowerCase().replace(/\s+/g, '_'),
      venue_name: venueName,
      default_capacity: getDefaultCapacity(venueName, performances),
      venue_type: 'concert_hall' // Could be enhanced with more venue types
    }));

  // Insert lookup data
  if (seasons.length > 0) {
    await insertInBatches(bigquery, 'seasons', seasons);
    console.log(`  ✓ Inserted ${seasons.length} seasons`);
  }

  if (series.length > 0) {
    await insertInBatches(bigquery, 'series', series);
    console.log(`  ✓ Inserted ${series.length} series`);
  }

  if (venues.length > 0) {
    await insertInBatches(bigquery, 'venues', venues);
    console.log(`  ✓ Inserted ${venues.length} venues`);
  }
}

// Helper functions
function generatePerformanceId(performanceCode) {
  // Extract numeric part from performance code or use hash
  const match = performanceCode.match(/\d+/);
  return match ? parseInt(match[0]) : Math.abs(hashCode(performanceCode));
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash;
}

function calculateCumulativeTickets(weeklySales, currentWeek) {
  return weeklySales
    .filter(w => w.week <= currentWeek)
    .reduce((sum, w) => sum + w.ticketsSold, 0);
}

function calculateCumulativePercentage(weeklySales, currentWeek) {
  return weeklySales
    .filter(w => w.week <= currentWeek)
    .reduce((sum, w) => sum + w.percentage, 0);
}

function extractFiscalYear(season) {
  const match = season.match(/(\d{2})-(\d{2})/);
  return match ? 2000 + parseInt(match[1]) + 1 : null; // Fiscal year ends in the second year
}

function categorizeSeriesType(seriesName) {
  const name = seriesName.toLowerCase();
  if (name.includes('classical') || name.includes('symphony')) return 'Classical';
  if (name.includes('pops')) return 'Pops';
  if (name.includes('family') || name.includes('children')) return 'Family';
  if (name.includes('special') || name.includes('event')) return 'Special Event';
  if (name.includes('chamber')) return 'Chamber Music';
  return 'Other';
}

function getDefaultCapacity(venueName, performances) {
  // Find the most common capacity for this venue
  const capacities = performances
    .filter(p => p.venue === venueName && p.capacity)
    .map(p => p.capacity);

  if (capacities.length === 0) return null;

  // Return the most frequent capacity
  const capacityCount = {};
  capacities.forEach(cap => {
    capacityCount[cap] = (capacityCount[cap] || 0) + 1;
  });

  return parseInt(Object.keys(capacityCount).reduce((a, b) =>
    capacityCount[a] > capacityCount[b] ? a : b
  ));
}

// Run the migration
if (require.main === module) {
  migrateDashboardData().catch(console.error);
}

module.exports = { migrateDashboardData };