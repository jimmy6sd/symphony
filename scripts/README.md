# Scripts Directory

Organized collection of data processing, migration, and diagnostic scripts for the Symphony Dashboard.

## Directory Structure

### active/
**Currently used scripts** for ongoing data pipeline operations.
- PDF processing and import to BigQuery
- CSV parsing and metadata updates
- BigQuery data extraction and queries
- Performance data verification

**Usage:** Run these scripts as part of normal operations.

### archive/
**Deprecated scripts** that are no longer actively used but kept for reference.
- Old migration scripts
- Legacy data cleanup utilities
- Superseded processing logic

**Status:** Historical reference only - not intended for production use.

### diagnostic/
**Debugging and analysis tools** for troubleshooting data issues.
- BigQuery table inspection
- Data quality audits
- Snapshot verification
- Performance checks

**Usage:** Run these when investigating data problems or performing audits.

### migrations/
**Database schema changes** and one-time migration scripts.
- BigQuery table creation
- Schema updates
- Data structure migrations

**Usage:** Run once per migration, then archive.

## Common Operations

### Import New PDF Report
```bash
node scripts/active/process-pdf-bucket.js
```

### Extract Data from BigQuery
```bash
node scripts/active/extract-bigquery-data.js
```

### Verify Data Quality
```bash
node scripts/diagnostic/verify-all-snapshots.js
```

### Check BigQuery Status
```bash
node scripts/diagnostic/check-bigquery-status.js
```

## Script Organization Guidelines

1. **Active scripts** = Currently in use, part of regular workflow
2. **Archive scripts** = Deprecated but kept for reference
3. **Diagnostic scripts** = Debugging and analysis tools
4. **Migration scripts** = One-time schema/data changes

When a script is no longer needed, move it from `active/` to `archive/` with a note about why it was deprecated.
