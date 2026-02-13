# Complimentary Tickets Implementation Plan

**Created:** 2025-12-02
**Status:** In Progress

---

## Overview

Add complimentary ticket tracking to the Symphony Dashboard by:
1. Adding a `comp_tickets` column to BigQuery snapshots
2. Parsing "Performance Sales Summary by Price Type Category" (PTC) PDFs to extract comp data
3. Displaying comp tickets in the dashboard UI

---

## Data Source

**PDF Report:** "Performance Sales Summary by Price Type Category" (PTC)
- Different from standard PSS PDFs (which don't include comp breakdown)
- Contains per-performance: Package, Single, Discount, **Comp**, Other ticket counts
- Report filename pattern: `26 PSS by PT Category_*.pdf`

### PTC PDF Structure
```
Row 1: Perf Code | DateTime | Budget% | Available | %Cap
Row 2: "Ticket Price" | Package# | Package$ | Single# | Single$ | Discount# | Discount$ | Comp# | Other# | Other$ | Total$ | Reserved# | Reserved$
```

---

## Implementation Steps

### Phase 1: Schema Migration [DONE ✅ 2025-12-02]
- **File:** `scripts/migrations/add-comp-tickets-column.js`
- Adds `comp_tickets INT64` column to `performance_sales_snapshots`
- Run: `node scripts/migrations/add-comp-tickets-column.js`
- **Executed:** Column added successfully

### Phase 2: PDF Parser [DONE ✅]
- **File:** `scripts/active/process-ptc-pdf.js`
- Parses PTC PDFs and extracts comp ticket counts
- Updates LATEST snapshot for each performance
- Usage:
  ```bash
  node scripts/active/process-ptc-pdf.js ./path/to/pdf.pdf --dry-run
  node scripts/active/process-ptc-pdf.js ./path/to/pdf.pdf
  ```
- **Tested:** 2025-12-02 - Imported 78 performances with 5,229 comp tickets

### Phase 3: Dashboard Integration [DONE ✅ 2025-12-02]

**Goal:** Clean up ATP calculations and display comp count in modal.

**Problem:** Current ATP = `revenue / total_tickets` includes $0 comp tickets, dragging down the average.

**Solution:** Calculate ATP using paid tickets only: `revenue / (total_tickets - comp_tickets)`

#### 3.1 API Changes (`bigquery-snapshots.js`) [DONE ✅]
- [x] Add `comp_tickets` to snapshot SELECT query (line ~286)
- [x] Add `COALESCE(s.comp_tickets, 0) as comp_tickets` to outer SELECT (line ~265)
- [x] Add `compTickets: row.comp_tickets || 0` to frontend transformation (line ~347)

#### 3.2 ATP Calculation Fix [DONE ✅]
- [x] **Single ATP:** `singleRevenue / (singleTicketsSold - compTickets)` (line ~1350-1352)
- [x] **Blended ATP:** `totalRevenue / (totalTickets - compTickets)` (line ~1385-1387)
- [x] Handle edge case: if `paidTickets <= 0`, show "N/A"

#### 3.3 UI Display (`data-table.js`) [DONE ✅]
- [x] Add "Comp Tickets" line in Single Ticket Sales section (line ~1356)
- [x] Position: Between "Tickets Sold" and "Average Ticket Price"
- [x] Shows always (even if 0)

**Single Ticket Sales section will look like:**
```
Single Ticket Sales
  Tickets Sold:          1,234
  Comp Tickets:             45
  Average Ticket Price: $52.00  ← calculated as revenue/(1234-45)
```

**NOT doing:** Changing projections, occupancy calculations, or other equations.

### Phase 4: Automation [DONE ✅ 2025-12-02]

#### 4.1 Cloud Function Created
- [x] `cloud-functions/pdf-webhook-ptc/index.js` - PTC PDF webhook
- [x] `cloud-functions/pdf-webhook-ptc/package.json` - Dependencies
- Entry point: `ptcPdfWebhook`
- Accepts `pdf_base64` in POST body
- Updates `comp_tickets` on latest snapshots

#### 4.2 Deployment
```bash
cd cloud-functions/pdf-webhook-ptc
npm install
npm run deploy
```

#### 4.3 Make.com Configuration [TODO]
- [ ] Create new Make.com scenario for PTC PDFs
- [ ] Route emails with "Price Type Category" in subject to PTC webhook
- [ ] Or add filter to existing scenario to detect PDF type

---

## Key Decisions

### Why separate from standard PSS import?
- PTC PDFs have different structure than standard PSS PDFs
- Comp data updates existing snapshots rather than creating new ones
- Keeps existing pipeline intact, adds comp data as supplementary

### Comp tickets DO NOT affect:
- Total tickets sold calculations
- Occupancy percentages
- Sales projections
- Any existing equations

### Comp tickets ONLY affect:
- ATP calculations (exclude comps from denominator)
- Display in sales modal (show comp count)

---

## Files Created

| File | Purpose | Status |
|------|---------|--------|
| `scripts/migrations/add-comp-tickets-column.js` | Schema migration | Done |
| `scripts/active/process-ptc-pdf.js` | PTC PDF parser (manual) | Done |
| `scripts/diagnostic/verify-ticket-data.js` | Data verification | Done |
| `cloud-functions/pdf-webhook-ptc/index.js` | GCF for automated PTC import | Done |
| `cloud-functions/pdf-webhook-ptc/package.json` | GCF dependencies | Done |
| `docs/COMP-TICKETS-IMPLEMENTATION-PLAN.md` | This plan | Done |

---

## Next Actions

1. **Run the migration** to add column:
   ```bash
   node scripts/migrations/add-comp-tickets-column.js
   ```

2. **Test with a PTC PDF** (dry run first):
   ```bash
   node scripts/active/process-ptc-pdf.js ./data/source-files/pdfs/ptc-sample.pdf --dry-run
   ```

3. **Update dashboard API** to return comp_tickets

4. **Add UI display** for comp tickets

---

## Notes

- Comp tickets in PTC = "Comp#" column (8th data field after "Ticket Price")
- Zero comps are valid (many performances have 0 comps)
- Updates target LATEST snapshot date for each performance code
