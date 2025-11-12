# 📊 Schema Enhancement Plan: Granular Revenue & Ticket Data Capture

**Created:** 2025-01-11
**Status:** Planning
**Priority:** HIGH - Unlocks critical revenue analytics

---

## 🎯 Objective

Enhance BigQuery schema and data pipeline to capture **ALL** granular revenue and ticket data from Tessitura PDFs, enabling detailed ATP analysis, revenue mix tracking, and inventory analytics.

---

## 📋 Current vs Enhanced Schema

### **Current Schema (Limited)**
```sql
CREATE TABLE symphony_dashboard.performance_sales_snapshots (
  snapshot_id STRING,
  performance_id INT64,
  performance_code STRING,
  snapshot_date DATE,

  -- CURRENT FIELDS (aggregated)
  single_tickets_sold INT64,           -- Single + Non-Fixed combined
  subscription_tickets_sold INT64,      -- Fixed only
  total_tickets_sold INT64,
  total_revenue FLOAT64,                -- All revenue combined

  capacity_percent FLOAT64,
  budget_percent FLOAT64,
  source STRING,
  source_filename STRING,
  created_at TIMESTAMP
);
```

### **Enhanced Schema (Granular)**
```sql
CREATE TABLE symphony_dashboard.performance_sales_snapshots (
  snapshot_id STRING,
  performance_id INT64,
  performance_code STRING,
  snapshot_date DATE,
  performance_time STRING,              -- ✨ NEW: e.g., "7:30 PM"

  -- TICKET COUNTS (granular breakdown)
  fixed_tickets_sold INT64,             -- ✨ NEW: Fixed packages (subscriptions)
  non_fixed_tickets_sold INT64,         -- ✨ NEW: Non-fixed packages
  single_tickets_sold INT64,            -- ✨ CHANGED: Pure single tickets only
  reserved_tickets INT64,               -- ✨ NEW: Comp/reserved tickets
  total_tickets_sold INT64,             -- Calculated total

  -- REVENUE BREAKDOWN (granular)
  fixed_revenue FLOAT64,                -- ✨ NEW: Subscription revenue
  non_fixed_revenue FLOAT64,            -- ✨ NEW: Package revenue
  single_revenue FLOAT64,               -- ✨ NEW: Single ticket revenue
  reserved_revenue FLOAT64,             -- ✨ NEW: Comp ticket value
  subtotal_revenue FLOAT64,             -- ✨ NEW: Before comps
  total_revenue FLOAT64,                -- Complete total

  -- INVENTORY & ANALYTICS
  available_seats INT64,                -- ✨ NEW: Remaining inventory
  capacity_percent FLOAT64,
  budget_percent FLOAT64,

  -- CALCULATED FIELDS (ATP per ticket type)
  fixed_atp FLOAT64,                    -- ✨ NEW: fixed_revenue / fixed_tickets_sold
  non_fixed_atp FLOAT64,                -- ✨ NEW: non_fixed_revenue / non_fixed_tickets_sold
  single_atp FLOAT64,                   -- ✨ NEW: single_revenue / single_tickets_sold
  overall_atp FLOAT64,                  -- ✨ NEW: total_revenue / total_tickets_sold

  -- METADATA
  source STRING,
  source_filename STRING,
  created_at TIMESTAMP
)
PARTITION BY snapshot_date
CLUSTER BY performance_code, snapshot_date;
```

### **Summary of New Fields: 14 New Columns**

| Category | New Fields | Count |
|----------|------------|-------|
| **Ticket Breakdown** | `fixed_tickets_sold`, `non_fixed_tickets_sold`, `reserved_tickets`, `performance_time` | 4 |
| **Revenue Breakdown** | `fixed_revenue`, `non_fixed_revenue`, `single_revenue`, `reserved_revenue`, `subtotal_revenue` | 5 |
| **Inventory** | `available_seats` | 1 |
| **ATP Analytics** | `fixed_atp`, `non_fixed_atp`, `single_atp`, `overall_atp` | 4 |

---

## 🛠️ Implementation Plan

### **Phase 1: Schema Migration** ⚡ CRITICAL

