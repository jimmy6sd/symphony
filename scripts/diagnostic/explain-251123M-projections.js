// REAL DATA FOR 251123M from BigQuery
const performanceDate = '2025-11-23';
const snapshotDate = '2025-11-22';  // Latest snapshot
const capacity = 1607;
const subscriptionTickets = 545;  // fixed_tickets_sold
const singleTicketsSold = 464;
const totalRevenue = 57613.7;
const singleRevenue = 21196.5;
const budgetGoal = 66500.0;

// Calculate timing
const perfDate = new Date(performanceDate);
const snapDate = new Date(snapshotDate);
const today = new Date();
today.setHours(0,0,0,0);

const daysUntil = Math.ceil((perfDate - today) / (1000 * 60 * 60 * 24));
const exactWeeksUntil = Math.max(0, daysUntil / 7);
const roundedWeeksUntil = Math.ceil(daysUntil / 7);

console.log('═══════════════════════════════════════════════════════════');
console.log('  PROJECTED TICKETS & REVENUE CALCULATION FOR 251123M');
console.log('  CS03 Matthias and Mahler #7');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('📅 TIMING (as of today ' + today.toISOString().split('T')[0] + ')');
console.log('   Performance Date: ' + performanceDate);
console.log('   Latest Snapshot: ' + snapshotDate);
console.log('   Days Until Performance: ' + daysUntil);
console.log('   Exact Weeks Until: ' + exactWeeksUntil.toFixed(4) + ' weeks');
console.log('   Rounded Weeks: ' + roundedWeeksUntil + ' week(s)');

console.log('\n📊 CURRENT SALES (from snapshot ' + snapshotDate + ')');
console.log('   Total Capacity: ' + capacity.toLocaleString() + ' seats');
console.log('   Subscription/Fixed Tickets: ' + subscriptionTickets.toLocaleString());
console.log('   Single Tickets Sold: ' + singleTicketsSold.toLocaleString());
console.log('   Total Tickets Sold: ' + (singleTicketsSold + subscriptionTickets).toLocaleString());
console.log('   Available Single Capacity: ' + (capacity - subscriptionTickets).toLocaleString());
console.log('   Capacity %: ' + ((singleTicketsSold + subscriptionTickets) / capacity * 100).toFixed(1) + '%');

console.log('\n💰 CURRENT REVENUE');
console.log('   Total Revenue: $' + totalRevenue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}));
console.log('   Single Revenue: $' + singleRevenue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}));
console.log('   Budget Goal: $' + budgetGoal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}));
console.log('   Budget %: ' + (totalRevenue / budgetGoal * 100).toFixed(1) + '%');

// Calculate average ticket prices
const currentTotalTickets = singleTicketsSold + subscriptionTickets;
const avgTicketPrice = totalRevenue / currentTotalTickets;
const avgSingleTicketPrice = singleRevenue / singleTicketsSold;

console.log('\n📈 AVERAGE TICKET PRICES');
console.log('   Overall ATP (total rev ÷ total tickets): $' + avgTicketPrice.toFixed(2));
console.log('   Single Ticket ATP: $' + avgSingleTicketPrice.toFixed(2));

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  PROJECTION CALCULATION');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('⚠️  NO TARGET COMPARISON FOUND');
console.log('   - No performance_comparisons table exists');
console.log('   - No historical CS03 performances in database');
console.log('   - Dashboard would show: "No target comp set"');
console.log('   - Projection cannot be calculated without target comp');

console.log('\n📝 WHAT THE DASHBOARD CURRENTLY SHOWS:');
console.log('   Projected Tickets: N/A (no target comp)');
console.log('   Projected Revenue: N/A (no target comp)');
console.log('   Status: "Cannot project - no target comp"');

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  IF A TARGET COMP WERE SET, HERE IS HOW IT WOULD WORK:');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('Assume target comp had these sales at various weeks out:');
console.log('   Week 10: 150 singles');
console.log('   Week 5: 250 singles');
console.log('   Week 2: 350 singles');
console.log('   Week 1: 420 singles');
console.log('   Week 0 (final): 500 singles');

const targetCompWeeksArray = [150, 200, 250, 280, 310, 340, 350, 380, 400, 420, 500];
const numWeeks = targetCompWeeksArray.length;

// Since we're 1 week out (rounded), but 0.1429 weeks exact
const actualWeek = roundedWeeksUntil;  // Use 1 week for calculation
const actualSales = singleTicketsSold;

console.log('\n🎯 STEP 1: Find Target Comp Value at Current Week');
console.log('   Current week position: ' + actualWeek + ' week(s) out');

const lowerWeek = Math.floor(actualWeek);
const upperWeek = Math.ceil(actualWeek);
const lowerWeekIndex = numWeeks - 1 - lowerWeek;
const upperWeekIndex = numWeeks - 1 - upperWeek;

