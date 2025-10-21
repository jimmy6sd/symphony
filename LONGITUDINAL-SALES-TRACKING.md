# Longitudinal Sales Tracking System - Implementation Complete

## 🎉 Overview

The Symphony Dashboard now supports **longitudinal sales tracking** - every daily PDF import creates a new snapshot instead of overwriting data. This allows you to:

- Track how sales progress over time for each performance
- Build accurate sales curves from real historical data
- Import historical data without losing current data
- Analyze sales velocity and trends
- Never lose data again

---

## 📊 New Database Architecture

### **3 Core Tables**

#### **1. `performances`** - Performance Metadata (Editable)
**Purpose**: Master table for performance information (NOT sales data)

**Editable fields** (via `/update-metadata` endpoint):
- `title` - Performance title
- `series` - Series classification
- `venue` - Venue name
- `season` - Season name
- `performance_date` - Concert date
- **`capacity`** ✅ - Venue seating capacity
- **`budget_goal`** ✅ - Revenue target
- **`occupancy_goal`** ✅ - Occupancy percentage target

**Read-only fields** (populated from snapshots):
- Sales data comes from `performance_sales_snapshots` (latest snapshot)

---

#### **2. `performance_sales_snapshots`** - Daily Sales Snapshots (Append-Only)
**Purpose**: Historical record of sales data over time

**Schema**:
```sql
snapshot_id              STRING      -- Unique ID
performance_id           INT64       -- Links to performances
performance_code         STRING      -- Performance code
snapshot_date            DATE        -- Date of this snapshot
single_tickets_sold      INT64       -- Single ticket count
subscription_tickets_sold INT64      -- Subscription count
total_tickets_sold       INT64       -- Total count
total_revenue            FLOAT64     -- Total revenue
capacity_percent         FLOAT64     -- Occupancy %
budget_percent           FLOAT64     -- Budget achievement %
source                   STRING      -- 'pdf_webhook', 'historical_import', 'migration'
created_at               TIMESTAMP   -- When snapshot was created
```

**Partitioned by**: `snapshot_date` (for query performance)
**Clustered by**: `performance_code`, `snapshot_date`

---

#### **3. `weekly_sales`** - Weekly Sales Progression (Future)
Currently not populated. Will be computed from snapshots when needed.

---

## 🔄 Data Flow

### **Daily PDF Workflow (DUAL-WRITE)**

```
PDF arrives from Make.com
      ↓
pdf-webhook.js receives data
      ↓
Parse performance sales data
      ↓
┌─────────────────────────────────┐
│  DUAL-WRITE (Both systems)      │
├─────────────────────────────────┤
│                                 │
│  1. INSERT snapshot (NEW)       │  ← Longitudinal tracking
│     → performance_sales_snapshots │
│                                 │
│  2. UPDATE performance (OLD)    │  ← Backwards compatibility
│     → performances table        │
└─────────────────────────────────┘
      ↓
Dashboard queries latest snapshot
```

**Why dual-write?**
- **Snapshots**: Build historical record for trending
- **Performances**: Maintain backwards compatibility with existing dashboard

---

## 📡 New API Endpoints

### **1. GET `/netlify/functions/bigquery-snapshots`** - Snapshot-based queries

**Get performances with latest sales data:**
```
GET /bigquery-snapshots?action=get-performances&dateFrom=2025-01-01&limit=100
```

**Get full history for a performance:**
```
GET /bigquery-snapshots?action=get-performance-history&performanceCode=250902E
```

**Get sales progression over time:**
```
GET /bigquery-snapshots?action=get-sales-progression&performanceCode=250902E
```

---

### **2. PUT `/netlify/functions/update-metadata`** - Edit performance metadata

**Update budget and capacity:**
```javascript
PUT /update-metadata
{
  "performanceCode": "250902E",
  "updates": {
    "capacity": 1440,
    "budget_goal": 150000,
    "occupancy_goal": 90
  }
}
```

**Editable fields only:**
- `title`, `series`, `venue`, `season`, `performance_date`
- `capacity`, `budget_goal`, `occupancy_goal`

**NOT editable** (sales data comes from snapshots):
- `single_tickets_sold`, `subscription_tickets_sold`, `total_revenue`, etc.

---

## 🚀 Migration Summary

### **What We Built**

✅ **Phase 1**: Created `performance_sales_snapshots` table
✅ **Phase 2**: Migrated 77 existing performances as initial snapshots
✅ **Phase 3**: Built new snapshot-based API endpoint
✅ **Phase 4**: Created metadata-only update endpoint
✅ **Phase 5**: Modified PDF webhook for dual-write
✅ **Phase 6**: Tested dual-write successfully

### **Files Created**

