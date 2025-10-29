/**
 * Parse Weekly Sales CSV - Build Historical Snapshots
 *
 * Input: Ticket Sales by Period_1132700.csv
 * Contains: Weekly incremental sales data (Week ending dates)
 * Output: Cumulative weekly snapshots for each performance
 *
 * This creates time-series data showing how sales evolved week-by-week
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

async function parseWeeklySalesCsv() {
  console.log('📊 Parsing Weekly Sales CSV...\n');
  console.log('=' .repeat(80));

  // Read CSV file
  const csvPath = path.join(__dirname, '..', 'Ticket Sales by Period_1132700.csv');
  const csvData = fs.readFileSync(csvPath, 'utf8');

  // Parse CSV
  const records = parse(csvData, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true // Handle UTF-8 BOM
  });

  console.log(`✅ Parsed ${records.length} transaction rows\n`);

  // Extract unique weeks and performances
  const weeks = new Set();
  const performances = new Set();

  for (const record of records) {
    weeks.add(record.group_desc);
    performances.add(record.perf_code1);
  }

  const weeksList = Array.from(weeks).sort();
  console.log(`📅 Found ${weeksList.length} unique weeks:`);
  console.log(`   First week: ${weeksList[0]}`);
  console.log(`   Last week: ${weeksList[weeksList.length - 1]}`);
  console.log(`\n🎭 Found ${performances.size} unique performances\n`);

  // Build weekly snapshots - CUMULATIVE approach
  // Each week shows total sales UP TO that week
  const performanceSnapshots = new Map();

  // Process in chronological order
  for (const weekDesc of weeksList) {
    const weekDate = weekDesc.replace('Week ending ', '');

    // Get all transactions for this week
    const weekTransactions = records.filter(r => r.group_desc === weekDesc);

    // Group by performance code and category
    for (const tx of weekTransactions) {
      const perfCode = tx.perf_code1;
      const perfDate = tx.perf_dt1;
      const category = tx.category1;

      // Parse ticket count - handle parentheses for negative numbers
      let tktCount = tx.tkt_count2.replace(/[()]/g, '');
      tktCount = tktCount.startsWith('-') ? parseInt(tktCount) : parseInt(tktCount);
      if (tx.tkt_count2.includes('(')) tktCount = -Math.abs(tktCount);

      // Parse revenue - handle parentheses and commas
      let revenue = tx.trn_amount3.replace(/[(),]/g, '');
      revenue = parseFloat(revenue) || 0;
      if (tx.trn_amount3.includes('(') || tx.trn_amount3.startsWith('-')) {
        revenue = -Math.abs(revenue);
      }

      // Initialize performance if needed
      if (!performanceSnapshots.has(perfCode)) {
        performanceSnapshots.set(perfCode, {
          performanceCode: perfCode,
          performanceDate: perfDate,
          weeklySnapshots: {}
        });
      }

      const perf = performanceSnapshots.get(perfCode);

      // Initialize week snapshot if needed
      if (!perf.weeklySnapshots[weekDate]) {
        perf.weeklySnapshots[weekDate] = {
          weekEnding: weekDate,
          categories: {},
          singleTickets: 0,
          subscriptionTickets: 0,
          totalTickets: 0,
          totalRevenue: 0
        };
      }

      const snapshot = perf.weeklySnapshots[weekDate];

      // Track by category
      if (!snapshot.categories[category]) {
        snapshot.categories[category] = {
          tickets: 0,
          revenue: 0
        };
      }

      snapshot.categories[category].tickets += tktCount;
      snapshot.categories[category].revenue += revenue;
    }
  }

  console.log('🔄 Building cumulative snapshots...\n');

  // Convert weekly increments to cumulative totals
  const cumulativeSnapshots = [];

  for (const [perfCode, perfData] of performanceSnapshots.entries()) {
    let cumulativeSingle = 0;
    let cumulativeSubscription = 0;
    let cumulativeRevenue = 0;

    const sortedWeeks = Object.keys(perfData.weeklySnapshots).sort(
      (a, b) => new Date(a) - new Date(b)
    );

    for (const weekDate of sortedWeeks) {
      const weekSnapshot = perfData.weeklySnapshots[weekDate];

      // Calculate incremental sales for this week
      const weekSingle =
        (weekSnapshot.categories['Single']?.tickets || 0) +
        (weekSnapshot.categories['Internet']?.tickets || 0);

      const weekSubscription =
        (weekSnapshot.categories['Subscription']?.tickets || 0) +
        (weekSnapshot.categories['Exchange']?.tickets || 0); // Exchanges often subscription-related

      const weekRevenue =
        Object.values(weekSnapshot.categories).reduce((sum, cat) => sum + cat.revenue, 0);

      // Add to cumulative totals
      cumulativeSingle += weekSingle;
      cumulativeSubscription += weekSubscription;
      cumulativeRevenue += weekRevenue;

      // Create cumulative snapshot
      cumulativeSnapshots.push({
        performanceCode: perfCode,
        performanceDate: perfData.performanceDate,
        snapshotDate: weekDate,
        weekEnding: weekDate,

        // Incremental (this week only)
        weeklyIncrement: {
          singleTickets: weekSingle,
          subscriptionTickets: weekSubscription,
          totalTickets: weekSingle + weekSubscription,
          totalRevenue: weekRevenue
        },

        // Cumulative (up to this week)
        cumulativeSales: {
          singleTickets: cumulativeSingle,
          subscriptionTickets: cumulativeSubscription,
          totalTickets: cumulativeSingle + cumulativeSubscription,
          totalRevenue: cumulativeRevenue
        },

        // Category breakdown for this week
        categories: weekSnapshot.categories
      });
    }

    // Reset cumulative counters for next performance
  }

  console.log(`✅ Created ${cumulativeSnapshots.length} cumulative weekly snapshots\n`);

  // Sort by date and performance
  cumulativeSnapshots.sort((a, b) => {
    const dateCompare = new Date(a.snapshotDate) - new Date(b.snapshotDate);
    if (dateCompare !== 0) return dateCompare;
    return a.performanceCode.localeCompare(b.performanceCode);
  });

  // Show summary statistics
  console.log('📊 SUMMARY STATISTICS:');
  console.log('─'.repeat(80));

  // Get latest snapshot for each performance
  const latestSnapshots = new Map();
  for (const snapshot of cumulativeSnapshots) {
    if (!latestSnapshots.has(snapshot.performanceCode) ||
        new Date(snapshot.snapshotDate) > new Date(latestSnapshots.get(snapshot.performanceCode).snapshotDate)) {
      latestSnapshots.set(snapshot.performanceCode, snapshot);
    }
  }

  console.log(`  Total performances tracked: ${latestSnapshots.size}`);
  console.log(`  Total weekly snapshots: ${cumulativeSnapshots.length}`);
  console.log(`  Average snapshots per performance: ${(cumulativeSnapshots.length / latestSnapshots.size).toFixed(1)}`);

  const totalTickets = Array.from(latestSnapshots.values())
    .reduce((sum, s) => sum + s.cumulativeSales.totalTickets, 0);
  const totalRevenue = Array.from(latestSnapshots.values())
    .reduce((sum, s) => sum + s.cumulativeSales.totalRevenue, 0);

  console.log(`  Total tickets sold (all performances): ${totalTickets.toLocaleString()}`);
  console.log(`  Total revenue (all performances): $${Math.round(totalRevenue).toLocaleString()}`);

  // Show top 5 performances by final sales
  const topPerformances = Array.from(latestSnapshots.values())
    .filter(s => s.cumulativeSales.totalTickets > 0)
    .sort((a, b) => b.cumulativeSales.totalTickets - a.cumulativeSales.totalTickets)
    .slice(0, 5);

  console.log('\n🏆 Top 5 Performances by Total Sales:');
  console.log('─'.repeat(80));
  for (const perf of topPerformances) {
    console.log(`  ${perf.performanceCode} (${perf.performanceDate})`);
    console.log(`    Total: ${perf.cumulativeSales.totalTickets} tickets, $${Math.round(perf.cumulativeSales.totalRevenue).toLocaleString()}`);
    console.log(`    Single: ${perf.cumulativeSales.singleTickets}, Subscription: ${perf.cumulativeSales.subscriptionTickets}`);
  }

  // Show progression example for one performance
  const examplePerf = '251010E'; // CS01 Copland's Appalachian Spring
  const exampleSnapshots = cumulativeSnapshots.filter(s => s.performanceCode === examplePerf);

  if (exampleSnapshots.length > 0) {
    console.log(`\n📈 Example: Sales Progression for ${examplePerf}`);
    console.log('─'.repeat(80));
    console.log('Week Ending       | Weekly Sales | Cumulative Total');
    console.log('─'.repeat(80));
    for (const snapshot of exampleSnapshots) {
      const weekSales = snapshot.weeklyIncrement.totalTickets;
      const cumSales = snapshot.cumulativeSales.totalTickets;
      console.log(`${snapshot.weekEnding.padEnd(18)}| ${weekSales.toString().padStart(12)} | ${cumSales.toString().padStart(16)}`);
    }
  }

  // Write output files
  const outputDir = path.join(__dirname, '..', 'data');

  // Full snapshots data
  const fullOutputPath = path.join(outputDir, 'historical-weekly-snapshots.json');
  fs.writeFileSync(fullOutputPath, JSON.stringify({
    extractedAt: new Date().toISOString(),
    source: 'Ticket Sales by Period_1132700.csv',
    reportPeriod: {
      firstWeek: weeksList[0],
      lastWeek: weeksList[weeksList.length - 1]
    },
    summary: {
      totalPerformances: latestSnapshots.size,
      totalSnapshots: cumulativeSnapshots.length,
      totalTickets,
      totalRevenue
    },
    snapshots: cumulativeSnapshots
  }, null, 2));

  console.log(`\n💾 Saved full snapshots: ${fullOutputPath}`);

  // Latest snapshot for each performance (for comparison with current data)
  const latestOutputPath = path.join(outputDir, 'historical-latest-snapshot.json');
  fs.writeFileSync(latestOutputPath, JSON.stringify({
    extractedAt: new Date().toISOString(),
    snapshotDate: weeksList[weeksList.length - 1],
    source: 'Ticket Sales by Period_1132700.csv',
    summary: {
      totalPerformances: latestSnapshots.size,
      totalTickets,
      totalRevenue
    },
    performances: Array.from(latestSnapshots.values()).map(s => ({
      performanceCode: s.performanceCode,
      performanceDate: s.performanceDate,
      singleTickets: s.cumulativeSales.singleTickets,
      subscriptionTickets: s.cumulativeSales.subscriptionTickets,
      totalTickets: s.cumulativeSales.totalTickets,
      totalRevenue: s.cumulativeSales.totalRevenue
    }))
  }, null, 2));

  console.log(`💾 Saved latest snapshot: ${latestOutputPath}`);

  console.log('\n✅ PARSING COMPLETE!');
  console.log('─'.repeat(80));
  console.log('Next steps:');
  console.log('  1. Compare latest snapshot with current BigQuery data');
  console.log('  2. Create performance_snapshots table in BigQuery');
  console.log('  3. Import all weekly snapshots for historical tracking');
  console.log('  4. Enhance dashboard to show sales progression over time\n');

  return {
    snapshots: cumulativeSnapshots,
    latestSnapshots: Array.from(latestSnapshots.values())
  };
}

// Run if executed directly
if (require.main === module) {
  parseWeeklySalesCsv()
    .then(() => {
      console.log('🎉 Done!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error:', error.message);
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = { parseWeeklySalesCsv };
