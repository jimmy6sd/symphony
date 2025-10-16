/**
 * Merge Excel and BigQuery Data
 *
 * Combines budget/projection data from Excel with current sales data from BigQuery
 * to create a unified dataset for the dashboard.
 *
 * INPUTS:
 *   - data/excel-extracted.json (102 performance records)
 *   - data/bigquery-extracted.json (60 performances with sales)
 *
 * OUTPUT:
 *   - data/unified-dashboard-data.json (merged and enriched)
 *
 * USAGE:
 *   node scripts/merge-excel-bigquery.js
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  excelDataPath: 'data/excel-extracted.json',
  bigqueryDataPath: 'data/bigquery-extracted.json',
  outputPath: 'data/unified-dashboard-data.json'
};

/**
 * Load JSON data file
 */
function loadJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Normalize performance name for matching
 * Removes series codes, special characters, and standardizes spacing
 */
function normalizePerformanceName(name) {
  if (!name) return '';

  return name
    .toLowerCase()
    .replace(/^(26\s+|cs\d+\s+|ps\d+\s+|fs\d+\s+)/i, '')  // Remove series prefixes
    .replace(/['']/g, "'")  // Normalize apostrophes
    .replace(/&/g, 'and')  // Normalize ampersands
    .replace(/\s+/g, ' ')  // Normalize spaces
    .replace(/[^\w\s']/g, '')  // Remove special characters
    .trim();
}

/**
 * Normalize date for matching
 */
function normalizeDate(date) {
  if (!date) return null;

  try {
    const d = new Date(date);
    return d.toISOString().split('T')[0];  // YYYY-MM-DD format
  } catch {
    return null;
  }
}

/**
 * Match BigQuery performance to Excel performance
 * Returns best match or null
 */
function findExcelMatch(bqPerf, excelPerformances) {
  const bqName = normalizePerformanceName(bqPerf.performanceName);
  const bqDate = normalizeDate(bqPerf.performanceDate);
  const bqSeries = bqPerf.seriesCode?.toUpperCase();

  // Try to find exact match by series code and date
  let match = excelPerformances.find(ep => {
    const epSeries = ep.seriesCode?.toUpperCase();
    const epDate = normalizeDate(ep.performanceDate);

    return epSeries === bqSeries && epDate === bqDate;
  });

  if (match) return match;

  // Try fuzzy name match with same date
  match = excelPerformances.find(ep => {
    const epName = normalizePerformanceName(ep.performanceName);
    const epDate = normalizeDate(ep.performanceDate);

    return epDate === bqDate && epName.includes(bqName.substring(0, 10));
  });

  if (match) return match;

  // Last resort: just match by name similarity
  match = excelPerformances.find(ep => {
    const epName = normalizePerformanceName(ep.performanceName);
    return epName.includes(bqName.substring(0, 15)) || bqName.includes(epName.substring(0, 15));
  });

  return match || null;
}

/**
 * Merge a single performance's data
 */
function mergePerformance(bqPerf, excelPerf) {
  const merged = {
    // Core identification (prefer BigQuery as source of truth)
    performanceId: bqPerf.performanceId,
    performanceCode: bqPerf.performanceCode,
    performanceName: bqPerf.performanceName,
    seriesCode: bqPerf.seriesCode || excelPerf?.seriesCode,
    performanceDate: bqPerf.performanceDate,
    performanceType: excelPerf?.performanceType || guessPerformanceType(bqPerf.seriesCode),
    venue: bqPerf.venue,
    season: bqPerf.season,

    // Timeline (from Excel if available)
    timeline: excelPerf ? {
      weekNumber: excelPerf.weekNumber,
      weeksUntilPerformance: excelPerf.weeksUntilPerformance
    } : null,

    // Current sales (from BigQuery)
    currentSales: bqPerf.currentSales,

    // Budget targets (from Excel, enhanced with BigQuery)
    budget: {
      total: excelPerf?.budget.total || bqPerf.budget.goal || 0,
      single: excelPerf?.budget.single || 0,
      subscription: excelPerf?.budget.subscription || 0
    },

    // Budget achievement (calculated)
    budgetAchievement: {
      total: excelPerf?.budgetAchievement.total || bqPerf.budget.achievement || 0,
      single: excelPerf?.budgetAchievement.single || 0,
      subscription: excelPerf?.budgetAchievement.subscription || 0
    },

    // Revenue breakdown (from BigQuery + Excel)
    revenue: {
      total: bqPerf.currentSales.totalRevenue,
      single: excelPerf?.revenue.single || 0,
      subscription: excelPerf?.revenue.subscription || 0
    },

    // Projections (from Excel)
    projected: excelPerf?.projected || {
      singleTickets: null,
      totalTickets: null,
      occupancy: null
    },

    // Targets (from Excel)
    targets: excelPerf?.targets || {
      singleTicketsFor85Occ: null
    },

    // Capacity (merge BigQuery + Excel)
    capacity: {
      max: bqPerf.capacity.total || excelPerf?.capacity.max || 0,
      currentOccupancy: bqPerf.capacity.currentOccupancy || excelPerf?.capacity.currentOccupancy || 0,
      occupancyGoal: bqPerf.capacity.occupancyGoal || 0.85
    },

    // Pricing (from Excel + BigQuery)
    pricing: {
      singleATP: excelPerf?.pricing.singleATP || bqPerf.metrics.singleATP || 0,
      subscriptionATP: bqPerf.metrics.subscriptionATP || 0
    },

    // Audience intelligence (from Excel)
    audience: excelPerf?.audience || {
      newHouseholds: 0,
      returningHouseholds: 0,
      totalHouseholds: 0
    },

    // Sales velocity (from Excel)
    salesVelocity: excelPerf?.salesVelocity || {
      revenueLastWeek: null,
      weeklyIncrease: null
    },

    // Calculated risk metrics
    riskMetrics: calculateRiskMetrics(bqPerf, excelPerf),

    // Data sources
    dataSources: {
      hasExcelData: !!excelPerf,
      hasBigQueryData: true,
      excelMatched: !!excelPerf
    }
  };

  return merged;
}

/**
 * Calculate risk metrics for a performance
 */
function calculateRiskMetrics(bqPerf, excelPerf) {
  if (!excelPerf) {
    return {
      riskLevel: 'UNKNOWN',
      pacingStatus: 'NO_DATA',
      budgetStatus: 'NO_DATA'
    };
  }

  // Pacing variance (actual vs projected)
  const actualSingles = bqPerf.currentSales.singleTickets;
  const projectedSingles = excelPerf.projected?.singleTickets || 0;
  const pacingVariance = projectedSingles > 0
    ? (actualSingles - projectedSingles) / projectedSingles
    : 0;

  // Budget variance
  const budgetVariance = excelPerf.budgetAchievement?.total || 0;

  // Determine risk level
  let riskLevel = 'LOW';
  if (pacingVariance < -0.5 || budgetVariance < 0.5) {
    riskLevel = 'HIGH';
  } else if (pacingVariance < -0.25 || budgetVariance < 0.75) {
    riskLevel = 'MEDIUM';
  }

  // Pacing status
  let pacingStatus = 'ON_TARGET';
  if (pacingVariance < -0.25) pacingStatus = 'BEHIND';
  else if (pacingVariance > 0.15) pacingStatus = 'AHEAD';

  // Budget status
  let budgetStatus = 'ON_TARGET';
  if (budgetVariance < 0.85) budgetStatus = 'BELOW';
  else if (budgetVariance >= 0.95) budgetStatus = 'AT_OR_ABOVE';

  return {
    riskLevel,
    pacingStatus,
    budgetStatus,
    pacingVariance,
    budgetVariance
  };
}

/**
 * Guess performance type from series code
 */
function guessPerformanceType(seriesCode) {
  if (!seriesCode) return 'Unknown';

  const code = seriesCode.toUpperCase();
  if (code.startsWith('CS')) return 'Classical';
  if (code.startsWith('PS')) return 'Pops';
  if (code.startsWith('FS')) return 'Family';
  if (code.includes('ON STAGE')) return 'On Stage';
  if (code.includes('HARRY POTTER') || code.includes('TOP GUN') || code.includes('INDIANA')) return 'Film';
  if (code.includes('CHRISTMAS') || code.includes('ELF') || code.includes('MESSIAH')) return 'Holiday';

  return 'Specials';
}

/**
 * Main merge function
 */
function mergeData() {
  console.log('🔄 Merging Excel and BigQuery Data...\n');
  console.log('=' .repeat(60));

  // Load data
  console.log('📂 Loading data files...');
  const excelData = loadJson(CONFIG.excelDataPath);
  const bigqueryData = loadJson(CONFIG.bigqueryDataPath);

  console.log(`✅ Excel: ${excelData.performances.length} records`);
  console.log(`✅ BigQuery: ${bigqueryData.performances.length} records\n`);

  // Merge each BigQuery performance with Excel data
  console.log('🔗 Matching and merging performances...');

  const mergedPerformances = [];
  let matchCount = 0;

  bigqueryData.performances.forEach((bqPerf, index) => {
    const excelMatch = findExcelMatch(bqPerf, excelData.performances);

    if (excelMatch) {
      matchCount++;
      console.log(`  ✅ Matched: ${bqPerf.performanceName} (${bqPerf.performanceDate})`);
    } else {
      console.log(`  ⚠️  No Excel match: ${bqPerf.performanceName} (${bqPerf.performanceDate})`);
    }

    const merged = mergePerformance(bqPerf, excelMatch);
    mergedPerformances.push(merged);
  });

  console.log(`\n📊 Match Results: ${matchCount}/${bigqueryData.performances.length} performances matched to Excel data`);

  // Create output structure
  const outputData = {
    generatedAt: new Date().toISOString(),
    sources: {
      excel: {
        file: CONFIG.excelDataPath,
        extractedAt: excelData.extractedAt,
        recordCount: excelData.performances.length
      },
      bigquery: {
        file: CONFIG.bigqueryDataPath,
        extractedAt: bigqueryData.extractedAt,
        recordCount: bigqueryData.performances.length
      }
    },
    summary: {
      totalPerformances: mergedPerformances.length,
      withExcelData: matchCount,
      withoutExcelData: mergedPerformances.length - matchCount,
      matchRate: (matchCount / mergedPerformances.length * 100).toFixed(1) + '%'
    },
    performances: mergedPerformances
  };

  // Write output
  fs.writeFileSync(CONFIG.outputPath, JSON.stringify(outputData, null, 2));

  console.log(`\n✅ Merged data written to: ${CONFIG.outputPath}`);

  // Print summary stats
  printSummary(mergedPerformances);

  return outputData;
}

/**
 * Print summary statistics
 */
function printSummary(performances) {
  console.log('\n' + '=' .repeat(60));
  console.log('MERGED DATA SUMMARY');
  console.log('=' .repeat(60));

  // Risk levels
  const riskCounts = {
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    UNKNOWN: 0
  };

  performances.forEach(p => {
    riskCounts[p.riskMetrics.riskLevel]++;
  });

  console.log('\n🚨 Risk Distribution:');
  console.log(`   🔴 HIGH: ${riskCounts.HIGH} performances`);
  console.log(`   🟡 MEDIUM: ${riskCounts.MEDIUM} performances`);
  console.log(`   🟢 LOW: ${riskCounts.LOW} performances`);
  console.log(`   ⚪ UNKNOWN: ${riskCounts.UNKNOWN} performances (no Excel data)`);

  // Data completeness
  const withAudience = performances.filter(p => p.audience.totalHouseholds > 0).length;
  const withProjections = performances.filter(p => p.projected.totalTickets !== null).length;
  const withBudget = performances.filter(p => p.budget.total > 0).length;

  console.log('\n📊 Data Completeness:');
  console.log(`   Audience Data: ${withAudience}/${performances.length} (${(withAudience/performances.length*100).toFixed(1)}%)`);
  console.log(`   Projections: ${withProjections}/${performances.length} (${(withProjections/performances.length*100).toFixed(1)}%)`);
  console.log(`   Budget Targets: ${withBudget}/${performances.length} (${(withBudget/performances.length*100).toFixed(1)}%)`);
}

/**
 * CLI execution
 */
if (require.main === module) {
  try {
    const result = mergeData();
    console.log('\n🎉 Merge complete!');
    console.log(`📁 Unified dashboard data ready at: ${CONFIG.outputPath}`);
  } catch (error) {
    console.error('\n❌ Merge failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

module.exports = { mergeData, normalizePerformanceName, normalizeDate };
