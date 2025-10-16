/**
 * Extract Current Performance Data from BigQuery
 *
 * Retrieves the 60 performances with sales data from BigQuery
 * and outputs structured JSON for merging with Excel data.
 *
 * OUTPUT: data/bigquery-extracted.json
 * USAGE: node scripts/extract-bigquery-data.js
 */

const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration
const CONFIG = {
  outputPath: 'data/bigquery-extracted.json',
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  dataset: 'symphony_dashboard'
};

/**
 * Initialize BigQuery client
 */
const initializeBigQuery = () => {
  const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  let credentials;

  if (credentialsEnv.startsWith('{')) {
    credentials = JSON.parse(credentialsEnv);
  } else {
    const credentialsFile = path.resolve(credentialsEnv);
    credentials = JSON.parse(fs.readFileSync(credentialsFile, 'utf8'));
  }

  if (credentials.private_key?.includes('\\\\n')) {
    credentials.private_key = credentials.private_key.replace(/\\\\n/g, '\n');
  }

  return new BigQuery({
    projectId: CONFIG.projectId || credentials.project_id,
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
    location: 'US'
  });
};

/**
 * Extract performance data from BigQuery
 */
async function extractBigQueryData() {
  console.log('📊 Extracting performance data from BigQuery...\n');

  const bigquery = initializeBigQuery();

  // Query all performances with sales data
  const query = `
    SELECT
      performance_id,
      performance_code,
      title,
      series,
      performance_date,
      venue,
      season,
      capacity,
      single_tickets_sold,
      subscription_tickets_sold,
      total_tickets_sold,
      total_revenue,
      occupancy_goal,
      budget_goal,
      capacity_percent,
      budget_percent,
      has_sales_data,
      created_at,
      updated_at,
      last_pdf_import_date
    FROM \`${CONFIG.projectId}.${CONFIG.dataset}.performances\`
    WHERE has_sales_data = true
    ORDER BY performance_date, performance_code
  `;

  console.log('🔍 Querying BigQuery...');
  const [rows] = await bigquery.query({ query, location: 'US' });

  console.log(`✅ Retrieved ${rows.length} performances with sales data\n`);

  // Transform BigQuery rows to structured format
  const performances = rows.map(row => {
    return {
      // Core identification
      performanceId: row.performance_id,
      performanceCode: row.performance_code,
      performanceName: row.title,
      seriesCode: row.series,
      performanceDate: row.performance_date?.value || row.performance_date,
      venue: row.venue,
      season: row.season,

      // Current sales (from BigQuery/PDFs)
      currentSales: {
        singleTickets: row.single_tickets_sold || 0,
        subscriptionTickets: row.subscription_tickets_sold || 0,
        totalTickets: row.total_tickets_sold || 0,
        totalRevenue: row.total_revenue || 0
      },

      // Calculated metrics
      metrics: {
        singleATP: row.single_tickets_sold > 0
          ? (row.total_revenue - (row.subscription_tickets_sold * 65)) / row.single_tickets_sold
          : 0,  // Rough estimate
        subscriptionATP: row.subscription_tickets_sold > 0
          ? 65  // Average subscription ATP (rough estimate)
          : 0
      },

      // Capacity data
      capacity: {
        total: row.capacity || 0,
        currentOccupancy: row.capacity_percent || 0,
        occupancyGoal: row.occupancy_goal || 0.85
      },

      // Budget data (from BigQuery)
      budget: {
        goal: row.budget_goal || 0,
        achievement: row.budget_percent || 0
      },

      // Metadata
      metadata: {
        hasSalesData: row.has_sales_data,
        createdAt: row.created_at?.value || row.created_at,
        updatedAt: row.updated_at?.value || row.updated_at,
        lastPdfImport: row.last_pdf_import_date?.value || row.last_pdf_import_date
      }
    };
  });

  // Create output structure
  const outputData = {
    extractedAt: new Date().toISOString(),
    source: 'BigQuery',
    dataset: CONFIG.dataset,
    performanceCount: performances.length,
    performances: performances
  };

  // Write to file
  ensureDirectoryExists(path.dirname(CONFIG.outputPath));
  fs.writeFileSync(CONFIG.outputPath, JSON.stringify(outputData, null, 2));

  console.log(`✅ Extracted ${performances.length} performances`);
  console.log(`📁 Output written to: ${CONFIG.outputPath}\n`);

  // Summary stats
  printSummary(performances);

  return outputData;
}

/**
 * Print summary statistics
 */
function printSummary(performances) {
  console.log('=' .repeat(60));
  console.log('SUMMARY STATISTICS');
  console.log('=' .repeat(60));

  // Group by series
  const bySeries = {};
  performances.forEach(p => {
    const series = p.seriesCode || 'Unknown';
    if (!bySeries[series]) bySeries[series] = [];
    bySeries[series].push(p);
  });

  console.log('\n📊 Performances by Series:');
  Object.entries(bySeries).sort().forEach(([series, perfs]) => {
    console.log(`   ${series}: ${perfs.length} performances`);
  });

  // Revenue stats
  const totalRevenue = performances.reduce((sum, p) => sum + p.currentSales.totalRevenue, 0);
  const avgRevenue = totalRevenue / performances.length;

  console.log('\n💰 Revenue Statistics:');
  console.log(`   Total Revenue: $${totalRevenue.toLocaleString()}`);
  console.log(`   Average per Performance: $${avgRevenue.toLocaleString()}`);

  // Ticket stats
  const totalTickets = performances.reduce((sum, p) => sum + p.currentSales.totalTickets, 0);
  const totalSingle = performances.reduce((sum, p) => sum + p.currentSales.singleTickets, 0);
  const totalSub = performances.reduce((sum, p) => sum + p.currentSales.subscriptionTickets, 0);

  console.log('\n🎟️  Ticket Statistics:');
  console.log(`   Total Tickets Sold: ${totalTickets.toLocaleString()}`);
  console.log(`   Single Tickets: ${totalSingle.toLocaleString()} (${((totalSingle/totalTickets)*100).toFixed(1)}%)`);
  console.log(`   Subscription Tickets: ${totalSub.toLocaleString()} (${((totalSub/totalTickets)*100).toFixed(1)}%)`);

  // Date range
  const dates = performances.map(p => new Date(p.performanceDate)).filter(d => !isNaN(d));
  if (dates.length > 0) {
    const earliestDate = new Date(Math.min(...dates));
    const latestDate = new Date(Math.max(...dates));

    console.log('\n📅 Date Range:');
    console.log(`   Earliest: ${earliestDate.toISOString().split('T')[0]}`);
    console.log(`   Latest: ${latestDate.toISOString().split('T')[0]}`);
  }
}

/**
 * Helper: Ensure directory exists
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * CLI execution
 */
if (require.main === module) {
  extractBigQueryData()
    .then(() => {
      console.log('\n✅ BigQuery data extraction complete!');
    })
    .catch(error => {
      console.error('❌ Extraction failed:', error.message);
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = { extractBigQueryData };
