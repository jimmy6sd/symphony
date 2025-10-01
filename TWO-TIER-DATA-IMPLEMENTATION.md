# Two-Tier Data Architecture - Implementation Summary

**Completed:** January 2025
**Status:** ✅ Fully Implemented

---

## 🎯 Architecture Overview

The Symphony Dashboard now uses a **two-tier data architecture** that separates concerns:

1. **Manual Metadata** - Edited via admin UI, never overwritten by automation
2. **Automated Sales Data** - Updated daily via PDF webhook, never manually edited

---

## 📊 Database Schema

### Performances Table Columns

**Manual Metadata (Editable via Admin UI):**
- `performance_id` - Unique numeric ID
- `performance_code` - Performance code (e.g., "250903E") **PRIMARY KEY**
- `title` - Performance title
- `series` - Series category (Classical, Pops, Family, etc.)
- `performance_date` - Date of performance
- `venue` - Venue name (Helzberg Hall, etc.)
- `season` - Season identifier (e.g., "25-26")
- `capacity` - Maximum venue capacity
- `occupancy_goal` - Target occupancy percentage (e.g., 85)
- `budget_goal` - Revenue budget target

**Automated Sales Data (Updated via PDF Webhook):**
- `single_tickets_sold` - Count of single tickets sold
- `subscription_tickets_sold` - Count of subscription tickets sold
- `total_tickets_sold` - Sum of single + subscription tickets
- `total_revenue` - Total revenue generated
- `capacity_percent` - Percentage of capacity sold
- `budget_percent` - Percentage of budget achieved
- `has_sales_data` - Boolean flag indicating if sales data exists

**Audit Columns:**
- `last_pdf_import_date` - Timestamp of most recent PDF import
- `updated_at` - Timestamp of last update (any type)

### Weekly Sales Table (For Historical Tracking)

- `performance_code` - Links to performance
- `week_number` - Week number in tracking period
- `weeks_until_performance` - Countdown to performance
- `single_tickets_sold` - Single ticket count for this week
- `subscription_tickets_sold` - Subscription ticket count for this week
- `total_tickets_sold` - Total tickets for this week
- `total_revenue` - Revenue for this week
- `import_date` - When this data was imported
- `created_at` - Record creation timestamp

---

## 🔄 Data Flow

### Daily PDF Import Workflow

1. **Make.com Automation** triggers daily
2. **PDF Webhook** (`netlify/functions/pdf-webhook.js`) receives PDF
3. **PDF Parsing** extracts sales data (tickets, revenue, capacity)
4. **Database Update:**
   - If performance exists: **UPDATE only sales columns**
   - If performance new: **INSERT with placeholder metadata**
5. **`last_pdf_import_date`** timestamp recorded
6. Weekly sales progression stored in `weekly_sales` table

### Manual Metadata Edit Workflow

1. Admin navigates to `/admin-edit.html`
2. Selects performance to edit
3. Edits metadata fields (title, series, venue, etc.)
4. **Metadata Update Function** (`update-performance-metadata.js`) validates:
   - Only metadata fields can be updated
   - Sales fields are blocked
5. Database updated with new metadata
6. Sales data remains untouched

---

## 🛡️ Data Integrity Safeguards

### PDF Webhook Protection

**What it updates:**
```javascript
// ONLY these columns are updated by PDF webhook:
single_tickets_sold
subscription_tickets_sold
total_tickets_sold
total_revenue
capacity_percent
budget_percent
has_sales_data
last_pdf_import_date
updated_at
```

**What it NEVER touches:**
```javascript
// These columns are NEVER updated by PDF webhook:
title
series
performance_date
venue
season
capacity
occupancy_goal
budget_goal
```

### Admin UI Protection

**What it updates:**
```javascript
// ONLY these metadata fields can be edited:
title
series
performance_date
venue
season
capacity
occupancy_goal
budget_goal
```

**What it NEVER touches:**
```javascript
// These sales columns are READ-ONLY in admin UI:
single_tickets_sold
subscription_tickets_sold
total_tickets_sold
total_revenue
capacity_percent
budget_percent
has_sales_data
last_pdf_import_date (set by webhook only)
```

---

## 📁 Files Created/Modified

### New Files Created

1. **`scripts/add-pdf-tracking-column.js`**
   - Adds `last_pdf_import_date` column to performances table

2. **`scripts/create-weekly-sales-table.js`**
   - Creates `weekly_sales` table for historical tracking

3. **`admin-edit.html`**
   - Admin UI for editing performance metadata
   - Displays sales data as read-only

