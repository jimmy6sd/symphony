// Give the FY27 productions that have no series code in the report (films + specials)
// a real series + season so they categorize correctly everywhere.
//
// Background: the Performance Sales Summary only carries a series code (CS/PS/FS) for
// the subscription series. Films and one-off specials appear with just a title, so the
// backfill left them on a month-bucket series ("Series-NN") and season "26-27 Special".
// Month buckets are ambiguous (the same Series-NN is used by both 25-26 Classical and
// 26-27 specials), so they can't be mapped to a category in SERIES_MAP_SQL — we set a
// real category-bearing series here instead. This is preserved by the webhook (its UPDATE
// only overwrites "Series-NN"/placeholder values).
//
// Usage: node scripts/active/recategorize-fy27-specials.js [--apply]

require('dotenv').config();
const path = require('path'), fs = require('fs');
const { BigQuery } = require('@google-cloud/bigquery');
const APPLY = process.argv.includes('--apply');

// IMPORTANT: scope every write to FY27 dates — several titles (Christmas Festival,
// Handel's Messiah) also exist as FY26 productions and must not be touched.
const FY27_CUTOFF = '2026-07-01';

// title -> { series, season }
const FILMS = ['Interstellar', 'Skyfall in Concert', 'Harry Potter 3: Azkaban', 'The Polar Express', 'The Muppet Christmas Carol'];
const SPECIALS = ["Handel's Messiah", 'On Stage 01', 'On Stage 02', 'On Stage 03', 'On Stage 04',
  'Dr. Jekyll & Mr. Hyde', 'European Tour Send-Off', 'Cody Fry Christmas'];

const plan = [];
for (const t of FILMS) plan.push({ title: t, series: 'Film', season: '26-27 Film' });
for (const t of SPECIALS) plan.push({ title: t, series: 'Special Event', season: '26-27 Special' });
// Christmas Festival is a Family series (matches its FY26 categorization).
plan.push({ title: 'Christmas Festival', series: 'Christmas Festival', season: '26-27 Family' });

const ce = process.env.GOOGLE_APPLICATION_CREDENTIALS;
let c; if (ce && ce.startsWith('{')) c = JSON.parse(ce);
else c = JSON.parse(fs.readFileSync(path.resolve(ce || './symphony-bigquery-key.json'), 'utf8'));
if (c.private_key && c.private_key.includes('\\n')) c.private_key = c.private_key.replace(/\\n/g, '\n');
const bq = new BigQuery({ projectId: 'kcsymphony', credentials: { client_email: c.client_email, private_key: c.private_key }, location: 'US' });
const TABLE = '`kcsymphony.symphony_dashboard.performances`';
const esc = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

(async () => {
  // show current state
  const titles = plan.map(p => `'${esc(p.title)}'`).join(',');
  const [before] = await bq.query({ query:
    `SELECT title, COUNT(*) n, STRING_AGG(DISTINCT series) series, STRING_AGG(DISTINCT season) season
     FROM ${TABLE} WHERE title IN (${titles}) AND performance_date >= '${FY27_CUTOFF}' GROUP BY title ORDER BY title`, location: 'US' });
  console.log('Current state of the FY27 no-series-code productions:');
  before.forEach(r => console.log('  ', (r.title||'').padEnd(28), 'n='+r.n, '| series', r.series, '| season', r.season));

  if (!APPLY) { console.log('\nDRY RUN — pass --apply to write.'); return; }

  for (const p of plan) {
    await bq.query({ query:
      `UPDATE ${TABLE} SET series='${esc(p.series)}', season='${esc(p.season)}', updated_at=CURRENT_TIMESTAMP()
       WHERE title='${esc(p.title)}' AND performance_date >= '${FY27_CUTOFF}'`, location: 'US' });
  }
  const [after] = await bq.query({ query:
    `SELECT season, COUNT(DISTINCT title) productions, COUNT(*) perfs FROM ${TABLE}
     WHERE performance_date >= '2026-07-01' GROUP BY season ORDER BY season`, location: 'US' });
  console.log('\nApplied. FY27 season breakdown now:');
  after.forEach(r => console.log('  ', (r.season||'').padEnd(18), 'productions', Number(r.productions), '| perfs', Number(r.perfs)));
})().catch(e => console.error('ERROR:', e.message));
