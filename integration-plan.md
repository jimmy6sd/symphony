# Excel + PDF Integration Plan

## Current State Understanding

### **Excel File Structure → Dashboard Mapping**

1. **"Board" Tab** → Executive Summary View
   - High-level rollup for board meetings
   - Series totals and key metrics
   - *Not our primary focus for integration*

2. **"Performances by Week" Tab** → **OUR DATA TABLE ENHANCEMENT TARGET** 🎯
   - Current Excel version is "first iteration"
   - We will improve upon this with PDF + Excel combined data
   - This is the main integration opportunity

3. **Individual Performance Tabs** (CS1, PS1, etc.) → **OUR MODAL POPUP ENHANCEMENT** 🎯
   - Deep dive on specific performances
   - 10-week sales pacing
   - Expected vs actual curves
   - We can enhance our modals with this structure

---

## Data Table Enhancement: Excel "Performances by Week" → Dashboard Table

### **Current Excel "Performances by Week" Columns**

| Column Group | Excel Columns | In PDF? | In Dashboard? | Action Needed |
|--------------|---------------|---------|---------------|---------------|
| **Timeline** | Week #, Weeks Until Perf, Perf Date | ✅ Yes | ✅ Yes | ✅ Keep |
| **Identification** | Performance Name, Performance Type | ✅ Yes | ✅ Yes | ✅ Keep |
| **Total Sales** | Actual Total Tickets, Total Revenue | ✅ Yes | ✅ Yes | ✅ Keep |
| **Projections** | Projected Tickets, Projected OCC | ❌ No | ❌ No | 🔧 **ADD from Excel** |
| **Budget Tracking** | Total Budget, Actual/Budget %, Projected/Budget % | ❌ No | ❌ No | 🔧 **ADD from Excel** |
| **Single Tickets** | Actual Sold, Target for 85% OCC, Projected, ATP | ⚠️ Partial | ⚠️ Partial | 🔧 **ENHANCE** |
| **Subscription Tickets** | Actual Sold, Revenue, Budget | ⚠️ Partial | ⚠️ Partial | 🔧 **ENHANCE** |
| **Audience Intelligence** | # New HH, # Ret HH, # Total HH | ❌ No | ❌ No | 🔧 **ADD from Excel** |
| **Sales Velocity** | Revenue Last Week, Increase Over Week | ❌ No | ❌ No | 🔧 **CALCULATE from PDF history** |

### **Proposed Enhanced Data Table Structure**

```javascript
// Each row in the table will have:
{
  // EXISTING (from PDF)
  "performanceName": "CS1 Appalachian Spring",
  "performanceDate": "2025-10-10",
  "weekNumber": 3,
  "singleTickets": 227,
  "singleRevenue": 12933,
  "subscriptionTickets": 516,
  "subscriptionRevenue": 34707,
  "totalTickets": 743,
  "totalRevenue": 47640,

  // NEW - FROM EXCEL
  "performanceType": "Classical",  // 🆕
  "seriesCode": "CS1",  // 🆕
  "capacity": 4299,  // 🆕
  "weeksUntilPerformance": 3,  // 🆕

  // Budget data
  "budget": {
    "singleTickets": 49998,  // 🆕
    "subscriptionTickets": 100000,  // 🆕
    "total": 149998  // 🆕
  },

  // Projections
  "projected": {
    "singleTickets": 582,  // 🆕 From Excel pacing model
    "totalTickets": 1098,  // 🆕
    "occupancy": 0.7663  // 🆕
  },

  // Targets
  "targets": {
    "singleTicketsFor85Occ": 779.45,  // 🆕
    "occupancy": 0.85  // 🆕
  },

  // Audience intelligence
  "audience": {
    "newHouseholds": 13,  // 🆕
    "returningHouseholds": 370,  // 🆕
    "totalHouseholds": 383  // 🆕
  },

  // CALCULATED METRICS
  "metrics": {
    "singleATP": 56.96,  // revenue / tickets
    "subscriptionATP": 67.26,
    "currentOccupancy": 0.1728,  // 743 / 4299
    "budgetAchievement": {
      "single": 0.2586,  // 12933 / 49998 (25.86%)
      "subscription": 0.3471,  // 34707 / 100000 (34.71%)
      "total": 0.3176  // 47640 / 149998 (31.76%)
    },
    "pacingVsTarget": {
      "single": -355,  // 227 - 582 (behind by 355 tickets)
      "singlePercent": -0.6099,  // -61% behind pace
      "occupancy": -0.5935  // Behind occupancy target
    },
    "riskLevel": "HIGH",  // Based on pacing variance
    "onTarget": false
  },

  // CALCULATED FROM PDF HISTORY
  "salesVelocity": {
    "revenueLastWeek": 47326,  // 🆕 From previous week PDF
    "weeklyIncrease": 314,  // 🆕 47640 - 47326
    "weeklyGrowthRate": 0.0066  // 🆕 0.66% growth
  }
}
```

