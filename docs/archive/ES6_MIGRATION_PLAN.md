# ES6 Module Migration Plan

## Problem Identified
The current `src/main.js` loads **19 scripts sequentially** (one at a time):
```javascript
// Current: SLOW - loads one by one
async function loadScripts(scripts) {
    for (const script of scripts) {
        await loadScript(script);  // ⚠️ Waits for each script!
    }
}
```

This causes slow page load times because each script is a separate network round-trip that blocks the next one.

## Goal
Convert to ES6 modules so the browser can:
- Load modules **in parallel** (not sequential)
- Automatically resolve dependencies
- Reduce load time by 50-70%

## Simplified Approach

**DON'T** convert all 27 files individually (too complex, too many conflicts with multiple Claude instances).

**DO** create a new streamlined `src/main.js` that uses native ES6 imports:

### New main.js Structure (≈50 lines)
```javascript
// src/main.js - ES6 Module Version
import logger from './utils/logger.js';
import errorHandler from './utils/error-handler.js';
import { dataService } from './data-service.js';
import { DataTable } from './charts/data-table.js';
import { DashboardUI } from './components/dashboard-ui.js';

// Simple initialization
async function init() {
    try {
        // Initialize dashboard UI (it handles everything else)
        const dashboard = new DashboardUI();
        await dashboard.init();

        console.log('✅ Dashboard loaded');
    } catch (error) {
        console.error('❌ Failed to load dashboard:', error);
    }
}

// Start when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
```

## Implementation Steps

### Step 1: Update index.html
Change from:
```html
<script src="/src/main.js"></script>
```

To:
```html
<script type="module" src="/src/main.js"></script>
```

### Step 2: Convert Only Essential Modules
Only convert the files that main.js directly imports:

**Priority 1 - Utilities (no dependencies):**
- `src/utils/logger.js` - Add `export default logger`
- `src/utils/error-handler.js` - Add `import logger` and `export default errorHandler`
- `src/utils/validators.js` - Add `export default Validators`

**Priority 2 - Core Services:**
- `src/data-service.js` - Add `export { dataService }`
- `src/components/dashboard-ui.js` - Add `export { DashboardUI }`

**Priority 3 - Charts (loaded by dashboard-ui):**
- `src/charts/data-table.js` - Add exports
- `src/charts/sales-curve-chart.js` - Add exports
- `src/charts/performance-chart.js` - Add exports
- `src/charts/ticket-type-chart.js` - Add exports

### Step 3: Create New Streamlined main.js
Replace the current 305-line `src/main.js` with a simple 50-line ES6 version that:
- Imports essential modules
- Initializes dashboard
- Shows loading state
- Handles errors

### Step 4: Keep Backward Compatibility (Temporarily)
For files not yet converted, keep the `window.*` assignments:
```javascript
// In logger.js - keep both for now
export default logger;
window.logger = logger;  // Backward compat
```

This lets unconverted files still work while we migrate.

## Expected Benefits

### Performance
- **Current:** 19 sequential script loads ≈ 2-4 seconds
- **After:** Parallel ES6 modules ≈ 0.5-1 second
- **Improvement:** 50-70% faster load time

### Code Quality
- **Current:** 305 lines in main.js
- **After:** ~50 lines in main.js
- **Simpler:** Browser handles dependency resolution

### Developer Experience
- Standard ES6 modules (modern, familiar)
- Better IDE support (autocomplete, imports)
- Easier debugging (clear dependency tree)

## Files to Modify

### High Priority (Do First)
1. `index.html` - Add `type="module"`
2. `src/main.js` - Complete rewrite (~50 lines)
3. `src/utils/logger.js` - Add ES6 exports
4. `src/utils/error-handler.js` - Add ES6 import/exports
5. `src/data-service.js` - Add ES6 exports

### Medium Priority (Do After Testing)
6. `src/components/dashboard-ui.js` - Add ES6 exports
7. `src/charts/data-table.js` - Add ES6 exports
8. `src/charts/sales-curve-chart.js` - Add ES6 exports

### Low Priority (Optional - Can Wait)
- All other charts
- Admin panel
- Router utilities

## Testing Checklist
After migration, verify:
- [ ] Dashboard loads without errors
- [ ] Data table displays performances
- [ ] Click on performance opens modal with sales curve
- [ ] All 4 charts render correctly
- [ ] No console errors
- [ ] Load time is faster (check Network tab)

## Rollback Plan
If something breaks:
```bash
git checkout src/main.js
git checkout index.html
# Browser refresh
```

## Success Criteria
- Dashboard loads in <1 second
- No JavaScript errors in console
- All features work (table, charts, modals)
- Code is simpler and more maintainable

---

## Current Status
- **Problem identified:** Sequential script loading is slow
- **Solution designed:** ES6 modules for parallel loading
- **Ready to execute:** Waiting for other Claude instances to be killed
- **Next step:** Start with index.html and new main.js

## Notes
- Keep `window.*` assignments during migration for backward compatibility
- Test after each major change
- Focus on the main user path (table → modal → chart)
- Don't try to convert everything at once - iterate!
