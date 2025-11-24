# Comprehensive Audit: subscriptionTicketsSold Calculation Impact Analysis

## CRITICAL FINDING

The calculation of subscriptionTicketsSold is INCORRECT:
- CURRENT: subscriptionTicketsSold = fixedPackages.count + nonFixedPackages.count
- REQUIRED: subscriptionTicketsSold = fixedPackages.count ONLY

This affects 23 files across the codebase.

## FILES REQUIRING CHANGES

### 1. CRITICAL - MUST FIX

File: c:\dev\symphony\src\data-service.js
Lines: 38-41
Issue: Adds both fixedPackages AND nonFixedPackages to subscription count
Required Fix: Remove nonFixedPackages from calculation

Current:
  subscriptionTicketsSold: (perf.breakdown?.fixedPackages?.count || 0) +
                         (perf.breakdown?.nonFixedPackages?.count || 0) ||

Should be:
  subscriptionTicketsSold: (perf.breakdown?.fixedPackages?.count || 0) ||

### 2. DISPLAY COMPONENTS (AUTO-CORRECT ON DATA FIX)

c:\dev\symphony\src\charts\data-table.js
- Lines: 110, 120, 136-141
- Type: READ - calculates totals from singleTicketsSold + subscriptionTicketsSold
- Action: No code change needed

c:\dev\symphony\src\charts\ticket-type-chart.js
- Lines: 39-40, 48-57
- Type: READ - shows breakdown percentages
- Action: No code change needed, will show correct percentages after data fix

c:\dev\symphony\src\charts\performance-chart.js
- Type: READ
- Action: Verify usage

c:\dev\symphony\src\charts\sales-curve-chart.js
- Type: Logging/READ
- Action: No changes needed

### 3. BIGQUERY API FUNCTIONS (AUTO-CORRECT ON DATA FIX)

c:\dev\symphony\netlify\functions\bigquery-data.js
- Lines: 124-125 (SELECT), 176, 182 (mapping)
- Type: READ from database
- Action: No code changes needed

c:\dev\symphony\netlify\functions\bigquery-snapshots.js
- Type: READ from database
- Action: No code changes needed

c:\dev\symphony\netlify\functions\update-performance-metadata.js
- Lines: 56
- Type: WRITE PROTECTION - prevents manual editing of ticket sales
- Action: No changes needed

### 4. PDF PROCESSING (VERIFY DATA SOURCES)

c:\dev\symphony\netlify\functions\pdf-webhook.js
- Type: RECEIVE - calls pdf-data-processor
- Action: Verify PDF extraction separates single/subscription correctly

c:\dev\symphony\netlify\functions\pdf-data-processor.js
- Lines: 193-194
- Type: WRITE - processes PDF data
- Action: Verify source data format separates correctly

### 5. DATA TRANSFORMATION & IMPORT SCRIPTS

c:\dev\symphony\scripts\parse-weekly-sales-csv.js
- Lines: 133-139
- Type: WRITE - parses CSV weekly sales
- Action: Verify CSV category mapping (check if 'Exchange' should be subscription)

c:\dev\symphony\scripts\parse-ticket-sales-by-period.js
- Lines: 110-116
- Type: WRITE - parses transaction XML
- Status: Correct - only includes 'Subscription' category
- Action: No changes needed

c:\dev\symphony\scripts\extract-excel-data.js
- Lines: 7, 10
- Type: WRITE - reads from Excel columns
- Action: Verify Excel source column indices and contents

c:\dev\symphony\scripts\create-dashboard-data.js
- Lines: 7, 22
- Type: READ from BigQuery
- Action: No code changes needed

c:\dev\symphony\scripts\process-pdf-bucket.js
- Lines: 17-18, 35, 38
- Type: WRITE - batch PDF processing
- Action: Verify PDF extraction format

### 6. MIGRATION SCRIPTS (HISTORICAL)

c:\dev\symphony\scripts\migrate-to-bigquery.js
c:\dev\symphony\scripts\migrate-to-bigquery-bulk.js
c:\dev\symphony\scripts\rebuild-clean-database.js
- Action: Don't re-run unless re-migrating data

### 7. MANUAL UPDATE SCRIPTS

c:\dev\symphony\scripts\manual-update-from-pdf.js
- Type: WRITE - manual performance update
- Action: Ensure correct values calculated before running

c:\dev\symphony\scripts\fix-morgan-freeman.js
- Type: One-off manual fix
- Action: No changes needed

c:\dev\symphony\scripts\migrate-to-snapshots.js
- Type: WRITE - creates historical snapshots
- Action: Depends on source data accuracy

c:\dev\symphony\scripts\restore-from-snapshot.js
- Type: Data restoration
- Action: Only use for backup restoration

### 8. DATA SOURCE TRANSFORMER

c:\dev\symphony\src\data\transformers\kcs-transformer.js
- Lines: 52-53, 79-80
- Type: TRANSFORM - converts KCS CSV to dashboard format
- Status: Receives separate values from source
- Action: Verify source provides correct separation

### 9. ANALYSIS & QUERY SCRIPTS (READ-ONLY)

All of these auto-correct on data fix:
- c:\dev\symphony\scripts\bigquery-full-audit.js
- c:\dev\symphony\scripts\check-morgan-freeman.js
- c:\dev\symphony\scripts\check-bigquery-status.js
- c:\dev\symphony\scripts\check-top-gun.js
- c:\dev\symphony\scripts\check-latest-data.js
- c:\dev\symphony\scripts\check-performance-251010E.js
- c:\dev\symphony\scripts\check-webhook-data.js
- c:\dev\symphony\scripts\compare-pdf-with-dashboard.js

### 10. UTILITY & VALIDATION

c:\dev\symphony\src\utils\sales-projections.js
- Type: READ - calculates projections
- Action: No changes needed

c:\dev\symphony\src\utils\validators.js
- Type: VALIDATION
- Action: Review for any subscription-specific validation rules

c:\dev\symphony\src\components\dashboard-ui.js
- Type: DISPLAY
- Action: No changes needed

### 11. TEST SCRIPTS (NON-CRITICAL)

Multiple test scripts reference subscription data:
- test-bigquery-upload.js
- test-snapshot-insert-direct.js
- test-snapshot-queries.js
- test-pdf-webhook-dual-write.js
- test-metadata-update.js
- test-metadata-workflow.js
- test-pdf-import.js
- test-pdf-processor.js
- test-new-logic.js

Action: Update expected values after main fix

### 12. BIGQUERY SCHEMA (NO CHANGES)

c:\dev\symphony\docs\bigquery-schema.sql
- Lines: 22-23, 34
- Status: Schema is CORRECT - fields exist separately
- Issue: Data stored may be incorrect
- Action: Data fix via update, not schema change

## IMPACT SUMMARY

Total files with references: 23
Critical code changes needed: 1 file (data-service.js line 39)
Data fixes needed: BigQuery performances table
Verification needed: 4-5 data source files
Auto-corrects on fix: 18+ files

## EXECUTION STEPS

1. Fix src/data-service.js line 39 (remove nonFixedPackages)
2. Test with sample data to verify correct calculation
3. Run rebuild-clean-database.js with corrected data-service
4. Verify dashboard shows corrected values
5. Update all test scripts to match new expected values
6. Document data fix in change log

