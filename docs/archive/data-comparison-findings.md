# Data Comparison Findings

## PDF Files vs BigQuery - Complete Analysis

### PDF File 1: `FY26 Performance Sales Summary_1124675.pdf`

**CS01 Appalachian Spring (10/10/2025):**
- Fixed Pkgs: 49 tickets / $33,243
- Non-Fixed Pkgs: 15 tickets / $1,101.60
- Single: 284 tickets / $15,897.70
- **Total: 50,242.30**

### PDF File 2: `FY26 Performance Sales Summary_1126300.pdf` (NEWER)

**CS01 Appalachian Spring (10/10/2025):**
- Fixed Pkgs: 480 tickets / $32,642
- Non-Fixed Pkgs: 17 tickets / $1,209.60
- Single: 340 tickets / $17,790.70
- **Total: $51,642.30**

### BigQuery Current Data:

**CS01 Appalachian Spring (10/10/2025):**
- Single: 485 tickets
- Subscription: 292 tickets
- **Total Revenue: $50,099.30**

---

## Key Findings

### 1. **PDFs are NOT in BigQuery**
The PDF data shows different numbers than BigQuery:
- PDF 2 (newer): 340 single, 497 subscription = 837 total
- BigQuery: 485 single, 292 subscription = 777 total
- **These are completely different snapshots!**

### 2. **PDF File Naming**
- `1124675` and `1126300` - These numbers don't obviously indicate dates
- Both PDFs cover same date range: 2025-07-01 to 2026-06-30
- Both have same 103 performance codes
- **But numbers are different** - suggests different report run dates

### 3. **BigQuery Data Source Unknown**
- Updated: Oct 1, 2025
- `last_pdf_import_date`: null (means NOT from PDF webhook)
- **Question**: Where did this data come from?
  - Manual import?
  - Different system?
  - Test data?

### 4. **Excel Data (Sep 17, 2025)**
**CS01 Appalachian Spring (10/10/2025):**
- Single: 227 tickets
- Subscription: 516 tickets
- Revenue: $47,640

**This is OLDER than both PDFs and BigQuery!**

---

## Data Timeline (Best Guess)

```
1. Sep 17, 2025  - Excel Export
   └─ CS01: 227 single, 516 sub, $47,640

2. Unknown Date  - PDF File 1 (1124675)
   └─ CS01: 284 single, 64 sub, $50,242

3. Oct 1, 2025   - BigQuery Import (source unknown)
   └─ CS01: 485 single, 292 sub, $50,099

4. Unknown Date  - PDF File 2 (1126300) [APPEARS NEWEST]
   └─ CS01: 340 single, 497 sub, $51,642
```

---

## The Truth: What Should You Do?

### Current State Problems:
1. ❌ BigQuery data is from unknown source
2. ❌ PDFs haven't been processed through webhook
3. ❌ Excel is oldest (Sep 17)
4. ❌ No clear "source of truth"

### Recommended Solution (No Shortcuts):

#### **Step 1: Process Fresh PDFs Through Webhook**
```bash
# This is the PROPER way to get PDF data into BigQuery
# Run webhook processing for the 2 PDF files
```

**What this does:**
- Extracts data from PDFs using your webhook logic
- Writes to BigQuery `performances` table
- Updates `last_pdf_import_date` to track source
- Creates proper audit trail

**Result:**
- BigQuery will have verified PDF data
- `last_pdf_import_date` will show when/how data arrived
- Clear lineage: PDF → Webhook → BigQuery → Dashboard

#### **Step 2: Get Fresh Excel Export**
```bash
# Export NEW Excel file from Tessitura
# Date it clearly: "KCS 25-26 Weekly Sales Report - Oct 2.xlsx"
# Run: npm run extract-excel
```

**What this does:**
- Gets current week projection/audience data
- Matches better with current performance dates
- Provides supplemental enrichment

#### **Step 3: Build Dashboard Data**
```bash
# Merge BigQuery (from PDFs) + Excel (supplemental)
npm run build-dashboard-data
```

**Result:**
- BigQuery as source of truth (from PDFs)
- Excel as supplemental (projections, audience)
- Proper data hierarchy maintained

---

## Questions to Answer First:

### Q1: Where did the Oct 1 BigQuery data come from?
**Possible answers:**
- A: Bulk import script (check `scripts/` folder)
- B: Manual CSV upload
- C: Test data generation
- D: Unknown

**Why it matters:**
- If it's good data → Keep it, just add PDF webhook for updates
- If it's test data → Replace with real PDF data
- If unknown → Start fresh with PDF webhook

### Q2: Which PDF file is most recent?
**Need to determine:**
- When was each PDF generated?
- File numbers 1124675 vs 1126300 - what do they mean?
- Check email timestamps if PDFs came via email

**Why it matters:**
- Only process the NEWEST PDF
- Older PDF would overwrite with stale data

### Q3: How often do PDFs arrive?
**Need to know:**
- Daily? Weekly? On-demand?
- Will they come via email webhook?
- Manual download required?

**Why it matters:**
- Affects automation strategy
- Determines refresh schedule

---

## My Recommendation (No Shortcuts Path):

### **Option A: If You Trust BigQuery Data (Oct 1)**
```bash
# 1. Use current BigQuery data as-is
# 2. Get fresh Excel export (Oct 2 or later)
# 3. Build dashboard with BigQuery + fresh Excel
npm run build-dashboard-data

# 4. Set up PDF webhook for FUTURE updates
# (Don't process old PDFs - BigQuery already has newer data)
```

**Pros:** Fast, uses existing data
**Cons:** Don't know where BigQuery data came from
**Risk:** Medium - assuming BigQuery data is good

### **Option B: Start Fresh with PDFs (Clean Slate)**
```bash
# 1. Clear BigQuery or mark as test data
# 2. Process PDF 1126300 (appears newest) through webhook
# 3. Verify data in BigQuery
# 4. Get fresh Excel export
# 5. Build dashboard
npm run build-dashboard-data
```

**Pros:** Clean lineage, know exactly where data came from
**Cons:** Takes longer, more work
**Risk:** Low - full data verification

### **Option C: Hybrid (Recommended)**
```bash
# 1. Process PDF 1126300 through webhook
#    (This will UPDATE BigQuery with PDF data)
# 2. Compare before/after to see differences
# 3. If PDF is newer → BigQuery updates
# 4. If BigQuery was newer → No changes
# 5. Get fresh Excel export
# 6. Build dashboard
npm run build-dashboard-data
```

**Pros:** Establishes PDF workflow, keeps good data
**Cons:** Requires PDF processing
**Risk:** Low - webhook updates only if newer

---

## Next Steps - Your Choice:

**Tell me:**
1. **Do you know where the Oct 1 BigQuery data came from?**
2. **Do you have access to email timestamps for the PDFs?**
3. **Can you export a fresh Excel file today (Oct 2)?**
4. **Which approach do you prefer: A, B, or C?**

Then I'll execute the proper no-shortcuts solution!
