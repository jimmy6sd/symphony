# ATP Calculation Fix - Complete Summary

## Problem Identified
Performance 251122E showing:
- ❌ Single Ticket ATP: "N/A" (should be $54.08)
- ❌ Blended ATP: Using fallback calculation instead of BigQuery field
- ❌ Tooltips: Using fallback calculations instead of granular ATP fields

## Root Cause
The Netlify function `bigquery-snapshots.js` was **NOT selecting the ATP fields** from the snapshots table, even though the fields exist and are populated correctly in BigQuery.

---

## BigQuery Data (VERIFIED CORRECT ✅)

```sql
-- Performance 251122E latest snapshot (2025-11-11):
SELECT
  single_tickets_sold,    -- 314
  total_tickets_sold,     -- 879
  single_revenue,         -- $16,981
  total_revenue,          -- $55,640.70
  single_atp,             -- $54.08  ✅ (16981 / 314)
  overall_atp,            -- $63.30  ✅ (55640.7 / 879)
  fixed_atp,              -- $68.48  ✅
  non_fixed_atp           -- $65.90  ✅
FROM `kcsymphony.symphony_dashboard.performance_sales_snapshots`
WHERE performance_code = '251122E'
ORDER BY snapshot_date DESC
LIMIT 1;
```

**All ATP calculations in BigQuery are CORRECT!**

---

## Fixes Applied

### 1. `netlify/functions/bigquery-snapshots.js` - getPerformancesWithLatestSnapshots()

**BEFORE** (lines 259-267):
```javascript
SELECT
  performance_code,
  snapshot_date,
  single_tickets_sold,
  subscription_tickets_sold,
  total_tickets_sold,
  total_revenue,
  capacity_percent,
  budget_percent
FROM `${PROJECT_ID}.${DATASET_ID}.performance_sales_snapshots`
```

**AFTER** (lines 259-275):
```javascript
SELECT
  performance_code,
  snapshot_date,
  single_tickets_sold,
  subscription_tickets_sold,
  total_tickets_sold,
  total_revenue,
  capacity_percent,
  budget_percent,
  single_atp,          // ✅ ADDED
  overall_atp,         // ✅ ADDED
  fixed_atp,           // ✅ ADDED
  non_fixed_atp        // ✅ ADDED
FROM `${PROJECT_ID}.${DATASET_ID}.performance_sales_snapshots`
```

### 2. Main SELECT Statement (lines 249-259)

**ADDED ATP fields to main SELECT:**
```javascript
COALESCE(s.single_atp, 0) as single_atp,
COALESCE(s.overall_atp, 0) as overall_atp,
COALESCE(s.fixed_atp, 0) as fixed_atp,
COALESCE(s.non_fixed_atp, 0) as non_fixed_atp,
```

### 3. getPerformanceHistory() (lines 355-375)

**ADDED ATP fields to historical snapshots query:**
```javascript
SELECT
  snapshot_id,
  performance_code,
  snapshot_date,
  single_tickets_sold,
  subscription_tickets_sold,
  total_tickets_sold,
  total_revenue,
  capacity_percent,
  budget_percent,
  single_atp,          // ✅ ADDED
  overall_atp,         // ✅ ADDED
  fixed_atp,           // ✅ ADDED
  non_fixed_atp,       // ✅ ADDED
  source,
  created_at
FROM `${PROJECT_ID}.${DATASET_ID}.performance_sales_snapshots`
```

---

## Data Flow (NOW FIXED ✅)

```
BigQuery snapshots table
  ↓ (has single_atp: $54.08, overall_atp: $63.30)
  ↓
Netlify Function: bigquery-snapshots.js
  ↓ (NOW SELECTS ATP fields ✅)
  ↓
DataService.getPerformances()
  ↓ (performance.single_atp = 54.08 ✅)
  ↓
Detail Modal / Chart Tooltips
  ↓ (displays ATP from BigQuery ✅)
  ↓
UI Display
  Single Ticket ATP: $54.08 ✅
  Blended ATP: $63.30 ✅
  Comp Blended ATP: (from comparison) ✅
```

---

## Expected Behavior After Fix

### Performance Detail Modal
- **Single Ticket ATP**: $54.08 (from `single_atp` field)
- **Blended ATP**: $63.30 (from `overall_atp` field)
- **Comp Blended ATP**: (from target comparison's `atp` field)

### Historical Tooltip (Blue Line)
```
Snapshot: 2025-11-11
Days before performance: X days
Tickets Sold: 314
Single Ticket ATP: $54.08  ✅ (from single_atp field)
Revenue: $16,981
Occupancy: X%
```

### Sales Curve Projection Tooltip
```
Current Sales
Week: X weeks before
Tickets Sold: 314
Occupancy: X%
Single Ticket ATP: $54.08  ✅ (from single_atp field)
Revenue: $16,981
```

### Comparison Line Tooltip
```
Comparison Name
Week: X weeks before
Target: XXX tickets
Blended ATP: $XX.XX  ✅ (labeled as "Blended ATP")
Revenue: $XX,XXX
```

---

## Testing Instructions

1. **Clear Cache**:
   ```
   http://localhost:8888/.netlify/functions/bigquery-snapshots?action=invalidate-cache
   ```

2. **Refresh Dashboard**: Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

3. **Check Performance 251122E**:
   - Navigate to http://localhost:8888/performance/other/251122E
   - Verify Single Ticket ATP shows **$54.08**
   - Verify Blended ATP shows **$63.30**
   - Hover over historical blue line points - should show "Single Ticket ATP: $54.08"
   - Hover over projection line points - should show "Single Ticket ATP: $54.08"
   - Hover over comparison lines - should show "Blended ATP: $XX.XX"

4. **Check Multiple Performances**: Test other performances to ensure ATP fields are populated across all data

---

## Files Modified

1. ✅ `netlify/functions/bigquery-snapshots.js` - Added ATP fields to all SELECT statements
2. ✅ `src/charts/sales-curve-chart.js` - Already updated to use single_atp (line 1104-1105)
3. ✅ `src/charts/data-table.js` - Already updated to use single_atp (lines 1019-1021, 1952-1953)

---

## Performance Impact

**No performance degradation expected** - Adding 4 FLOAT64 columns to SELECT statement has negligible impact:
- Column data already exists in BigQuery (no computation needed)
- FLOAT64 fields are small (8 bytes each = 32 bytes total for 4 fields)
- No additional JOINs or calculations required

---

## Next Deployment

After testing locally, deploy to production:
```bash
git add netlify/functions/bigquery-snapshots.js
git commit -m "fix: add ATP fields to snapshots API for granular revenue analytics"
git push
```

Netlify will automatically redeploy the function with the ATP fields included.
