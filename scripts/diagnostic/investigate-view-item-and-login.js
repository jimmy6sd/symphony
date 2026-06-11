require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');

const creds = JSON.parse(fs.readFileSync(path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS), 'utf8'));
const bq = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || creds.project_id,
  credentials: { client_email: creds.client_email, private_key: creds.private_key },
  location: 'US',
});

async function main() {
  // 1) view_item: raw hits, unique sessions, and first/last seen date (30 days)
  const [vi] = await bq.query({ query: `
    SELECT
      COUNT(*) AS raw_hits,
      COUNT(DISTINCT user_pseudo_id) AS users,
      COUNT(DISTINCT CONCAT(user_pseudo_id, CAST(COALESCE((SELECT value.int_value FROM UNNEST(event_params) WHERE key='ga_session_id'),0) AS STRING))) AS sessions,
      MIN(event_date) AS first_date,
      MAX(event_date) AS last_date
    FROM \`kcsymphony.analytics_445499663.events_*\`
    WHERE _TABLE_SUFFIX >= FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY))
      AND event_name = 'view_item'
  ` });
  console.log('\n=== view_item (last 30 days) ===');
  console.log(vi[0]);

  // 1b) view_item FIRST EVER seen across the whole export — is the tag new?
  const [viFirst] = await bq.query({ query: `
    SELECT MIN(event_date) AS first_ever, MAX(event_date) AS last_ever, COUNT(*) AS total_ever
    FROM \`kcsymphony.analytics_445499663.events_*\`
    WHERE event_name = 'view_item'
  ` });
  console.log('\n=== view_item (all time) ===');
  console.log(viFirst[0]);

  // 1c) daily view_item over last 45 days to see when it started ramping
  const [viDaily] = await bq.query({ query: `
    SELECT event_date, COUNT(*) AS hits
    FROM \`kcsymphony.analytics_445499663.events_*\`
    WHERE _TABLE_SUFFIX >= FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 45 DAY))
      AND event_name = 'view_item'
    GROUP BY event_date ORDER BY event_date
  ` });
  console.log('\n=== view_item daily (45 days) ===');
  viDaily.forEach(r => console.log(`  ${r.event_date}  ${r.hits}`));

  // 2) compare magnitudes of the funnel events (sanity — is 54 anomalous vs others?)
  const [mags] = await bq.query({ query: `
    SELECT event_name, COUNT(*) AS raw_hits,
      COUNT(DISTINCT CONCAT(user_pseudo_id, CAST(COALESCE((SELECT value.int_value FROM UNNEST(event_params) WHERE key='ga_session_id'),0) AS STRING))) AS sessions
    FROM \`kcsymphony.analytics_445499663.events_*\`
    WHERE _TABLE_SUFFIX >= FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY))
      AND event_name IN ('session_start','view_item','view_item_list','add_to_cart','begin_checkout','purchase')
    GROUP BY event_name ORDER BY raw_hits DESC
  ` });
  console.log('\n=== funnel event magnitudes (30 days) ===');
  mags.forEach(r => console.log(`  ${r.event_name.padEnd(16)} raw=${String(r.raw_hits).padStart(8)}  sessions=${String(r.sessions).padStart(8)}`));

  // 5) Look for ANY login / account / sign-in style event in GA4 (90 days, broad)
  const [logins] = await bq.query({ query: `
    SELECT event_name, COUNT(*) AS hits
    FROM \`kcsymphony.analytics_445499663.events_*\`
    WHERE _TABLE_SUFFIX >= FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY))
      AND (
        LOWER(event_name) LIKE '%login%' OR LOWER(event_name) LIKE '%log_in%' OR
        LOWER(event_name) LIKE '%sign%' OR LOWER(event_name) LIKE '%account%' OR
        LOWER(event_name) LIKE '%auth%' OR LOWER(event_name) LIKE '%register%'
      )
    GROUP BY event_name ORDER BY hits DESC
  ` });
  console.log('\n=== candidate login/account events (90 days) ===');
  if (!logins.length) console.log('  (none found)');
  logins.forEach(r => console.log(`  ${r.event_name.padEnd(28)} ${r.hits}`));

  // 5b) Full distinct event_name inventory (90 days) so nothing is missed
  const [allEvents] = await bq.query({ query: `
    SELECT event_name, COUNT(*) AS hits
    FROM \`kcsymphony.analytics_445499663.events_*\`
    WHERE _TABLE_SUFFIX >= FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY))
    GROUP BY event_name ORDER BY hits DESC
  ` });
  console.log('\n=== all event_names (90 days) ===');
  allEvents.forEach(r => console.log(`  ${r.event_name.padEnd(28)} ${r.hits}`));
}

main().catch(e => console.error('Error:', e.message));
