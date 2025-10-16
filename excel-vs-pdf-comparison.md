# Excel vs PDF Data Comparison & Integration Plan

## Data Sources Overview

### **Excel File: "KCS 25-26 Weekly Sales Report - Sep 17.xlsx"**
- **Date**: September 17, 2025
- **Type**: Comprehensive management/board report
- **20 sheets** with detailed breakdowns

### **PDF Files: Weekly performance sales summaries**
- **Date**: Individual weekly snapshots
- **Type**: Individual performance tracking
- **Source**: Latest webhook data

---

## Key Data Structure Comparison

### **Excel Data Structure**

#### **Board Sheet** (Main Dashboard)
**Columns:**
- Series Code (CS1, CS2, PS1, etc.)
- Performance Name
- Date Range
- **Single Tickets**: Budget, Actual, # Sold, ATP
- **Subscription Tickets**: Budget, Actual, # Sold
- **Total Sales**: Budget, Actual, # Sold
- **Hall Data**: Capacity, % Sold
- Audience data (new/returning households)

**Example Row (CS1 Appalachian Spring):**
```
Series: CS1
Name: Appalachian Spring
Dates: Oct 10-12
Single Budget: $49,998 | Actual: $48,381 | Sold: 802 tickets | ATP: $64.50
Sub Budget: $100,000 | Actual: $112,805.70 | Sold: 1,697 tickets
Total Budget: $149,998 | Actual: $161,186.70 | Sold: 2,499 tickets
Capacity: 4,299 | % Sold: 58.13%
```

#### **Performances by Week Sheet** (Detailed Timeline)
**Columns:**
- Week #
- # Weeks Until Performance
- Performance Date(s)
- Performance Type (Classical, Pops, Family, Specials, Film)
- **Actual Total Tickets Sold**
- **Projected Single Tickets + Actual Subs**
- **Projected Total Occupancy**
- **Total Actual Revenue**
- **TOTAL BUDGET**
- **Actual/Budget %**
- **Projected/Budget %**
- Single Tickets: Actual, Target for 85% OCC, Projected, ATP
- Subscription Tickets: Actual, Revenue, Budget
- Hall Data: Max Capacity, Actual OCC
- Audience: # New HH, # Returning HH, # Total HH
- **Revenue last week**
- **Increase over week**

**Example Row (PS1 Music of Journey - 9/19/2025):**
```
Week #: 3
Weeks Until Perf: 0 (current week)
Date: 9/19/2025
Type: Pops
Actual Total Sold: 1,092
Total Revenue: $71,854.60
Budget: $100,666
Actual/Budget: 71.38%
Single Tickets Sold: 444
Single Revenue: $24,387
Single ATP: $65.80
Sub Tickets: 648
Sub Revenue: $47,467.60
Capacity: 1,590
Occupancy: 68.68%
New HH: 67 | Ret HH: 416 | Total HH: 483
Revenue Last Week: $69,230
Increase: $2,624.60
```

#### **Individual Performance Sheets** (CS1, CS2, PS1, etc.)
**Purpose**: Week-by-week sales progression for specific performances
**Data**: Historical sales pacing (10 weeks out → performance date)

### **PDF Data Structure**

#### **Weekly Performance Sales Summary**
**Extracted Fields:**
- Performance ID
- Performance Name
- Performance Date
- Week Number
- **Subscription Ticket Count**
- **Subscription Revenue**
- **Single Ticket Count**
- **Single Revenue**
- **Total Ticket Count**
- **Total Revenue**

**Example (from PDF):**
```json
{
  "performanceName": "CS1 Appalachian Spring",
  "performanceDate": "2025-10-10",
  "weekNumber": 3,
  "subscriptionTickets": 516,
  "subscriptionRevenue": 34707.00,
  "singleTickets": 227,
  "singleRevenue": 12933.00,
  "totalTickets": 743,
  "totalRevenue": 47640.00
}
```

---

## Data Comparison: Strengths & Gaps

### **Excel Data Strengths** ✅