**File:** `scripts/migrations/add-granular-revenue-fields.sql`

```sql
-- Add new ticket count fields
ALTER TABLE `kcsymphony.symphony_dashboard.performance_sales_snapshots`
ADD COLUMN IF NOT EXISTS fixed_tickets_sold INT64,
ADD COLUMN IF NOT EXISTS non_fixed_tickets_sold INT64,
ADD COLUMN IF NOT EXISTS reserved_tickets INT64,
ADD COLUMN IF NOT EXISTS performance_time STRING;

-- Add new revenue fields
ALTER TABLE `kcsymphony.symphony_dashboard.performance_sales_snapshots`
ADD COLUMN IF NOT EXISTS fixed_revenue FLOAT64,
ADD COLUMN IF NOT EXISTS non_fixed_revenue FLOAT64,
ADD COLUMN IF NOT EXISTS single_revenue FLOAT64,
ADD COLUMN IF NOT EXISTS reserved_revenue FLOAT64,
ADD COLUMN IF NOT EXISTS subtotal_revenue FLOAT64;

-- Add inventory field
ALTER TABLE `kcsymphony.symphony_dashboard.performance_sales_snapshots`
ADD COLUMN IF NOT EXISTS available_seats INT64;

-- Add calculated ATP fields
ALTER TABLE `kcsymphony.symphony_dashboard.performance_sales_snapshots`
ADD COLUMN IF NOT EXISTS fixed_atp FLOAT64,
ADD COLUMN IF NOT EXISTS non_fixed_atp FLOAT64,
ADD COLUMN IF NOT EXISTS single_atp FLOAT64,
ADD COLUMN IF NOT EXISTS overall_atp FLOAT64;
```

**Execution:**
```bash
# Run migration via bq command line
bq query --use_legacy_sql=false < scripts/migrations/add-granular-revenue-fields.sql

# Or via Node.js script
node scripts/migrations/run-schema-migration.js
```

---

### **Phase 2: Update Cloud Function** 🔄

**File:** `cloud-functions/pdf-webhook/index.js`

**Current code (lines 334-361):**
```javascript
// BEFORE: Aggregated data
const performance = {
  performance_code: performanceCode,
  performance_date: parseDate(dateTime) || '2025-01-01',
  single_tickets_sold: singleTicketsTotal,
  subscription_tickets_sold: subscriptionTickets,
  total_revenue: totalRevenue,
  capacity_percent: capacityPercent,
  budget_percent: budgetPercent
};
```

**Enhanced code:**
```javascript
// AFTER: Granular data capture
const performance = {
  performance_code: performanceCode,
  performance_date: parseDate(dateTime) || '2025-01-01',
  performance_time: parseTime(dateTime) || null,  // ✨ NEW

  // Ticket breakdown
  fixed_tickets_sold: fixedCount,                  // ✨ NEW
  non_fixed_tickets_sold: nonFixedCount,           // ✨ NEW
  single_tickets_sold: singleCount,                // ✨ CHANGED: Pure singles only
  reserved_tickets: parseInt(reservedStr.replace(/,/g, '')) || 0,  // ✨ NEW
  total_tickets_sold: fixedCount + nonFixedCount + singleCount,

  // Revenue breakdown
  fixed_revenue: fixedRevenue,                     // ✨ NEW
  non_fixed_revenue: nonFixedRevenue,              // ✨ NEW
  single_revenue: singleRevenue,                   // ✨ NEW
  reserved_revenue: parseFloat(reservedRevStr.replace(/,/g, '')) || 0,  // ✨ NEW
  subtotal_revenue: parseFloat(subtotalStr.replace(/,/g, '')) || 0,     // ✨ NEW
  total_revenue: totalRevenue,

  // Inventory
  available_seats: availSeats,                     // ✨ NEW

  // Analytics
  capacity_percent: capacityPercent,
  budget_percent: budgetPercent,

  // Calculated ATP
  fixed_atp: fixedCount > 0 ? fixedRevenue / fixedCount : 0,           // ✨ NEW
  non_fixed_atp: nonFixedCount > 0 ? nonFixedRevenue / nonFixedCount : 0,  // ✨ NEW
  single_atp: singleCount > 0 ? singleRevenue / singleCount : 0,       // ✨ NEW
  overall_atp: (fixedCount + nonFixedCount + singleCount) > 0
    ? totalRevenue / (fixedCount + nonFixedCount + singleCount) : 0    // ✨ NEW
};
```