4. **`netlify/functions/update-performance-metadata.js`**
   - Backend function for updating metadata
   - Validates only metadata fields are edited
   - Blocks sales data updates

5. **`TWO-TIER-DATA-IMPLEMENTATION.md`** (this file)
   - Complete documentation of the architecture

### Modified Files

1. **`netlify/functions/pdf-webhook.js`**
   - Modified UPDATE query to only touch sales columns
   - Added `last_pdf_import_date` to INSERT and UPDATE
   - Added comments explaining data separation

2. **`netlify/functions/bigquery-data.js`**
   - Removed `occupancy_percent` from SELECT (column doesn't exist)
   - Added `last_pdf_import_date` to SELECT for admin UI display

---

## 🧪 Testing Checklist

### Database Schema Tests
- [x] `last_pdf_import_date` column added to performances table
- [x] `weekly_sales` table created with correct schema
- [x] BigQuery queries execute without errors

### PDF Webhook Tests
- [ ] Test PDF import with existing performance
  - Verify sales data updates
  - Verify metadata remains unchanged
  - Verify `last_pdf_import_date` updated
- [ ] Test PDF import with new performance
  - Verify new record inserted
  - Verify placeholder metadata created
  - Verify sales data populated

### Admin UI Tests
- [ ] Navigate to `/admin-edit.html`
- [ ] Verify performance list loads from BigQuery
- [ ] Open edit modal for a performance
- [ ] Verify sales data shows as read-only
- [ ] Edit metadata fields (title, series, venue)
- [ ] Save changes and verify update
- [ ] Verify sales data unchanged after save

### Integration Tests
- [ ] Edit metadata via admin UI
- [ ] Run PDF import for same performance
- [ ] Verify metadata preserved and sales updated
- [ ] Check `last_pdf_import_date` updated

### Dashboard Display Tests
- [ ] Verify dashboard loads with BigQuery data
- [ ] Check all charts render correctly
- [ ] Verify performance details show correct metadata
- [ ] Verify sales progression displays correctly

---

## 🚀 Deployment Notes

### Environment Variables Required

```bash
GOOGLE_CLOUD_PROJECT_ID=kcsymphony
GOOGLE_APPLICATION_CREDENTIALS=./symphony-bigquery-key.json
JWT_SECRET=[your-jwt-secret]
```

### Database Migration Commands

```bash
# Add PDF tracking column
export GOOGLE_APPLICATION_CREDENTIALS="./symphony-bigquery-key.json"
export GOOGLE_CLOUD_PROJECT_ID="kcsymphony"
node scripts/add-pdf-tracking-column.js

# Create weekly sales table
node scripts/create-weekly-sales-table.js
```

### Admin Access

- Navigate to: `http://localhost:8888/admin-edit.html` (dev)
- Or: `https://symphony.netlify.app/admin-edit.html` (production)
- Requires authentication (same login as dashboard)

---

## 📈 Benefits of This Architecture

### Data Integrity
- **No conflicts** between automated imports and manual edits
- **Audit trail** via `last_pdf_import_date` timestamp
- **Field-level control** prevents accidental overwrites

### Operational Efficiency
- **Daily automation** keeps sales data current
- **Manual control** allows correction of metadata errors
- **Clear separation** makes troubleshooting easier

### Scalability
- **Weekly sales table** enables historical analysis
- **Flexible metadata** can be enriched over time
- **Automated imports** scale to any number of performances

---

## 🔍 Troubleshooting

### Issue: PDF webhook overwrites metadata

**Check:**
1. Verify webhook UPDATE query only includes sales columns
2. Check logs for "Updated sales data for: [code]" message
3. Confirm `last_pdf_import_date` is being set

### Issue: Admin UI can't update performance

**Check:**
1. Verify JWT authentication is working
2. Check browser console for error messages
3. Confirm performance_code exists in database
4. Verify only allowed fields being updated

### Issue: Dashboard shows outdated data

**Check:**
1. Verify PDF webhook is running daily
2. Check `last_pdf_import_date` in database
3. Confirm BigQuery data is being fetched
4. Clear browser cache and reload

---

## ✅ Implementation Complete

All tasks completed successfully:

1. ✅ Fixed bigquery-data.js query (removed occupancy_percent)
2. ✅ Added last_pdf_import_date column to performances table
3. ✅ Created weekly_sales table in BigQuery
4. ✅ Updated PDF webhook to preserve manual metadata
5. ✅ Created admin UI for editing performance metadata
6. ⏳ Ready for end-to-end testing

**Next Step:** Test the complete workflow with a real PDF import and metadata edit.
