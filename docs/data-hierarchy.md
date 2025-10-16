# Data Hierarchy & Priority - Symphony Dashboard

## Overview

The dashboard uses a **layered data approach** with clear priority rules to ensure data accuracy while providing enrichment.

---

## Data Priority (Highest to Lowest)

### 🥇 **Priority 1: PDF/BigQuery Data** (SOURCE OF TRUTH)

**Source**: Daily PDF reports → Webhook → BigQuery
**Update Frequency**: Daily (via webhook)
**Cannot be overridden by**: Excel or Admin UI

**Fields (authoritative)**:
- `performanceId` - Unique ID
- `performanceCode` - Performance code
- `title` - Performance title
- `series` - Series code (CS01, PS1, etc.)
- `date` - **Performance date** ✅
- `venue` - Venue name
- `season` - Season identifier
- **`singleTicketsSold`** - Single ticket count ✅
- **`subscriptionTicketsSold`** - Subscription ticket count ✅
- **`totalTicketsSold`** - Total tickets ✅
- **`totalRevenue`** - Total revenue ✅
- **`capacity`** - Venue capacity ✅
- `capacityPercent` - Current occupancy %
- `budgetGoal` - Budget target (if in PDF)
- `budgetPercent` - Budget achievement %

### 🥈 **Priority 2: Excel Data** (SUPPLEMENTAL ENRICHMENT)

**Source**: Manual Excel report (weekly)
**Update Frequency**: Weekly manual export
**Purpose**: Add projections, audience intelligence, pacing data

**Fields (supplemental only)**:
- `supplemental.projected.singleTickets` - Expected final singles
- `supplemental.projected.totalTickets` - Expected final total
- `supplemental.projected.occupancy` - Expected final occupancy %
- `supplemental.targets.singleTicketsFor85Occ` - Target for 85% occupancy
- `supplemental.audience.newHouseholds` - New customer count
- `supplemental.audience.returningHouseholds` - Returning customers
- `supplemental.audience.totalHouseholds` - Total households
- `supplemental.salesVelocity.revenueLastWeek` - Previous week revenue
- `supplemental.salesVelocity.weeklyIncrease` - Week-over-week change
- `supplemental.timeline.weekNumber` - Current week number
- `supplemental.timeline.weeksUntilPerformance` - Countdown
- `performanceType` - Classical/Pops/Family (if not guessed)

**Note**: Excel supplemental data is only added when:
1. Performance matches by series code and date
2. Excel data doesn't contradict BigQuery data
3. Field is truly supplemental (not core sales data)

### 🥉 **Priority 3: Admin UI** (FUTURE - MANUAL OVERRIDES)

**Source**: Dashboard admin interface
**Update Frequency**: As needed
**Purpose**: Manual corrections/additions for supplemental data only

**Allowed overrides**:
- Supplemental fields (projections, audience, etc.)
- Performance type categorization
- Notes and flags

**Cannot override**:
- Any PDF/BigQuery data (sales, revenue, dates, capacity)

---

## Data Flow

```
┌─────────────────────────────────────────────────────────┐
│  DAILY: PDF Reports                                     │
│  ├─ Email with PDF attachment                           │
│  ├─ Webhook receives PDF                                │
│  ├─ Extract sales data                                  │
│  └─ Write to BigQuery                                   │
│     (Performances table)                                │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  WEEKLY: Excel Export                                   │
│  ├─ Manual export from Tessitura                        │
│  ├─ Save as .xlsx in root directory                     │
│  └─ Run: npm run extract-excel                          │
│     (Creates data/excel-extracted.json)                 │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  MERGE: Create Dashboard Data                           │
│  ├─ Query BigQuery (source of truth)                    │
│  ├─ Load Excel supplemental data                        │
│  ├─ Match by series code + date                         │
│  ├─ BigQuery data takes priority                        │
│  ├─ Add Excel as supplemental enrichment                │
│  └─ Run: npm run build-dashboard-data                   │
│     (Creates data/dashboard-data.json)                  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  DASHBOARD: Display                                     │
│  ├─ Load data/dashboard-data.json                       │
│  ├─ Show BigQuery data as core metrics                  │
│  ├─ Display Excel supplemental where available          │
│  └─ Calculate risk metrics from combined data           │
└─────────────────────────────────────────────────────────┘
```

---

## NPM Scripts

### Build Dashboard Data
```bash
# Quick rebuild (uses current Excel + fresh BigQuery data)
npm run build-dashboard-data

# Full refresh (re-extract Excel first)
npm run refresh-dashboard
```

### Individual Steps
```bash
# Extract Excel supplemental data
npm run extract-excel

# Extract BigQuery core data
npm run extract-bigquery

# Legacy merge (old approach)
npm run merge-data
```

---

## Data Structure

### Full Performance Object