**Also update lines 936-960 (snapshot INSERT query):**
```javascript
const snapshotValues = validPerfs.map(p => {
  const perfId = existingCodes.get(p.performance_code);
  return `(
    '${crypto.randomBytes(8).toString('hex')}',
    ${perfId},
    '${p.performance_code}',
    CURRENT_DATE(),
    ${p.fixed_tickets_sold || 0},
    ${p.non_fixed_tickets_sold || 0},
    ${p.single_tickets_sold || 0},
    ${p.reserved_tickets || 0},
    ${p.total_tickets_sold || 0},
    ${p.fixed_revenue || 0},
    ${p.non_fixed_revenue || 0},
    ${p.single_revenue || 0},
    ${p.reserved_revenue || 0},
    ${p.subtotal_revenue || 0},
    ${p.total_revenue || 0},
    ${p.available_seats || 0},
    ${p.capacity_percent || 0},
    ${p.budget_percent || 0},
    ${p.fixed_atp || 0},
    ${p.non_fixed_atp || 0},
    ${p.single_atp || 0},
    ${p.overall_atp || 0},
    ${p.performance_time ? `'${p.performance_time}'` : 'NULL'},
    'pdf_webhook',
    CURRENT_TIMESTAMP()
  )`;
}).join(',\n');

const insertSnapshots = `
  INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.performance_sales_snapshots\`
  (snapshot_id, performance_id, performance_code, snapshot_date,
   fixed_tickets_sold, non_fixed_tickets_sold, single_tickets_sold, reserved_tickets, total_tickets_sold,
   fixed_revenue, non_fixed_revenue, single_revenue, reserved_revenue, subtotal_revenue, total_revenue,
   available_seats, capacity_percent, budget_percent,
   fixed_atp, non_fixed_atp, single_atp, overall_atp, performance_time,
   source, created_at)
  VALUES ${snapshotValues}
`;
```

**Add helper function for time parsing:**
```javascript
// Parse time from datetime string
function parseTime(dateTimeStr) {
  if (!dateTimeStr) return null;

  // Match time patterns: "7:30 PM", "2:00 PM", "19:30", etc.
  const timeMatch = dateTimeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (timeMatch) {
    return timeMatch[0]; // Return the matched time string
  }

  return null;
}
```

---

### **Phase 3: Update Reimport Script** 📦

**File:** `scripts/active/reprocess-pdfs-from-bucket.js`

**Changes needed:**
1. Update PDF parsing to extract all new fields (similar to Cloud Function changes)
2. Update BigQuery INSERT to include new columns
3. Add ATP calculations before insertion

**Key sections to modify:**
- PDF text extraction (add performance_time, reserved fields, revenue breakdown)
- BigQuery INSERT query (add all 14 new columns)
- Progress reporting (show new field counts)

---

### **Phase 4: Update Dashboard Analytics** 📊

**Files to update:**
- `src/charts/sales-curve-chart.js` - Add revenue breakdown to tooltips
- `src/charts/data-table.js` - Display ATP by ticket type
- `js/data-service.js` - Fetch new fields from API

**New analytics capabilities:**
```javascript
// Revenue mix analysis
const revenueMix = {
  subscription: (fixedRevenue / totalRevenue * 100).toFixed(1) + '%',
  packages: (nonFixedRevenue / totalRevenue * 100).toFixed(1) + '%',
  single: (singleRevenue / totalRevenue * 100).toFixed(1) + '%'
};

