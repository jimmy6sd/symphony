# YTD Attribution Toggle - COMPLETE

**Date Started**: 2026-01-22
**Date Completed**: 2026-02-05
**Status**: ✅ Complete and deployed to production

---

## Overview

Added a toggle to switch between two attribution modes for YTD comparison segments:
- **Snapshot attribution**: Revenue attributed to when sales data was captured (existing behavior)
- **Performance attribution**: Revenue attributed to when concerts actually occurred (new feature)

---

## What Was Implemented

### 1. Historical Performance Data Backfill ✅

**Script**: `scripts/active/backfill-historical-performance-dates.js`

Parses Excel files (FY23-FY25) to extract individual performance records with dates and revenue.

**Final Data**:
- FY23: 34 performances (season '22-23')
- FY24: 34 performances (season '23-24')
- FY25: 51 performances (season '24-25')

**Bug Fixed**: `getFiscalYear()` was generating wrong season codes ('25-26' instead of '24-25'). Fixed to correctly calculate season from performance date.

### 2. BigQuery Table ✅

**Table**: `kcsymphony.symphony_dashboard.ytd_historical_performances`

Stores per-performance revenue and ticket data for historical years.

### 3. API Modifications ✅

**File**: `netlify/functions/bigquery-snapshots.js`

- Added `attributionMode` parameter to `getYTDComparison()`
- Historical query uses `ytd_historical_performances` table with running YTD totals
- FY26 live query groups by performance_date instead of snapshot_date
- Calculates `total_revenue` and `total_tickets` from single + subscription fields

### 4. Frontend - Attribution Toggle ✅

**File**: `src/ytd-comparison-app.js`

- Added `segment-attribution-select` dropdown
- Toggle only affects segment cards (chart always uses snapshot mode)
- Loads separate `segmentData` for attribution-specific calculations

### 5. Frontend - Segment Improvements ✅

**Segments now show delta values** that sum to season total (not cumulative YTD).

**Current segment indicator**: Blue border + "Week XX" badge on the segment containing current week.

**Month labels**: Segments show month ranges (e.g., "Jul-Aug (W1-W9)") instead of just week numbers.

**Incomplete logic fixed**: In performance mode, segments aren't marked incomplete just because no concerts in early weeks.

### 6. Styling Fixes ✅

- FY24 toggle button changed from green to purple to match line color
- Added `.current-badge` and `.current-segment` CSS
- Added `.week-numbers` styling for subtle week display

---

## Metrics Support by Year (Performance Mode)

| Metric | FY24 | FY25 | FY26 |
|--------|------|------|------|
| Total Revenue | ✓ $3.66M | ✓ $7.32M | ✓ $6.70M |
| Total Tickets | ✓ 60,528 | ✓ 119,279 | ✓ 98,476 |
| Single Revenue | ✓ | ✓ | ✓ |
| Single Tickets | ✓ | ✓ | ✓ |
| Sub Revenue | ✓ | ✓ | ✓ |
| Sub Tickets | ✗ (0 in source) | ✓ | ✓ |

---

## Files Modified

- `netlify/functions/bigquery-snapshots.js` - API attribution mode support
- `src/ytd-comparison-app.js` - Frontend toggle, segment calculations, month labels
- `styles/ytd-comparison.css` - Current segment styling, FY24 color fix
- `scripts/active/backfill-historical-performance-dates.js` - Season code fix

---

## Commit

```
da6148a feat: YTD attribution toggle, segment improvements, FY25 backfill fix
```

Deployed to production on 2026-02-05.
