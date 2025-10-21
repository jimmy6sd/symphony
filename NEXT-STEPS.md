# Next Steps - Symphony Dashboard

## 🎯 Current Status (October 21, 2025)

**Branch**: `next`

**Completed:**
- ✅ Longitudinal sales tracking system (snapshots table)
- ✅ Metadata management system (capacity/budget editing)
- ✅ PDF parsing fixes (yellow=subscriptions, green=single)
- ✅ Dual-write webhook (snapshots + performances)
- ✅ All tests passing

**What Works:**
- PDF webhook creates daily snapshots
- Metadata (capacity, budget_goal) editable and persists
- Sales data automatically updates from PDFs
- Historical tracking enabled

---

## 📋 Immediate Next Steps

### **1. Populate Initial Metadata (HIGH PRIORITY)**

All 118 performances need capacity and budget_goal set from your Weekly Sales Report.

**Action Required:**
1. Open your Weekly Sales Report spreadsheet
2. Export "Performances by Week" worksheet as CSV/Excel
3. Edit `scripts/populate-metadata-from-weekly-report.js` with your data:

```javascript
const metadataUpdates = [
  {
    performance_code: '251010E',
    capacity: 1440,      // From Column AG
    budget_goal: 122000  // From Column M
  },
  {
    performance_code: '251011E',
    capacity: 1440,
    budget_goal: 132000
  }
  // ... add all 118 performances
];
```

4. Run the script:
```bash
export GOOGLE_APPLICATION_CREDENTIALS="./symphony-bigquery-key.json"
node scripts/populate-metadata-from-weekly-report.js
```

**Why:** Right now performances have default/calculated values. We need real capacity and budget_goal from your finance data.

**Columns to use:**
- Capacity → Column AG in "Performances by Week"
- Budget Goal → Column M in "Performances by Week"

---

### **2. Test with Real PDF (WHEN NEXT PDF ARRIVES)**

When the next daily Performance Sales Report PDF arrives from Make.com:

**Verify:**
1. ✅ Snapshot created in `performance_sales_snapshots` table
2. ✅ Sales data (single/subscription tickets) updated correctly
3. ✅ Capacity and budget_goal stayed unchanged
4. ✅ Yellow columns → subscriptions (Fixed + Non-Fixed)
5. ✅ Green column → single tickets

**Check with:**
```bash
export GOOGLE_APPLICATION_CREDENTIALS="./symphony-bigquery-key.json"
node scripts/check-latest-data.js  # See latest snapshot
```

**Expected behavior:**
- New row in snapshots table dated today
- Source = 'pdf_webhook'
- Single tickets should match green column
- Subscription tickets should match yellow columns (Fixed + Non-Fixed)

---

### **3. Update Dashboard to Use Snapshots (OPTIONAL)**

Right now dashboard uses old `bigquery-data.js` endpoint. New snapshot-based endpoint is ready but not connected.

**To switch:**
1. Update `js/data-service.js`:
```javascript
// OLD:
const response = await fetch('/.netlify/functions/bigquery-data?action=get-performances');

// NEW:
const response = await fetch('/.netlify/functions/bigquery-snapshots?action=get-performances');
```

2. Test locally:
```bash
npm run dev
# Open http://localhost:8888
# Verify all charts still work
```

3. Deploy when ready:
```bash
npm run deploy:preview  # Test on preview first
# If good, merge to main
```

**Benefits of switching:**
- Access to historical sales progression
- Better sales curve charts (real data over time)
- Can query any date range

**Safe approach:** Keep old endpoint for now, switch later when you want historical trending.

---

## 🔮 Future Enhancements

### **A. Historical Data Import**

When you get the historical sales export:

1. **Format:** Should have performance_code, date, tickets_sold, revenue
2. **Import script:**
```bash
node scripts/import-historical-data.js historical-export.csv
```

3. **What it does:**
   - Inserts old snapshots with source='historical_import'
   - Fills in weeks/months of sales progression
   - Builds accurate sales curves from real data

**Status:** Script ready to build when you have the data

---

### **B. Admin UI for Metadata Editing**

Add "Edit" buttons to dashboard performance list.

**Features:**
- Click performance → Modal opens
- Edit capacity, budget_goal, title, series, venue
- Sales data shown but greyed out (not editable)
- Save → Calls `/update-metadata` endpoint
- Changes persist through PDF updates

**Implementation:**
1. Add edit button to `src/components/dashboard-ui.js`
2. Create modal with form
3. Call update-metadata endpoint on save
4. Refresh table after update

**Status:** Backend ready, frontend needs work

---

### **C. Sales Progression Charts**

Show how sales changed over time for each performance.

**Query:**
```sql
SELECT snapshot_date, total_tickets_sold, total_revenue
FROM performance_sales_snapshots
WHERE performance_code = '251010E'
ORDER BY snapshot_date ASC
```

