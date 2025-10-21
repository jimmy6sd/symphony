/**
 * Parse TicketSalesByPeriod.xml
 *
 * This XML file contains sales transactions grouped by week from 1/1/24 to 10/20/25.
 * Each row represents sales in a specific category during a specific period.
 *
 * Goal: Extract weekly snapshots for each performance to build historical progression
 */

const fs = require('fs');
const xml2js = require('xml2js');
const path = require('path');

async function parseTicketSalesByPeriod() {
  console.log('📊 Parsing TicketSalesByPeriod.xml...\n');
  console.log('=' .repeat(70));

  // Read XML file
  const xmlPath = path.join(__dirname, '..', 'TicketSalesByPeriod.xml');
  const xmlData = fs.readFileSync(xmlPath, 'utf8');

  // Parse XML
  const parser = new xml2js.Parser();
  const result = await parser.parseStringPromise(xmlData);

  // Extract detail rows
  const details = result.Report.Export[0].Details1_Collection[0].Details1;

  console.log(`✅ Found ${details.length} transaction rows\n`);

  // Group by performance code
  const performanceMap = new Map();

  for (const detail of details) {
    const attrs = detail.$;
    const perfCode = attrs.perf_code1;
    const perfDesc = attrs.group_desc;
    const perfDate = attrs.perf_dt1;
    const category = attrs.category1;
    const tktCount = parseInt(attrs.tkt_count2) || 0;
    const compCount = parseInt(attrs.comp_count3) || 0;
    const trnAmount = parseFloat(attrs.trn_amount3) || 0;

    if (!performanceMap.has(perfCode)) {
      performanceMap.set(perfCode, {
        performanceCode: perfCode,
        performanceName: perfDesc,
        performanceDate: perfDate,
        categories: {},
        totalTickets: 0,
        totalRevenue: 0
      });
    }

    const perf = performanceMap.get(perfCode);

    // Accumulate by category
    if (!perf.categories[category]) {
      perf.categories[category] = {
        tickets: 0,
        revenue: 0,
        transactions: 0
      };
    }

    perf.categories[category].tickets += tktCount;
    perf.categories[category].revenue += trnAmount;
    perf.categories[category].transactions += 1;

    perf.totalTickets += tktCount;
    perf.totalRevenue += trnAmount;
  }

  console.log(`\n📈 Grouped into ${performanceMap.size} unique performances\n`);

  // Analyze categories and performance types
  const categoryBreakdown = {};
  const performances = Array.from(performanceMap.values());

  for (const perf of performances) {
    for (const category in perf.categories) {
      if (!categoryBreakdown[category]) {
        categoryBreakdown[category] = {
          performances: 0,
          totalTickets: 0,
          totalRevenue: 0
        };
      }
      categoryBreakdown[category].performances += 1;
      categoryBreakdown[category].totalTickets += perf.categories[category].tickets;
      categoryBreakdown[category].totalRevenue += perf.categories[category].revenue;
    }
  }

  console.log('📊 Category Breakdown:');
  console.log('─'.repeat(70));
  for (const [category, data] of Object.entries(categoryBreakdown)) {
    console.log(`  ${category.padEnd(20)} ${data.performances.toString().padStart(4)} perfs  ${data.totalTickets.toString().padStart(6)} tickets  $${Math.round(data.totalRevenue).toLocaleString()}`);
  }

  // Show top performances by ticket sales
  const topPerformances = performances
    .filter(p => p.totalTickets > 0)
    .sort((a, b) => b.totalTickets - a.totalTickets)
    .slice(0, 10);

  console.log('\n🎯 Top 10 Performances by Ticket Sales:');
  console.log('─'.repeat(70));
  for (const perf of topPerformances) {
    const singleTickets = (perf.categories['Single']?.tickets || 0) +
                          (perf.categories['Internet']?.tickets || 0);
    const subscriptionTickets = (perf.categories['Subscription']?.tickets || 0);

    console.log(`  ${perf.performanceCode} ${perf.performanceName.substring(0, 30).padEnd(30)}`);
    console.log(`    Total: ${perf.totalTickets.toString().padStart(4)} tickets ($${Math.round(perf.totalRevenue).toLocaleString()})`);
    console.log(`    Single: ${singleTickets}, Subscription: ${subscriptionTickets}`);
  }

  // Determine if we can extract weekly snapshots
  console.log('\n\n🔍 ANALYSIS: Can we extract weekly snapshots?');
  console.log('─'.repeat(70));
  console.log('❓ The XML shows CUMULATIVE sales grouped by category.');
  console.log('❓ Without date/period markers, this appears to be a SINGLE snapshot.');
  console.log('❓ To get historical progression, we need MULTIPLE reports over time.\n');

  console.log('💡 RECOMMENDATION:');
  console.log('   1. This XML gives us ONE baseline snapshot (all sales 1/1/24 - 10/20/25)');
  console.log('   2. Use this as the historical baseline');
  console.log('   3. Going forward, run this report weekly to capture progression');
  console.log('   4. Each week\'s report = cumulative snapshot at that point in time\n');

  // Calculate single vs subscription breakdown for matching with current data
  console.log('\n📋 Performance Breakdown for BigQuery Import:');
  console.log('─'.repeat(70));

  const importData = performances
    .filter(p => p.totalTickets > 0)
    .map(perf => {
      // Group categories into Single and Subscription
      const singleTickets =
        (perf.categories['Single']?.tickets || 0) +
        (perf.categories['Internet']?.tickets || 0);

      const subscriptionTickets =
        (perf.categories['Subscription']?.tickets || 0);

      const singleRevenue =
        (perf.categories['Single']?.revenue || 0) +
        (perf.categories['Internet']?.revenue || 0);

      const subscriptionRevenue =
        (perf.categories['Subscription']?.revenue || 0);

      return {
        performanceCode: perf.performanceCode,
        performanceName: perf.performanceName,
        performanceDate: perf.performanceDate.split('T')[0],
        singleTickets,
        subscriptionTickets,
        totalTickets: singleTickets + subscriptionTickets,
        singleRevenue,
        subscriptionRevenue,
        totalRevenue: perf.totalRevenue,
        categories: perf.categories
      };
    })
    .sort((a, b) => new Date(a.performanceDate) - new Date(b.performanceDate));

  console.log(`✅ Ready to import: ${importData.length} performances with sales data`);
  console.log(`   Date range: ${importData[0]?.performanceDate} to ${importData[importData.length - 1]?.performanceDate}`);
  console.log(`   Total tickets: ${importData.reduce((sum, p) => sum + p.totalTickets, 0).toLocaleString()}`);
  console.log(`   Total revenue: $${Math.round(importData.reduce((sum, p) => sum + p.totalRevenue, 0)).toLocaleString()}`);

  // Write processed data for import
  const outputPath = path.join(__dirname, '..', 'data', 'xml-historical-snapshot.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    extractedAt: new Date().toISOString(),
    snapshotDate: '2025-10-20',
    reportPeriod: {
      start: '2024-01-01',
      end: '2025-10-20'
    },
    source: 'TicketSalesByPeriod.xml',
    summary: {
      totalPerformances: importData.length,
      totalTickets: importData.reduce((sum, p) => sum + p.totalTickets, 0),
      totalRevenue: importData.reduce((sum, p) => sum + p.totalRevenue, 0)
    },
    performances: importData
  }, null, 2));

  console.log(`\n💾 Saved processed data: ${outputPath}`);

  // Show sample of first 5 performances
  console.log('\n📄 Sample Data (first 5 performances):');
  console.log('─'.repeat(70));
  for (const perf of importData.slice(0, 5)) {
    console.log(`\n  ${perf.performanceCode} - ${perf.performanceName}`);
    console.log(`  Date: ${perf.performanceDate}`);
    console.log(`  Single: ${perf.singleTickets} tickets ($${Math.round(perf.singleRevenue).toLocaleString()})`);
    console.log(`  Subscription: ${perf.subscriptionTickets} tickets ($${Math.round(perf.subscriptionRevenue).toLocaleString()})`);
    console.log(`  Total: ${perf.totalTickets} tickets ($${Math.round(perf.totalRevenue).toLocaleString()})`);
  }

  console.log('\n\n✅ PARSING COMPLETE!');
  console.log('─'.repeat(70));
  console.log('Next steps:');
  console.log('  1. Compare this data with current BigQuery snapshots');
  console.log('  2. Create performance_snapshots table in BigQuery');
  console.log('  3. Import this as baseline historical snapshot (date: 2025-10-20)');
  console.log('  4. Set up weekly XML export to capture future progression\n');

  return importData;
}

// Run if executed directly
if (require.main === module) {
  parseTicketSalesByPeriod()
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

module.exports = { parseTicketSalesByPeriod };