console.log('   lowerWeek: ' + lowerWeek);
console.log('   upperWeek: ' + upperWeek);
console.log('   lowerWeekIndex: ' + lowerWeekIndex + ' (in weeksArray)');
console.log('   upperWeekIndex: ' + upperWeekIndex + ' (in weeksArray)');

let targetCompAtActualWeek;
if (lowerWeek === upperWeek) {
    targetCompAtActualWeek = targetCompWeeksArray[lowerWeekIndex];
    console.log('   Exact integer week, using direct value');
} else {
    const lowerValue = targetCompWeeksArray[lowerWeekIndex];
    const upperValue = targetCompWeeksArray[upperWeekIndex];
    const fraction = actualWeek - lowerWeek;
    targetCompAtActualWeek = lowerValue + (upperValue - lowerValue) * fraction;
    console.log('   Interpolating between weeks');
    console.log('   lowerValue (week ' + lowerWeek + '): ' + lowerValue);
    console.log('   upperValue (week ' + upperWeek + '): ' + upperValue);
    console.log('   fraction: ' + fraction.toFixed(4));
}

console.log('   ➜ Target comp at week ' + actualWeek + ': ' + targetCompAtActualWeek.toFixed(1) + ' singles');

console.log('\n⚖️  STEP 2: Calculate Variance');
const variance = actualSales - targetCompAtActualWeek;
console.log('   Variance = actualSales - targetCompAtActualWeek');
console.log('   Variance = ' + actualSales + ' - ' + targetCompAtActualWeek.toFixed(1));
console.log('   ➜ Variance = ' + variance.toFixed(1) + ' tickets');
console.log('   Status: ' + (variance >= 0 ? '✅ AHEAD of target' : '❌ BEHIND target'));

console.log('\n🎯 STEP 3: Project Final Single Tickets');
const targetCompFinal = targetCompWeeksArray[numWeeks - 1];
console.log('   Target comp final (week 0): ' + targetCompFinal + ' singles');
console.log('   projectedFinalSingles = targetCompFinal + variance');
console.log('   projectedFinalSingles = ' + targetCompFinal + ' + ' + variance.toFixed(1));

const availableSingleCapacity = capacity - subscriptionTickets;
let projectedFinalSingles = targetCompFinal + variance;
console.log('   Before capping: ' + projectedFinalSingles.toFixed(1) + ' singles');
console.log('   Available single capacity cap: ' + availableSingleCapacity);

projectedFinalSingles = Math.round(Math.min(
    Math.max(0, projectedFinalSingles),
    availableSingleCapacity
));

console.log('   After capping and rounding: ' + projectedFinalSingles + ' singles');
console.log('   ➜ Projected Final Single Tickets = ' + projectedFinalSingles.toLocaleString());

console.log('\n🎫 STEP 4: Add Subscriptions for Total Projected Tickets');
const projectedFinalTotal = projectedFinalSingles + subscriptionTickets;
const targetFinalTotal = targetCompFinal + subscriptionTickets;
console.log('   projectedFinalTotal = projectedFinalSingles + subscriptions');
console.log('   projectedFinalTotal = ' + projectedFinalSingles + ' + ' + subscriptionTickets);
console.log('   ➜ Projected Total Tickets = ' + projectedFinalTotal.toLocaleString());
console.log('   (Target would be: ' + targetFinalTotal.toLocaleString() + ')');

console.log('\n💵 STEP 5: Calculate Projected Revenue');
console.log('   Using overall ATP (blended single + subscription price)');
console.log('   avgTicketPrice = currentTotalRevenue ÷ currentTotalTickets');
console.log('   avgTicketPrice = $' + totalRevenue.toFixed(2) + ' ÷ ' + currentTotalTickets);
console.log('   avgTicketPrice = $' + avgTicketPrice.toFixed(2));

const projectedRevenue = Math.round(projectedFinalTotal * avgTicketPrice);
const targetRevenue = Math.round(targetFinalTotal * avgTicketPrice);

console.log('\n   projectedRevenue = projectedFinalTotal × avgTicketPrice');
console.log('   projectedRevenue = ' + projectedFinalTotal + ' × $' + avgTicketPrice.toFixed(2));
console.log('   ➜ Projected Revenue = $' + projectedRevenue.toLocaleString());
console.log('   (Target would be: $' + targetRevenue.toLocaleString() + ')');

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  SUMMARY (with hypothetical target comp)');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('📊 FINAL RESULTS:');
console.log('   Current Single Tickets: ' + singleTicketsSold.toLocaleString());
console.log('   Projected Single Tickets: ' + projectedFinalSingles.toLocaleString());
console.log('   Current Total Tickets: ' + currentTotalTickets.toLocaleString());
console.log('   Projected Total Tickets: ' + projectedFinalTotal.toLocaleString());
console.log('   Current Revenue: $' + totalRevenue.toLocaleString('en-US', {minimumFractionDigits: 2}));
console.log('   Projected Revenue: $' + projectedRevenue.toLocaleString());
console.log('   Variance vs Target: ' + (variance >= 0 ? '+' : '') + variance.toFixed(0) + ' tickets');