**Scripts** (`scripts/`):
- `create-snapshots-table.js` - Create snapshots table
- `migrate-to-snapshots.js` - Migrate existing data
- `test-snapshot-queries.js` - Test snapshot queries
- `test-snapshot-api.js` - Test API endpoint
- `test-metadata-update.js` - Test metadata updates
- `test-snapshot-insert-direct.js` - Test dual-write

**Netlify Functions** (`netlify/functions/`):
- `bigquery-snapshots.js` - NEW snapshot-based data API
- `update-metadata.js` - NEW metadata editor
- `pdf-webhook.js` - MODIFIED for dual-write

---

## 📈 Current State

**Snapshots Table**:
- 77 performances with initial snapshots (dated 2025-10-21)
- Source: `migration`
- Ready to receive daily updates

**Dual-Write Status**:
- ✅ PDF webhook writes to BOTH tables
- ✅ Snapshots accumulate over time
- ✅ Performances table stays current
- ✅ Backwards compatible with existing dashboard

**Dashboard**:
- Currently uses old `bigquery-data.js` endpoint
- Can be switched to `bigquery-snapshots.js` anytime
- Both endpoints return same data format

---

## 🔮 Next Steps

### **When Historical Data Arrives**

1. **Import historical sales data** into snapshots table:
```javascript
// For each historical record:
INSERT INTO performance_sales_snapshots
(snapshot_id, performance_id, performance_code, snapshot_date,
 single_tickets_sold, subscription_tickets_sold, total_revenue,
 capacity_percent, budget_percent, source)
VALUES (..., 'historical_import')
```

2. **Build weekly sales curves** from snapshots:
- Query snapshots grouped by week
- Calculate cumulative progression
- Display in sales curve charts

3. **Switch dashboard** to snapshot-based queries:
- Update data service to call `bigquery-snapshots.js`
- Remove dependency on `bigquery-data.js`
- Test thoroughly

4. **Remove old UPDATE logic** (optional cleanup):
- Once confirmed snapshots work, can remove performance table updates
- Keep metadata-only in performances table

---

## 🎯 Benefits Achieved

✅ **Never lose data** - Every PDF creates a new snapshot
✅ **Historical trending** - See how sales progressed over weeks/months
✅ **Accurate sales curves** - Built from real snapshots, not estimates
✅ **Flexible analysis** - Query any date range, compare time periods
✅ **Editable metadata** - Budget/capacity changes don't affect sales history
✅ **Audit trail** - Know exactly when data changed and by how much
✅ **Historical data ready** - When export arrives, seamlessly integrates
✅ **Backwards compatible** - Existing dashboard still works

---

## 📝 Testing Performed

All tests passed ✅:

1. ✅ Snapshot table creation
2. ✅ Data migration (77 performances)
3. ✅ Snapshot queries match performance data exactly
4. ✅ Dashboard-style queries work correctly
5. ✅ Metadata updates work (budget/capacity editable)
6. ✅ Sales data updates blocked (security)
7. ✅ Dual-write creates snapshots + updates performances
8. ✅ Data matches between both tables

---

## 🛠️ Maintenance

**Daily Operations:**
- PDF arrives → Webhook auto-creates snapshot
- No manual intervention needed
- Snapshots accumulate automatically

**Querying Data:**
- Latest data: Query performances table OR latest snapshot
- Historical trends: Query snapshots over time
- Sales progression: Query snapshots grouped by week

**Editing Data:**
- Metadata: Use `/update-metadata` endpoint
- Sales data: Comes from PDF only (not editable)

---

## 🎓 Key Concepts

**Snapshot** = A point-in-time record of sales data for a performance

**Dual-Write** = Writing to both snapshots (new) and performances (old) for safety

**Longitudinal** = Tracking data over time (vs. just current state)

**Metadata** = Performance info (title, venue, capacity) - editable by admin

**Sales Data** = Ticket counts, revenue - comes from PDF, not editable

---

## 📞 Troubleshooting

**Q: How do I see all snapshots for a performance?**
```sql
SELECT * FROM performance_sales_snapshots
WHERE performance_code = '250902E'
ORDER BY snapshot_date ASC
```

**Q: How do I get the latest sales data?**
```sql
-- Option 1: From performances table
SELECT * FROM performances WHERE performance_code = '250902E'

-- Option 2: Latest snapshot
SELECT * FROM performance_sales_snapshots
WHERE performance_code = '250902E'
ORDER BY snapshot_date DESC
LIMIT 1
```

**Q: How do I update budget or capacity?**
```javascript
PUT /update-metadata
{
  "performanceCode": "250902E",
  "updates": { "budget_goal": 150000, "capacity": 1440 }
}
```

**Q: Can I edit sales data?**
No. Sales data comes from PDF imports only. This ensures data integrity.

---

**Implementation Date**: October 21, 2025
**Status**: ✅ Complete and Tested
**Branch**: `next`
