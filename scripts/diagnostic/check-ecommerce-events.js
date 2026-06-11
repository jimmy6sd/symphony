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
  // 1) Event volume comparison
  const [counts] = await bq.query({ query: `
    SELECT
      event_name,
      COUNT(*) AS event_count,
      COUNT(DISTINCT user_pseudo_id) AS unique_users,
      COUNT(DISTINCT CONCAT(user_pseudo_id, CAST(COALESCE((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id'), 0) AS STRING))) AS unique_sessions
    FROM \`kcsymphony.analytics_445499663.events_*\`
    WHERE _TABLE_SUFFIX >= FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY))
      AND event_name IN ('session_start', 'page_view', 'view_item', 'view_item_list', 'add_to_cart', 'view_cart', 'begin_checkout', 'add_payment_info', 'add_shipping_info', 'purchase')
    GROUP BY event_name
    ORDER BY event_count DESC
  ` });

  console.log('\n=== E-Commerce Event Volumes (30 days) ===');
  console.log('Event'.padEnd(22), 'Count'.padStart(8), 'Users'.padStart(8), 'Sessions'.padStart(10));
  console.log('-'.repeat(50));
  counts.forEach(r => console.log(
    r.event_name.padEnd(22),
    String(r.event_count).padStart(8),
    String(r.unique_users).padStart(8),
    String(r.unique_sessions).padStart(10)
  ));

  // 2) view_cart vs add_to_cart ratio by day (last 7 days)
  const [daily] = await bq.query({ query: `
    SELECT
      event_date,
      COUNTIF(event_name = 'add_to_cart') AS atc,
      COUNTIF(event_name = 'view_cart') AS view_cart,
      COUNTIF(event_name = 'begin_checkout') AS checkout
    FROM \`kcsymphony.analytics_445499663.events_*\`
    WHERE _TABLE_SUFFIX >= FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY))
      AND event_name IN ('add_to_cart', 'view_cart', 'begin_checkout')
    GROUP BY event_date
    ORDER BY event_date
  ` });

  console.log('\n=== Daily: ATC vs view_cart vs checkout (7 days) ===');
  console.log('Date'.padEnd(12), 'ATC'.padStart(7), 'view_cart'.padStart(11), 'checkout'.padStart(10), 'vc/atc'.padStart(8));
  daily.forEach(r => console.log(
    r.event_date.padEnd(12),
    String(r.atc).padStart(7),
    String(r.view_cart).padStart(11),
    String(r.checkout).padStart(10),
    (r.atc ? (r.view_cart / r.atc * 100).toFixed(1) + '%' : 'n/a').padStart(8)
  ));

  // 3) view_cart event params — what's being sent?
  const [params] = await bq.query({ query: `
    SELECT
      ep.key,
      COUNT(*) AS cnt,
      APPROX_TOP_COUNT(COALESCE(ep.value.string_value, CAST(ep.value.int_value AS STRING), CAST(ep.value.double_value AS STRING)), 3) AS top_values
    FROM \`kcsymphony.analytics_445499663.events_*\`,
      UNNEST(event_params) AS ep
    WHERE _TABLE_SUFFIX >= FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY))
      AND event_name = 'view_cart'
    GROUP BY ep.key
    ORDER BY cnt DESC
    LIMIT 15
  ` });

  console.log('\n=== view_cart event_params (7 days) ===');
  params.forEach(r => {
    const vals = r.top_values.map(v => `${v.value}(${v.count})`).join(', ');
    console.log(`  ${r.key.padEnd(30)} count=${r.cnt}  top: ${vals}`);
  });

  // 4) Check if view_cart fires on same sessions as add_to_cart
  const [overlap] = await bq.query({ query: `
    WITH sessions AS (
      SELECT
        user_pseudo_id,
        COALESCE((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id'), 0) AS sid,
        MAX(IF(event_name = 'add_to_cart', 1, 0)) AS had_atc,
        MAX(IF(event_name = 'view_cart', 1, 0)) AS had_vc,
        MAX(IF(event_name = 'begin_checkout', 1, 0)) AS had_co
      FROM \`kcsymphony.analytics_445499663.events_*\`
      WHERE _TABLE_SUFFIX >= FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY))
        AND event_name IN ('add_to_cart', 'view_cart', 'begin_checkout')
      GROUP BY 1, 2
    )
    SELECT
      COUNT(*) AS total_sessions,
      COUNTIF(had_atc = 1) AS with_atc,
      COUNTIF(had_vc = 1) AS with_view_cart,
      COUNTIF(had_atc = 1 AND had_vc = 1) AS atc_and_vc,
      COUNTIF(had_atc = 1 AND had_vc = 0) AS atc_no_vc,
      COUNTIF(had_vc = 1 AND had_atc = 0) AS vc_no_atc,
      COUNTIF(had_co = 1) AS with_checkout,
      COUNTIF(had_vc = 1 AND had_co = 1) AS vc_and_checkout,
      COUNTIF(had_atc = 1 AND had_co = 1) AS atc_and_checkout
    FROM sessions
  ` });

  console.log('\n=== Session overlap: ATC vs view_cart vs checkout (14 days) ===');
  const o = overlap[0];
  console.log(`  Total sessions with any of these events: ${o.total_sessions}`);
  console.log(`  Sessions with ATC:        ${o.with_atc}`);
  console.log(`  Sessions with view_cart:   ${o.with_view_cart}`);
  console.log(`  ATC + view_cart:           ${o.atc_and_vc}  (${o.with_atc ? (o.atc_and_vc/o.with_atc*100).toFixed(1) : 0}% of ATC sessions)`);
  console.log(`  ATC without view_cart:     ${o.atc_no_vc}`);
  console.log(`  view_cart without ATC:     ${o.vc_no_atc}`);
  console.log(`  Sessions with checkout:    ${o.with_checkout}`);
  console.log(`  view_cart + checkout:      ${o.vc_and_checkout}`);
  console.log(`  ATC + checkout:            ${o.atc_and_checkout}`);
}

main().catch(e => console.error('Error:', e.message));
