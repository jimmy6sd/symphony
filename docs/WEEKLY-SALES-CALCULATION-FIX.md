# Weekly Sales Calculation Fix - Sales Progression Data

## Issue Summary

**Problem**: The `weeklySales` data stored in BigQuery is tracking **total tickets sold** (single + subscription including fixed packages), but the sales progression chart should only track **sellable/flexible tickets** (single tickets + non-fixed packages, excluding fixed subscription packages).

**Current Behavior**:
- Red dot on chart shows: `singleTicketsSold` = 942 (single + non-fixed packages)
- Blue line from `weeklySales` shows: 948 at week 10 (includes 6 fixed subscription tickets)
- **Mismatch**: 6-ticket discrepancy

**Root Cause**: The `weeklySales.tickets_sold` field in BigQuery includes fixed subscription packages, which should be excluded from sales progression tracking.

---

## Data Model Clarification

### Ticket Categories (from PDF reports)
1. **Fixed Packages** - Season tickets with assigned seats (pre-committed, exclude from progression)
2. **Non-Fixed Packages** - Flexible subscription seats (count toward sales progression)
3. **Single Tickets** - Individual ticket purchases (count toward sales progression)

### Current Field Definitions (After Fix in commit 2f619a9)
- `singleTicketsSold` = Single Tickets + Non-Fixed Packages ✅ **CORRECT**
- `subscriptionTicketsSold` = Fixed Packages only ✅ **CORRECT**
- `totalTicketsSold` = singleTicketsSold + subscriptionTicketsSold ✅ **CORRECT**

### Weekly Sales Data (NEEDS FIX)
- `weeklySales[].ticketsSold` = Currently tracking `totalTicketsSold` ❌ **INCORRECT**
- **Should track**: `singleTicketsSold` only (which includes non-fixed packages)

---

## Technical Details

### Where Weekly Sales Data is Stored
**BigQuery Table**: `weekly_sales`
**Schema**:
```sql
CREATE TABLE weekly_sales (
  performance_id INT64,
  week_number INT64,
  tickets_sold INT64,        -- ❌ Currently includes fixed packages
  percentage FLOAT64,
  cumulative_tickets INT64,  -- ❌ Currently includes fixed packages
  cumulative_percentage FLOAT64
)
```

### Where Weekly Sales Data is Used
1. **Sales Progression Chart** (`src/charts/sales-curve-chart.js`)
   - Uses comparison data from `getPerformanceComparisons()` API
   - Renders blue longitudinal lines showing week-by-week sales progression
   - Currently shows total tickets (incorrect)

2. **Data Table** (`src/charts/data-table.js`)
   - Displays weekly sales data in performance modal
   - Shows cumulative progression by week

3. **BigQuery API** (`netlify/functions/bigquery-data.js`)
   - Reads from `weekly_sales` table
   - Returns data in response for charts to consume

---

## Required Fix

### 1. Update BigQuery Data Collection
The source of weekly sales data needs to track **only sellable tickets** (single + non-fixed), excluding fixed subscription packages.

**Current calculation**:
```
tickets_sold = total_tickets_sold  // ❌ Includes fixed packages
```

**Should be**:
```
tickets_sold = single_tickets_sold  // ✅ Excludes fixed packages (already includes non-fixed)
```

### 2. Update Weekly Sales Import Scripts
Any scripts that populate the `weekly_sales` table need to use `singleTicketsSold` instead of `totalTicketsSold`:

**Files to check**:
- `scripts/parse-weekly-sales-csv.js` - Line 133-139
- `scripts/migrate-to-snapshots.js` - Historical snapshot creation
- Any PDF processing that generates weekly data

### 3. Recalculate Existing Data
After fixing the import logic, existing `weekly_sales` records need to be recalculated:

**Option A - Full Rebuild**:
```bash
# Rebuild entire database with corrected calculation
node scripts/rebuild-clean-database.js
```

**Option B - Update Existing Records**:
```sql
-- Update weekly_sales to exclude fixed subscription tickets
UPDATE `weekly_sales` w
SET
  tickets_sold = (
    -- Calculate single tickets only from snapshots or source data
    -- This query needs to be adapted based on available historical data
  )
WHERE performance_id IN (SELECT performance_id FROM performances)
```

---

## Verification Steps

### 1. Check Sample Performance Data
```bash
# Example: Morgan Freeman performance (ID 24090)
# Current data:
# - singleTicketsSold: 942
# - subscriptionTicketsSold: 6 (fixed packages)
# - totalTicketsSold: 948
# - weeklySales[week 10].ticketsSold: 948 ❌ Should be 942
```

### 2. After Fix - Verify Alignment
The red dot (current sales) and blue line (weekly progression) should align:
- Red dot at week N: `singleTicketsSold = 942`
- Blue line at week N: `weeklySales[N].ticketsSold = 942`
- Both should exclude the 6 fixed subscription tickets

### 3. Test with Multiple Performances
Verify fix across different performance types:
- Classical series (high subscription base)
- Pops series (moderate subscriptions)
- Special events (low subscriptions)
- Family concerts

---

## Implementation Priority

**Priority**: HIGH
**Impact**: Affects sales progression analysis accuracy
**Effort**: Medium (requires data recalculation)

### Immediate Actions
1. ✅ Document the issue (this document)
2. ⏳ Audit weekly sales data sources
3. ⏳ Update import/calculation logic
4. ⏳ Recalculate historical weekly_sales data
5. ⏳ Verify chart alignment
6. ⏳ Test across multiple performances

---

## Related Issues

- **Fixed**: commit 2f619a9 - "subscription tickets now only include fixed packages"
  - This fixed the daily snapshot (`singleTicketsSold` calculation)
  - Still need to fix historical weekly progression data

- **Documentation**: `SUBSCRIPTION_TICKET_AUDIT.md`
  - Comprehensive audit of subscription ticket calculation across codebase
  - This document extends that work to weekly sales progression

---

## Notes

**Why exclude fixed packages from progression?**
Fixed subscription packages are pre-committed season tickets with assigned seats. They represent baseline attendance that was "sold" before the performance went on sale to the general public. Sales progression tracking should measure how well we're selling the **available** inventory (single tickets + flexible subscription options), not the pre-committed baseline.

**Chart Legend**:
- "Actual Sales" = Single tickets + non-fixed packages (red dot)
- "Available Single Tickets" = Total capacity - fixed subscriptions (purple line)
- "Total Capacity" = Full venue capacity (gray line)

The sales progression should track movement toward "Available Single Tickets" goal, not total capacity.

---

## Contact

For questions about this fix, refer to:
- `src/data-service.js` - Lines 38-41 (main calculation)
- `netlify/functions/bigquery-data.js` - Lines 235-282 (weekly sales API)
- Git commit 2f619a9 - Original subscription calculation fix
