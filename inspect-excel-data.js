const data = require('./data/excel-extracted.json');

console.log('='.repeat(60));
console.log('EXCEL DATA EXTRACTION RESULTS');
console.log('='.repeat(60));
console.log(`Extracted at: ${data.extractedAt}`);
console.log(`Source file: ${data.sourceFile}`);
console.log(`Total performances: ${data.performances.length}`);

console.log('\n' + '='.repeat(60));
console.log('SAMPLE PERFORMANCES (First 3)');
console.log('='.repeat(60));

data.performances.slice(0, 3).forEach((p, i) => {
  console.log(`\n${i + 1}. ${p.performanceName}`);
  console.log(`   Date: ${p.performanceDate}`);
  console.log(`   Type: ${p.performanceType}`);
  console.log(`   Series: ${p.seriesCode}`);
  console.log(`   Week #: ${p.weekNumber} (${p.weeksUntilPerformance} weeks until)`);
  console.log(`
   Tickets:
     Single: ${p.actualTickets.single}
     Subscription: ${p.actualTickets.subscription}
     Total: ${p.actualTickets.total}

   Revenue:
     Single: $${p.revenue.single.toLocaleString()}
     Subscription: $${p.revenue.subscription.toLocaleString()}
     Total: $${p.revenue.total.toLocaleString()}

   Budget:
     Single: $${p.budget.single.toLocaleString()}
     Subscription: $${p.budget.subscription.toLocaleString()}
     Total: $${p.budget.total.toLocaleString()}

   Budget Achievement:
     Total: ${(p.budgetAchievement.total * 100).toFixed(1)}%

   Capacity:
     Max: ${p.capacity.max}
     Current Occupancy: ${(p.capacity.currentOccupancy * 100).toFixed(1)}%

   Audience:
     New Households: ${p.audience.newHouseholds}
     Returning Households: ${p.audience.returningHouseholds}
     Total Households: ${p.audience.totalHouseholds}
  `);
});

console.log('\n' + '='.repeat(60));
console.log('PERFORMANCE TYPE BREAKDOWN');
console.log('='.repeat(60));

const typeCount = {};
data.performances.forEach(p => {
  typeCount[p.performanceType] = (typeCount[p.performanceType] || 0) + 1;
});

Object.entries(typeCount).forEach(([type, count]) => {
  console.log(`${type}: ${count} performances`);
});

console.log('\n' + '='.repeat(60));
console.log('UNIQUE PERFORMANCE NAMES (by series)');
console.log('='.repeat(60));

const uniquePerformances = {};
data.performances.forEach(p => {
  if (!uniquePerformances[p.seriesCode]) {
    uniquePerformances[p.seriesCode] = p.performanceName;
  }
});

Object.entries(uniquePerformances).forEach(([code, name]) => {
  console.log(`${code || 'N/A'}: ${name}`);
});
