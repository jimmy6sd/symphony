/**
 * validate-funnel-deep.js
 *
 * Deep investigation of zero-value purchases in GA4 and
 * Tessitura single-ticket delta for the same 30-day window.
 *
 * Usage: node scripts/diagnostic/validate-funnel-deep.js
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

const GA4_TABLE = '`kcsymphony.analytics_445499663.events_*`';
const SUFFIX_FILTER = `_TABLE_SUFFIX BETWEEN '${START_DATE}' AND '${END_DATE}'`;

async function runQuery(bq, label, sql) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  ${label}`);
  console.log('='.repeat(70));
  const [rows] = await bq.query({ query: sql });
  return rows;
}

function fmt(n) {
  return Number(n).toLocaleString();
}

function fmtDollars(n) {
  return '$' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function main() {
  const bq = getBQClient();

  console.log('GA4 Funnel Deep Validation');
  console.log(`Date range: ${START_DATE} to ${END_DATE}`);
  console.log(`GA4 table: kcsymphony.analytics_445499663.events_*`);
  console.log(`Tessitura table: kcsymphony.symphony_dashboard.performance_sales_snapshots`);

  // =================================================================
  // QUERY 1: ZERO-VALUE PURCHASE INVESTIGATION
  // =================================================================
  console.log(`\n${'#'.repeat(70)}`);
  console.log('  PART 1: ZERO-VALUE PURCHASE INVESTIGATION');
  console.log('#'.repeat(70));

  // 1a. Unique sessions and transaction_ids with zero-value purchases
  const q1a = `
    WITH purchase_events AS (
      SELECT
        user_pseudo_id,
        COALESCE(
          (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id'), 0
        ) AS ga_session_id,
        (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'transaction_id') AS transaction_id,
        COALESCE(
          (SELECT value.double_value FROM UNNEST(event_params) WHERE key = 'value'),
          CAST((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'value') AS FLOAT64),
          0
        ) AS purchase_value
      FROM ${GA4_TABLE}
      WHERE ${SUFFIX_FILTER}
        AND event_name = 'purchase'
    )
    SELECT
      CASE WHEN purchase_value = 0 THEN 'zero_value' ELSE 'positive_value' END AS value_group,
      COUNT(*) AS total_events,
      COUNT(DISTINCT CONCAT(user_pseudo_id, '-', CAST(ga_session_id AS STRING))) AS unique_sessions,
      COUNT(DISTINCT transaction_id) AS unique_transaction_ids,
      COUNTIF(transaction_id IS NULL) AS null_transaction_ids
    FROM purchase_events
    GROUP BY value_group
    ORDER BY value_group
  `;
  const r1a = await runQuery(bq, '1a. UNIQUE SESSIONS & TRANSACTIONS BY VALUE GROUP', q1a);
  for (const row of r1a) {
    console.log(`\n   [${row.value_group}]`);
    console.log(`   Total events:             ${fmt(row.total_events)}`);
    console.log(`   Unique sessions:          ${fmt(row.unique_sessions)}`);
    console.log(`   Unique transaction_ids:   ${fmt(row.unique_transaction_ids)}`);
    console.log(`   NULL transaction_ids:     ${fmt(row.null_transaction_ids)}`);
  }

  // 1b. Top landing pages for zero-value vs positive-value purchase sessions
  const q1b = `
    WITH purchase_sessions AS (
      SELECT
        user_pseudo_id,
        COALESCE(
          (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id'), 0
        ) AS ga_session_id,
        COALESCE(
          (SELECT value.double_value FROM UNNEST(event_params) WHERE key = 'value'),
          CAST((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'value') AS FLOAT64),
          0
        ) AS purchase_value
      FROM ${GA4_TABLE}
      WHERE ${SUFFIX_FILTER}
        AND event_name = 'purchase'
    ),
    session_landing AS (
      SELECT
        user_pseudo_id,
        COALESCE(
          (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id'), 0
        ) AS ga_session_id,
        (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location') AS page_location
      FROM ${GA4_TABLE}
      WHERE ${SUFFIX_FILTER}
        AND event_name = 'session_start'
    ),
    joined AS (
      SELECT
        CASE WHEN ps.purchase_value = 0 THEN 'zero_value' ELSE 'positive_value' END AS value_group,
        REGEXP_REPLACE(
          REGEXP_REPLACE(sl.page_location, r'\\?.*', ''),
          r'https?://[^/]+', ''
        ) AS landing_path
      FROM purchase_sessions ps
      JOIN session_landing sl
        ON ps.user_pseudo_id = sl.user_pseudo_id
        AND ps.ga_session_id = sl.ga_session_id
    )
    SELECT value_group, landing_path, COUNT(*) AS sessions
    FROM joined
    GROUP BY value_group, landing_path
    QUALIFY ROW_NUMBER() OVER (PARTITION BY value_group ORDER BY sessions DESC) <= 10
    ORDER BY value_group, sessions DESC
  `;
  const r1b = await runQuery(bq, '1b. TOP LANDING PAGES BY VALUE GROUP', q1b);
  let currentGroup = '';
  for (const row of r1b) {
    if (row.value_group !== currentGroup) {
      currentGroup = row.value_group;
      console.log(`\n   [${currentGroup}]`);
    }
    console.log(`   ${String(row.sessions).padStart(5)}  ${row.landing_path || '(empty)'}`);
  }

  // 1c. Sample transaction_ids for zero-value vs positive-value
  const q1c = `
    WITH purchase_events AS (
      SELECT
        (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'transaction_id') AS transaction_id,
        COALESCE(
          (SELECT value.double_value FROM UNNEST(event_params) WHERE key = 'value'),
          CAST((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'value') AS FLOAT64),
          0
        ) AS purchase_value
      FROM ${GA4_TABLE}
      WHERE ${SUFFIX_FILTER}
        AND event_name = 'purchase'
    )
    (
      SELECT 'zero_value' AS value_group, transaction_id, purchase_value
      FROM purchase_events
      WHERE purchase_value = 0
      LIMIT 5
    )
    UNION ALL
    (
      SELECT 'positive_value' AS value_group, transaction_id, purchase_value
      FROM purchase_events
      WHERE purchase_value > 0
      LIMIT 5
    )
  `;
  const r1c = await runQuery(bq, '1c. SAMPLE TRANSACTION_IDS BY VALUE GROUP', q1c);
  currentGroup = '';
  for (const row of r1c) {
    if (row.value_group !== currentGroup) {
      currentGroup = row.value_group;
      console.log(`\n   [${currentGroup}]`);
    }
    console.log(`   transaction_id: ${row.transaction_id || '(null)'}  value: ${fmtDollars(row.purchase_value)}`);
  }

  // 1d. Average revenue per transaction for non-zero purchases
  const q1d = `
    WITH purchase_txns AS (
      SELECT
        (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'transaction_id') AS transaction_id,
        COALESCE(
          (SELECT value.double_value FROM UNNEST(event_params) WHERE key = 'value'),
          CAST((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'value') AS FLOAT64),
          0
        ) AS purchase_value
      FROM ${GA4_TABLE}
      WHERE ${SUFFIX_FILTER}
        AND event_name = 'purchase'
    ),
    deduped AS (
      SELECT transaction_id, MAX(purchase_value) AS purchase_value
      FROM purchase_txns
      WHERE purchase_value > 0 AND transaction_id IS NOT NULL
      GROUP BY transaction_id
    )
    SELECT
      COUNT(*) AS positive_transactions,
      ROUND(SUM(purchase_value), 2) AS total_revenue,
      ROUND(AVG(purchase_value), 2) AS avg_revenue_per_txn,
      ROUND(MIN(purchase_value), 2) AS min_revenue,
      ROUND(MAX(purchase_value), 2) AS max_revenue,
      APPROX_QUANTILES(purchase_value, 2)[OFFSET(1)] AS median_revenue
    FROM deduped
  `;
  const r1d = await runQuery(bq, '1d. REVENUE STATS FOR NON-ZERO PURCHASES (deduped by transaction_id)', q1d);
  const s = r1d[0];
  console.log(`   Positive-value transactions:  ${fmt(s.positive_transactions)}`);
  console.log(`   Total revenue:                ${fmtDollars(s.total_revenue)}`);
  console.log(`   Avg revenue per transaction:  ${fmtDollars(s.avg_revenue_per_txn)}`);
  console.log(`   Min:                          ${fmtDollars(s.min_revenue)}`);
  console.log(`   Median:                       ${fmtDollars(s.median_revenue)}`);
  console.log(`   Max:                          ${fmtDollars(s.max_revenue)}`);

  // =================================================================
  // QUERY 2: TESSITURA SINGLE TICKET DELTA FOR SAME 30-DAY WINDOW
  // =================================================================
  console.log(`\n${'#'.repeat(70)}`);
  console.log('  PART 2: TESSITURA SINGLE TICKET DELTA (Apr 28 - May 27, 2026)');
  console.log('#'.repeat(70));

  const q2 = `
    WITH
    -- Latest snapshot on or before 2026-05-27 for each performance
    end_snapshots AS (
      SELECT
        performance_code,
        single_tickets_sold,
        single_revenue,
        total_tickets_sold,
        total_revenue,
        ROW_NUMBER() OVER (
          PARTITION BY performance_code
          ORDER BY snapshot_date DESC
        ) AS rn
      FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
      WHERE snapshot_date <= '2026-05-27'
    ),
    -- Latest snapshot on or before 2026-04-27 (day before window) for each performance
    start_snapshots AS (
      SELECT
        performance_code,
        single_tickets_sold,
        single_revenue,
        total_tickets_sold,
        total_revenue,
        ROW_NUMBER() OVER (
          PARTITION BY performance_code
          ORDER BY snapshot_date DESC
        ) AS rn
      FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
      WHERE snapshot_date <= '2026-04-27'
    ),
    deltas AS (
      SELECT
        e.performance_code,
        COALESCE(e.single_tickets_sold, 0) - COALESCE(s.single_tickets_sold, 0) AS single_ticket_delta,
        COALESCE(e.single_revenue, 0) - COALESCE(s.single_revenue, 0) AS single_revenue_delta,
        COALESCE(e.total_tickets_sold, 0) - COALESCE(s.total_tickets_sold, 0) AS total_ticket_delta,
        COALESCE(e.total_revenue, 0) - COALESCE(s.total_revenue, 0) AS total_revenue_delta
      FROM end_snapshots e
      LEFT JOIN start_snapshots s
        ON e.performance_code = s.performance_code AND s.rn = 1
      WHERE e.rn = 1
    )
    SELECT
      COUNT(*) AS performances_with_data,
      SUM(single_ticket_delta) AS net_new_single_tickets,
      ROUND(SUM(single_revenue_delta), 2) AS net_new_single_revenue,
      SUM(total_ticket_delta) AS net_new_total_tickets,
      ROUND(SUM(total_revenue_delta), 2) AS net_new_total_revenue,
      SUM(CASE WHEN single_ticket_delta > 0 THEN 1 ELSE 0 END) AS performances_with_new_singles,
      SUM(CASE WHEN single_ticket_delta < 0 THEN 1 ELSE 0 END) AS performances_with_negative_delta
    FROM deltas
  `;
  const r2 = await runQuery(bq, '2a. TESSITURA AGGREGATE DELTAS', q2);
  const t = r2[0];
  console.log(`   Performances with snapshot data:  ${fmt(t.performances_with_data)}`);
  console.log(`   Performances with new singles:    ${fmt(t.performances_with_new_singles)}`);
  console.log(`   Performances with negative delta: ${fmt(t.performances_with_negative_delta)}`);
  console.log('');
  console.log(`   --- Single Tickets ---`);
  console.log(`   Net new single tickets:           ${fmt(t.net_new_single_tickets)}`);
  console.log(`   Net new single revenue:           ${fmtDollars(t.net_new_single_revenue)}`);
  console.log('');
  console.log(`   --- Total (incl. subscriptions) ---`);
  console.log(`   Net new total tickets:            ${fmt(t.net_new_total_tickets)}`);
  console.log(`   Net new total revenue:            ${fmtDollars(t.net_new_total_revenue)}`);

  // 2b. Top 15 performances by single ticket delta
  const q2b = `
    WITH
    end_snapshots AS (
      SELECT
        performance_code,
        single_tickets_sold,
        single_revenue,
        ROW_NUMBER() OVER (PARTITION BY performance_code ORDER BY snapshot_date DESC) AS rn
      FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
      WHERE snapshot_date <= '2026-05-27'
    ),
    start_snapshots AS (
      SELECT
        performance_code,
        single_tickets_sold,
        single_revenue,
        ROW_NUMBER() OVER (PARTITION BY performance_code ORDER BY snapshot_date DESC) AS rn
      FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
      WHERE snapshot_date <= '2026-04-27'
    ),
    deltas AS (
      SELECT
        e.performance_code,
        COALESCE(e.single_tickets_sold, 0) - COALESCE(s.single_tickets_sold, 0) AS single_ticket_delta,
        COALESCE(e.single_revenue, 0) - COALESCE(s.single_revenue, 0) AS single_revenue_delta
      FROM end_snapshots e
      LEFT JOIN start_snapshots s
        ON e.performance_code = s.performance_code AND s.rn = 1
      WHERE e.rn = 1
    )
    SELECT
      d.performance_code,
      p.title,
      d.single_ticket_delta,
      ROUND(d.single_revenue_delta, 2) AS single_revenue_delta
    FROM deltas d
    LEFT JOIN \`kcsymphony.symphony_dashboard.performances\` p
      ON d.performance_code = p.performance_code
    WHERE d.single_ticket_delta != 0
    ORDER BY d.single_ticket_delta DESC
    LIMIT 15
  `;
  const r2b = await runQuery(bq, '2b. TOP 15 PERFORMANCES BY SINGLE TICKET DELTA', q2b);
  console.log(`   ${'Perf Code'.padEnd(12)} ${'Tickets'.padStart(8)} ${'Revenue'.padStart(12)}  Title`);
  console.log(`   ${'─'.repeat(12)} ${'─'.repeat(8)} ${'─'.repeat(12)}  ${'─'.repeat(30)}`);
  for (const row of r2b) {
    console.log(`   ${String(row.performance_code).padEnd(12)} ${String(row.single_ticket_delta).padStart(8)} ${fmtDollars(row.single_revenue_delta).padStart(12)}  ${(row.title || '(unknown)').substring(0, 40)}`);
  }

  // =================================================================
  // COMPARISON SUMMARY
  // =================================================================
  console.log(`\n${'#'.repeat(70)}`);
  console.log('  COMPARISON: GA4 vs TESSITURA');
  console.log('#'.repeat(70));
  console.log('');
  console.log('   Source                    Transactions    Revenue');
  console.log('   ────────────────────────  ────────────    ───────────');
  console.log(`   GA4 (all purchases)       1,436           $183,000 (approx)`);
  console.log(`   GA4 (positive value only) 1,195           $183,000 (approx)`);

  const tessTickets = t.net_new_single_tickets != null ? fmt(t.net_new_single_tickets) : 'N/A';
  const tessRevenue = t.net_new_single_revenue != null ? fmtDollars(t.net_new_single_revenue) : 'N/A';
  console.log(`   Tessitura (singles)       ${tessTickets.padEnd(16)}${tessRevenue}`);

  const tessTotalTickets = t.net_new_total_tickets != null ? fmt(t.net_new_total_tickets) : 'N/A';
  const tessTotalRevenue = t.net_new_total_revenue != null ? fmtDollars(t.net_new_total_revenue) : 'N/A';
  console.log(`   Tessitura (all tickets)   ${tessTotalTickets.padEnd(16)}${tessTotalRevenue}`);
  console.log('');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
