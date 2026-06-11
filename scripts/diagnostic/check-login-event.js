require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');
const creds = JSON.parse(fs.readFileSync(path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS), 'utf8'));
const bq = new BigQuery({ projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || creds.project_id, credentials: { client_email: creds.client_email, private_key: creds.private_key }, location: 'US' });

async function q(label, query) {
  try { const [rows] = await bq.query({ query }); console.log('\n=== ' + label + ' ==='); rows.forEach(r => console.log(' ', JSON.stringify(r))); if (!rows.length) console.log('  (no rows)'); }
  catch (e) { console.log('\n=== ' + label + ' ===\n  ERROR: ' + e.message); }
}

(async () => {
  // 1) login in DAILY tables (what the funnel query reads), last 10 days, by date + stream
  await q('login in daily events_* (10d)', `
    SELECT event_date, stream_id, COUNT(*) AS hits
    FROM \`kcsymphony.analytics_445499663.events_*\`
    WHERE _TABLE_SUFFIX >= FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 10 DAY))
      AND event_name = 'login'
    GROUP BY event_date, stream_id ORDER BY event_date`);

  // 2) login in INTRADAY (today, not yet in daily tables / excluded by funnel suffix filter)
  await q('login in events_intraday_* (today)', `
    SELECT stream_id, COUNT(*) AS hits
    FROM \`kcsymphony.analytics_445499663.events_intraday_*\`
    WHERE event_name = 'login'
    GROUP BY stream_id`);

  // 3) all stream_ids in the property (30d) so we can match G-VN1MPLJ55F
  await q('stream_ids in property (30d)', `
    SELECT stream_id, COUNT(*) AS events, COUNT(DISTINCT event_name) AS distinct_events
    FROM \`kcsymphony.analytics_445499663.events_*\`
    WHERE _TABLE_SUFFIX >= FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY))
    GROUP BY stream_id ORDER BY events DESC`);

  // 4) does intraday even exist? list available login-bearing tables
  await q('intraday login by table', `
    SELECT _TABLE_SUFFIX AS tbl, COUNT(*) AS hits
    FROM \`kcsymphony.analytics_445499663.events_intraday_*\`
    WHERE event_name = 'login'
    GROUP BY tbl ORDER BY tbl`);
})();
