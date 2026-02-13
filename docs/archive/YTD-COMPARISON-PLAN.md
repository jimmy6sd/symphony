# YTD Sales Comparison Feature - Implementation Plan

## Overview
Add a new page to the Symphony Dashboard that displays year-to-date ticket sales comparison across fiscal years (FY23-FY26) using overlapping lines, similar to the existing sales curve charts.

## Architecture

```
Excel Files (FY23-FY26) --> Processing Script --> BigQuery Table
                                                       |
BigQuery snapshots (current year) ---------------------|
                                                       v
                                    API Endpoint (get-ytd-comparison)
                                                       |
                                                       v
                                    ytd-comparison.html + D3 Chart
```

## Files to Create/Modify

### New Files
1. **`scripts/active/process-ytd-excel-files.js`** - Parse Excel files, populate BigQuery
2. **`ytd-comparison.html`** - New page (based on excel.html pattern)
3. **`src/charts/ytd-comparison-chart.js`** - D3 chart component
4. **`src/ytd-comparison-app.js`** - Page initialization
5. **`styles/ytd-comparison.css`** - Page-specific styles

### Modify
6. **`netlify/functions/bigquery-snapshots.js`** - Add `get-ytd-comparison` action
7. **`index.html`** - Add navigation link to YTD page

---

## Phase 1: BigQuery Table

Create `ytd_weekly_totals` table:

```sql
CREATE TABLE IF NOT EXISTS `kcsymphony.symphony_dashboard.ytd_weekly_totals` (
  record_id STRING NOT NULL,
  fiscal_year STRING NOT NULL,           -- 'FY23', 'FY24', 'FY25', 'FY26'
  fiscal_week INT64 NOT NULL,            -- 1-52 (weeks from July 1)
  iso_week INT64 NOT NULL,               -- 1-52 (ISO week number)
  week_end_date DATE NOT NULL,
  ytd_tickets_sold INT64 NOT NULL,
  ytd_single_tickets INT64,
  ytd_subscription_tickets INT64,
  ytd_revenue FLOAT64,
  performance_count INT64,
  source STRING,                         -- 'excel_import', 'bigquery_calc'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY fiscal_year
CLUSTER BY fiscal_week;
```

**Note**: Store both fiscal_week and iso_week to support frontend toggle between views.

---

## Phase 2: Excel Processing Script

**File**: `scripts/active/process-ytd-excel-files.js`

### Logic
1. Iterate through `data/YTD-Comp-Data/FY{23,24,25,26}/` folders
2. For each Excel file:
   - Parse date from filename: `YYYY.MM.DD ... .xlsx`
   - Calculate fiscal week and ISO week from date
   - Extract YTD totals (multi-strategy parser for format variations)
   - Insert into BigQuery

### Multi-Strategy Parser
```javascript
// Try multiple extraction strategies to handle format variations:
// 1. Look for "Board" sheet with total row
// 2. Look for "Summary" sheet totals
// 3. Aggregate from "Performances by Week" sheet
// 4. Log failures for manual review
```

### Key Utilities (already in codebase)
- `xlsx` library for Excel parsing
- Date parsing: `XLSX.utils.sheet_to_json(sheet, { header: 1 })`
- Number cleaning: strip `$`, `,`, `%` characters

---

## Phase 3: API Endpoint

**File**: `netlify/functions/bigquery-snapshots.js`

Add new action:
```javascript
case 'get-ytd-comparison':
  return await getYTDComparison(bigquery, params, headers);
```

### Response Format
```json
{
  "data": {
    "FY23": [{ "fiscalWeek": 1, "isoWeek": 27, "tickets": 1234, "revenue": 56789, ... }, ...],
    "FY24": [...],
    "FY25": [...],
    "FY26": [...]
  },
  "_meta": {
    "fiscalYears": ["FY23", "FY24", "FY25", "FY26"],
    "maxWeek": 52
  }
}
```

### Current Year Fallback
If FY26 needs real-time data, calculate from `performance_sales_snapshots`:
```sql
SELECT
  FLOOR(DATE_DIFF(snapshot_date, DATE '2025-07-01', DAY) / 7) + 1 as fiscal_week,
  EXTRACT(ISOWEEK FROM snapshot_date) as iso_week,
  SUM(single_tickets_sold) as tickets,
  SUM(total_revenue) as revenue
FROM performance_sales_snapshots
WHERE snapshot_date >= '2025-07-01'
GROUP BY fiscal_week, iso_week
```

---

## Phase 4: Frontend Page

### `ytd-comparison.html`
- Header with title and back-to-dashboard link
- Controls:
  - Metric selector (tickets/revenue)
  - Week type toggle (Fiscal Week vs ISO Week)
  - Year toggles (show/hide each FY)
- Chart container
- Loading/error states

### `src/charts/ytd-comparison-chart.js`
Following `SalesCurveChart` patterns:
- D3.js line chart
- X-axis: Fiscal week (1-52) or ISO week (1-52) - toggleable
- Y-axis: Cumulative tickets or revenue
- Multiple colored lines (one per year)
- Interactive tooltips
- Legend with year toggles
- Responsive design

### Year Colors
```javascript
const yearColors = {
  'FY23': '#8884d8',  // Purple
  'FY24': '#82ca9d',  // Green
  'FY25': '#ffc658',  // Gold
  'FY26': '#ff7c43'   // Orange (current year - prominent)
};
```

---

## Phase 5: Navigation

Add link in `index.html` header:
```html
<a href="/ytd-comparison.html">YTD Comparison</a>
```

---

## Implementation Order

1. Create BigQuery table schema
2. Build and run Excel processing script (populate historical data)
3. Add API endpoint
4. Create frontend page and chart
5. Add navigation link
6. Test end-to-end locally
7. Deploy to preview branch

---

## Verification Steps

1. **Data quality**: Verify row counts per fiscal year, check for week gaps
2. **API testing**: `curl "http://localhost:8888/.netlify/functions/bigquery-snapshots?action=get-ytd-comparison"`
3. **Chart testing**: All years render, tooltips work, metric switching works
4. **Responsive**: Test on mobile/tablet viewports

---

## Key Reference Files

- `src/charts/sales-curve-chart.js` - D3 chart patterns
- `scripts/active/import-historical-comps-v2.js` - Excel parsing + BigQuery
- `excel.html` - Page structure template
- `netlify/functions/bigquery-snapshots.js` - API patterns