### **Enhanced Table Columns (Visual Layout)**

**Column Groups:**

1. **Performance Info** (always visible)
   - Performance Name
   - Date
   - Type (Classical/Pops/Family/etc.) 🆕
   - Week # | Weeks Until 🆕

2. **Current Sales** (core metrics)
   - Total Tickets: `743 / 4299` (17.3% OCC) 🆕 capacity + %
   - Total Revenue: `$47,640`
   - Single Tix: `227` | ATP: `$56.96`
   - Sub Tix: `516` | ATP: `$67.26`

3. **Budget Tracking** 🆕 (new section)
   - Budget: `$149,998`
   - Actual/Budget: `31.8%` 🔴 (color coded)
   - Variance: `-$102,358` 🔴

4. **Pacing Analysis** 🆕 (new section)
   - Projected Final: `1,098 tix` (76.6% OCC)
   - vs Target (85%): `-355 tix` 🔴
   - Risk: `🔴 HIGH` or `🟡 MEDIUM` or `🟢 LOW`

5. **Audience** 🆕 (new section)
   - New HH: `13`
   - Ret HH: `370`
   - Total: `383`

6. **Velocity** 🆕 (new section)
   - Last Week: `$47,326`
   - Increase: `+$314` (0.7%)

7. **Actions**
   - View Details (opens modal)

### **Visual Enhancements**

**Color Coding:**
- 🟢 Green: ≥95% of budget, on target pacing
- 🟡 Yellow: 85-95% of budget, slightly behind pace
- 🔴 Red: <85% of budget, significantly behind pace

**Risk Indicators:**
- 🔴 HIGH: >50% behind pacing target
- 🟡 MEDIUM: 25-50% behind target
- 🟢 LOW: On target or ahead

**Sortable/Filterable:**
- Sort by: Risk Level, Budget Achievement %, Revenue, Occupancy
- Filter by: Performance Type, Week Range, Risk Level

---

## Modal Popup Enhancement: Individual Performance Deep Dive

### **Current Modal → Excel Individual Performance Tab Alignment**

**Excel Individual Performance Sheets (CS1, PS1, etc.) contain:**
- Week-by-week sales progression (10 weeks out → performance date)
- Expected pacing percentages per week
- Actual vs expected comparison
- Capacity calculations
- "Pace for 85% OCC" targets

### **Proposed Enhanced Modal Structure**