```javascript
{
  // CORE DATA (from BigQuery - cannot be overridden)
  "id": 23620,
  "performanceId": 23620,
  "performanceCode": "251010E",
  "title": "CS01 Copland's Appalachian Spr",
  "series": "CS01",
  "date": "2025-10-10",                    // ✅ PDF is source of truth
  "venue": "HELZBERG HALL",
  "season": "25-26 Classical",
  "singleTicketsSold": 485,                // ✅ PDF is source of truth
  "subscriptionTicketsSold": 292,          // ✅ PDF is source of truth
  "totalTicketsSold": 777,                 // ✅ PDF is source of truth
  "totalRevenue": 50099.3,                 // ✅ PDF is source of truth
  "capacity": 1481,                        // ✅ PDF is source of truth
  "capacityPercent": 45.1,
  "occupancyGoal": 85,
  "budgetGoal": 86276,
  "budgetPercent": 51.1,
  "singleTicketATP": 61.98,

  // ENRICHMENT (from Excel - supplemental only)
  "performanceType": "Classical",          // Guessed or from Excel
  "supplemental": {
    "projected": {
      "singleTickets": 582,                // Excel projection
      "totalTickets": 1098,
      "occupancy": 0.7663
    },
    "targets": {
      "singleTicketsFor85Occ": 779.45      // Excel target
    },
    "audience": {
      "newHouseholds": 13,
      "returningHouseholds": 370,
      "totalHouseholds": 383
    },
    "salesVelocity": {
      "revenueLastWeek": 47326,
      "weeklyIncrease": 314
    },
    "timeline": {
      "weekNumber": 3,
      "weeksUntilPerformance": null
    }
  },

  // CALCULATED (from multiple sources)
  "riskMetrics": {
    "riskLevel": "HIGH",                   // Calculated
    "pacingStatus": "BEHIND",              // vs Excel projection
    "budgetStatus": "BELOW",               // vs BigQuery budget
    "pacingVariance": -0.518,
    "budgetAchievement": 0.714
  },

  // METADATA
  "hasSalesData": true,
  "hasExcelData": true,                    // Has supplemental data?
  "createdAt": "2025-10-01T15:47:57.472Z",
  "updatedAt": "2025-10-01T15:47:57.472Z",
  "lastPdfImport": null,

  // VISUALIZATION (generated for charts)
  "weeklySales": [ /* 10 weeks of progression */ ]
}
```

---

## Example: Data Conflict Resolution

### Scenario: Dates Don't Match

**Excel says**: Oct 9, 10, 11
**PDF/BigQuery says**: Oct 10, 11, 12

**Resolution**:
- ✅ Use PDF dates (Oct 10, 11, 12)
- ⚠️ Excel supplemental data won't match (dates differ)
- 📊 Dashboard shows: PDF data only, no supplemental

### Scenario: Sales Numbers Differ

**Excel says**: 227 single tickets
**PDF/BigQuery says**: 485 single tickets

**Resolution**:
- ✅ Use PDF numbers (485 single tickets)
- 📊 Excel data stored in `supplemental.projected` as projection, not actual
- 🎯 Risk calculation compares actual (485) vs projected (582 from Excel)

---

## Updating Data

### Daily (Automatic)
1. PDF arrives via email
2. Webhook processes PDF
3. BigQuery updated
4. Dashboard shows fresh data automatically

### Weekly (Manual)
1. Export Excel from Tessitura
2. Save as `KCS 25-26 Weekly Sales Report - [DATE].xlsx`
3. Run: `npm run refresh-dashboard`
4. Dashboard gains supplemental data

### As Needed (Admin UI - Future)
1. Open dashboard admin panel
2. Edit supplemental fields only
3. Cannot edit PDF/BigQuery data

---

## Key Principles

✅ **PDF/BigQuery is always right** for core sales data
✅ **Excel supplements** with projections and audience intelligence
✅ **Admin UI can edit** supplemental data only
✅ **No overriding** PDF data - it's the source of truth
✅ **Clear separation** between actual (PDF) and projected (Excel)

---

## Files

- `data/dashboard-data.json` - Final dashboard data (BigQuery + Excel)
- `data/excel-extracted.json` - Excel supplemental data
- `data/bigquery-extracted.json` - BigQuery core data (debugging)
- `scripts/create-dashboard-data.js` - Merge script with proper priority

---

## Success Metrics

✅ **Current Status**:
- 60 performances from BigQuery (source of truth)
- 3 performances matched to Excel supplemental data
- 100% BigQuery data accuracy (no overrides)
- Clear data lineage (know where each field comes from)

**Why only 3 matches?**
- Excel file is from Sep 17 (older snapshot)
- BigQuery has current PDF data (more recent)
- This is **correct behavior** - fresh data takes priority!

**To increase matches**:
- Export fresh Excel with current week data
- Run `npm run refresh-dashboard`
- Matches will increase as dates align
