# Excel + PDF Data Integration - Complete! ✅

## Summary

Successfully integrated Excel budget/projection data with BigQuery PDF sales data to create a unified dataset for the Symphony Dashboard.

## What We Built

### Phase 1: Excel Data Extraction ✅
**Script**: `scripts/extract-excel-data.js`
**Output**: `data/excel-extracted.json`
**Records**: 102 weekly performance snapshots

**Data Extracted**:
- Budget targets (single, subscription, total)
- Projected final sales and occupancy
- Audience intelligence (new vs returning households)
- Sales velocity (week-over-week revenue changes)
- Performance types (Classical, Pops, Family, etc.)
- Capacity and occupancy targets

### Phase 2: BigQuery Data Extraction ✅
**Script**: `scripts/extract-bigquery-data.js`
**Output**: `data/bigquery-extracted.json`
**Records**: 60 performances with current sales data

**Data Extracted**:
- Current ticket sales (single, subscription, total)
- Total revenue
- Performance metadata (code, date, venue, season)
- Capacity and occupancy percentages

### Phase 3: Data Merge ✅
**Script**: `scripts/merge-excel-bigquery.js`
**Output**: `data/unified-dashboard-data.json`
**Records**: 60 performances with enriched data
**Match Rate**: 78% (47/60 performances matched to Excel data)

**Merged Data Includes**:
- Current sales (from BigQuery/PDFs)
- Budget targets and achievement (from Excel + BigQuery)
- Projections and pacing models (from Excel)
- Audience intelligence (from Excel)
- Sales velocity (from Excel)
- **Risk metrics** (calculated):
  - Risk level (HIGH/MEDIUM/LOW)
  - Pacing status (AHEAD/ON_TARGET/BEHIND)
  - Budget status (AT_OR_ABOVE/ON_TARGET/BELOW)

---

## Usage

### One-Command Build
```bash
npm run build-dashboard-data
```

This runs all three steps:
1. Extract Excel data
2. Extract BigQuery data
3. Merge into unified dataset

### Individual Steps
```bash
# Extract Excel data only
npm run extract-excel

# Extract BigQuery data only
npm run extract-bigquery

# Merge existing extracted data
npm run merge-data

# Inspect Excel data
npm run inspect-excel
```

---

## Data Structure

### Unified Performance Object

```javascript
{
  // IDENTIFICATION
  "performanceId": 23668,
  "performanceCode": "250919E",
  "performanceName": "PS1 Music of Journey",
  "seriesCode": "PS1",
  "performanceDate": "2025-09-19",
  "performanceType": "Pops",
  "venue": "HELZBERG HALL",
  "season": "25-26 Pops",

  // TIMELINE
  "timeline": {
    "weekNumber": 3,
    "weeksUntilPerformance": null
  },

  // CURRENT SALES (from BigQuery/PDFs)
  "currentSales": {
    "singleTickets": 214,
    "subscriptionTickets": 695,
    "totalTickets": 909,
    "totalRevenue": 63832.1
  },

  // BUDGET (from Excel + BigQuery)
  "budget": {
    "total": 100666,
    "single": 59333,
    "subscription": 41333
  },

  // BUDGET ACHIEVEMENT
  "budgetAchievement": {
    "total": 0.7138,           // 71.4% of total budget
    "single": 0.4110,          // 41.1% of single budget
    "subscription": 1.1484     // 114.8% of subscription budget
  },

  // REVENUE BREAKDOWN
  "revenue": {
    "total": 63832.1,
    "single": 24387,
    "subscription": 47467.6
  },

  // PROJECTIONS (from Excel pacing models)
  "projected": {
    "singleTickets": 444,              // Expected final single sales
    "totalTickets": 1092,              // Expected final total
    "occupancy": 0.6868                // Expected final occupancy
  },

  // TARGETS
  "targets": {
    "singleTicketsFor85Occ": 800.7     // Singles needed for 85% occupancy
  },

  // CAPACITY
  "capacity": {
    "max": 1578,
    "currentOccupancy": 57.6,
    "occupancyGoal": 85
  },

  // PRICING
  "pricing": {
    "singleATP": 65.80,
    "subscriptionATP": 65
  },

  // AUDIENCE INTELLIGENCE (from Excel)
  "audience": {
    "newHouseholds": 67,
    "returningHouseholds": 416,
    "totalHouseholds": 483
  },

  // SALES VELOCITY (from Excel)
  "salesVelocity": {
    "revenueLastWeek": 69230,
    "weeklyIncrease": 2624.6
  },

  // RISK METRICS (calculated)
  "riskMetrics": {
    "riskLevel": "HIGH",                   // HIGH/MEDIUM/LOW/UNKNOWN
    "pacingStatus": "BEHIND",              // AHEAD/ON_TARGET/BEHIND
    "budgetStatus": "BELOW",               // AT_OR_ABOVE/ON_TARGET/BELOW
    "pacingVariance": -0.518,              // -51.8% behind pacing target
    "budgetVariance": 0.714                // 71.4% of budget achieved
  },

  // DATA SOURCES (tracking)
  "dataSources": {
    "hasExcelData": true,
    "hasBigQueryData": true,
    "excelMatched": true
  }
}
```

