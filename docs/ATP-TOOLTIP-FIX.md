# ATP Tooltip Calculation Fix

## Problem
Performance 251122E historical tooltip was showing **INCORRECT Single Ticket ATP** due to wrong fallback calculation.

### The Issue
The tooltip fallback calculation was using:
```javascript
atp = total_revenue / single_tickets_sold
atp = $55,640.70 / 314 = $177.20  ❌ WRONG!
```

Should have been:
```javascript
atp = single_revenue / single_tickets_sold
atp = $16,981 / 314 = $54.08  ✅ CORRECT!
```

---

## Root Cause

### 1. Wrong Revenue Field in Data Mapping (data-table.js line 1905)

**BEFORE:**
```javascript
const historicalPoints = historicalData.map(snapshot => {
    return {
        week: Math.max(0, exactWeeksOut),
        tickets: snapshot.single_tickets_sold || 0,  // 314 tickets
        revenue: snapshot.total_revenue || 0,        // $55,640.70 ❌ WRONG!
        // ... other fields
    };
});
```

**AFTER:**
```javascript
const historicalPoints = historicalData.map(snapshot => {
    return {
        week: Math.max(0, exactWeeksOut),
        tickets: snapshot.single_tickets_sold || 0,  // 314 tickets
        revenue: snapshot.single_revenue || 0,       // $16,981 ✅ CORRECT!
        single_atp: snapshot.single_atp || 0,        // $54.08 from BigQuery
        // ... other fields
    };
});
```

### 2. Missing Revenue Fields in Netlify Function

The `bigquery-snapshots.js` function was **NOT selecting** the granular revenue fields from BigQuery.

**BEFORE:**
```sql
SELECT
  performance_code,
  snapshot_date,
  single_tickets_sold,
  total_tickets_sold,
  total_revenue,  -- Only total revenue
  capacity_percent,
  budget_percent
FROM `performance_sales_snapshots`
```

**AFTER:**
```sql
SELECT
  performance_code,
  snapshot_date,
  single_tickets_sold,
  total_tickets_sold,
  total_revenue,
  single_revenue,     -- ✅ ADDED
  fixed_revenue,      -- ✅ ADDED
  non_fixed_revenue,  -- ✅ ADDED
  capacity_percent,
  budget_percent,
  single_atp,         -- ✅ ADDED
  overall_atp,        -- ✅ ADDED
  fixed_atp,          -- ✅ ADDED
  non_fixed_atp       -- ✅ ADDED
FROM `performance_sales_snapshots`
```

---

## Fixes Applied

### File: `src/charts/data-table.js`
**Line 1905**: Changed `snapshot.total_revenue` to `snapshot.single_revenue`
**Line 1907**: Added `single_atp: snapshot.single_atp || 0`

### File: `netlify/functions/bigquery-snapshots.js`
**Lines 253-255**: Added revenue fields to main SELECT:
```javascript
COALESCE(s.single_revenue, 0) as single_revenue,
COALESCE(s.fixed_revenue, 0) as fixed_revenue,
COALESCE(s.non_fixed_revenue, 0) as non_fixed_revenue,
```

**Lines 270-272**: Added revenue fields to subquery SELECT
**Lines 370-372**: Added revenue fields to performance history query

---

## Calculation Hierarchy

The tooltip now uses ATP in this order of preference:

1. **Primary**: `snapshot.single_atp` (from BigQuery) = $54.08 ✅
2. **Fallback**: `single_revenue / single_tickets_sold` = $16,981 / 314 = $54.08 ✅

Both calculations now produce the CORRECT result!

---

## Expected Results After Fix

### For Performance 251122E (Latest Snapshot 2025-11-11):

**Historical Tooltip should show:**
```
2025-11-11
Days before performance: X days
Tickets Sold: 314
Single Ticket ATP: $54.08  ✅ CORRECT!
Revenue: $16,981  ✅ (single revenue, not total)
Occupancy: X%
```

**Data from BigQuery:**
- Single Tickets Sold: 314
- Single Revenue: $16,981
- Single ATP: $54.08
- Total Revenue: $55,640.70 (includes fixed + non-fixed + single)
- Overall ATP: $63.30

---

## Testing

After clearing cache and refreshing:
1. Navigate to performance 251122E
2. Hover over any historical blue line data point
3. Tooltip should show:
   - **Single Ticket ATP: $54.08** ✅
   - **Revenue: $16,981** (not $55,640.70)

The calculation now correctly isolates single ticket metrics instead of mixing total revenue with single ticket counts.

---

## Files Modified

1. ✅ `src/charts/data-table.js` - Fixed revenue field and added single_atp
2. ✅ `netlify/functions/bigquery-snapshots.js` - Added all granular revenue and ATP fields to 3 queries

---

## Summary

**The Problem**: Tooltip was dividing total revenue ($55,640.70) by single tickets (314) = $177.20 ❌

**The Fix**: Tooltip now divides single revenue ($16,981) by single tickets (314) = $54.08 ✅

**The Data**: BigQuery had the correct data all along - we just weren't:
1. Selecting the `single_revenue` field in the Netlify function
2. Using the `single_revenue` field in the tooltip calculation
