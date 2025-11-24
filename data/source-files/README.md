# Source Data Files

Original data files from Tessitura and internal tracking systems.

## Directory Structure

### pdfs/
Tessitura Performance Sales Summary PDFs exported from the ticketing system.
- **Purpose:** Historical record of performance sales data
- **Usage:** Can be re-imported to BigQuery using `scripts/active/process-pdf-bucket.js`
- **Format:** PDF reports with performance data tables

### excel/
Weekly sales reports and tracking spreadsheets from symphony staff.
- **Purpose:** Manual tracking and board reporting data
- **Usage:** Can be processed with `scripts/active/parse-csv-and-populate-metadata.js`
- **Format:** Excel workbooks (.xlsx) with performance data

### csv/
CSV exports from BigQuery and other data sources.
- **Purpose:** Data exports for analysis and migration
- **Usage:** Various scripts in `scripts/active/` directory
- **Format:** CSV files and XML exports

## Re-Processing Data
All source files can be re-imported to BigQuery if needed:

1. **PDFs:** `node scripts/active/process-pdf-bucket.js`
2. **Excel:** `node scripts/active/extract-bigquery-data.js`
3. **CSV:** `node scripts/active/parse-csv-and-populate-metadata.js`

See `scripts/active/README.md` for detailed script documentation.

## Data Flow
```
Source Files (pdfs/, excel/, csv/)
    ↓
Processing Scripts (scripts/active/)
    ↓
BigQuery Database
    ↓
Netlify Functions (/.netlify/functions/bigquery-snapshots)
    ↓
Dashboard (index.html)
```

## Notes
- Source files are preserved for historical reference and re-processing
- Dashboard NEVER reads these files directly at runtime
- All runtime data comes from BigQuery via API