1. **Comprehensive Budget Tracking**
   - Single vs subscription budget targets
   - Budget variance calculations
   - Historical pacing models

2. **Audience Intelligence**
   - New vs returning household counts
   - Total household tracking
   - Customer acquisition metrics

3. **Projected Performance**
   - Forecasted final sales
   - Projected occupancy at performance
   - Target vs actual pacing

4. **Week-over-Week Growth**
   - Revenue increase tracking
   - Sales velocity monitoring
   - Performance trajectory

5. **Rich Context**
   - Performance types (Classical, Pops, Family, Film)
   - Series codes (CS1-CS14, PS1-PS5, etc.)
   - Venue capacity data

6. **Historical Sales Pacing**
   - Individual performance sheets track sales 10 weeks out
   - Comparison to expected pacing percentages
   - Early warning for underperformance

### **PDF Data Strengths** ✅

1. **Real-Time Updates**
   - Automated weekly generation
   - Consistent extraction via webhook
   - Up-to-date performance snapshots

2. **Clean Machine-Readable Format**
   - Structured JSON extraction
   - Consistent field names
   - Easy API integration

3. **Performance-Level Granularity**
   - Individual performance tracking
   - Week-by-week progression
   - Historical comparison capability

4. **Automation Ready**
   - Webhook-based ingestion
   - No manual data entry
   - Immediate availability

### **Excel Data Gaps** ❌

1. **Manual Updates Required**
   - Updated only once per week (manually)
   - Potential for human error
   - Delayed information

2. **Not Machine-Readable**
   - Requires xlsx parsing
   - Complex multi-sheet structure
   - Formulas and calculated fields

3. **Static Snapshots**
   - No continuous updates
   - Historical versions scattered

### **PDF Data Gaps** ❌

1. **No Budget Information**
   - Missing single/sub budget targets
   - No variance calculations
   - No financial goals

2. **No Audience Data**
   - No household tracking
   - Missing new vs returning metrics
   - No customer intelligence

3. **No Projected Sales**
   - No forecasting
   - No target pacing models
   - No occupancy projections

4. **Limited Context**
   - No performance types
   - No series information
   - No venue capacity

5. **No ATP (Average Ticket Price)**
   - Only total revenue and counts
   - No pricing analysis

---

## Integration Strategy: Best of Both Worlds

### **Proposed Combined Data Model**

