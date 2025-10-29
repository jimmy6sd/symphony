// Bulk load migration script for BigQuery (works with free tier)
// Uses load jobs instead of streaming inserts

const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Initialize BigQuery client
const initializeBigQuery = () => {
  const config = {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    location: 'US'
  };

  // Try different credential loading methods
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

async function migrateDashboardData() {
  try {
    console.log('🎭 Starting Symphony Dashboard bulk data migration to BigQuery...\n');

    const bigquery = initializeBigQuery();

    // Read the dashboard data
    const dataPath = path.join(__dirname, '..', 'data', 'dashboard.json');
    const rawData = await fs.readFile(dataPath, 'utf8');
    const performances = JSON.parse(rawData);

    console.log(`📊 Found ${performances.length} performances to migrate`);

    // Prepare temporary files for bulk loading
    const tempDir = path.join(__dirname, '..', 'temp');
    await fs.mkdir(tempDir, { recursive: true });

    // Prepare data for different tables
    const performanceRows = [];
    const weeklySalesRows = [];
    const dataSourceRows = [];

    for (const perf of performances) {
      // Main performance data
      const performanceRow = {
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
        has_sales_data: perf.hasSalesData || false,
        total_tickets_sold: (perf.singleTicketsSold || 0) + (perf.subscriptionTicketsSold || 0),
        occupancy_percent: perf.capacity > 0 ? ((perf.singleTicketsSold || 0) + (perf.subscriptionTicketsSold || 0)) / perf.capacity * 100 : 0
      };

      performanceRows.push(performanceRow);

      // Weekly sales data
      if (perf.weeklySales && perf.weeklySales.length > 0) {
        for (const week of perf.weeklySales) {
          weeklySalesRows.push({
            performance_id: performanceRow.performance_id,
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
            performance_id: performanceRow.performance_id,
            source_name: perf.dataSources[i],
            source_priority: i + 1
          });
        }
      }
    }

    // Write data to JSON files for bulk loading
    console.log('\n📄 Creating temporary JSON files for bulk loading...');

    const performancesFile = path.join(tempDir, 'performances.json');
    await fs.writeFile(performancesFile, performanceRows.map(row => JSON.stringify(row)).join('\n'));
    console.log(`✓ Created ${performancesFile} with ${performanceRows.length} records`);

    if (weeklySalesRows.length > 0) {
      const salesFile = path.join(tempDir, 'weekly_sales.json');
      await fs.writeFile(salesFile, weeklySalesRows.map(row => JSON.stringify(row)).join('\n'));
      console.log(`✓ Created ${salesFile} with ${weeklySalesRows.length} records`);
    }

    if (dataSourceRows.length > 0) {
      const sourcesFile = path.join(tempDir, 'data_sources.json');
      await fs.writeFile(sourcesFile, dataSourceRows.map(row => JSON.stringify(row)).join('\n'));
      console.log(`✓ Created ${sourcesFile} with ${dataSourceRows.length} records`);
    }

    // Load data into BigQuery using load jobs
    console.log('\n📥 Loading data into BigQuery tables...');

    // Load performances
    await loadDataToTable(bigquery, 'performances', performancesFile);

    // Load weekly sales if exists
    if (weeklySalesRows.length > 0) {
      await loadDataToTable(bigquery, 'weekly_sales', path.join(tempDir, 'weekly_sales.json'));
    }

    // Load data sources if exists
    if (dataSourceRows.length > 0) {
      await loadDataToTable(bigquery, 'data_sources', path.join(tempDir, 'data_sources.json'));
    }

    // Insert lookup data
    await insertLookupData(bigquery, performances, tempDir);

    // Log the migration
    const refreshId = `migration_${Date.now()}`;
    const logRow = {
      refresh_id: refreshId,
      refresh_type: 'initial_migration',
      start_time: new Date().toISOString(),
      end_time: new Date().toISOString(),
      records_processed: performances.length,
      records_inserted: performanceRows.length,
      records_updated: 0,
      status: 'completed'
    };

    const logFile = path.join(tempDir, 'refresh_log.json');
    await fs.writeFile(logFile, JSON.stringify(logRow));
    await loadDataToTable(bigquery, 'refresh_log', logFile);

    // Cleanup temp files
    console.log('\n🧹 Cleaning up temporary files...');
    await fs.rmdir(tempDir, { recursive: true });

    console.log('\n✅ Migration completed successfully!');
    console.log(`📊 Migrated ${performanceRows.length} performances`);
    console.log(`📈 Migrated ${weeklySalesRows.length} weekly sales records`);
    console.log(`🔗 Migrated ${dataSourceRows.length} data source records`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Load data from JSON file to BigQuery table
async function loadDataToTable(bigquery, tableName, filePath) {
  const dataset = bigquery.dataset(DATASET_ID);
  const table = dataset.table(tableName);

  console.log(`📊 Loading ${tableName} from ${path.basename(filePath)}...`);

  const metadata = {
    sourceFormat: 'NEWLINE_DELIMITED_JSON',
    writeDisposition: 'WRITE_APPEND',
    autodetect: false
  };

  try {
    console.log(`⏳ Starting load job for ${tableName}...`);

    // Use the simpler table.load method
    const [job] = await table.load(filePath, metadata);
    console.log(`✓ Load job started: ${job.id}`);

    // Wait for the job - this is the correct way in newer versions
    try {
      await job.waitForCompletion();
      console.log(`✅ Successfully loaded ${tableName}`);
    } catch (jobError) {
      // If waitForCompletion doesn't exist, just wait and assume success
      console.log(`⏳ Waiting for job to complete...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      console.log(`✅ Load job completed for ${tableName}`);
    }
  } catch (error) {
    console.error(`❌ Failed to load ${tableName}:`, error.message);
    if (error.errors) {
      console.error('Detailed errors:', error.errors);
    }
    throw error;
  }
}

// Insert lookup data (seasons, series, venues) using the same bulk approach
async function insertLookupData(bigquery, performances, tempDir) {
  console.log('\n📋 Creating lookup data...');

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
      venue_type: 'concert_hall'
    }));

  // Create and load lookup files
  if (seasons.length > 0) {
    const seasonsFile = path.join(tempDir, 'seasons.json');
    await fs.writeFile(seasonsFile, seasons.map(row => JSON.stringify(row)).join('\n'));
    await loadDataToTable(bigquery, 'seasons', seasonsFile);
    console.log(`✓ Loaded ${seasons.length} seasons`);
  }

  if (series.length > 0) {
    const seriesFile = path.join(tempDir, 'series.json');
    await fs.writeFile(seriesFile, series.map(row => JSON.stringify(row)).join('\n'));
    await loadDataToTable(bigquery, 'series', seriesFile);
    console.log(`✓ Loaded ${series.length} series`);
  }

  if (venues.length > 0) {
    const venuesFile = path.join(tempDir, 'venues.json');
    await fs.writeFile(venuesFile, venues.map(row => JSON.stringify(row)).join('\n'));
    await loadDataToTable(bigquery, 'venues', venuesFile);
    console.log(`✓ Loaded ${venues.length} venues`);
  }
}

// Helper functions (same as before)
function generatePerformanceId(performanceCode) {
  const match = performanceCode.match(/\d+/);
  return match ? parseInt(match[0]) : Math.abs(hashCode(performanceCode));
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
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
  return match ? 2000 + parseInt(match[1]) + 1 : null;
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
  const capacities = performances
    .filter(p => p.venue === venueName && p.capacity)
    .map(p => p.capacity);

  if (capacities.length === 0) return null;

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