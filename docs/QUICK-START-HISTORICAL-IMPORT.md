# Quick Start: Import Historical PDFs for Longitudinal Sales Tracking

**Goal:** Import a bucket of historical PDF reports to build day-by-day sales progression data.

---

## ✅ What's Ready

- **PDF Parser** - Extracts performance sales from Tessitura PDF reports
- **BigQuery Table** - `performance_sales_snapshots` already exists and working
- **Import Script** - `scripts/process-pdf-bucket.js` processes local/GCS PDFs
- **Test Script** - `scripts/test-pdf-import.js` validates PDFs without importing

---

## 🚀 Quick Start (3 Steps)

### Step 1: Organize Your PDFs

Put PDFs in a folder with **dates in filenames**:

```
pdfs/
├── FY26_Performance_Sales_Summary_2025-09-01.pdf
├── FY26_Performance_Sales_Summary_2025-09-08.pdf
├── FY26_Performance_Sales_Summary_2025-09-15.pdf
└── FY26_Performance_Sales_Summary_2025-10-20.pdf
```

**Important:** Include date in format `YYYY-MM-DD` so script can extract it.

### Step 2: Test (No BigQuery)

```bash
node scripts/test-pdf-import.js pdfs
```

Output:
```
📊 Testing PDF Import (No BigQuery)
═══════════════════════════════════

📁 Scanning directory: pdfs

Found 4 PDF files

📄 FY26_Performance_Sales_Summary_2025-09-01.pdf
   Date: 2025-09-01
   ✅ Parsed 118 performances
   Sample data:
     250902E: 1050 tickets, $130,000
     250903E: 1040 tickets, $128,500
     ...

═══════════════════════════════════
📈 SUMMARY
═══════════════════════════════════
Files processed: 4
Total snapshots: 472

Snapshots by date:
  2025-09-01: 118 performances
  2025-09-08: 118 performances
  2025-09-15: 118 performances
  2025-10-20: 118 performances

✅ Test complete!
```

### Step 3: Import to BigQuery

```bash
# Set credentials
export GOOGLE_APPLICATION_CREDENTIALS="./symphony-bigquery-key.json"

# Import
node scripts/process-pdf-bucket.js pdfs
```

Output:
```
📊 PDF Bucket Processor
═══════════════════════

📁 Processing local directory: pdfs
Found 4 PDF files

📄 Processing: FY26_Performance_Sales_Summary_2025-09-01.pdf (date: 2025-09-01)
   ✅ Parsed 118 performances

📄 Processing: FY26_Performance_Sales_Summary_2025-09-08.pdf (date: 2025-09-08)
   ✅ Parsed 118 performances

...

═══════════════════════
📈 PROCESSING SUMMARY
═══════════════════════
   PDFs processed: 4
   PDFs with errors: 0
   Total snapshots: 472

🚀 Inserting snapshots...
✅ Inserted 472 snapshots into BigQuery

✅ IMPORT COMPLETE!
   472 snapshots successfully imported

🎯 Next steps:
   1. Query snapshots: node scripts/check-snapshot-timeline.js
   2. Update modal to display historical progression
   3. Build sales curve visualizations
```

---

## 📊 Verify Import

Check the timeline:

```bash
node scripts/check-snapshot-timeline.js
```

Expected:
```
Found 4 snapshot date/source combinations:

  📅 2025-09-01:
     [historical_pdf_import] 118 performances

  📅 2025-09-08:
     [historical_pdf_import] 118 performances

  📅 2025-09-15:
     [historical_pdf_import] 118 performances

  📅 2025-10-20:
     [historical_pdf_import] 118 performances

✅ Found 118 performances with multiple snapshots:
  250902E: 4 dates (2025-09-01 to 2025-10-20)
  250903E: 4 dates (2025-09-01 to 2025-10-20)
  ...
```

---

## 🎨 Use in Dashboard

Query historical data via API:

```javascript
// Get progression for one performance
fetch('/netlify/functions/bigquery-snapshots?action=get-performance-history&performanceCode=250902E')
  .then(r => r.json())
  .then(history => {
    // history = [
    //   { snapshot_date: "2025-09-01", total_tickets_sold: 1050, ... },
    //   { snapshot_date: "2025-09-08", total_tickets_sold: 1100, ... },
    //   { snapshot_date: "2025-09-15", total_tickets_sold: 1120, ... },
    //   { snapshot_date: "2025-10-20", total_tickets_sold: 1160, ... }
    // ]

    renderTimelineChart(history);
  });
```

Display in modal:
- Line chart showing ticket sales growth over time
- Revenue progression
- Sales velocity (tickets per day)
- Comparison to similar performances

---

## 🔄 Import from GCS Bucket

If PDFs are already backed up to GCS:

```bash
# Import from GCS
node scripts/process-pdf-bucket.js gs://symphony-dashboard-pdfs/2025

# Import specific month
node scripts/process-pdf-bucket.js gs://symphony-dashboard-pdfs/2025/10
```

The script automatically:
- Lists all PDFs in bucket
- Downloads each PDF temporarily
- Extracts date from GCS path (e.g., `2025/10/`)
- Parses and imports

---

## 📋 Checklist

Before import:
- [ ] PDFs have dates in filenames (`YYYY-MM-DD`)
- [ ] Test with `test-pdf-import.js` first
- [ ] Set `GOOGLE_APPLICATION_CREDENTIALS` env variable
- [ ] Confirm no duplicate dates (will create duplicate snapshots)

After import:
- [ ] Run `check-snapshot-timeline.js` to verify
- [ ] Check snapshot counts match expected
- [ ] Query sample performance to see progression
- [ ] Update modal UI to display charts

---

## 🎯 What You Get

**Before import:**
- Only current snapshot per performance
- No historical progression data
- Can't see sales growth over time

**After import:**
- Multiple snapshots per performance (1 per PDF date)
- Complete historical progression
- Can analyze sales velocity, trends, patterns
- Rich modal displays with timeline charts

---

## 📞 Example Use Cases

### 1. See how sales progressed week-by-week

Query: Performance 250902E (Morgan Freeman show)
```
2025-09-01: 1,050 tickets ($130,000) - 80% capacity
2025-09-08: 1,100 tickets ($135,000) - 84% capacity
2025-09-15: 1,120 tickets ($137,168) - 86% capacity
2025-10-20: 1,160 tickets ($137,698) - 89% capacity  [Final]
```

Chart: Shows steady climb, strong early sales

### 2. Find underperforming shows early

Query: Find performances with declining sales between snapshots
```sql
-- Performances that lost tickets between snapshots
SELECT performance_code FROM...
WHERE current_tickets < previous_tickets
```

Alert: "Warning: CS03 Mahler lost 20 tickets this week"

### 3. Project final sales based on velocity

Calculate: Current tickets ÷ days since on sale = tickets/day
Project: tickets/day × days until show = estimated final

Display: "At current pace, will reach 95% capacity by show date"

---

## 🎓 Technical Details

**Snapshot ID format:** `{performanceCode}_{date}_pdf`
- Example: `250902E_2025-10-20_pdf`
- Prevents duplicates (primary key-like behavior)

**Source tracking:** `source = 'historical_pdf_import'`
- Distinguishes from webhook imports (`pdf_webhook`)
- Can filter queries by source

**Date extraction priority:**
1. Filename: `2025-10-20` in name
2. GCS path: `2025/10/` → `2025-10-01`
3. Timestamp: `2025-10-20T14-30-00`
4. Fallback: Current date (with warning)

---

**Ready to import?** Start with Step 1 above! 🚀
