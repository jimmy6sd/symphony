# PDF Reprocessing Guide

## Overview

The `reprocess-pdfs-from-bucket.js` script reprocesses historical PDFs from Google Cloud Storage to create backdated sales snapshots. This is useful when:

- New performances are added and need historical sales data
- You want to rebuild the entire snapshot history
- Data corrections are needed

## Key Features

✅ **Idempotent** - Safe to run multiple times (uses MERGE, no duplicates)
✅ **Smart** - Only processes performances that exist in database
✅ **Efficient** - Uses database-level deduplication (no pre-checking queries)
✅ **Safe** - Dry-run mode to preview changes

## Usage

### Basic Commands

```bash
# Test run (see what would happen, no changes)
node scripts/active/reprocess-pdfs-from-bucket.js --dry-run

# Reprocess all PDFs
node scripts/active/reprocess-pdfs-from-bucket.js

# Reprocess PDFs since a specific date
node scripts/active/reprocess-pdfs-from-bucket.js --since=2025-10-01

# Reprocess only for a specific performance
node scripts/active/reprocess-pdfs-from-bucket.js --performance=251011A

# Test with first 5 PDFs only
node scripts/active/reprocess-pdfs-from-bucket.js --limit=5 --dry-run
```

## Options

| Option | Description | Example |
|--------|-------------|---------|
| `--dry-run` | Preview changes without modifying database | `--dry-run` |
| `--since=DATE` | Only process PDFs since date | `--since=2025-10-01` |
| `--performance=CODE` | Only process specific performance | `--performance=251011A` |
| `--limit=N` | Process only first N PDFs | `--limit=10` |
| `--force` | Reprocess even if snapshots exist (rarely needed) | `--force` |

## How It Works

### 1. Fetches PDFs from Cloud Storage
```
gs://symphony-dashboard-pdfs/
├── 2025/10/... (41 PDFs)
└── 2025/11/... (4 PDFs)
```

### 2. Extracts Snapshot Date
- From GCS upload timestamp
- Or from filename if available

### 3. Parses PDF Data
Same parsing logic as live webhook:
- Performance codes
- Tickets sold (single + subscription)
- Revenue
- Capacity %

### 4. Upserts to Database
Uses BigQuery MERGE statement:
- **If snapshot exists**: Updates with new values
- **If snapshot doesn't exist**: Inserts new row
- **No duplicates ever created**

### 5. Only Processes Valid Data
- Skips performances not in database
- Skips PDFs with no data to process
- Logs everything for transparency

## Typical Workflow

### Scenario: New Performance Added

```bash
# 1. First, edit the performance metadata in admin console
#    (Give it proper title, venue, capacity, etc.)

# 2. Test the reprocessing
node scripts/active/reprocess-pdfs-from-bucket.js \
  --performance=251011A \
  --dry-run

# 3. If it looks good, run for real
node scripts/active/reprocess-pdfs-from-bucket.js \
  --performance=251011A

# 4. Verify snapshots were created
# Check in BigQuery or admin console
```

## Output Example

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 PDF Reprocessing from Cloud Storage
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 Initializing BigQuery and Cloud Storage clients...
📂 Fetching PDFs from gs://symphony-dashboard-pdfs/...
✅ Found 45 PDF files

🔍 Checking existing performances in database...
✅ Found 126 performances in database

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1/45] Processing: FY26 Performance Sales Summary_1124633.pdf
    📅 Snapshot Date: 2025-10-01
    📄 Downloading and parsing PDF...
    ✅ Parsed 58 performances
    ⏭️  Skipped 8 (not in DB)
    💾 Upserted 50 snapshots (inserts + updates)

[2/45] Processing: FY26 Performance Sales Summary_1124675.pdf
    📅 Snapshot Date: 2025-10-02
    📄 Downloading and parsing PDF...
    ✅ Parsed 58 performances
    💾 Upserted 58 snapshots (inserts + updates)

...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Reprocessing Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 PDFs Processed:     45/45
⏭️  PDFs Skipped:       0
💾 Snapshots Created:  2,610
❌ Errors:             0

✅ Done!
```

## Safety Features

### 1. Idempotent MERGE
```sql
-- If snapshot exists for (performance_code, snapshot_date):
--   → UPDATE with new values
-- If snapshot doesn't exist:
--   → INSERT new row
-- Result: Never creates duplicates, always safe to rerun
```

### 2. Database Validation
- Only processes performances that exist in `performances` table
- Skips unknown performance codes
- Maps codes to IDs automatically

### 3. Dry Run Mode
- Shows exactly what would happen
- No database modifications
- Perfect for testing filters

## Troubleshooting

### "Skipped N (not in DB)"
**Cause:** Performance codes in PDF don't exist in database
**Fix:** Add performance metadata first using admin console

### "Error: Could not parse PDF"
**Cause:** PDF format changed or corrupted
**Fix:** Check PDF manually, may need parser update

### "0 snapshots to process"
**Cause:** All snapshots already exist (idempotent working!)
**Fix:** This is normal behavior, nothing to fix

## Advanced Usage

### Rebuild Entire History
```bash
# Clear existing snapshots first (DANGEROUS!)
# Only do this if you know what you're doing
bq query --project_id=kcsymphony "
  DELETE FROM symphony_dashboard.performance_sales_snapshots
  WHERE source = 'pdf_reprocess'
"

# Then reprocess all
node scripts/active/reprocess-pdfs-from-bucket.js
```

### Process Only Recent Data
```bash
# Last 7 days
node scripts/active/reprocess-pdfs-from-bucket.js \
  --since=$(date -d '7 days ago' +%Y-%m-%d)
```

### Batch Process Specific Performances
```bash
# Process multiple performances
for perf in 251011A 251011B 251011C; do
  node scripts/active/reprocess-pdfs-from-bucket.js \
    --performance=$perf
done
```

## Performance Notes

- Processing 45 PDFs takes ~2-5 minutes
- Each PDF contains ~50-60 performances
- Total: ~2,500-3,000 snapshots created
- BigQuery handles this easily with MERGE

## When to Use This Script

✅ **Good reasons:**
- New performance added, needs historical data
- Corrected metadata, want to update snapshots
- Initial setup of new environment

❌ **Bad reasons:**
- Just testing (use --dry-run instead)
- Already ran successfully (idempotent, but wastes resources)
- Trying to fix webhook issues (fix webhook instead)
