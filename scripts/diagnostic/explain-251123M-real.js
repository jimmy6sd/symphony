// REAL DATA FOR 251123M from BigQuery
const performanceDate = '2025-11-23';
const snapshotDate = '2025-11-22';
const capacity = 1607;
const subscriptionTickets = 545;
const singleTicketsSold = 464;
const totalRevenue = 57613.7;
const budgetGoal = 66500.0;

// REAL TARGET COMP DATA FROM BIGQUERY
const targetComp = {
  name: '24-25 CS13 Mahler',
  weeksArray: [95, 99, 102, 110, 122, 133, 151, 168, 200, 234, 272, 431],
  atp: 55.0,
  capacity: 1450
};

console.log('═══════════════════════════════════════════════════════════');
console.log('  PROJECTED TICKETS & REVENUE - 251123M (REAL CALCULATION)');
console.log('  CS03 Matthias and Mahler #7');
console.log('═══════════════════════════════════════════════════════════\n');

// Calculate timing
const perfDate = new Date(performanceDate);
const today = new Date();
today.setHours(0,0,0,0);
const daysUntil = Math.ceil((perfDate - today) / (1000 * 60 * 60 * 24));
const exactWeeksUntil = Math.max(0, daysUntil / 7);
const roundedWeeksUntil = Math.ceil(daysUntil / 7);

console.log('📅 TIMING (as of ' + today.toISOString().split('T')[0] + ')');
console.log('   Performance Date: ' + performanceDate);
console.log('   Days Until: ' + daysUntil);
console.log('   Exact Weeks Until: ' + exactWeeksUntil.toFixed(4));
console.log('   Rounded Weeks: ' + roundedWeeksUntil);

console.log('\n📊 CURRENT SALES (snapshot ' + snapshotDate + ')');
console.log('   Capacity: ' + capacity);
console.log('   Subscriptions: ' + subscriptionTickets);
console.log('   Single Tickets Sold: ' + singleTicketsSold);
console.log('   Total Tickets: ' + (singleTicketsSold + subscriptionTickets));
console.log('   Available Single Capacity: ' + (capacity - subscriptionTickets));

console.log('\n💰 CURRENT REVENUE');
console.log('   Total Revenue: $' + totalRevenue.toLocaleString());
console.log('   Budget Goal: $' + budgetGoal.toLocaleString());

const currentTotalTickets = singleTicketsSold + subscriptionTickets;
const avgTicketPrice = totalRevenue / currentTotalTickets;

console.log('\n📈 AVERAGE TICKET PRICE');
console.log('   $' + totalRevenue.toFixed(2) + ' ÷ ' + currentTotalTickets + ' = $' + avgTicketPrice.toFixed(2));

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  TARGET COMP: ' + targetComp.name);
console.log('═══════════════════════════════════════════════════════════\n');

console.log('weeksArray (12 weeks):');
targetComp.weeksArray.forEach((val, idx) => {
  const weekNum = targetComp.weeksArray.length - 1 - idx;
  console.log('   Week ' + weekNum + ': ' + val + ' singles');
});

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  STEP-BY-STEP CALCULATION');
console.log('═══════════════════════════════════════════════════════════\n');

const numWeeks = targetComp.weeksArray.length;
const actualWeek = roundedWeeksUntil;
const actualSales = singleTicketsSold;

console.log('🎯 STEP 1: Find Target Comp at Current Week');
console.log('   actualWeek = ' + actualWeek + ' week(s) out');

const lowerWeek = Math.floor(actualWeek);
const upperWeek = Math.ceil(actualWeek);
const lowerWeekIndex = numWeeks - 1 - lowerWeek;
const upperWeekIndex = numWeeks - 1 - upperWeek;

console.log('   lowerWeek = ' + lowerWeek);
console.log('   upperWeek = ' + upperWeek);
console.log('   numWeeks = ' + numWeeks);
console.log('   lowerWeekIndex = ' + numWeeks + ' - 1 - ' + lowerWeek + ' = ' + lowerWeekIndex);
console.log('   upperWeekIndex = ' + numWeeks + ' - 1 - ' + upperWeek + ' = ' + upperWeekIndex);

