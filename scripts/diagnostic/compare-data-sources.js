// Compare data between BigQuery and Excel to understand discrepancies
const fs = require('fs');

const bqData = require('../data/bigquery-extracted.json');
const excelData = require('../data/excel-extracted.json');

console.log('🔍 Comparing Data Sources\n');
console.log('=' .repeat(60));

// Find Appalachian Spring in both sources
const bqAppalachian = bqData.performances.filter(p =>
  p.performanceName.toLowerCase().includes('appalachian')
);

const excelAppalachian = excelData.performances.filter(p =>
  p.performanceName.toLowerCase().includes('appalachian')
);

console.log('\n📊 APPALACHIAN SPRING Comparison:\n');

console.log('BigQuery (PDF Data) - SOURCE OF TRUTH:');
bqAppalachian.forEach(p => {
  console.log(`  ${p.performanceDate} (${p.performanceCode})`);
  console.log(`    Single: ${p.currentSales.singleTickets}`);
  console.log(`    Subscription: ${p.currentSales.subscriptionTickets}`);
  console.log(`    Total: ${p.currentSales.totalTickets}`);
  console.log(`    Revenue: $${p.currentSales.totalRevenue.toLocaleString()}`);
  console.log(`    Capacity: ${p.capacity.total}`);
});

console.log('\nExcel Data - SUPPLEMENTAL:');
excelAppalachian.forEach(p => {
  console.log(`  ${p.performanceDate}`);
  console.log(`    Single: ${p.actualTickets.single}`);
  console.log(`    Subscription: ${p.actualTickets.subscription}`);
  console.log(`    Projections: ${p.projected?.singleTickets || 'N/A'}`);
  console.log(`    Audience: ${p.audience?.totalHouseholds || 0} households`);
});

console.log('\n' + '=' .repeat(60));
console.log('📋 DATA HIERARCHY RECOMMENDATION:\n');
console.log('1. Use BigQuery for: dates, sales, revenue, capacity');
console.log('2. Add Excel for: projections, audience, performance types');
console.log('3. Admin UI can edit: Excel-type supplemental data only');