```
┌──────────────────────────────────────────────────────────┐
│  CS1 Appalachian Spring - Oct 10-12, 2025               │
│  Classical Series | 3 Performances | Capacity: 4,299    │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  📊 SALES PACING CHART (NEW!)                           │
│                                                          │
│  Tickets                                                 │
│  Sold    2500 │                                         │
│          2000 │                            ╱ Target     │
│          1500 │                      ╱╱╱╱╱              │
│          1000 │               ╱╱╱╱╱╱                    │
│           500 │  ━━━━━━━━━━━                            │
│             0 └──────────────────────────────────────   │
│               Week: 8  7  6  5  4  3  2  1  0           │
│                                                          │
│  ━━━ Actual Sales    ╱╱╱ Expected Pacing Curve          │
│                                                          │
│  Status: 🔴 61% BEHIND TARGET at Week 3                 │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  📈 BUDGET & PROJECTIONS                                 │
│                                                          │
│  Single Tickets:                                         │
│    Budget: $49,998  |  Actual: $12,933  |  26% 🔴      │
│    Projected Final: $36,800 (74% of budget) 🔴          │
│                                                          │
│  Subscription Tickets:                                   │
│    Budget: $100,000  |  Actual: $34,707  |  35% 🔴     │
│    Projected Final: $112,806 (113% of budget) 🟢        │
│                                                          │
│  TOTAL:                                                  │
│    Budget: $149,998  |  Actual: $47,640  |  32% 🔴     │
│    Projected Final: $161,187 (107% of budget) 🟢        │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  📅 WEEK-BY-WEEK PROGRESSION (NEW!)                      │
│                                                          │
│  Week  Date      Single  Sub   Total   Revenue  Δ Week  │
│  ────  ────────  ──────  ────  ─────   ───────  ───────│
│    8   Aug 27      106    516    622   $38,456    -     │
│    7   Sep 3       106    516    622   $38,456    $0    │
│    6   Sep 10      106    516    622   $38,456    $0    │
│    5   Sep 17      212    516    728   $47,326  $8,870  │
│    4   Sep 24      ...    ...    ...      ...     ...   │
│  ► 3   Oct 1       227    516    743   $47,640   $314   │
│    2   Oct 8       (projected based on pacing model)    │
│    1   Oct 15      (projected)                          │
│    0   Oct 22      (projected)                          │
│                                                          │
│  Expected at Week 3: 582 single tix (you have 227) 🔴  │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  👥 AUDIENCE INTELLIGENCE (NEW!)                         │
│                                                          │
│  Households:                                             │
│    New: 13 (3.4%)                                       │
│    Returning: 370 (96.6%)                               │
│    Total: 383                                           │
│                                                          │
│  Retention Rate: 96.6% 🟢                               │
│  Acquisition Opportunity: Needs more new customers 🟡   │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  🎭 PERFORMANCE DETAILS (EXISTING)                       │
│  [Keep current venue, series, date breakdown view]      │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  [Close] [Export Report] [View Similar Performances]    │
└──────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### **Phase 1: Excel Data Extraction** ⚡
**Duration**: 2-3 hours
**Priority**: HIGH

**Tasks:**
1. ✅ Create Excel parser script
2. Extract "Board" sheet → performance budgets, capacities
3. Extract "Performances by Week" → projections, audience data
4. Extract individual performance sheets → pacing models
5. Output structured JSON: `excel-data.json`

**Script outline:**
```javascript
// extract-excel-data.js
const XLSX = require('xlsx');

function extractBoardData(sheet) {
  // Extract budget, capacity, ATP data
  // Return array of performance budget objects
}

function extractPerformancesByWeek(sheet) {
  // Extract current snapshot with projections
  // Return array of weekly performance data
}

function extractPacingModels(workbook, performanceSheets) {
  // Extract week-by-week expected pacing
  // Return pacing curves per performance
}

// Output: excel-data.json
```

### **Phase 2: PDF History Builder** ⚡
**Duration**: 1-2 hours
**Priority**: HIGH

**Tasks:**
1. Query all stored PDFs from webhook data
2. Group by performance + week number
3. Sort chronologically to build progression
4. Calculate week-over-week deltas
5. Output: `pdf-history.json`

**Script outline:**
```javascript
// build-pdf-history.js

function getPdfHistory() {
  // Query all webhook_data entries
  // Group by performance name + date
  // Sort by week number
  // Calculate weekly increases
  // Return timeline per performance
}

