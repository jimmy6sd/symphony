// BigQuery health check + full manual backup
// READ-ONLY against BQ. Writes JSON files to data/bigquery-backup/<timestamp>/
//
// Usage: node scripts/diagnostic/bq-health-check-and-backup.js
//        node scripts/diagnostic/bq-health-check-and-backup.js --no-backup    (health check only)

const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'kcsymphony';
const DATASET_ID = 'symphony_dashboard';
const KEY_PATH = path.resolve(__dirname, '..', '..', 'symphony-bigquery-key.json');

const args = process.argv.slice(2);
const skipBackup = args.includes('--no-backup');

function fmtBytes(n) {
  if (!n) return '0 B';
  n = Number(n);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function fmtTime(ms) {
  if (!ms) return 'unknown';
  return new Date(parseInt(ms)).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

async function main() {
  const start = Date.now();
  console.log('═'.repeat(90));
  console.log(`BIGQUERY HEALTH CHECK${skipBackup ? '' : ' + BACKUP'}  —  ${PROJECT_ID}.${DATASET_ID}`);
  console.log('═'.repeat(90));

  const bigquery = new BigQuery({ projectId: PROJECT_ID, keyFilename: KEY_PATH });
  const dataset = bigquery.dataset(DATASET_ID);

  // 1. Confirm dataset exists
  const [dsExists] = await dataset.exists();
  if (!dsExists) {
    console.error(`❌ Dataset ${PROJECT_ID}.${DATASET_ID} does not exist`);
    process.exit(1);
  }

  // 2. Enumerate tables
  const [tables] = await dataset.getTables();
  console.log(`\nFound ${tables.length} table(s)/view(s) in dataset.\n`);

  // 3. Prepare backup dir
  let backupDir = null;
  if (!skipBackup) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    backupDir = path.resolve(__dirname, '..', '..', 'data', 'bigquery-backup', ts);
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`Backup target: ${backupDir}\n`);
  }

  // 4. Per-table: metadata + (optional) row dump
  const results = [];
  for (const table of tables) {
    const tableId = table.id;
    const result = { tableId, type: null, numRows: null, numBytes: null, lastModified: null, schemaCols: null, dumpedRows: null, dumpFile: null, error: null };

    try {
      const [metadata] = await table.getMetadata();
      result.type = metadata.type || 'TABLE';
      result.numRows = metadata.numRows ? Number(metadata.numRows) : 0;
      result.numBytes = metadata.numBytes ? Number(metadata.numBytes) : 0;
      result.lastModified = metadata.lastModifiedTime;
      result.schemaCols = metadata.schema?.fields?.length || 0;

      console.log('─'.repeat(90));
      console.log(`📋 ${tableId}  (${result.type})`);
      console.log(`   rows: ${result.numRows.toLocaleString()}   size: ${fmtBytes(result.numBytes)}   cols: ${result.schemaCols}   modified: ${fmtTime(result.lastModified)}`);
      if (metadata.streamingBuffer) {
        const sb = metadata.streamingBuffer;
        console.log(`   ⚠️  streaming buffer: ~${sb.estimatedRows || 0} rows, ~${fmtBytes(sb.estimatedBytes || 0)}, oldest entry ${fmtTime(sb.oldestEntryTime)}`);
      }

      if (!skipBackup) {
        // Dump full table via SELECT * (works for views too)
        const [rows] = await bigquery.query({
          query: `SELECT * FROM \`${PROJECT_ID}.${DATASET_ID}.${tableId}\``,
          location: 'US'
        });

        const file = path.join(backupDir, `${tableId}.json`);
        const payload = {
          table: tableId,
          project: PROJECT_ID,
          dataset: DATASET_ID,
          backedUpAt: new Date().toISOString(),
          rowCount: rows.length,
          schema: metadata.schema,
          rows
        };
        fs.writeFileSync(file, JSON.stringify(payload, null, 2));
        result.dumpedRows = rows.length;
        result.dumpFile = path.basename(file);
        const fileBytes = fs.statSync(file).size;
        console.log(`   ✅ dumped ${rows.length.toLocaleString()} rows → ${path.basename(file)} (${fmtBytes(fileBytes)})`);

        // Sanity check vs metadata.numRows (note: numRows may lag for streaming inserts)
        if (result.numRows && Math.abs(result.numRows - rows.length) > 0) {
          console.log(`   ⚠️  metadata.numRows=${result.numRows} but SELECT returned ${rows.length} (streaming buffer or stale metadata)`);
        }
      }
    } catch (err) {
      result.error = err.message;
      console.log(`   ❌ ERROR: ${err.message}`);
    }

    results.push(result);
  }

  // 5. Summary table
  console.log('\n' + '═'.repeat(90));
  console.log('SUMMARY');
  console.log('═'.repeat(90));
  console.log(pad('Table', 38) + pad('Rows', 12) + pad('Size', 14) + pad('Cols', 6) + pad('Status', 20));
  console.log('-'.repeat(90));
  let totalRows = 0;
  let totalBytes = 0;
  let errors = 0;
  for (const r of results) {
    const status = r.error ? `ERR: ${r.error.slice(0, 16)}` : (skipBackup ? 'ok' : `dumped ${r.dumpedRows}`);
    console.log(
      pad(r.tableId, 38) +
      pad((r.numRows || 0).toLocaleString(), 12) +
      pad(fmtBytes(r.numBytes), 14) +
      pad(r.schemaCols || 0, 6) +
      pad(status, 20)
    );
    if (r.numRows) totalRows += r.numRows;
    if (r.numBytes) totalBytes += r.numBytes;
    if (r.error) errors++;
  }
  console.log('-'.repeat(90));
  console.log(pad(`TOTAL (${results.length} tables)`, 38) + pad(totalRows.toLocaleString(), 12) + pad(fmtBytes(totalBytes), 14));

  if (!skipBackup && backupDir) {
    // Write a manifest
    const manifest = {
      backedUpAt: new Date().toISOString(),
      project: PROJECT_ID,
      dataset: DATASET_ID,
      tableCount: results.length,
      totalRows,
      totalBytes,
      tables: results
    };
    fs.writeFileSync(path.join(backupDir, '_manifest.json'), JSON.stringify(manifest, null, 2));
    console.log(`\nManifest: ${path.join(backupDir, '_manifest.json')}`);
  }

  console.log(`\n${errors === 0 ? '✅' : '⚠️ '} Done in ${((Date.now() - start) / 1000).toFixed(1)}s${errors ? ` — ${errors} error(s)` : ''}`);
}

main().catch(err => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
