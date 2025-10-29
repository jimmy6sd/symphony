/**
 * Create Dashboard Data with Correct Priority
 *
 * DATA HIERARCHY:
 * 1. PDF/BigQuery (SOURCE OF TRUTH):
 *    - Performance dates, codes, IDs
 *    - Single ticket sales
 *    - Subscription ticket sales
 *    - Total revenue
 *    - Capacity/availability
 *    - Budget data from BigQuery
 *
 * 2. Excel (SUPPLEMENTAL ONLY):
 *    - Projections (expected sales)
 *    - Audience intelligence
 *    - Sales velocity
 *    - Performance types (if missing)
 *    - Pacing models
 *
 * 3. Admin UI (FUTURE):
 *    - Manual overrides for supplemental data only
 *    - Cannot override PDF/BigQuery data
 *
 * OUTPUT: data/dashboard-data.json
 */

const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Initialize BigQuery
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
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || credentials.project_id,
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
    location: 'US'
  });
};

/**
 * Load Excel supplemental data
 */
function loadExcelSupplemental() {
  const excelPath = 'data/excel-extracted.json';
  if (!fs.existsSync(excelPath)) {
    console.warn('⚠️  Excel data not found, will use BigQuery only');
    return { performances: [] };
  }
  return JSON.parse(fs.readFileSync(excelPath, 'utf8'));
}

/**
 * Find Excel supplemental data for a performance
 */
function findExcelSupplemental(bqPerf, excelData) {
  const bqSeries = bqPerf.series?.toUpperCase();
  const bqDate = bqPerf.performance_date?.value || bqPerf.performance_date;

  // Try to match by series code and date
  return excelData.performances.find(ep => {
    const epSeries = ep.seriesCode?.toUpperCase();
    const epDate = ep.performanceDate;
    return epSeries === bqSeries && epDate === bqDate;
  });
}

/**
 * Guess performance type from series code
 */
function guessPerformanceType(seriesCode) {
  if (!seriesCode) return 'Other';
  const code = seriesCode.toUpperCase();

  if (code.startsWith('CS')) return 'Classical';
  if (code.startsWith('PS')) return 'Pops';
  if (code.startsWith('FS')) return 'Family';
  if (code.includes('ON STAGE')) return 'On Stage';
  if (code.includes('HARRY POTTER') || code.includes('TOP GUN') || code.includes('INDIANA')) return 'Film';
  if (code.includes('CHRISTMAS') || code.includes('ELF') || code.includes('MESSIAH')) return 'Holiday';

  return 'Special Event';
}

/**
 * Calculate risk metrics
 */
function calculateRiskMetrics(performance, excelData) {
  if (!excelData || !excelData.projected?.singleTickets) {
    return {
      riskLevel: 'UNKNOWN',
      pacingStatus: 'NO_DATA',
      budgetStatus: 'NO_DATA',
      message: 'No projection data available'
    };
  }

  // Calculate pacing variance
  const actualSingles = performance.single_tickets_sold || 0;
  const projectedSingles = excelData.projected.singleTickets;
  const pacingVariance = projectedSingles > 0
    ? (actualSingles - projectedSingles) / projectedSingles
    : 0;

  // Calculate budget achievement
  const budgetAchievement = performance.budget_goal > 0
    ? performance.total_revenue / performance.budget_goal
    : 0;

  // Determine risk level
  let riskLevel = 'LOW';
  if (pacingVariance < -0.5 || budgetAchievement < 0.5) {
    riskLevel = 'HIGH';
  } else if (pacingVariance < -0.25 || budgetAchievement < 0.75) {
    riskLevel = 'MEDIUM';
  }

  // Pacing status
  let pacingStatus = 'ON_TARGET';
  if (pacingVariance < -0.15) pacingStatus = 'BEHIND';
  else if (pacingVariance > 0.15) pacingStatus = 'AHEAD';

  // Budget status
  let budgetStatus = 'ON_TARGET';
  if (budgetAchievement < 0.85) budgetStatus = 'BELOW';
  else if (budgetAchievement >= 0.95) budgetStatus = 'AT_OR_ABOVE';

  return {
    riskLevel,
    pacingStatus,
    budgetStatus,
    pacingVariance,
    budgetAchievement
  };
}

/**
 * Main function to create dashboard data
 */