// Output: pdf-history.json
```

### **Phase 3: Data Merger** ⚡⚡
**Duration**: 2-3 hours
**Priority**: CRITICAL

**Tasks:**
1. Load Excel data + PDF history
2. Match performances (by series code + date)
3. Merge current PDF snapshot with Excel budget/projections
4. Attach PDF history as sales progression
5. Calculate derived metrics (ATP, variance, risk level)
6. Output: `unified-performance-data.json`

**Script outline:**
```javascript
// merge-data.js

function matchPerformances(excelData, pdfData) {
  // Match by series code + date
  // Handle date format differences
}

function calculateMetrics(performance) {
  // ATP, occupancy %, budget variance
  // Pacing variance, risk level
  // Week-over-week growth
}

function mergeData() {
  const excel = loadExcelData();
  const pdf = loadPdfHistory();

  const unified = excel.map(excelPerf => {
    const pdfCurrent = findCurrentPdf(excelPerf);
    const pdfHistory = findPdfHistory(excelPerf);

    return {
      ...excelPerf,
      currentSnapshot: pdfCurrent,
      salesHistory: pdfHistory,
      metrics: calculateMetrics({...excelPerf, ...pdfCurrent})
    };
  });

  return unified;
}

// Output: unified-performance-data.json
```

### **Phase 4: Dashboard Table Enhancement** 🎨
**Duration**: 3-4 hours
**Priority**: HIGH

**Tasks:**
1. Update data service to load `unified-performance-data.json`
2. Add new table columns (budget, projections, audience, velocity)
3. Implement color coding (red/yellow/green)
4. Add risk indicators
5. Enhanced sorting/filtering
6. Responsive design for new columns

### **Phase 5: Modal Popup Enhancement** 🎨
**Duration**: 4-5 hours
**Priority**: MEDIUM

**Tasks:**
1. Create sales pacing chart component (D3.js)
2. Add week-by-week progression table
3. Add budget tracking section
4. Add audience intelligence section
5. Implement expected vs actual curves
6. Add export functionality

---

## File Structure

```
symphony/
├── scripts/
│   ├── extract-excel-data.js          # Parse Excel file
│   ├── build-pdf-history.js           # Build PDF timeline
│   ├── merge-data.js                  # Combine Excel + PDF
│   └── update-dashboard-data.js       # Generate final JSON
│
├── data/
│   ├── excel-data.json                # Extracted Excel data
│   ├── pdf-history.json               # PDF timeline per performance
│   ├── unified-performance-data.json  # Final merged data
│   └── dashboard.json                 # Current dashboard data
│
├── src/
│   ├── components/
│   │   ├── enhanced-data-table.js     # New table with all columns
│   │   └── enhanced-modal.js          # New modal with pacing chart
│   └── charts/
│       └── pacing-chart.js            # Sales pacing visualization
│
└── KCS 25-26 Weekly Sales Report - Sep 17.xlsx  # Source Excel
```

---

## Success Criteria

### **Data Integration Success:**
- ✅ All performances from Excel matched to PDF data
- ✅ Complete sales history for each performance
- ✅ Budget, projection, and audience data merged
- ✅ Calculated metrics accurate (ATP, variance, risk)

### **Dashboard Enhancement Success:**
- ✅ Table shows all new columns with correct data
- ✅ Color coding works (red/yellow/green)
- ✅ Sortable and filterable by new fields
- ✅ Risk indicators clearly visible
- ✅ Performance remains fast (<2s load)

### **Modal Enhancement Success:**
- ✅ Sales pacing chart displays correctly
- ✅ Expected vs actual curves visualized
- ✅ Week-by-week table shows progression
- ✅ Budget tracking section accurate
- ✅ Audience intelligence displayed

---

## Next Steps

**Immediate action plan:**

1. **Start with Phase 1**: Create Excel parser
2. **Then Phase 2**: Build PDF history
3. **Then Phase 3**: Merge data sources
4. **Finally Phases 4-5**: Update UI

**Should I proceed with creating the Excel parser script?**
