# Quintile Analysis CSV Generator

## Overview
Generate CSV files replicating Danny's holiday analysis format for each of the 5 two-month "quintiles" of the symphony season, enabling year-over-year comparison with per-performance normalization.

## The 5 Quintiles (2-month chunks)
| # | Name | Calendar Months | Fiscal Months |
|---|------|-----------------|---------------|
| 1 | Sep-Oct | September-October | 3-4 |
| 2 | Nov-Dec (Holiday) | November-December | 5-6 |
| 3 | Jan-Feb | January-February | 7-8 |
| 4 | Mar-Apr | March-April | 9-10 |
| 5 | May-Jun | May-June | 11-12 |

## Target Output Format (matching Danny's CSV)

### Section 1: Raw Totals
| Column | Description |
|--------|-------------|
| FY | Fiscal year (FY23, FY24, etc.) |
| Reported Date | Snapshot date (MM/DD/YYYY) |
| Actual Revenue | Single ticket revenue to date |
| % to budget | Revenue / Budget |
| # Performances | Count for this quintile |
| Budget | Sum of performance budgets |
| Total Seats | Sum of capacity |
| Seats Sold | Total tickets sold |
| Capacity % | Seats Sold / Total Seats |
| ATP | Revenue / Seats Sold |
| Programming | Title list with counts |

### Section 2: Per-Performance Normalized
Same metrics divided by # Performances

### Section 3: % Difference vs FY24
Percentage change from FY24 baseline

---

## Tasks

### Phase 1: Data Exploration
- [x] Examine FY23 Excel format and identify columns
- [x] Examine FY24 Excel format and identify columns
- [x] Examine FY25 Excel format and identify columns
- [x] Examine FY26 Excel format and identify columns
- [x] Document column mappings for each year
- [x] Identify comparable snapshot dates across FYs

### Phase 2: Script Development
- [x] Create `scripts/active/generate-quintile-analysis.js`
- [x] Implement FY23/FY24 parser
- [x] Implement FY25 parser
- [x] Implement FY26 parser (Performances by Week format)
- [x] Add performance date → quintile assignment logic
- [x] Add aggregation by quintile logic
- [x] Add programming list generation (title counts)

### Phase 3: CSV Generation
- [x] Generate all quintile CSVs (sep-oct, nov-dec, jan-feb, mar-apr, may-jun)
- [ ] Validate against Danny's existing holiday CSV
- [x] Output to `data/quintile-analysis/` directory

### Phase 4: Verification & Cleanup
- [ ] Review all noted anomalies
- [ ] Resolve data holes (capacity data missing for FY23/FY26)
- [ ] Final validation of all quintile CSVs

---

## Anomalies Log
*Note any data issues encountered during extraction here:*

| Date Found | FY | Issue Description | Resolution |
|------------|----|--------------------|------------|
| | | | |

---

## Data Sources

### Primary: Excel Files in `/data/YTD-Comp-Data/`
The Excel files contain **per-performance data** with all needed fields:
- Performance name/title
- Performance date
- Budget (per performance)
- Revenue (single ticket actual)
- Tickets sold
- Capacity

**File format varies by year** - will document during Phase 1

### Data Holes Strategy
- Note anomalies in the log above as they're discovered
- Continue extraction, don't block on issues
- Resolve all anomalies in Phase 4 after extraction complete

---

## Snapshot Dates for Comparison
For apples-to-apples comparison across years:
- FY23: 2022.11.22 (from Danny's CSV)
- FY24: 2023.11.06 (from Danny's CSV)
- FY25: 2024.11.04 (from Danny's CSV)
- FY26: 2025.11.05 (from Danny's CSV)

---

## Files to Create

1. **`scripts/active/generate-quintile-analysis.js`** - Main extraction/generation script
2. **`data/quintile-analysis/`** - Output directory
   - `nov-dec-holiday.csv`
   - `sep-oct.csv`
   - `jan-feb.csv`
   - `mar-apr.csv`
   - `may-jun.csv`

---

## Column Mappings by Fiscal Year

### FY23/FY24 Format
First sheet, headers in row 4-5:
- Col 0: Series Code (CS1, PS1, etc.)
- Col 1: Title
- Col 3: Date (text like "Sept. 13-15")
- Col 5: Budget
- Col 6: Actual Revenue
- Col 7: TO GO
- Col 8: # Sold (tickets)

### FY25 Format
First sheet (named like "24 25"), headers in row 4:
- Col 0: Series Code
- Col 1: Title
- Col 3: DATE (text format)
- Col 5: BUDGET
- Col 6: ACTUAL (revenue)
- Col 8: # SOLD

### FY26 Format
"Performances by Week" sheet, headers in row 4:
- Col 3: Performance (title)
- Col 6: Performance Date(s) (Excel serial)
- Col 18: Actual Single Tickets Sold
- Col 24: Actual Revenue
- Col 25: BUDGET
