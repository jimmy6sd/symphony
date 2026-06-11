/**
 * validate-funnel-counts.js
 *
 * Diagnostic script to validate GA4 funnel numbers by querying
 * the raw BigQuery GA4 export directly.
 *
 * Usage: node scripts/diagnostic/validate-funnel-counts.js
 */

const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');

const START_DATE = '20260428';
const END_DATE = '20260527';

function getBQClient() {
  const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS || './symphony-bigquery-key.json';
  let credentials;
  if (credentialsEnv.startsWith('{')) {
    credentials = JSON.parse(credentialsEnv);
  } else {
    credentials = JSON.parse(fs.readFileSync(path.resolve(credentialsEnv), 'utf8'));
  }

  if (credentials.private_key && credentials.private_key.includes('\\n')) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  }

  return new BigQuery({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || credentials.project_id,
    credentials: { client_email: credentials.client_email, private_key: credentials.private_key },
    location: 'US',
  });
}

const TABLE = '`kcsymphony.analytics_445499663.events_*`';
const SUFFIX_FILTER = `_TABLE_SUFFIX BETWEEN '${START_DATE}' AND '${END_DATE}'`;

async function runQuery(bq, label, sql) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  ${label}`);
  console.log('='.repeat(70));
  const [rows] = await bq.query({ query: sql });
  return rows;
}

async function main() {
  const bq = getBQClient();

  console.log(`GA4 Funnel Validation — Raw BigQuery Export`);
  console.log(`Date range: ${START_DATE} to ${END_DATE}`);
  console.log(`Table: kcsymphony.analytics_445499663.events_*`);

  // ---------------------------------------------------------------
  // 1. Raw purchase event count
  // ---------------------------------------------------------------
  const q1 = `
    SELECT COUNT(*) AS raw_purchase_events
    FROM ${TABLE}
    WHERE ${SUFFIX_FILTER}
      AND event_name = 'purchase'
  `;
  const r1 = await runQuery(bq, '1. RAW PURCHASE EVENT COUNT', q1);
  console.log(`   Total purchase events fired: ${r1[0].raw_purchase_events}`);
  console.log(`   (Before any dedup — if >> 1,414, GA4 fires multiple per session)`);

  // ---------------------------------------------------------------
  // 2. Unique transactions (DISTINCT transaction_id)
  // ---------------------------------------------------------------
  const q2 = `
    SELECT
      COUNT(DISTINCT (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'transaction_id')) AS unique_transactions,
      COUNT(*) AS total_purchase_events,
      COUNT(*) - COUNT(DISTINCT (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'transaction_id')) AS duplicate_events
    FROM ${TABLE}
    WHERE ${SUFFIX_FILTER}
      AND event_name = 'purchase'
  `;
  const r2 = await runQuery(bq, '2. UNIQUE TRANSACTIONS (DISTINCT transaction_id)', q2);
  console.log(`   Unique transaction_ids:  ${r2[0].unique_transactions}`);
  console.log(`   Total purchase events:   ${r2[0].total_purchase_events}`);
  console.log(`   Duplicate events:        ${r2[0].duplicate_events}`);

  // ---------------------------------------------------------------
  // 3. Session-level purchase count (open funnel — should match 1,414)
  // ---------------------------------------------------------------
  const q3 = `
    SELECT COUNT(*) AS sessions_with_purchase
    FROM (
      SELECT
        user_pseudo_id,
        COALESCE(
          (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id'), 0
        ) AS ga_session_id
      FROM ${TABLE}
      WHERE ${SUFFIX_FILTER}
        AND event_name = 'purchase'
      GROUP BY user_pseudo_id, ga_session_id
    )
  `;
  const r3 = await runQuery(bq, '3. SESSION-LEVEL PURCHASE COUNT (open funnel)', q3);
  console.log(`   Distinct sessions with purchase: ${r3[0].sessions_with_purchase}`);
  console.log(`   Expected (open funnel):          1,414`);
  const diff3 = Number(r3[0].sessions_with_purchase) - 1414;
  console.log(`   Difference:                      ${diff3 >= 0 ? '+' : ''}${diff3}`);

  // ---------------------------------------------------------------
  // 4. Session-level closed purchase count (should match 1,266)
  // ---------------------------------------------------------------
  const q4 = `
    SELECT COUNT(*) AS closed_purchase_sessions
    FROM (
      SELECT
        user_pseudo_id,
        COALESCE(
          (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id'), 0
        ) AS ga_session_id,
        MAX(IF(event_name = 'add_to_cart', 1, 0)) AS had_atc,
        MAX(IF(event_name = 'begin_checkout', 1, 0)) AS had_checkout,
        MAX(IF(event_name = 'purchase', 1, 0)) AS had_purchase
      FROM ${TABLE}
      WHERE ${SUFFIX_FILTER}
        AND event_name IN ('add_to_cart', 'begin_checkout', 'purchase')
      GROUP BY user_pseudo_id, ga_session_id
      HAVING had_atc = 1 AND had_checkout = 1 AND had_purchase = 1
    )
  `;
  const r4 = await runQuery(bq, '4. SESSION-LEVEL CLOSED PURCHASE COUNT (ATC + checkout + purchase)', q4);
  console.log(`   Closed funnel purchase sessions: ${r4[0].closed_purchase_sessions}`);
  console.log(`   Expected (closed funnel):        1,266`);
  const diff4 = Number(r4[0].closed_purchase_sessions) - 1266;
  console.log(`   Difference:                      ${diff4 >= 0 ? '+' : ''}${diff4}`);

  // ---------------------------------------------------------------
  // 5. Total purchase revenue from raw events
  // ---------------------------------------------------------------
  const q5 = `
    SELECT
      ROUND(SUM(
        COALESCE(
          (SELECT value.double_value FROM UNNEST(event_params) WHERE key = 'value'),
          CAST((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'value') AS FLOAT64),
          0
        )
      ), 2) AS total_revenue,
      ROUND(SUM(ecommerce.purchase_revenue), 2) AS ecommerce_revenue
    FROM ${TABLE}
    WHERE ${SUFFIX_FILTER}
      AND event_name = 'purchase'
  `;
  const r5 = await runQuery(bq, '5. TOTAL PURCHASE REVENUE FROM RAW EVENTS', q5);
  console.log(`   Revenue (event_params.value):    $${Number(r5[0].total_revenue).toLocaleString()}`);
  console.log(`   Revenue (ecommerce.purchase_revenue): $${r5[0].ecommerce_revenue != null ? Number(r5[0].ecommerce_revenue).toLocaleString() : 'NULL'}`);
  console.log(`   Expected range (funnel):         $165,000 - $183,000`);

  // ---------------------------------------------------------------
  // 6. Add to cart counts (raw + session-level)
  // ---------------------------------------------------------------
  const q6 = `
    SELECT
      COUNT(*) AS raw_atc_events,
      COUNT(DISTINCT CONCAT(
        user_pseudo_id, '-',
        CAST(COALESCE(
          (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id'), 0
        ) AS STRING)
      )) AS sessions_with_atc
    FROM ${TABLE}
    WHERE ${SUFFIX_FILTER}
      AND event_name = 'add_to_cart'
  `;
  const r6 = await runQuery(bq, '6. ADD TO CART COUNTS', q6);
  console.log(`   Raw add_to_cart events:          ${r6[0].raw_atc_events}`);
  console.log(`   Distinct sessions with ATC:      ${r6[0].sessions_with_atc}`);
  console.log(`   Expected (funnel ATC):           4,736`);
  console.log(`   Note: Funnel reports session-level ATC. If raw >> session, users add multiple items per session.`);

  // ---------------------------------------------------------------
  // 7. Purchase events with zero or null value
  // ---------------------------------------------------------------
  const q7 = `
    SELECT
      COUNT(*) AS total_purchase_events,
      COUNTIF(
        COALESCE(
          (SELECT value.double_value FROM UNNEST(event_params) WHERE key = 'value'),
          CAST((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'value') AS FLOAT64)
        ) IS NULL
      ) AS null_value_events,
      COUNTIF(
        COALESCE(
          (SELECT value.double_value FROM UNNEST(event_params) WHERE key = 'value'),
          CAST((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'value') AS FLOAT64),
          0
        ) = 0
      ) AS zero_value_events,
      COUNTIF(
        COALESCE(
          (SELECT value.double_value FROM UNNEST(event_params) WHERE key = 'value'),
          CAST((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'value') AS FLOAT64),
          0
        ) > 0
      ) AS has_value_events
    FROM ${TABLE}
    WHERE ${SUFFIX_FILTER}
      AND event_name = 'purchase'
  `;
  const r7 = await runQuery(bq, '7. PURCHASE EVENTS WITH ZERO OR NULL VALUE', q7);
  console.log(`   Total purchase events:           ${r7[0].total_purchase_events}`);
  console.log(`   Events with NULL value:          ${r7[0].null_value_events}`);
  console.log(`   Events with zero value:          ${r7[0].zero_value_events}`);
  console.log(`   Events with value > 0:           ${r7[0].has_value_events}`);
  const pctNoValue = r7[0].total_purchase_events > 0
    ? ((Number(r7[0].null_value_events) + Number(r7[0].zero_value_events)) / Number(r7[0].total_purchase_events) * 100).toFixed(1)
    : 0;
  console.log(`   % with no revenue:               ${pctNoValue}%`);

  // ---------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------
  console.log(`\n${'='.repeat(70)}`);
  console.log('  SUMMARY');
  console.log('='.repeat(70));
  console.log(`  Raw purchase events:              ${r1[0].raw_purchase_events}`);
  console.log(`  Unique transactions:              ${r2[0].unique_transactions}`);
  console.log(`  Open funnel purchases (sessions): ${r3[0].sessions_with_purchase} (expected 1,414)`);
  console.log(`  Closed funnel purchases:          ${r4[0].closed_purchase_sessions} (expected 1,266)`);
  console.log(`  Revenue (event params):           $${Number(r5[0].total_revenue).toLocaleString()}`);
  console.log(`  Sessions with ATC:                ${r6[0].sessions_with_atc} (expected 4,736)`);
  console.log(`  Zero/null value purchases:        ${Number(r7[0].null_value_events) + Number(r7[0].zero_value_events)} of ${r7[0].total_purchase_events}`);
  console.log('');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