---

## Risk Metrics Explained

### Risk Level
- **HIGH** 🔴: >50% behind pacing target OR <50% of budget
- **MEDIUM** 🟡: 25-50% behind pacing target OR 50-75% of budget
- **LOW** 🟢: On target or ahead
- **UNKNOWN** ⚪: No Excel data available for comparison

### Current Risk Distribution
- 🔴 HIGH: 15 performances (25%)
- 🟡 MEDIUM: 28 performances (47%)
- 🟢 LOW: 4 performances (7%)
- ⚪ UNKNOWN: 13 performances (22% - no Excel match)

---

## Data Quality

### Match Results
- **Total Performances**: 60
- **Matched to Excel**: 47 (78%)
- **Unmatched**: 13 (22%)

**Why Some Don't Match**:
- On Stage performances (not in Excel weekly data)
- Some individual performance dates vs series summaries
- Naming variations between sources

### Data Completeness
- **Budget Targets**: 60/60 (100%)
- **Current Sales**: 60/60 (100%)
- **Audience Data**: 19/60 (32%)
- **Projections**: 12/60 (20%)
- **Sales Velocity**: 19/60 (32%)

**Note**: Lower percentages for audience/projections are because only matched performances have this Excel-specific data.

---

## Example Use Cases

### 1. Find High-Risk Performances
```javascript
const data = require('./data/unified-dashboard-data.json');

const highRisk = data.performances.filter(p =>
  p.riskMetrics.riskLevel === 'HIGH'
);

console.log(`Found ${highRisk.length} high-risk performances:`);
highRisk.forEach(p => {
  console.log(`- ${p.performanceName} (${p.performanceDate})`);
  console.log(`  Pacing: ${(p.riskMetrics.pacingVariance * 100).toFixed(1)}%`);
  console.log(`  Budget: ${(p.riskMetrics.budgetVariance * 100).toFixed(1)}%`);
});
```

### 2. Calculate Total Revenue vs Budget
```javascript
const data = require('./data/unified-dashboard-data.json');

const totals = data.performances.reduce((acc, p) => {
  acc.revenue += p.currentSales.totalRevenue;
  acc.budget += p.budget.total;
  return acc;
}, { revenue: 0, budget: 0 });

console.log(`Total Revenue: $${totals.revenue.toLocaleString()}`);
console.log(`Total Budget: $${totals.budget.toLocaleString()}`);
console.log(`Achievement: ${(totals.revenue / totals.budget * 100).toFixed(1)}%`);
```

### 3. Analyze Customer Acquisition
```javascript
const data = require('./data/unified-dashboard-data.json');

const withAudience = data.performances.filter(p =>
  p.audience.totalHouseholds > 0
);

const avgNewCustomers = withAudience.reduce((sum, p) =>
  sum + p.audience.newHouseholds, 0) / withAudience.length;

console.log(`Average new customers per performance: ${avgNewCustomers.toFixed(1)}`);
```

---

## Next Steps

### Immediate: Dashboard Integration
Now that we have unified data, we can:

1. **Update dashboard to use `data/unified-dashboard-data.json`**
2. **Add new table columns**:
   - Budget vs Actual
   - Projected Final Sales
   - Risk Level indicators
   - Audience breakdown
   - Week-over-week growth

3. **Enhance modal popups**:
   - Budget tracking gauges
   - Pacing comparison charts
   - Audience acquisition metrics

### Future Enhancements

1. **Automated Pipeline**: Schedule `npm run build-dashboard-data` to run daily/weekly
2. **Historical Tracking**: Store snapshots over time to build true week-by-week progression
3. **Alerts**: Email notifications for high-risk performances
4. **Forecasting**: Machine learning models to improve projections

---

## Files Created

### Scripts
- ✅ `scripts/extract-excel-data.js` (590 lines)
- ✅ `scripts/extract-bigquery-data.js` (200 lines)
- ✅ `scripts/merge-excel-bigquery.js` (550 lines)

### Data Files
- ✅ `data/excel-extracted.json` (102 records)
- ✅ `data/bigquery-extracted.json` (60 records)
- ✅ `data/unified-dashboard-data.json` (60 enriched records)

### Documentation
- ✅ `docs/phase1-excel-extraction.md`
- ✅ `docs/phase2-situation-assessment.md`
- ✅ `docs/data-integration-complete.md` (this file)

### NPM Scripts
- ✅ `npm run extract-excel`
- ✅ `npm run extract-bigquery`
- ✅ `npm run merge-data`
- ✅ `npm run build-dashboard-data` (runs all three)

---

## Success! 🎉

We've successfully combined:
- **Excel strategic data** (budgets, projections, audience intelligence)
- **BigQuery tactical data** (current sales, real-time numbers)
- **Calculated risk metrics** (automated analysis)

into a unified dataset that provides a complete picture of each performance's status, trajectory, and risk level.

**The data is ready for dashboard integration!**
