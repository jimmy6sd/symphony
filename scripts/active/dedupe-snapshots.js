// Remove duplicate performance_sales_snapshots created by re-running historical PDF
// reports (the webhook always INSERTs, so re-processing a day that already had a
// snapshot adds an identical copy). We keep ONE row per (performance_code,
// snapshot_date) among rows whose sales values are identical, deleting the rest.
// Rows that differ in any sales value for the same perf+date are left untouched.
//
// Safety: BigQuery time travel (7 days) can recover the table if needed.
// Usage: node scripts/active/dedupe-snapshots.js [--apply]

require('dotenv').config();
const path = require('path'), fs = require('fs');
const { BigQuery } = require('@google-cloud/bigquery');
const APPLY = process.argv.includes('--apply');

const ce = process.env.GOOGLE_APPLICATION_CREDENTIALS;
let c; if (ce && ce.startsWith('{')) c = JSON.parse(ce);
else c = JSON.parse(fs.readFileSync(path.resolve(ce || './symphony-bigquery-key.json'), 'utf8'));
if (c.private_key && c.private_key.includes('\\n')) c.private_key = c.private_key.replace(/\\n/g, '\n');
const bq = new BigQuery({ projectId: 'kcsymphony', credentials: { client_email: c.client_email, private_key: c.private_key }, location: 'US' });
const T = '`kcsymphony.symphony_dashboard.performance_sales_snapshots`';

// Identical-duplicate predicate: same perf + date + all core sales values, larger snapshot_id.
const DUP_EXISTS = `EXISTS (
  SELECT 1 FROM ${T} t2
  WHERE t2.performance_code = t.performance_code
    AND t2.snapshot_date = t.snapshot_date
    AND IFNULL(t2.single_tickets_sold,-1)   = IFNULL(t.single_tickets_sold,-1)
    AND IFNULL(t2.fixed_tickets_sold,-1)     = IFNULL(t.fixed_tickets_sold,-1)
    AND IFNULL(t2.non_fixed_tickets_sold,-1) = IFNULL(t.non_fixed_tickets_sold,-1)
    AND IFNULL(t2.total_tickets_sold,-1)     = IFNULL(t.total_tickets_sold,-1)
    AND IFNULL(t2.total_revenue,-1)          = IFNULL(t.total_revenue,-1)
    AND IFNULL(t2.capacity_percent,-1)       = IFNULL(t.capacity_percent,-1)
    AND IFNULL(t2.budget_percent,-1)         = IFNULL(t.budget_percent,-1)
    AND t2.snapshot_id < t.snapshot_id
)`;

const one = async (sql) => (await bq.query({ query: sql, location: 'US' }))[0][0];

(async () => {
  const before = Number((await one(`SELECT COUNT(*) total FROM ${T}`)).total);
  const toDelete = Number((await one(`SELECT COUNT(*) n FROM ${T} t WHERE ${DUP_EXISTS}`)).n);
  console.log('total snapshot rows:', before);
  console.log('identical-duplicate rows to delete:', toDelete);

  if (!APPLY) { console.log('\nDRY RUN — pass --apply to delete.'); return; }
  if (toDelete === 0) { console.log('Nothing to delete.'); return; }

  const [job] = await bq.createQueryJob({ query: `DELETE FROM ${T} t WHERE ${DUP_EXISTS}`, location: 'US' });
  await job.getQueryResults();

  const after = Number((await one(`SELECT COUNT(*) total FROM ${T}`)).total);
  const remaining = Number((await one(`SELECT COUNT(*) n FROM ${T} t WHERE ${DUP_EXISTS}`)).n);
  console.log(`\nDeleted ${before - after} rows. Now ${after} total, ${remaining} identical-dups remaining.`);
})().catch(e => console.error('ERROR:', e.message));
