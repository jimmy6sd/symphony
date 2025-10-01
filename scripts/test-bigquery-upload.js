// Test script to show what data would be uploaded to BigQuery
// This DOES NOT actually upload - it's for review only

const fs = require('fs');

console.log('='.repeat(80));
console.log('BIGQUERY UPLOAD PREVIEW - WHAT WOULD BE SENT');
console.log('='.repeat(80));

// Read current dashboard data
const dashboardData = JSON.parse(fs.readFileSync('data/dashboard.json', 'utf8'));

// Summary statistics
const withSalesData = dashboardData.filter(p => p.hasSalesData);
const totalTickets = dashboardData.reduce((sum, p) => sum + p.singleTicketsSold + p.subscriptionTicketsSold, 0);
const totalRevenue = dashboardData.reduce((sum, p) => sum + p.totalRevenue, 0);

console.log('\n📊 DATA SUMMARY:');
console.log(`   Total Performances: ${dashboardData.length}`);
console.log(`   With Sales Data: ${withSalesData.length}`);
console.log(`   Without Sales Data: ${dashboardData.length - withSalesData.length}`);
console.log(`   Total Tickets Sold: ${totalTickets.toLocaleString()}`);
console.log(`   Total Revenue: $${totalRevenue.toLocaleString()}`);

// Show sample records
console.log('\n📋 SAMPLE RECORDS (First 5 with sales data):');
withSalesData.slice(0, 5).forEach((perf, i) => {
  console.log(`\n${i + 1}. ${perf.id} - ${perf.title}`);
  console.log(`   Date: ${perf.date}`);
  console.log(`   Series: ${perf.series}`);
  console.log(`   Capacity: ${perf.capacity} (${perf.capacityPercent}% filled)`);
  console.log(`   Single Tickets: ${perf.singleTicketsSold}`);
  console.log(`   Subscription Tickets: ${perf.subscriptionTicketsSold}`);
  console.log(`   Revenue: $${perf.totalRevenue.toLocaleString()}`);
  console.log(`   Budget Goal: $${perf.budgetGoal.toLocaleString()} (${perf.budgetPercent}% achieved)`);
  console.log(`   Weekly Sales Data: ${perf.weeklySales?.length || 0} weeks`);
});

// Data source breakdown
const dataSources = {};
dashboardData.forEach(p => {
  const sources = p.dataSources.join(', ');
  dataSources[sources] = (dataSources[sources] || 0) + 1;
});

console.log('\n📁 DATA SOURCES:');
Object.entries(dataSources).forEach(([source, count]) => {
  console.log(`   ${source}: ${count} performances`);
});

// Show date range
const dates = dashboardData.map(p => new Date(p.date)).filter(d => !isNaN(d));
const minDate = new Date(Math.min(...dates));
const maxDate = new Date(Math.max(...dates));

console.log('\n📅 DATE RANGE:');
console.log(`   Earliest: ${minDate.toLocaleDateString()}`);
console.log(`   Latest: ${maxDate.toLocaleDateString()}`);

// Show series breakdown
const seriesBreakdown = {};
dashboardData.forEach(p => {
  seriesBreakdown[p.series] = (seriesBreakdown[p.series] || 0) + 1;
});

console.log('\n🎭 SERIES BREAKDOWN:');
Object.entries(seriesBreakdown)
  .sort((a, b) => b[1] - a[1])
  .forEach(([series, count]) => {
    console.log(`   ${series}: ${count} performances`);
  });

// Latest PDF info
const pdfFiles = fs.readdirSync('.').filter(f => f.endsWith('.pdf'));
if (pdfFiles.length > 0) {
  console.log('\n📄 PDF FILES IN DIRECTORY:');
  pdfFiles.forEach(file => {
    const stats = fs.statSync(file);
    console.log(`   ${file}`);
    console.log(`     Modified: ${stats.mtime.toLocaleString()}`);
    console.log(`     Size: ${(stats.size / 1024).toFixed(2)} KB`);
  });
}

console.log('\n' + '='.repeat(80));
console.log('✅ REVIEW COMPLETE');
console.log('='.repeat(80));
console.log('\nThis data is ready to be uploaded to BigQuery.');
console.log('To proceed with upload, you would need to:');
console.log('  1. Process the latest PDF file');
console.log('  2. Send it to the webhook endpoint');
console.log('  3. Verify the data in BigQuery');
console.log('\n⚠️  Make sure this data looks correct before uploading!');
