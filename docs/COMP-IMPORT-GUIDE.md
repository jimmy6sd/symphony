# Comp Import Guide

Quick guide for importing updated comp data from Excel spreadsheets.

---

## Quick Start (30 seconds)

1. Place your new Excel file in the project root: `C:\dev\sym\`
2. Run this command:

```bash
npm run import-comps "Your Comp File Name.xlsx"
```

That's it! The script will:
- Convert Excel to CSV automatically
- Clear existing comps from BigQuery
- Import all new comp data with metadata (ATP, subs, capacity, etc.)

---

## What the Import Does

| Step | Action |
|------|--------|
| 1 | Converts `.xlsx` to CSV |
| 2 | Clears all existing comp data from BigQuery |
| 3 | Reads default values (Global Default, Piazza Default) |
| 4 | Imports each performance's comp data |
| 5 | Sets first comp per performance as "target" |
| 6 | Imports metadata: comp_date, ATP, subs, capacity, occupancy_percent |

---

## Expected Excel Format

The Excel file should have this structure:

| Column | Content |
|--------|---------|
| A | Tess Performance Code (e.g., 251101E) |
| B | Target flag (y or empty) |
| C | Performance Description |
| D | Comp Description |
| E | Comp Date |
| F-Q | Weeks 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, Final |
| R | Subs |
| S | Capacity |
| T | Total OCC % |
| U | ATP |

**Important rows:**
- Row 13: Global Default values
- Row 14: Piazza Default values
- Row 15+: Performance data

---

## Troubleshooting

### "No numeric data" warnings
This means the performance has no week-by-week sales numbers yet. The comp will be skipped until data is added.

### Piazza performances skipped
Piazza Friday performances reference "Piazza Default" - they use row 14's values automatically.

### Duplicate comps
If a performance has multiple comp rows in the spreadsheet, the first one becomes the "target" (shown as solid line), others are secondary (dashed lines).

---

## Manual Import (Alternative)

If the npm script doesn't work, run these steps manually:

```bash
# 1. Convert Excel to CSV
node -e "
const XLSX = require('xlsx');
const fs = require('fs');
const wb = XLSX.readFile('YOUR_FILE.xlsx');
const csv = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
fs.writeFileSync('Comps for 25-26 Performances(Sheet1).csv', csv);
"

# 2. Run import with clear flag
node scripts/active/import-historical-comps-v2.js --clear
```

---

## Files Involved

| File | Purpose |
|------|---------|
| `scripts/active/import-historical-comps-v2.js` | Main import script |
| `Comps for 25-26 Performances(Sheet1).csv` | Generated CSV (temporary) |
| BigQuery table: `performance_sales_comparisons` | Where data is stored |

---

## After Import

- Data is immediately available in the dashboard
- No deployment needed (data is in BigQuery)
- Clear browser cache if old comps still appear

---

Last updated: December 2024
