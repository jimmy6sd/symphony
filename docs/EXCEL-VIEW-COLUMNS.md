# Excel View Column Reference

Complete documentation of all columns in the `/excel` view, including data sources, calculations, and N/A conditions.

---

## Data Flow Overview

```
PDF Weekly Reports → Make.com → BigQuery (performance_sales_snapshots)
                                     ↓
                         Netlify Function (bigquery-snapshots.js)
                                     ↓
                         Frontend (excel-view.js processData())
                                     ↓
                         Calculations + Projections
```

---

## Column Reference

### Basic Information Columns

| # | Column | Source | Calculation | N/A Reason |
|---|--------|--------|-------------|------------|
| 1 | **Wk #** | Calculated | Row index + 1 | Never N/A |
| 2 | **# Weeks Until Performance** | Calculated | `(performance_date - today) / 7 days` | Never N/A (shows "X (past)" for past events) |
| 3 | **Performance Week (Monday)** | Calculated | Monday of the week containing performance_date | Never N/A |
| 4 | **Performance** | BigQuery | `performances.title` + `performance_code` | Never N/A |
| 5-6 | **(Empty columns)** | N/A | Spacers | Always empty |
| 7 | **Performance Date(s)** | BigQuery | `performances.performance_date` | Never N/A |
| 8 | **Performance Type** | BigQuery | `performances.series` | N/A if series field is null |

---

### Ticket Columns

| # | Column | Source | Calculation | N/A Reason |
|---|--------|--------|-------------|------------|
| 9 | **Actual Total Tickets Sold** | BigQuery | `performance_sales_snapshots.total_tickets_sold` | Shows 0 if no snapshot |
| 10 | **Projected Single Tickets + Actual Subs** | **CALCULATED** | `projectedSingles + subscription_tickets_sold` | N/A if: no target comp set, no sales yet, or outside comp data range |
| 11 | **Projected Total OCC at Performance** | **CALCULATED** | `(projectedTotal / capacity) × 100` | N/A same as #10 |

---

### Revenue & Budget Columns

| # | Column | Source | Calculation | N/A Reason |
|---|--------|--------|-------------|------------|
| 12 | **Total Actual Revenue** | BigQuery | `performance_sales_snapshots.total_revenue` | Shows $0 if no data |
| 13 | **TOTAL BUDGET** | BigQuery | `performances.budget_goal` | Shows $0 if not set |
| 14 | **Actual/Budget %** | **CALCULATED** | `(total_revenue / budget_goal) × 100` (client-side) | Shows 0% if budget is 0 |
| 15 | **Projected/Budget %** | **CALCULATED** | `(projectedRevenue / budget_goal) × 100` where `projectedRevenue = projectedTotal × single_atp` | N/A if projection unavailable or budget=0 |

---

### Single Ticket Columns

| # | Column | Source | Calculation | N/A Reason |
|---|--------|--------|-------------|------------|
| 16 | **Actual Single Tickets Sold** | BigQuery | `performance_sales_snapshots.single_tickets_sold` | Shows 0 if no data |
| 17 | **Target Single Tickets for 85% OCC** | Calculated | `CEIL(capacity × 0.85) - subscription_tickets_sold` | Never N/A |
| 18 | **Projected Single Tickets** | **CALCULATED** | Comparison-based projection (see below) | N/A if: no target comp, no sales, outside range |
| 19 | **Projected Single Tickets vs 85% OCC Target** | **CALCULATED** | `projectedSingles - targetSinglesFor85` | N/A same as #18 |
| 20 | **Actual Revenue (Singles)** | BigQuery | `performance_sales_snapshots.single_revenue` | Shows $0 if no data |
| 21 | **BUDGET (Singles)** | BigQuery | `performances.single_budget_goal` | N/A if field is 0 or null |
| 22 | **Actual/Budget % (Singles)** | Calculated | `(single_revenue / single_budget_goal) × 100` | N/A if budget=0 or revenue=0 |
| 23 | **Projected/Budget % (Singles)** | **CALCULATED** | `(projectedSingles × single_atp) / single_budget_goal × 100` | N/A if: no target comp, no sales, singles budget=0, or ATP=0 |

---

### Subscription Columns

