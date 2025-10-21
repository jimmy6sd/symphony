# Performance Metadata Management Workflow

## Overview

Performance data is split into two categories:
1. **Sales Data** (auto-updated from PDF) → `performance_sales_snapshots` table
2. **Metadata** (manually managed) → `performances` table

---

## Metadata vs Sales Data

### **Metadata (Editable)**
These fields are set once and can be edited by admins:

- `title` - Performance title
- `series` - Series classification (Classical, Pops, Family, etc.)
- `venue` - Venue name
- `season` - Season identifier
- `performance_date` - Concert date/time
- **`capacity`** ✅ - Venue seating capacity (fixed per performance)
- **`budget_goal`** ✅ - Revenue target (set by finance)
- **`occupancy_goal`** - Occupancy percentage target (typically 85%)

### **Sales Data (Auto-Updated from PDF)**
These fields come from daily PDF reports and are NOT editable:

- `single_tickets_sold` (Green column in PDF)
- `subscription_tickets_sold` (Yellow columns in PDF - Fixed + Non-Fixed)
- `total_revenue`
- `capacity_percent` (from report)
- `budget_percent` (from report)

---

## Workflow

### **Step 1: Initial Population**

When setting up a new season, populate metadata from your Weekly Sales Report:

```bash
# Option 1: Use the populate script (edit with your data first)
node scripts/populate-metadata-from-weekly-report.js

# Option 2: Use the API endpoint
curl -X PUT https://symphony.netlify.app/.netlify/functions/update-metadata \
  -H "Content-Type: application/json" \
  -d '{
    "performanceCode": "251010E",
    "updates": {
      "capacity": 1440,
      "budget_goal": 122000,
      "occupancy_goal": 85
    }
  }'
```

**Data Sources:**
- **Capacity** → Column AG in "Performances by Week" worksheet
- **Budget Goal** → Column M in "Performances by Week" worksheet

---

### **Step 2: PDF Auto-Updates (Daily)**

Every day when the PDF Performance Sales Report arrives:

1. PDF is processed by webhook
2. **Sales data** is extracted (green/yellow columns)
3. New snapshot is **inserted** into `performance_sales_snapshots`
4. ✅ **Metadata is NOT touched** (capacity, budget_goal unchanged)

```
PDF arrives
    ↓
Extract sales data only:
  - Single tickets (green)
  - Subscription tickets (yellow: fixed + non-fixed)
  - Total revenue
  - Budget % (from report)
  - Capacity % (from report)
    ↓
INSERT into snapshots table
(metadata stays unchanged)
```

---

### **Step 3: Manual Edits (As Needed)**

If you need to change capacity or budget_goal for a performance:

**Via API:**
```bash
curl -X PUT https://symphony.netlify.app/.netlify/functions/update-metadata \
  -H "Content-Type: application/json" \
  -d '{
    "performanceCode": "251010E",
    "updates": {
      "capacity": 1500,
      "budget_goal": 150000
    }
  }'
```

**Via Admin UI (future):**
- Click "Edit" on performance
- Update capacity or budget_goal
- Save changes
- ✅ Your edits override the defaults

---

## Key Principles

### **1. Metadata is Fixed (Unless You Change It)**

```
Initial setup:
  capacity = 1440 (from weekly report)
  budget_goal = $122,000 (from weekly report)

Daily PDF updates:
  capacity = 1440 (unchanged)
  budget_goal = $122,000 (unchanged)
  ✅ Sales data updated in snapshots

Manual edit:
  capacity = 1500 (you changed it)
  budget_goal = $150,000 (you changed it)
  ✅ Your changes persist

Future PDF updates:
  capacity = 1500 (still your value)
  budget_goal = $150,000 (still your value)
  ✅ Sales data continues updating in snapshots
```

### **2. Capacity is NOT Calculated**

❌ **Wrong:**
```javascript
capacity = fixed_count + non_fixed_count + single_count + avail_count
```

✅ **Correct:**
```javascript
// Capacity comes from database
capacity = performances.capacity  // Set manually, never from PDF
```

**Why?** The "Available" count in the PDF fluctuates based on:
- Holds (seats temporarily blocked)
- Comps (complimentary tickets)
- House seats
- Administrative blocks

True venue capacity is fixed and doesn't change.

### **3. Budget Goal is NOT Calculated**