```javascript
{
  // Core Identity
  "performanceId": "CS1-2025-10-10",
  "seriesCode": "CS1",
  "performanceName": "Appalachian Spring",
  "performanceDate": "2025-10-10T19:30:00",
  "performanceType": "Classical",
  "venue": "Lyric Theatre",

  // Current Snapshot (FROM PDF - Real-Time)
  "currentWeek": {
    "weekNumber": 3,
    "weeksUntilPerformance": 0,
    "snapshotDate": "2025-09-17",
    "singleTickets": {
      "sold": 227,
      "revenue": 12933.00,
      "atp": 56.96  // Calculated
    },
    "subscriptionTickets": {
      "sold": 516,
      "revenue": 34707.00,
      "atp": 67.26  // Calculated
    },
    "totalTickets": {
      "sold": 743,
      "revenue": 47640.00
    }
  },

  // Budget & Targets (FROM EXCEL - Strategic)
  "budget": {
    "singleTickets": {
      "budget": 49998,
      "target": 802  // Tickets needed
    },
    "subscriptionTickets": {
      "budget": 100000,
      "target": 1697
    },
    "total": {
      "budget": 149998,
      "target": 2499
    }
  },

  // Performance Metrics (HYBRID - Excel + Calculated)
  "metrics": {
    "capacity": 4299,
    "currentOccupancy": 0.1728,  // 743 / 4299
    "projectedOccupancy": 0.5813,  // From Excel projection
    "targetOccupancy": 0.85,
    "actualVsBudget": {
      "single": -0.7413,  // (12933 - 49998) / 49998
      "subscription": -0.6529,
      "total": -0.6824
    },
    "onPaceFor85": false,  // Flag if pacing correctly
    "projectedFinalSales": 2499  // From Excel model
  },

  // Sales Progression (FROM PDF - Historical)
  "salesHistory": [
    {
      "weekNumber": 1,
      "weekDate": "2025-08-27",
      "singleTickets": 106,
      "subscriptionTickets": 516,
      "totalRevenue": 38456.00,
      "weeklyIncrease": null
    },
    {
      "weekNumber": 2,
      "weekDate": "2025-09-03",
      "singleTickets": 212,
      "subscriptionTickets": 516,
      "totalRevenue": 47326.00,
      "weeklyIncrease": 8870.00
    },
    {
      "weekNumber": 3,
      "weekDate": "2025-09-17",
      "singleTickets": 227,
      "subscriptionTickets": 516,
      "totalRevenue": 47640.00,
      "weeklyIncrease": 314.00
    }
  ],

  // Audience Intelligence (FROM EXCEL - Customer Data)
  "audience": {
    "newHouseholds": 13,
    "returningHouseholds": 370,
    "totalHouseholds": 383,
    "retentionRate": 0.9661  // 370/383
  },

  // Pacing Model (FROM EXCEL - Predictive)
  "pacing": {
    "expectedSingleTicketsAt3Weeks": 582,  // From pacing model
    "actualSingleTickets": 227,
    "pacingVariance": -355,  // Behind pace
    "expectedOccupancyAt3Weeks": 0.7663,
    "actualOccupancy": 0.1728,
    "riskLevel": "HIGH"  // Calculated based on variance
  }
}
```

### **Data Integration Pipeline**

