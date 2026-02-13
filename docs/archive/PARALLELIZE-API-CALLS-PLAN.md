# Plan: Parallelize Dashboard API Calls

## Problem

Dashboard initial load takes ~4.6s because two API calls run **sequentially**:

1. `bigquery-snapshots?action=get-initial-load` (~2.3s)
2. `performance-comparisons?performanceIds=...` (~2.0s)

Each call pays its own Netlify function cold start + BigQuery connection penalty.

## Goal

Run both calls in **parallel** to reduce total load time from ~4.6s to ~2.3s.

---

## Current Code

**File:** `src/charts/data-table.js`

```javascript
// Lines 536-568 (simplified)
async init() {
    // SEQUENTIAL - waits for this to complete...
    const result = await dataService.getPerformances();
    this.data = result.performances;

    // ...then does this (calls enrichWithProjections which fetches comparisons)
    await this.enrichWithProjections();

    this.render();
}

async enrichWithProjections() {
    const performanceIds = this.data.map(perf => perf.performanceCode || ...);
    // SEQUENTIAL - this waits for getPerformances to finish first
    const allComparisons = await window.dataService.getBatchPerformanceComparisons(performanceIds);
    // ... calculate projections
}
```

**Problem:** `enrichWithProjections()` can't start until `getPerformances()` finishes because it needs the performance IDs.

---

## Solution

Fetch comparisons for ALL performances upfront (we know there are ~110-140), then filter client-side.

### Option A: Fetch All Comparisons (Simplest)

Modify the API to support fetching all comparisons without specifying IDs:

**Backend change** in `netlify/functions/performance-comparisons.js`:

```javascript
// Add a new case in getComparisons() for when no IDs provided
if (!performanceId && !performanceIds) {
    // Return ALL comparisons (there are only ~60 total)
    const query = `
        SELECT * FROM \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
        ORDER BY performance_id, is_target DESC, created_at DESC
    `;
    // ... execute and return grouped by performance_id
}
```

**Frontend change** in `src/charts/data-table.js`:

```javascript
async init() {
    try {
        const dataService = window.dataService || new window.DataService();

        // PARALLEL - both start immediately
        const [result, allComparisons] = await Promise.all([
            dataService.getPerformances(),
            fetch('/.netlify/functions/performance-comparisons')
                .then(r => r.json())
        ]);

        this.data = result.performances;
        const wowData = result.weekOverWeek;

        // Attach W/W data
        if (wowData) {
            this.data.forEach(performance => {
                const code = performance.performanceCode || performance.performance_code || performance.id;
                performance._weekOverWeek = wowData[code] || { tickets: 0, revenue: 0, available: false };
            });
        }

        // Calculate projections using already-fetched comparisons
        await this.enrichWithProjections(allComparisons);

    } catch (error) {
        console.error('Error initializing data table:', error);
        this.data = [];
    }

    this.render();
    return this;
}

async enrichWithProjections(allComparisons) {
    // allComparisons is already keyed by performance_id
    const projectionPromises = this.data.map(async (perf) => {
        try {
            const performanceId = perf.performanceCode || perf.performance_code || perf.code || perf.id;
            const result = await this.calculateProjection(perf, allComparisons[performanceId] || []);
            perf._projection = result.projection;
        } catch (error) {
            perf._projection = null;
        }
    });

    await Promise.all(projectionPromises);
}
```

### Option B: Combine Into Single Endpoint (Best Performance)

Create a new combined endpoint that returns everything in one call:

**New endpoint:** `bigquery-snapshots?action=get-dashboard-data`

Returns:
```json
{
    "performances": [...],
    "weekOverWeek": {...},
    "comparisons": {...},
    "_meta": {...}
}
```

This would:
- Reduce from 2 cold starts to 1
- Reduce from 2 BigQuery connections to 1
- Run all 3 queries in parallel server-side

**Estimated improvement:** 4.6s → ~1.5s

---

## Implementation Steps

### For Option A (Simpler):

1. [ ] Add "get all comparisons" support to `performance-comparisons.js`
2. [ ] Update `data-table.js` init() to use Promise.all
3. [ ] Update `enrichWithProjections()` to accept pre-fetched data
4. [ ] Test locally
5. [ ] Deploy to next branch and verify timing

### For Option B (Better):

1. [ ] Add `get-dashboard-data` action to `bigquery-snapshots.js`
2. [ ] Include comparisons query in the parallel Promise.all
3. [ ] Update frontend to use new combined endpoint
4. [ ] Add caching for combined response
5. [ ] Test locally
6. [ ] Deploy and verify

---

## Expected Results

| Approach | Current | After | Savings |
|----------|---------|-------|---------|
| Option A (parallel) | 4.6s | ~2.3s | 50% |
| Option B (combined) | 4.6s | ~1.5s | 67% |

---

## Testing

```bash
# Local timing test
curl -s -w "\nTime: %{time_total}s" "http://localhost:8888/.netlify/functions/bigquery-snapshots?action=get-initial-load"

# Production timing test (after deploy)
# Use browser DevTools Network tab to verify parallel requests
```

---

## Notes

- Option B is better long-term but more code changes
- Either option works with the existing caching strategy
- Consider adding a keep-warm cron job after implementing (see caching docs)