❌ **Wrong:**
```javascript
budget_goal = total_revenue / (budget_percent / 100)
```

✅ **Correct:**
```javascript
// Budget goal comes from database
budget_goal = performances.budget_goal  // Set by finance, never from PDF
```

**Why?** Budget % in the PDF is calculated as: `(actual revenue / budget goal) * 100`

If we reverse-calculate budget_goal from the current revenue, it would change every day as sales accumulate. The goal should be fixed.

---

## Example Workflow

### **New Season Setup (September)**

```bash
# 1. Import performance list from Tessitura
node scripts/import-performances.js

# 2. Populate metadata from Weekly Sales Report
# Edit populate-metadata-from-weekly-report.js with your data
node scripts/populate-metadata-from-weekly-report.js

# Result:
# - 118 performances created
# - Each has capacity and budget_goal set
# - Ready for daily PDF updates
```

### **Daily Operations (October - June)**

```
PDF arrives via Make.com → Webhook → Snapshots created automatically

(No manual intervention needed)
```

### **Mid-Season Adjustments (As Needed)**

```bash
# Venue changed, update capacity
curl -X PUT https://symphony.netlify.app/.netlify/functions/update-metadata \
  -d '{"performanceCode": "251010E", "updates": {"capacity": 1800, "venue": "SY-Lyric Theatre"}}'

# Budget revised, update goal
curl -X PUT https://symphony.netlify.app/.netlify/functions/update-metadata \
  -d '{"performanceCode": "251010E", "updates": {"budget_goal": 175000}}'
```

---

## Data Integrity Checks

### **Validation Rules:**

1. **Capacity check:**
   ```sql
   -- Alert if tickets sold exceeds capacity
   SELECT performance_code, total_tickets_sold, capacity
   FROM performances p
   JOIN (SELECT performance_code, total_tickets_sold
         FROM performance_sales_snapshots
         WHERE snapshot_date = CURRENT_DATE()) s
     ON p.performance_code = s.performance_code
   WHERE s.total_tickets_sold > p.capacity
   ```

2. **Budget tracking:**
   ```sql
   -- Show budget achievement
   SELECT
     performance_code,
     total_revenue,
     budget_goal,
     (total_revenue / budget_goal * 100) as budget_percent
   FROM performances p
   JOIN latest_snapshots s ON p.performance_code = s.performance_code
   WHERE budget_goal > 0
   ORDER BY budget_percent DESC
   ```

---

## Troubleshooting

### **Q: Capacity seems wrong for a performance**

**A:** Check where it came from:
```sql
SELECT performance_code, capacity, updated_at
FROM performances
WHERE performance_code = '251010E'
```

If it's wrong, update it:
```bash
curl -X PUT .../update-metadata -d '{"performanceCode": "251010E", "updates": {"capacity": 1440}}'
```

### **Q: Budget goal doesn't match finance report**

**A:** Update it manually:
```bash
curl -X PUT .../update-metadata -d '{"performanceCode": "251010E", "updates": {"budget_goal": 150000}}'
```

### **Q: Can I update sales data manually?**

**A:** No. Sales data comes from PDF only. This ensures:
- Data integrity (single source of truth)
- Audit trail (every update tracked in snapshots)
- Historical accuracy (no manual overwrites)

If sales data is wrong, check the PDF or contact Tessitura support.

---

## Future Enhancements

### **Admin UI for Metadata Editing**

```
Dashboard → Performance List → Click "Edit" button

Modal appears:
  - Title: [editable]
  - Capacity: [editable]
  - Budget Goal: [editable]
  - Series: [dropdown]
  - Venue: [dropdown]

  [Sales data shown but greyed out - not editable]

Save button → Calls /update-metadata endpoint
```

### **Bulk Metadata Import**

```javascript
// Import from Excel/CSV
node scripts/bulk-import-metadata.js weekly-sales-report.xlsx

// Maps columns:
// - Column AG → capacity
// - Column M → budget_goal
// - Updates all performances at once
```

### **Metadata Change History**

```sql
-- Track who changed what and when
CREATE TABLE metadata_changes (
  change_id STRING,
  performance_code STRING,
  field_name STRING,
  old_value STRING,
  new_value STRING,
  changed_by STRING,
  changed_at TIMESTAMP
)
```

---

**Last Updated**: October 21, 2025
**Status**: Implemented and Tested
