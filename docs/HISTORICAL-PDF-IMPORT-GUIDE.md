# Historical PDF Import Guide - Longitudinal Sales Tracking

**Created:** October 2025
**Purpose:** Import historical daily sales snapshots from PDF bucket to build time-series data

---

## 🎯 Overview

This guide shows you how to take a **bucket of historical PDF sales reports** and import them into BigQuery to create **longitudinal sales tracking** - showing how sales progressed day-by-day for each performance.

---

## 📊 What You'll Get

After import, you'll have:
- **Daily snapshots** of sales data for each performance
- **Historical progression** showing ticket sales growth over time
- **Sales velocity** analysis (how fast tickets are selling)
- **Rich modal views** with timeline charts in the dashboard

---

## 🗂️ Current Database Schema

The `performance_sales_snapshots` table already exists with this structure:

```sql
CREATE TABLE symphony_data.performance_sales_snapshots (
  snapshot_id STRING,                    -- Unique: performanceCode_date_source
  performance_id INT64,                  -- Links to performances table
  performance_code STRING,               -- e.g., "250902E"
  snapshot_date DATE,                    -- Date of this snapshot
  single_tickets_sold INT64,             -- Single ticket count
  subscription_tickets_sold INT64,       -- Subscription count
  total_tickets_sold INT64,              -- Total tickets
  total_revenue FLOAT64,                 -- Revenue
  capacity_percent FLOAT64,              -- Occupancy %
  budget_percent FLOAT64,                -- Budget achievement %
  source STRING,                         -- 'historical_pdf_import', 'pdf_webhook', etc.
  source_filename STRING,                -- Original PDF filename
  created_at TIMESTAMP                   -- When snapshot was inserted
)
PARTITION BY snapshot_date
CLUSTER BY performance_code, snapshot_date
```

---

## 📁 Step 1: Organize Your PDFs

### Option A: Local Directory

Create a folder with your PDFs:

```
pdfs/
├── FY26_Performance_Sales_Summary_2025-09-01.pdf
├── FY26_Performance_Sales_Summary_2025-09-08.pdf
├── FY26_Performance_Sales_Summary_2025-09-15.pdf
├── FY26_Performance_Sales_Summary_2025-09-22.pdf
└── ...
```

**Naming convention (important for date extraction):**
- Include date in filename: `YYYY-MM-DD` format
- Example: `performance_sales_2025-10-20.pdf`
- Or: `FY26_Performance_Sales_Summary_2025-10-20.pdf`

### Option B: Google Cloud Storage

