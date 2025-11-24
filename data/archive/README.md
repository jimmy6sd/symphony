# Archived Data Files

This directory contains historical data extractions and cache files that are no longer used at runtime.

## 2024-11-pre-cleanup/
Last cached data files before migrating to pure BigQuery architecture (November 2024).

**Contents:**
- `dashboard*.json` - Old runtime cache files
- `*-extracted.json` - Extraction artifacts from PDF/Excel/BigQuery processing
- `historical-*.json` - Old snapshot files
- `pdf-structure.json` - PDF parsing results

**Status:** NOT used by dashboard - kept for historical reference only

## Why Archived?
As of November 2024, the dashboard pulls ALL data directly from BigQuery via API calls. These files represent the old cached data approach that is no longer needed for runtime operation.

## When to Reference
- Debugging historical data issues
- Understanding old data pipeline
- Comparing data consistency over time
- Recovery scenarios (if needed)
