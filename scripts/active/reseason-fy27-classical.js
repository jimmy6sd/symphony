// Reseason mislabeled next-season performances.
//
// Context: cloud-functions/pdf-webhook/index.js hardcodes season='25-26 Classical'
// for every auto-created performance. As a result, all FY27 (26-27 season)
// performances loaded so far sit in the performances table under
// season='25-26 Classical' with FY27 performance_dates (Aug 2026 -> Jun 2027).
// They are all classical (series = month-bucket Series-01..Series-12), so it is
// safe to move them to '26-27 Classical'. This permanently keeps them out of the
// FY26 YTD report (which filters season LIKE '25-26%') and scopes them as next season.
//
// The webhook's existing-performance UPDATE path does NOT write `season`, so this
// relabel persists across daily imports.
//
// Reversible: the affected rows are backed up to data/bigquery-backup/ before the
// UPDATE. Run with --apply to execute; without it, prints a dry run only.

require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');
const fs = require('fs');

const ce = process.env.GOOGLE_APPLICATION_CREDENTIALS;
let c;
if (ce && ce.startsWith('{')) c = JSON.parse(ce);
else c = JSON.parse(fs.readFileSync(path.resolve(ce || './symphony-bigquery-key.json'), 'utf8'));
if (c.private_key && c.private_key.includes('\\n')) c.private_key = c.private_key.replace(/\\n/g, '\n');

const bq = new BigQuery({ projectId: 'kcsymphony', credentials: { client_email: c.client_email, private_key: c.private_key }, location: 'US' });
const TABLE = '`kcsymphony.symphony_dashboard.performances`';
const FROM_SEASON = '25-26 Classical';
const TO_SEASON = '26-27 Classical';
const FY27_CUTOFF = '2026-07-01'; // FY26 ends 2026-06-30; anything on/after is FY27
const APPLY = process.argv.includes('--apply');

async function run() {
  const [rows] = await bq.query({
    query: `
    SELECT performance_id, performance_code, title, series, season, performance_date
    FROM ${TABLE}
    WHERE season = @from AND performance_date >= @cutoff
    ORDER BY performance_date`,
    params: { from: FROM_SEASON, cutoff: FY27_CUTOFF }, location: 'US' });

  console.log(`Matched ${rows.length} performances ('${FROM_SEASON}' dated >= ${FY27_CUTOFF}).`);
  console.log(`  date range: ${rows[0]?.performance_date?.value} -> ${rows[rows.length-1]?.performance_date?.value}`);

  if (rows.length === 0) { console.log('Nothing to do.'); return; }

  // Backup affected rows (id + old season) for trivial reversibility
  const backupDir = 'data/bigquery-backup';
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, 'reseason-fy27-classical-backup.json');
  fs.writeFileSync(backupPath, JSON.stringify(rows.map(r => ({
    performance_id: r.performance_id, performance_code: r.performance_code,
    old_season: r.season, performance_date: r.performance_date?.value
  })), null, 2));
  console.log(`Backed up ${rows.length} rows to ${backupPath}`);

  if (!APPLY) {
    console.log('\nDRY RUN — re-run with --apply to perform the UPDATE.');
    return;
  }

  const [job] = await bq.createQueryJob({
    query: `UPDATE ${TABLE} SET season = @to, updated_at = CURRENT_TIMESTAMP()
            WHERE season = @from AND performance_date >= @cutoff`,
    params: { to: TO_SEASON, from: FROM_SEASON, cutoff: FY27_CUTOFF },
    location: 'US'
  });
  await job.getQueryResults();
  const meta = job.metadata.statistics.query;
  console.log(`\nUPDATE complete. Rows affected: ${meta.dmlStats?.updatedRowCount || '(see console)'}`);

  const [after] = await bq.query({
    query: `
    SELECT season, COUNT(*) n FROM ${TABLE}
    WHERE performance_date >= @cutoff GROUP BY season ORDER BY season`,
    params: { cutoff: FY27_CUTOFF }, location: 'US' });
  console.log('\nSeasons now present for FY27-dated performances:');
  after.forEach(r => console.log('  ', (r.season || 'NULL').padEnd(20), Number(r.n)));
}
run().catch(e => console.error('ERROR:', e.message));