Upload PDFs to GCS bucket (they're already being backed up there):

```
gs://symphony-dashboard-pdfs/
├── 2025/
│   ├── 09/
│   │   ├── performance_sales_2025-09-01_exec123.pdf
│   │   ├── performance_sales_2025-09-08_exec124.pdf
│   │   └── ...
│   └── 10/
│       ├── performance_sales_2025-10-01_exec125.pdf
│       └── ...
```

The script will extract dates from:
1. Filename date pattern: `2025-10-20`
2. GCS folder structure: `2025/10/` → defaults to `2025-10-01`
3. Timestamp in filename: `2025-10-20T14-30-00`

---

## 🚀 Step 2: Run the Import Script

### Import from Local Directory

```bash
# Set up environment
export GOOGLE_APPLICATION_CREDENTIALS="./symphony-bigquery-key.json"
export GOOGLE_CLOUD_PROJECT_ID="kcsymphony"

# Run import
node scripts/process-pdf-bucket.js ./pdfs
```

### Import from GCS Bucket

```bash
# Import all PDFs from a bucket path
node scripts/process-pdf-bucket.js gs://symphony-dashboard-pdfs/2025

# Import specific month
node scripts/process-pdf-bucket.js gs://symphony-dashboard-pdfs/2025/10
```

---

## 📈 Step 3: What the Script Does

The script will:

1. **Scan for PDFs** in the specified location
2. **Extract snapshot date** from filename or path
3. **Parse each PDF** to extract performance sales data
4. **Create snapshots** with format:
   ```javascript
   {
     snapshot_id: "250902E_2025-09-15_pdf",
     performance_code: "250902E",
     snapshot_date: "2025-09-15",
     single_tickets_sold: 1064,
     subscription_tickets_sold: 56,
     total_tickets_sold: 1120,
     total_revenue: 137168,
     capacity_percent: 86.0,
     budget_percent: 89.5,
     source: "historical_pdf_import",
     source_filename: "FY26_Performance_Sales_Summary_2025-09-15.pdf"
   }
   ```
5. **Insert into BigQuery** in batch

---

## 📊 Step 4: Verify Import

Check the snapshot timeline:

```bash
node scripts/check-snapshot-timeline.js
```

Expected output:
```
📅 Checking snapshot timeline...

Found 15 snapshot date/source combinations:

  📅 2025-09-01:
     [historical_pdf_import] 118 performances (118 snapshots)

  📅 2025-09-08:
     [historical_pdf_import] 118 performances (118 snapshots)

  📅 2025-09-15:
     [historical_pdf_import] 118 performances (118 snapshots)

  ...

✅ Found 118 performances with multiple snapshots:
  250902E: 15 dates (2025-09-01 to 2025-10-20)
  250903E: 15 dates (2025-09-01 to 2025-10-20)
  ...
```

---

## 🎨 Step 5: Update Modal to Show Historical Progression

### A. Query Historical Data

The API endpoint already supports historical queries:

```javascript
// Get all snapshots for a performance
GET /netlify/functions/bigquery-snapshots?action=get-performance-history&performanceCode=250902E

// Returns:
[
  {
    snapshot_date: "2025-09-01",
    total_tickets_sold: 1050,
    total_revenue: 130000,
    capacity_percent: 80.5
  },
  {
    snapshot_date: "2025-09-08",
    total_tickets_sold: 1100,
    total_revenue: 135000,
    capacity_percent: 84.2
  },
  {
    snapshot_date: "2025-09-15",
    total_tickets_sold: 1120,
    total_revenue: 137168,
    capacity_percent: 86.0
  }
]
```

### B. Enhance Modal UI

Update [src/charts/data-table.js](../src/charts/data-table.js) to show timeline:

```javascript
// When modal opens for a performance, fetch historical data
async function showPerformanceModal(performanceCode) {
  const history = await fetch(
    `/netlify/functions/bigquery-snapshots?action=get-performance-history&performanceCode=${performanceCode}`
  ).then(r => r.json());

  // Show timeline chart
  renderTimelineChart(history);

  // Show metrics
  renderSalesMetrics(history);
}

function renderTimelineChart(history) {
  // D3.js line chart showing:
  // - X axis: snapshot_date
  // - Y axis: total_tickets_sold
  // - Line showing progression over time
  // - Optional: second Y axis for revenue
}
```

---

## 📋 Example: Complete Import Flow

### Sample PDF Bucket Structure

```
gs://symphony-dashboard-pdfs/
├── 2025/
│   ├── 09/
│   │   ├── FY26_Performance_Sales_Summary_2025-09-01_exec101.pdf  ← Week 1
│   │   ├── FY26_Performance_Sales_Summary_2025-09-08_exec102.pdf  ← Week 2
│   │   ├── FY26_Performance_Sales_Summary_2025-09-15_exec103.pdf  ← Week 3
│   │   └── FY26_Performance_Sales_Summary_2025-09-22_exec104.pdf  ← Week 4
│   └── 10/
│       ├── FY26_Performance_Sales_Summary_2025-10-01_exec105.pdf  ← Week 5
│       └── FY26_Performance_Sales_Summary_2025-10-20_exec106.pdf  ← Week 8
```

### Run Import

```bash
node scripts/process-pdf-bucket.js gs://symphony-dashboard-pdfs/2025/09
```

### Output

```
================================================================================
📊 PDF Bucket Processor - Historical Sales Snapshot Importer
================================================================================

☁️  Processing GCS bucket: gs://symphony-dashboard-pdfs/2025/09

   Bucket: symphony-dashboard-pdfs
   Prefix: 2025/09

Found 4 PDF files in bucket

📄 Processing: 2025/09/FY26_Performance_Sales_Summary_2025-09-01_exec101.pdf (date: 2025-09-01)
   ✅ Parsed 118 performances

📄 Processing: 2025/09/FY26_Performance_Sales_Summary_2025-09-08_exec102.pdf (date: 2025-09-08)
   ✅ Parsed 118 performances

📄 Processing: 2025/09/FY26_Performance_Sales_Summary_2025-09-15_exec103.pdf (date: 2025-09-15)
   ✅ Parsed 118 performances

📄 Processing: 2025/09/FY26_Performance_Sales_Summary_2025-09-22_exec104.pdf (date: 2025-09-22)
   ✅ Parsed 118 performances

================================================================================
📈 PROCESSING SUMMARY
================================================================================
   PDFs processed successfully: 4
   PDFs with errors: 0
   Total snapshots extracted: 472

📅 Snapshots by date:
   2025-09-01: 118 performances
   2025-09-08: 118 performances
   2025-09-15: 118 performances
   2025-09-22: 118 performances

💾 Ready to insert snapshots into BigQuery
   Dataset: symphony_data
   Table: performance_sales_snapshots

🚀 Inserting snapshots...
✅ Inserted 472 snapshots into BigQuery

✅ IMPORT COMPLETE!
================================================================================
   472 snapshots successfully imported

🎯 Next steps:
   1. Query snapshots: node scripts/check-snapshot-timeline.js
   2. Update modal to display historical progression
   3. Build sales curve visualizations
```

---

## 🎯 Sales Progression Visualization

After import, you can show charts like:

### Daily Ticket Sales Progression
```
Tickets
1200 ┤                                        ●
1100 ┤                             ●──●──●───●
1000 ┤                    ●────●───●
 900 ┤          ●────●───●
 800 ┤    ●────●
 700 ┤●───●
     └─────────────────────────────────────────→
      9/1  9/8  9/15 9/22 9/29 10/6 10/13 10/20
```

### Revenue Growth Over Time
```
Revenue ($K)
$140K ┤                                   ●
$130K ┤                        ●──●──●───●
$120K ┤              ●────●───●
$110K ┤      ●──●───●
$100K ┤●────●
      └────────────────────────────────────→
       9/1  9/8  9/15 9/22 9/29 10/6 10/13
```

---

## 🔍 Querying Historical Data

### SQL Queries

**Get all snapshots for a performance:**
```sql
SELECT
  snapshot_date,
  total_tickets_sold,
  total_revenue,
  capacity_percent,
  source_filename
FROM symphony_data.performance_sales_snapshots
WHERE performance_code = '250902E'
ORDER BY snapshot_date ASC
```

**Calculate sales velocity (tickets per day):**
```sql
WITH daily_changes AS (
  SELECT
    performance_code,
    snapshot_date,
    total_tickets_sold,
    LAG(total_tickets_sold) OVER (PARTITION BY performance_code ORDER BY snapshot_date) as prev_tickets,
    DATE_DIFF(snapshot_date, LAG(snapshot_date) OVER (PARTITION BY performance_code ORDER BY snapshot_date), DAY) as days_between
  FROM symphony_data.performance_sales_snapshots
)
SELECT
  performance_code,
  snapshot_date,
  (total_tickets_sold - prev_tickets) / NULLIF(days_between, 0) as tickets_per_day
FROM daily_changes
WHERE prev_tickets IS NOT NULL
```

**Find performances with declining sales:**
```sql
WITH sales_trends AS (
  SELECT
    performance_code,
    snapshot_date,
    total_tickets_sold,
    LAG(total_tickets_sold) OVER (PARTITION BY performance_code ORDER BY snapshot_date) as prev_tickets
  FROM symphony_data.performance_sales_snapshots
)
SELECT DISTINCT performance_code
FROM sales_trends
WHERE total_tickets_sold < prev_tickets
```

---

## 🚨 Troubleshooting

### Issue: Date not extracted from filename

**Problem:** Script uses current date instead of PDF date

**Solution:** Rename PDFs to include date in format `YYYY-MM-DD`:
```bash
# Good filenames:
performance_sales_2025-10-20.pdf
FY26_Summary_2025-10-20.pdf
report-2025-10-20-morning.pdf

# Bad filenames (will use current date):
performance_sales_latest.pdf
report_monday.pdf
```

### Issue: Duplicate snapshots

**Problem:** Same performance/date combination imported twice

**Solution:** BigQuery will reject duplicates if `snapshot_id` is the same. Delete and re-import:
```sql
DELETE FROM symphony_data.performance_sales_snapshots
WHERE source = 'historical_pdf_import'
  AND snapshot_date = '2025-10-20'
```

### Issue: PDF parsing errors

**Problem:** Some PDFs fail to parse

**Solution:** Check PDF format matches expected structure. The script expects:
- Performance codes in format `25XXXXXY`
- Data columns: Budget %, Fixed, Non-Fixed, Single, Revenue, etc.
- Standard Tessitura PDF report format

---

## ✅ Validation Checklist

After import, verify:

- [ ] All PDFs processed successfully
- [ ] Snapshot dates match PDF dates
- [ ] Each performance has multiple snapshots (longitudinal data)
- [ ] Sales numbers are cumulative (increasing over time)
- [ ] No duplicate snapshot_ids
- [ ] Latest snapshot matches current dashboard data
- [ ] Modal displays historical progression chart

---

## 📞 Support

If you encounter issues:

1. Check the console output for specific error messages
2. Verify PDF format matches expected structure
3. Test with a single PDF first: `node scripts/parse-specific-pdf.js sample.pdf`
4. Check BigQuery table contents: `node scripts/check-snapshot-timeline.js`

---

**Next Steps:**
1. Organize your historical PDFs with dates in filenames
2. Run the import script on your PDF bucket
3. Verify data with `check-snapshot-timeline.js`
4. Update modal UI to display historical charts
5. Enjoy longitudinal sales tracking! 🎉