let targetCompAtActualWeek;
if (lowerWeek === upperWeek) {
    targetCompAtActualWeek = targetComp.weeksArray[lowerWeekIndex];
    console.log('   Exact integer week → use weeksArray[' + lowerWeekIndex + ']');
    console.log('   ➜ targetCompAtActualWeek = ' + targetCompAtActualWeek + ' singles');
} else {
    const lowerValue = targetComp.weeksArray[lowerWeekIndex];
    const upperValue = targetComp.weeksArray[upperWeekIndex];
    const fraction = actualWeek - lowerWeek;
    targetCompAtActualWeek = lowerValue + (upperValue - lowerValue) * fraction;
    console.log('   Interpolating:');
    console.log('   lowerValue (week ' + lowerWeek + ') = ' + lowerValue);
    console.log('   upperValue (week ' + upperWeek + ') = ' + upperValue);
    console.log('   fraction = ' + fraction.toFixed(4));
    console.log('   ➜ targetCompAtActualWeek = ' + targetCompAtActualWeek.toFixed(1));
}

console.log('\n⚖️  STEP 2: Calculate Variance');
const variance = actualSales - targetCompAtActualWeek;
console.log('   variance = actualSales - targetCompAtActualWeek');
console.log('   variance = ' + actualSales + ' - ' + targetCompAtActualWeek);
console.log('   ➜ variance = ' + variance.toFixed(1) + ' tickets');
console.log('   Status: ' + (variance >= 0 ? '✅ AHEAD' : '❌ BEHIND') + ' of target');

console.log('\n🎯 STEP 3: Project Final Single Tickets');
const targetCompFinal = targetComp.weeksArray[numWeeks - 1];
console.log('   targetCompFinal = weeksArray[' + (numWeeks - 1) + '] = ' + targetCompFinal);
console.log('   projectedFinalSingles = targetCompFinal + variance');
console.log('   projectedFinalSingles = ' + targetCompFinal + ' + (' + variance.toFixed(1) + ')');

const availableSingleCapacity = capacity - subscriptionTickets;
let projectedFinalSingles = targetCompFinal + variance;
console.log('   Before capping = ' + projectedFinalSingles.toFixed(1));
console.log('   Available capacity = ' + availableSingleCapacity);

projectedFinalSingles = Math.round(Math.min(
    Math.max(0, projectedFinalSingles),
    availableSingleCapacity
));
console.log('   After cap & round = ' + projectedFinalSingles);
console.log('   ➜ Projected Single Tickets = ' + projectedFinalSingles);

console.log('\n🎫 STEP 4: Add Subscriptions');
const projectedFinalTotal = projectedFinalSingles + subscriptionTickets;
const targetFinalTotal = targetCompFinal + subscriptionTickets;
console.log('   projectedFinalTotal = ' + projectedFinalSingles + ' + ' + subscriptionTickets);
console.log('   ➜ Projected Total Tickets = ' + projectedFinalTotal);
console.log('   (Target total would be: ' + targetFinalTotal + ')');

console.log('\n💵 STEP 5: Calculate Projected Revenue');
console.log('   avgTicketPrice = $' + avgTicketPrice.toFixed(2));
console.log('   projectedRevenue = projectedFinalTotal × avgTicketPrice');
console.log('   projectedRevenue = ' + projectedFinalTotal + ' × $' + avgTicketPrice.toFixed(2));

const projectedRevenue = Math.round(projectedFinalTotal * avgTicketPrice);
const targetRevenue = Math.round(targetFinalTotal * avgTicketPrice);

console.log('   ➜ Projected Revenue = $' + projectedRevenue.toLocaleString());
console.log('   (Target revenue would be: $' + targetRevenue.toLocaleString() + ')');

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  FINAL RESULTS');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('Current State:');
console.log('  Single Tickets: ' + singleTicketsSold);
console.log('  Total Tickets: ' + currentTotalTickets);
console.log('  Revenue: $' + totalRevenue.toLocaleString());
console.log('  Budget %: ' + (totalRevenue/budgetGoal*100).toFixed(1) + '%');

console.log('\nProjected Final:');
console.log('  Single Tickets: ' + projectedFinalSingles + ' (+'+ (projectedFinalSingles - singleTicketsSold) +')');
console.log('  Total Tickets: ' + projectedFinalTotal + ' (+'+ (projectedFinalTotal - currentTotalTickets) +')');
console.log('  Revenue: $' + projectedRevenue.toLocaleString() + ' (+$'+ (projectedRevenue - totalRevenue).toLocaleString() +')');
console.log('  Budget %: ' + (projectedRevenue/budgetGoal*100).toFixed(1) + '%');
console.log('  Variance: ' + (variance >= 0 ? '+' : '') + variance.toFixed(0) + ' vs ' + targetComp.name);