```
┌─────────────────────────────────────────────────────────┐
│                   DATA SOURCES                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📄 PDF (Real-Time)          📊 Excel (Strategic)      │
│  ├─ Current sales             ├─ Budget targets        │
│  ├─ Week-by-week history      ├─ Pacing models         │
│  ├─ Performance dates         ├─ Audience data         │
│  └─ Revenue totals            ├─ Projections           │
│                               └─ Performance types      │
│                                                         │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              DATA INTEGRATION LAYER                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. PDF Webhook → Extract current snapshot              │
│  2. Excel Parser → Load budget/pacing data              │
│  3. Match performances by: series + date                │
│  4. Calculate derived metrics:                          │
│     ├─ ATP (revenue / tickets)                          │
│     ├─ Occupancy % (sold / capacity)                    │
│     ├─ Budget variance %                                │
│     ├─ Pacing variance (actual vs expected)             │
│     ├─ Risk level (HIGH/MEDIUM/LOW)                     │
│     └─ Week-over-week growth                            │
│  5. Build sales history timeline                        │
│  6. Store in unified JSON structure                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              DASHBOARD VISUALIZATION                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📊 Performance Overview                                │
│     ├─ Current sales vs budget (Excel + PDF)           │
│     ├─ Occupancy gauge (PDF + Excel capacity)          │
│     └─ Risk indicators (Calculated)                     │
│                                                         │
│  📈 Sales Progression Chart                             │
│     ├─ Week-by-week actual sales (PDF history)         │
│     ├─ Expected pacing curve (Excel model)             │
│     └─ Projection to performance (Excel forecast)       │
│                                                         │
│  🎯 Budget Tracking                                     │
│     ├─ Single vs sub breakdown (Excel + PDF)           │
│     ├─ Variance from budget (Calculated)               │
│     └─ ATP comparison (Calculated from PDF)            │
│                                                         │
│  👥 Audience Insights                                   │
│     ├─ New vs returning households (Excel)             │
│     ├─ Total household count (Excel)                   │
│     └─ Customer retention rate (Calculated)            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### **Phase 1: Excel Parser**
**Goal**: Extract budget, pacing, and audience data from Excel

**Tasks:**
1. Parse "Board" sheet → budget targets, capacity, ATP
2. Parse "Performances by Week" → projections, audience data
3. Parse individual performance sheets → pacing models
4. Create `excel-data.json` with structured output

### **Phase 2: PDF History Builder**
**Goal**: Build week-by-week sales progression from PDFs

**Tasks:**
1. Scan all stored PDFs in database/filesystem
2. Extract performance-week snapshots
3. Build historical timeline per performance
4. Create `pdf-history.json` with sales progression

### **Phase 3: Data Merger**
**Goal**: Combine Excel + PDF into unified structure

**Tasks:**
1. Match performances by series code + date
2. Merge current PDF snapshot with Excel budget
3. Append PDF history as `salesHistory` array
4. Calculate derived metrics (ATP, variance, pacing)
5. Assign risk levels based on pacing variance
6. Output `combined-performance-data.json`

### **Phase 4: Dashboard Enhancement**
**Goal**: Visualize integrated data

**Tasks:**
1. **Performance Cards**: Show budget vs actual with color coding
2. **Sales Curve Chart**: Plot PDF history + Excel pacing model
3. **Budget Gauge**: Visual indicator of budget achievement
4. **Audience Breakdown**: New vs returning households
5. **Risk Alerts**: Highlight underperforming shows
6. **ATP Tracking**: Price realization analysis

---

## Key Insights from Combined Data

### **What We Gain**

1. **Real-Time + Strategic Context**
   - PDF: Current sales numbers (real-time)
   - Excel: Budget targets and pacing models (strategic)
   - **Result**: Know if sales are on track to hit goals

2. **Sales Velocity Analysis**
   - PDF: Week-by-week progression
   - Excel: Expected pacing curve
   - **Result**: Identify acceleration/deceleration early

3. **Revenue Optimization**
   - PDF: Actual ATP (revenue/tickets)
   - Excel: Budgeted ATP
   - **Result**: Price realization and yield management

4. **Audience Intelligence**
   - Excel: New vs returning households
   - PDF: Total sales volume
   - **Result**: Customer acquisition cost and retention insights

5. **Predictive Analytics**
   - PDF: Historical sales patterns
   - Excel: Pacing models and projections
   - **Result**: Forecast final occupancy and revenue

6. **Risk Management**
   - Excel: Budget targets and pacing
   - PDF: Current actual sales
   - **Result**: Early warning system for underperformance

---

## Next Steps

### **Immediate Actions**

1. **Validate Data Matching**
   - Confirm performance name consistency (PDF vs Excel)
   - Verify date formats align
   - Test series code mapping

2. **Build Excel Parser**
   - Extract key sheets to JSON
   - Handle Excel date formats
   - Capture formulas as calculated values

3. **Create Integration Script**
   - Match performances across sources
   - Calculate derived metrics
   - Generate unified JSON output

4. **Design Dashboard Views**
   - Sales progression with pacing curves
   - Budget tracking with variance indicators
   - Audience breakdown visualizations

### **Long-Term Vision**

**Ultimate Goal**: Real-time dashboard that combines:
- **Live sales data** from PDFs (webhook-driven)
- **Strategic targets** from Excel (weekly manual update)
- **Predictive analytics** (machine learning on historical patterns)
- **Automated alerts** (email/SMS for at-risk performances)

---

## Summary

**Excel provides the "WHY" and "WHAT SHOULD BE":**
- Budget targets
- Pacing expectations
- Audience intelligence
- Performance projections

**PDF provides the "WHAT IS" and "HOW WE GOT HERE":**
- Current sales reality
- Week-by-week progression
- Historical patterns
- Real-time updates

**Together, they create a complete picture:**
- ✅ Current status (PDF)
- ✅ Historical trends (PDF)
- ✅ Budget targets (Excel)
- ✅ Expected pacing (Excel)
- ✅ Audience insights (Excel)
- ✅ Projections (Excel)
- ✅ Risk analysis (Calculated)
- ✅ Actionable alerts (Calculated)

**The integration creates a powerful analytics engine that tells the full story: where we are, where we should be, how we got here, and where we're headed.**