| # | Column | Source | Calculation | N/A Reason |
|---|--------|--------|-------------|------------|
| 24 | **Actual Sub Tickets Sold** | BigQuery | `performance_sales_snapshots.fixed_tickets_sold` | Shows 0 if no data |
| 25 | **Actual Revenue (Subscriptions)** | BigQuery | `performance_sales_snapshots.fixed_revenue` | Shows $0 if no data |
| 26 | **BUDGET (Subscriptions)** | BigQuery | `performances.subscription_budget_goal` | N/A if field is 0 or null |
| 27 | **Actual vs Budget % (Subs)** | Calculated | `(fixed_revenue / subscription_budget_goal) × 100` | N/A if budget=0 or revenue=0 |

---

### Capacity & Price Columns

| # | Column | Source | Calculation | N/A Reason |
|---|--------|--------|-------------|------------|
| 28 | **Max CAP** | BigQuery | `performances.capacity` | Shows 0 if not set |
| 29 | **Actual OCC SOLD** | **CALCULATED** | `(total_tickets_sold / capacity) × 100` (client-side) | Shows 0% if capacity is 0 |
| 30 | **Single Ticket ATP** | BigQuery | `performance_sales_snapshots.single_atp` | Shows $0.00 if no single sales |

---

### Week-over-Week Columns

| # | Column | Source | Calculation | N/A Reason |
|---|--------|--------|-------------|------------|
| 31 | **Revenue last week** | **CALCULATED** | `current_revenue - week_over_week_change` | N/A if no snapshot from 5-10 days ago exists |
| 32 | **Increase over week** | BigQuery | Compares latest snapshot vs snapshot from 5-10 days ago | N/A if no historical snapshot in 5-10 day window, or if performance is in the past |

---

## Projection Calculation Deep Dive

The **comparison-based projection** (used in columns 10, 11, 15, 18, 19) uses the same logic as the sales curve chart.

### How It Works

```
1. Get target comparison performance (user-set via admin)
2. Calculate exact weeks until performance (decimal, e.g., 3.5 weeks)
3. Interpolate target comp's sales at current week position
4. Calculate variance: currentSingles - targetCompAtCurrentWeek
5. Project final: targetCompFinal + variance
6. Cap at available single capacity
7. Floor at current sales (can't project fewer than sold)
```

### Example Calculation

```
Current single tickets sold: 300
Target comp at 3.5 weeks out: 250
Variance: +50 (we're ahead of the comp)
Target comp final sales: 600

Projected final: 600 + 50 = 650 singles
```

### Why Projections Show N/A

| Reason Code | Meaning | Solution |
|-------------|---------|----------|
| `no_target_comp` | No comparison performance has been set as target | Set a target comp in the performance detail modal |
| `no_sales` | Zero single tickets sold yet | Wait for sales data |
| `week_out_of_range` | Performance is too far out for comp data range | Wait until closer to performance |

---

## BigQuery Tables Referenced

### `performances` table
Contains performance metadata:
- `performance_id`, `performance_code`, `title`, `series`
- `performance_date`, `venue`, `season`, `capacity`
- `budget_goal`, `single_budget_goal`, `subscription_budget_goal`
- `occupancy_goal`

### `performance_sales_snapshots` table
Contains daily sales snapshots:
- `performance_code`, `snapshot_date`
- `single_tickets_sold`, `fixed_tickets_sold`, `total_tickets_sold`
- `single_revenue`, `fixed_revenue`, `total_revenue`
- `capacity_percent`, `budget_percent`
- `single_atp`, `overall_atp`, `fixed_atp`

### `performance_comparisons` table
Contains user-defined comparison relationships:
- `performance_code`, `comparison_code`
- `is_target` (boolean - marks the target comp for projections)
- `weeksArray` (sales by week for the comparison)

---

## Color Coding Reference

### Occupancy (OCC) Colors
- **Green** (≥85%): High occupancy - meeting goal
- **Orange** (70-84%): Medium occupancy - on track
- **Red** (<70%): Low occupancy - needs attention

### Budget % Colors
- **Green** (≥100%): Over budget - exceeding goal
- **Blue** (≥85%): On track
- **Red** (<85%): Under budget - needs attention

### Variance Colors
- **Green** (positive): Ahead of target/projection
- **Red** (negative): Behind target/projection

---

## Related Files

- `src/charts/excel-view.js` - Main Excel view component
- `src/utils/sales-projections.js` - Projection calculation utilities
- `netlify/functions/bigquery-snapshots.js` - Backend API
- `excel.html` - Excel view page

---

*Last Updated: January 2025*