async function createDashboardData() {
  console.log('🎯 Creating Dashboard Data (BigQuery Priority)\n');
  console.log('=' .repeat(60));

  // 1. Load BigQuery data (SOURCE OF TRUTH)
  console.log('📊 Loading BigQuery data (SOURCE OF TRUTH)...');
  const bigquery = initializeBigQuery();
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;

  const query = `
    SELECT *
    FROM \`${projectId}.symphony_dashboard.performances\`
    WHERE has_sales_data = true
    ORDER BY performance_date, performance_code
  `;

  const [bqRows] = await bigquery.query({ query, location: 'US' });
  console.log(`✅ Loaded ${bqRows.length} performances from BigQuery\n`);

  // 2. Load Excel supplemental data
  console.log('📑 Loading Excel supplemental data...');
  const excelData = loadExcelSupplemental();
  console.log(`✅ Loaded ${excelData.performances?.length || 0} Excel records\n`);

  // 3. Merge data with BigQuery priority
  console.log('🔗 Merging data (BigQuery first, Excel supplements)...\n');

  const dashboardPerformances = bqRows.map(bq => {
    const excelSupplemental = findExcelSupplemental(bq, excelData);

    // Calculate ATP from BigQuery data
    const singleATP = bq.single_tickets_sold > 0
      ? (bq.total_revenue * 0.6) / bq.single_tickets_sold  // Rough estimate
      : 0;

    const performance = {
      // CORE DATA - FROM BIGQUERY (SOURCE OF TRUTH)
      id: bq.performance_id,
      performanceId: bq.performance_id,
      performanceCode: bq.performance_code,
      title: bq.title,
      series: bq.series,
      date: bq.performance_date?.value || bq.performance_date,
      venue: bq.venue,
      season: bq.season,

      // SALES DATA - FROM BIGQUERY (SOURCE OF TRUTH)
      singleTicketsSold: bq.single_tickets_sold || 0,
      subscriptionTicketsSold: bq.subscription_tickets_sold || 0,
      totalTicketsSold: bq.total_tickets_sold || 0,
      totalRevenue: bq.total_revenue || 0,

      // CAPACITY - FROM BIGQUERY (SOURCE OF TRUTH)
      capacity: bq.capacity || 0,
      capacityPercent: bq.capacity_percent || 0,
      occupancyGoal: bq.occupancy_goal || 85,

      // BUDGET - FROM BIGQUERY (SOURCE OF TRUTH)
      budgetGoal: bq.budget_goal || 0,
      budgetPercent: bq.budget_percent || 0,

      // PRICING - CALCULATED FROM BIGQUERY
      singleTicketATP: singleATP,

      // PERFORMANCE TYPE - FROM EXCEL OR GUESSED
      performanceType: excelSupplemental?.performanceType || guessPerformanceType(bq.series),

      // SUPPLEMENTAL DATA - FROM EXCEL (ENRICHMENT ONLY)
      supplemental: excelSupplemental ? {
        // Projections
        projected: {
          singleTickets: excelSupplemental.projected?.singleTickets || null,
          totalTickets: excelSupplemental.projected?.totalTickets || null,
          occupancy: excelSupplemental.projected?.occupancy || null
        },

        // Targets
        targets: {
          singleTicketsFor85Occ: excelSupplemental.targets?.singleTicketsFor85Occ || null
        },

        // Audience intelligence
        audience: {
          newHouseholds: excelSupplemental.audience?.newHouseholds || 0,
          returningHouseholds: excelSupplemental.audience?.returningHouseholds || 0,
          totalHouseholds: excelSupplemental.audience?.totalHouseholds || 0
        },

        // Sales velocity
        salesVelocity: {
          revenueLastWeek: excelSupplemental.salesVelocity?.revenueLastWeek || null,
          weeklyIncrease: excelSupplemental.salesVelocity?.weeklyIncrease || null
        },

        // Timeline
        timeline: {
          weekNumber: excelSupplemental.weekNumber || null,
          weeksUntilPerformance: excelSupplemental.weeksUntilPerformance || null
        }
      } : null,

      // CALCULATED METRICS
      riskMetrics: calculateRiskMetrics(bq, excelSupplemental),

      // METADATA
      hasSalesData: bq.has_sales_data,
      hasExcelData: !!excelSupplemental,
      createdAt: bq.created_at?.value || bq.created_at,
      updatedAt: bq.updated_at?.value || bq.updated_at,
      lastPdfImport: bq.last_pdf_import_date?.value || bq.last_pdf_import_date,

      // Weekly sales progression (generated from current data for visualization)
      // Uses single_tickets_sold (which includes non-fixed packages) to match sales curve chart
      weeklySales: generateWeeklySalesProgression(bq.single_tickets_sold || 0)
    };

    if (excelSupplemental) {
      console.log(`  ✅ ${bq.title} (${bq.performance_date?.value || bq.performance_date})`);
    } else {
      console.log(`  ⚪ ${bq.title} (${bq.performance_date?.value || bq.performance_date}) - BigQuery only`);
    }

    return performance;
  });

  // Write output
  const outputData = {
    generatedAt: new Date().toISOString(),
    dataHierarchy: {
      priority1: 'PDF/BigQuery (source of truth)',
      priority2: 'Excel (supplemental enrichment)',
      priority3: 'Admin UI (future manual overrides)'
    },
    summary: {
      totalPerformances: dashboardPerformances.length,
      withExcelSupplemental: dashboardPerformances.filter(p => p.hasExcelData).length,
      withoutExcelSupplemental: dashboardPerformances.filter(p => !p.hasExcelData).length
    },
    performances: dashboardPerformances
  };

  const outputPath = 'data/dashboard-data.json';
  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));

  console.log(`\n✅ Dashboard data created: ${outputPath}`);
  console.log(`📊 ${outputData.summary.totalPerformances} performances`);
  console.log(`📈 ${outputData.summary.withExcelSupplemental} with Excel supplemental data`);
  console.log(`📉 ${outputData.summary.withoutExcelSupplemental} BigQuery only\n`);

  return outputData;
}

/**
 * Generate weekly sales progression for visualization
 */
function generateWeeklySalesProgression(finalTickets) {
  const weeks = [];
  const expectedProgression = [0.15, 0.18, 0.21, 0.24, 0.27, 0.30, 0.39, 0.46, 0.59, 1.0];

  for (let week = 1; week <= 10; week++) {
    const progress = expectedProgression[week - 1];
    weeks.push({
      week,
      ticketsSold: Math.round(finalTickets * progress),
      percentage: progress * 100
    });
  }

  return weeks;
}

// Execute
if (require.main === module) {
  createDashboardData()
    .then(() => {
      console.log('🎉 Dashboard data ready!');
    })
    .catch(error => {
      console.error('❌ Failed to create dashboard data:', error.message);
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = { createDashboardData };
