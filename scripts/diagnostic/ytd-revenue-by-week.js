// Generate YTD revenue by week table for FY23, FY24, FY25, FY26
const data = require('../../data/ytd-validated-data.json');

// Get all records with revenue data
const allRecords = [];
for (const [fy, records] of Object.entries(data.fiscal_years)) {
  records.filter(r => r.single_revenue).forEach(r => {
    allRecords.push({
      fy,
      date: r.date,
      revenue: r.single_revenue,
      tickets: r.single_tickets
    });
  });
}

// Group by fiscal year
const byFY = {};
for (const r of allRecords) {
  if (!byFY[r.fy]) byFY[r.fy] = [];
  byFY[r.fy].push(r);
}

// Sort each FY by date
for (const fy of Object.keys(byFY)) {
  byFY[fy].sort((a, b) => a.date.localeCompare(b.date));
}

// Calculate fiscal year week number
// FY starts July 1, so FY23 starts July 1, 2022
function getFYWeek(dateStr, fy) {
  const date = new Date(dateStr);
  const fyStartYear = parseInt(fy.replace('FY', '')) + 1999; // FY23 = 2022, FY24 = 2023, FY25 = 2024
  const fyStart = new Date(fyStartYear, 6, 1); // July 1
  const diffDays = Math.floor((date - fyStart) / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7) + 1;
}

// Build week-aligned data
const weekData = {};
for (const [fy, records] of Object.entries(byFY)) {
  for (const r of records) {
    const week = getFYWeek(r.date, fy);
    if (!weekData[week]) weekData[week] = {};
    // Keep the latest entry for each week (in case of multiple snapshots)
    weekData[week][fy] = { revenue: r.revenue, date: r.date, tickets: r.tickets };
  }
}

// Print table
console.log('YTD Single Ticket Revenue by Fiscal Year Week');
console.log('='.repeat(100));
console.log('Week |     FY23 Revenue |     FY24 Revenue |     FY25 Revenue |     FY26 Revenue | Notes');
console.log('-'.repeat(100));

const weeks = Object.keys(weekData).map(Number).sort((a, b) => a - b);
let lastFY23 = 0, lastFY24 = 0, lastFY25 = 0, lastFY26 = 0;

for (const week of weeks) {
  const fy23 = weekData[week]?.FY23?.revenue;
  const fy24 = weekData[week]?.FY24?.revenue;
  const fy25 = weekData[week]?.FY25?.revenue;
  const fy26 = weekData[week]?.FY26?.revenue;

  // Track for growth
  if (fy23) lastFY23 = fy23;
  if (fy24) lastFY24 = fy24;
  if (fy25) lastFY25 = fy25;
  if (fy26) lastFY26 = fy26;

  const fmt = (v) => v ? ('$' + (v/1000000).toFixed(2) + 'M').padStart(16) : '-'.padStart(16);

  // Add notes for comparison (when we have 3+ years of data for same week)
  let note = '';
  if (fy24 && fy25 && fy26) {
    const diff25v24 = ((fy25 - fy24) / fy24 * 100).toFixed(0);
    const diff26v25 = ((fy26 - fy25) / fy25 * 100).toFixed(0);
    note = `25v24: ${diff25v24}%, 26v25: ${diff26v25}%`;
  } else if (fy23 && fy24 && fy25) {
    const diff24v23 = ((fy24 - fy23) / fy23 * 100).toFixed(0);
    const diff25v24 = ((fy25 - fy24) / fy24 * 100).toFixed(0);
    note = `24v23: ${diff24v23}%, 25v24: ${diff25v24}%`;
  }

  console.log(String(week).padStart(4) + ' |' + fmt(fy23) + ' |' + fmt(fy24) + ' |' + fmt(fy25) + ' |' + fmt(fy26) + ' | ' + note);
}

// Final summary
console.log('-'.repeat(100));
console.log('Final|' +
  ('$' + (lastFY23/1000000).toFixed(2) + 'M').padStart(16) + ' |' +
  ('$' + (lastFY24/1000000).toFixed(2) + 'M').padStart(16) + ' |' +
  ('$' + (lastFY25/1000000).toFixed(2) + 'M').padStart(16) + ' |' +
  ('$' + (lastFY26/1000000).toFixed(2) + 'M').padStart(16) + ' |');

const growth24v23 = ((lastFY24 - lastFY23) / lastFY23 * 100).toFixed(1);
const growth25v24 = ((lastFY25 - lastFY24) / lastFY24 * 100).toFixed(1);
const growth26v25 = lastFY26 > 0 ? ((lastFY26 - lastFY25) / lastFY25 * 100).toFixed(1) : 'N/A';
console.log('\nYear-over-Year Growth (at latest available week):');
console.log(`  FY24 vs FY23: +${growth24v23}%`);
console.log(`  FY25 vs FY24: +${growth25v24}%`);
console.log(`  FY26 vs FY25: ${growth26v25 === 'N/A' ? growth26v25 : '+' + growth26v25 + '%'} (FY26 data only through week ${Math.max(...Object.keys(weekData).filter(w => weekData[w].FY26).map(Number))})`);
