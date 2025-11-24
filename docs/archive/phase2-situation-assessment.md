# Phase 2: PDF History Builder - Situation Assessment

## Current State

### BigQuery Database Status
- **`performances` table**: ✅ Exists with 118 records
  - Contains performance metadata (title, series, date, venue, capacity)
  - **BUT**: All records have `has_sales_data: false`
  - No actual sales numbers populated yet

- **`weekly_sales` table**: ✅ Exists but **empty** (0 records)
  - This would hold week-by-week progression data
  - Currently no data ingested

### PDF Files Available
- ✅ `FY26 Performance Sales Summary_1124675.pdf`
- ✅ `FY26 Performance Sales Summary_1126300.pdf`
- These contain the actual sales data we need!

### Webhook System
- ✅ PDF webhook function exists and works (`netlify/functions/pdf-webhook.js`)
- ✅ Test results show successful processing
- ✅ Creates snapshots and logs pipeline executions
- **But**: Data hasn't been loaded into BigQuery yet

## The Situation

We have two paths forward:

### **Option A: Use Existing PDF Files Directly**
Extract data from the two PDF files in the root directory and use that as our "historical" data for now.

**Pros:**
- Immediate results
- We control the data
- Can test the full integration pipeline

**Cons:**
- Only 2 data points (2 weeks)
- Not a true multi-week history
- Manual process

### **Option B: Ingest PDFs via Webhook First**
Process the PDF files through the webhook system to populate BigQuery, then build the history extractor.

**Pros:**
- Uses the production data pipeline
- More realistic/sustainable approach
- Tests the webhook system

**Cons:**
- Extra step before we can merge data
- Requires webhook processing first

### **Option C: Hybrid Approach (RECOMMENDED)**
1. Build a PDF data extractor that works with **both**:
   - Local PDF files (for immediate testing)
   - BigQuery webhook data (for production)

2. This gives us:
   - Immediate progress with local PDFs
   - Future-proof design for webhook data
   - Flexibility during development

## Recommended Approach: Option C

### Phase 2A: Local PDF Extraction
**Build a script that:**
1. Reads the 2 PDF files in root directory
2. Extracts performance sales data
3. Outputs `pdf-history.json` with week-by-week data
4. Uses same structure as BigQuery will eventually have

### Phase 2B: BigQuery Integration (Future)
**When webhook data is available:**
1. Query BigQuery snapshots/sales data
2. Build timeline from database
3. Merge with local PDF data if needed

### Immediate Next Steps

1. **Extract data from the 2 PDF files**
   - Parse using existing PDF parsing logic
   - Structure as weekly snapshots
   - Output to `data/pdf-extracted.json`

2. **Create unified structure**
   - Make it compatible with both local PDFs and BigQuery
   - Document the schema clearly

3. **Proceed with Phase 3 merge**
   - Use Excel data + PDF extracted data
   - Build the unified dataset

## Questions for You

**Before I proceed, I need to know:**

1. **Do you want to process the 2 PDF files through the webhook first to populate BigQuery?**
   - Or should I just extract directly from the PDFs for now?

2. **Are more PDF files coming via the webhook in the future?**
   - Will this become a regular weekly data source?

3. **Is the goal to have this work with:**
   - A) Just these 2 PDFs (one-time integration)
   - B) Ongoing weekly PDFs (sustainable pipeline)

Based on your answers, I'll build the appropriate solution!

## My Recommendation

I suggest we:
1. **Extract the 2 PDFs directly** (quick win)
2. **Build the merge with Excel** (complete the integration)
3. **See the results** (validate the approach)
4. **Then** decide if we need BigQuery integration for ongoing updates

This gets us to a working product faster, and we can add BigQuery integration later if needed.

**Sound good?**