// ATP comparison
const atpComparison = {
  subscription: fixedAtp.toFixed(2),
  packages: nonFixedAtp.toFixed(2),
  single: singleAtp.toFixed(2),
  overall: overallAtp.toFixed(2)
};
```

---

## 🚀 Execution Order

### **Step 1: Schema Migration** (5 minutes)
```bash
node scripts/migrations/run-schema-migration.js
```
- Adds 14 new columns to BigQuery table
- Backward compatible (existing queries still work)
- Non-destructive operation

### **Step 2: Deploy Enhanced Cloud Function** (10 minutes)
```bash
cd cloud-functions/pdf-webhook
npm run deploy
```
- Future PDFs will capture all granular data
- Existing data unaffected

### **Step 3: Update & Test Reimport Script** (15 minutes)
```bash
# Test with dry-run first
node scripts/active/reprocess-pdfs-from-bucket.js --dry-run --limit=5

# Verify extraction works
node scripts/active/reprocess-pdfs-from-bucket.js --limit=1
```

### **Step 4: Full Historical Reimport** (30-60 minutes)
```bash
# Reprocess all PDFs to backfill granular data
node scripts/active/reprocess-pdfs-from-bucket.js --force

# Or process by date range
node scripts/active/reprocess-pdfs-from-bucket.js --since=2025-09-01 --force
```

### **Step 5: Verify Data Quality** (10 minutes)
```bash
# Check sample snapshots have new fields populated
node scripts/diagnostic/verify-granular-data.js

# Query BigQuery directly
bq query --use_legacy_sql=false "
  SELECT
    performance_code,
    snapshot_date,
    fixed_atp,
    non_fixed_atp,
    single_atp,
    overall_atp,
    fixed_revenue + non_fixed_revenue + single_revenue as calculated_total,
    total_revenue as reported_total
  FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
  WHERE snapshot_date >= '2025-10-01'
  LIMIT 10
"
```

### **Step 6: Update Dashboard** (20 minutes)
- Modify tooltips to show revenue breakdown
- Add ATP comparison visualizations
- Update data table to display granular metrics

---

## ✅ Success Criteria

- [ ] **Schema migration complete**: 14 new columns added to BigQuery table
- [ ] **Cloud Function deployed**: New PDFs capture all granular data
- [ ] **Reimport successful**: Historical PDFs reprocessed with new fields
- [ ] **Data validation**: ATP calculations match across all ticket types
- [ ] **Dashboard updated**: New analytics visible in tooltips and tables
- [ ] **No data loss**: `total_revenue` equals sum of revenue breakdown fields
- [ ] **Performance maintained**: No significant query slowdown

---

## 📊 Expected Outcomes

### **Analytics Unlocked:**
✅ Subscription vs single ticket revenue trends
✅ Package performance analysis
✅ ATP by ticket type (subscription, package, single)
✅ Revenue mix visualization
✅ Inventory tracking over time
✅ Comp ticket value analysis
✅ Time-of-day performance comparison (matinee vs evening)

### **Business Questions Answered:**
- "Are subscriptions generating higher ATP than single tickets?"
- "How has our revenue mix changed over the season?"
- "Which performances have the best package sales?"
- "What's the value of our comp tickets?"
- "How does available inventory trend before performances?"

---

## 🔄 Rollback Plan

If issues arise:

```bash
# Cloud Function: Revert to previous version
gcloud functions deploy symphony-pdf-webhook --revision=PREVIOUS_REVISION

# BigQuery: Schema changes are additive and backward compatible
# Old queries still work, new fields are NULL for old data

# Dashboard: Git revert
git revert <commit-hash>
```

---

## 📝 Files to Modify

1. ✅ `docs/SCHEMA-ENHANCEMENT-PLAN.md` (this file)
2. ⏳ `scripts/migrations/add-granular-revenue-fields.sql`
3. ⏳ `scripts/migrations/run-schema-migration.js`
4. ⏳ `cloud-functions/pdf-webhook/index.js`
5. ⏳ `scripts/active/reprocess-pdfs-from-bucket.js`
6. ⏳ `scripts/diagnostic/verify-granular-data.js` (new)
7. ⏳ `src/charts/sales-curve-chart.js`
8. ⏳ `src/charts/data-table.js`
9. ⏳ `netlify/functions/get-dashboard-data.js`

---

**Ready to proceed with implementation!** 🚀