**Chart types:**
- Line chart: Tickets sold over time
- Area chart: Revenue accumulation
- Compare multiple performances
- Show actual vs target curve

**Use:** `bigquery-snapshots.js` endpoint (action=get-sales-progression)

**Status:** API ready, needs D3 chart component

---

### **D. Bulk Metadata Import from Excel**

Instead of editing populate script, import directly from Excel.

**Script:**
```bash
node scripts/bulk-import-metadata.js weekly-sales-report.xlsx
```

**Logic:**
- Read Excel file
- Find "Performances by Week" sheet
- Map columns: AG→capacity, M→budget_goal
- Update all performances in one batch

**Status:** Needs to be built (2-3 hours work)

---

### **E. Remove "vs Target Occ" Column**

You mentioned removing this from the dashboard table.

**Action:**
1. Open `js/charts/data-table.js`
2. Find column definition for "vs Target Occ"
3. Remove/comment out that column
4. Test table still works

**Status:** Simple change, 5 minutes

---

## 🛠️ Maintenance Tasks

### **Weekly: Verify PDF Updates**

Check that PDFs are creating snapshots:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="./symphony-bigquery-key.json"
node -e "
const { BigQuery } = require('@google-cloud/bigquery');
// Quick check for recent snapshots
const bq = new BigQuery({credentials: ...});
bq.query(\`
  SELECT snapshot_date, COUNT(*) as count
  FROM performance_sales_snapshots
  WHERE snapshot_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
  GROUP BY snapshot_date
  ORDER BY snapshot_date DESC
\`).then(([rows]) => console.table(rows));
"
```

**Expected:** One snapshot per performance per day

---

### **Monthly: Data Quality Check**

Verify data looks reasonable:

```sql
-- Check for anomalies
SELECT
  performance_code,
  snapshot_date,
  single_tickets_sold,
  subscription_tickets_sold,
  total_revenue
FROM performance_sales_snapshots
WHERE
  -- Single tickets decreased significantly
  (single_tickets_sold < LAG(single_tickets_sold) OVER (PARTITION BY performance_code ORDER BY snapshot_date) - 50)
  OR
  -- Subscriptions increased significantly (unusual)
  (subscription_tickets_sold > LAG(subscription_tickets_sold) OVER (PARTITION BY performance_code ORDER BY snapshot_date) + 50)
ORDER BY snapshot_date DESC
LIMIT 20
```

**Alert if:** Large unexpected changes (could be data error)

---

### **As Needed: Edit Metadata**

When capacity or budget changes for a performance:

```bash
curl -X PUT https://symphony.netlify.app/.netlify/functions/update-metadata \
  -H "Content-Type: application/json" \
  -d '{
    "performanceCode": "251010E",
    "updates": {
      "capacity": 1500,
      "budget_goal": 150000,
      "venue": "SY-Lyric Theatre"
    }
  }'
```

**Or via Postman:** Saved in `postman-examples/` (if created)

---

## 📚 Documentation Reference

All docs are in the repo root:

- **LONGITUDINAL-SALES-TRACKING.md** - Overall system architecture
- **PDF-PARSING-RULES.md** - How PDFs are parsed (yellow=sub, green=single)
- **METADATA-MANAGEMENT.md** - How to manage capacity/budget
- **BIGQUERY-DATA-STRATEGY.md** - Database design (may be outdated)
- **README.md** - Project overview
- **CLAUDE.md** - Development workflow and conventions

---

## 🚨 Known Issues / Edge Cases

### **1. Morgan Freeman Performance**

Was accidentally changed during testing. Fixed now.

**If it happens again:**
```bash
node scripts/fix-morgan-freeman.js
```

### **2. Subscription Tickets Decreasing**

**This is NORMAL!** Subscribers exchange tickets to other performances.

**Expected pattern:**
- Week 10: 600 subscriptions
- Week 6: 550 subscriptions ↓
- Week 2: 480 subscriptions ↓↓
- Performance day: 430 subscriptions

**Action:** No action needed, this is correct behavior

### **3. Capacity Seems Wrong**

**First, check where it came from:**
```sql
SELECT performance_code, capacity, updated_at
FROM performances
WHERE performance_code = 'XXXXX'
```

**If wrong, update it:**
```bash
curl -X PUT .../update-metadata \
  -d '{"performanceCode": "XXXXX", "updates": {"capacity": 1440}}'
```

### **4. Test Snapshots Lingering**

If test snapshots aren't cleaned up:

```sql
DELETE FROM performance_sales_snapshots
WHERE source LIKE 'test%'
```

---

## 🔐 Credentials & Access

**BigQuery:**
- Project: `kcsymphony`
- Dataset: `symphony_dashboard`
- Service Account Key: `symphony-bigquery-key.json` (local only, NOT in git)
- Netlify: Uses `GOOGLE_APPLICATION_CREDENTIALS_JSON` env var

**Netlify:**
- Site: `symphony.netlify.app`
- Branch deploys automatically from GitHub

**Make.com:**
- Webhook URL: `https://symphony.netlify.app/.netlify/functions/pdf-webhook`
- Triggered when PDF email arrives
- Sends parsed PDF data

---

## 📊 Database Tables Summary

### **performances** (Metadata - Editable)
- `performance_code` - Primary key
- `title`, `series`, `venue`, `season` - Event info
- `capacity` ✏️ - Editable (from Weekly Report Col AG)
- `budget_goal` ✏️ - Editable (from Weekly Report Col M)
- `occupancy_goal` ✏️ - Editable (default 85%)

### **performance_sales_snapshots** (Sales Data - Auto-Updated)
- `snapshot_id` - Primary key
- `performance_code` - Links to performances
- `snapshot_date` - Date of this data point
- `single_tickets_sold` - Green column from PDF
- `subscription_tickets_sold` - Yellow columns from PDF (Fixed + Non-Fixed)
- `total_revenue` - Total $ from PDF
- `source` - 'pdf_webhook', 'historical_import', 'migration'

### **weekly_sales** (Future - Computed from Snapshots)
- Currently empty
- Will be populated from snapshots grouped by week
- Powers sales curve charts

---

## 🎯 Success Metrics

**Short-term (Next 2 weeks):**
- [ ] All 118 performances have capacity and budget_goal populated
- [ ] Daily PDFs creating snapshots successfully
- [ ] No metadata overwriting issues
- [ ] Dashboard displaying correct data

**Medium-term (Next month):**
- [ ] Historical data imported (when available)
- [ ] Sales progression charts working
- [ ] Admin UI for metadata editing
- [ ] Remove "vs Target Occ" column

**Long-term (Next quarter):**
- [ ] Full season of longitudinal data collected
- [ ] Trend analysis and forecasting working
- [ ] Automated alerts for underperforming shows
- [ ] Comparative analytics across performances

---

## 🆘 Troubleshooting Commands

**Check recent snapshots:**
```bash
export GOOGLE_APPLICATION_CREDENTIALS="./symphony-bigquery-key.json"
node scripts/check-latest-data.js
```

**Verify metadata:**
```bash
node scripts/query-performances-table.js
```

**Test webhook locally:**
```bash
node scripts/test-pdf-webhook-dual-write.js
```

**Check for errors:**
```bash
# Netlify function logs
netlify logs

# Local server
npm run dev
```

---

## 📞 Questions to Resolve Later

1. **Historical data format?**
   - What columns will the export have?
   - How far back does it go?
   - Daily or weekly granularity?

2. **Dashboard priorities?**
   - Switch to snapshot endpoint now or later?
   - Which charts need historical data first?
   - Admin UI timeline?

3. **Metadata updates frequency?**
   - How often do capacity/budget_goal change?
   - Should there be an approval workflow?
   - Need change history tracking?

---

## 🚀 Quick Start (When Resuming)

```bash
# 1. Check current branch
git status
# Should be on 'next'

# 2. Check what's committed
git log --oneline -5

# 3. Review latest docs
cat NEXT-STEPS.md
cat LONGITUDINAL-SALES-TRACKING.md

# 4. Test current state
export GOOGLE_APPLICATION_CREDENTIALS="./symphony-bigquery-key.json"
node scripts/test-snapshot-queries.js

# 5. Continue from Step 1 (Populate Metadata) above
```

---

**Last Updated**: October 21, 2025
**Branch**: `next`
**Ready to merge**: After Step 1 (metadata population) and Step 2 (PDF test) complete

---

## 📝 Notes for Future Claude Sessions

**Key files to review:**
- This file (`NEXT-STEPS.md`)
- `LONGITUDINAL-SALES-TRACKING.md` - System architecture
- `PDF-PARSING-RULES.md` - PDF parsing details
- `METADATA-MANAGEMENT.md` - Workflow docs

**Critical context:**
- Yellow columns (Fixed + Non-Fixed) = Subscriptions
- Green column = Single tickets
- Capacity comes from database, not PDF
- Budget_goal comes from database, not PDF
- Subscriptions decrease over time (normal behavior!)
- Metadata edits persist through PDF updates

**Current state:**
- All infrastructure built and tested
- Needs metadata population (Step 1)
- Needs real PDF test (Step 2)
- Then ready to deploy

**Be careful not to:**
- Calculate capacity from PDF report
- Calculate budget_goal from PDF report
- Overwrite metadata during PDF processing
- Confuse subscription decreases with errors (they're normal!)
