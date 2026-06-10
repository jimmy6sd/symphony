// Pipeline Health API - Detects ingest failures in the daily PDF -> BigQuery pipeline
// Designed to be polled by a scheduled Make.com scenario after the daily noon ingest,
// which emails an alert when status != "ok".
//
// Checks:
//   1. staleness        - latest snapshot_date should be today (America/Chicago)
//   2. partial_ingest   - latest snapshot row count vs median of prior 7 days
//   3. missing_upcoming - every upcoming, non-cancelled performance that has prior
//                         sales data must appear in the latest snapshot
//   4. revenue_drop     - upcoming shows whose revenue fell sharply vs prior snapshot
//                         (single-ticket revenue rarely decreases; flags parse errors)

const { BigQuery } = require('@google-cloud/bigquery');

const initializeBigQuery = () => {
  const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsEnv) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable not set');
  }

  let credentials;
  if (credentialsEnv.startsWith('{')) {
    credentials = JSON.parse(credentialsEnv);
  } else {
    const fs = require('fs');
    const path = require('path');
    credentials = JSON.parse(fs.readFileSync(path.resolve(credentialsEnv), 'utf8'));
  }

  if (credentials.private_key && credentials.private_key.includes('\\n')) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  }

  return new BigQuery({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || credentials.project_id,
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
    location: 'US'
  });
};

const DATASET_ID = process.env.BIGQUERY_DATASET || 'symphony_dashboard';
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony';
const SNAPSHOTS = `\`${PROJECT_ID}.${DATASET_ID}.performance_sales_snapshots\``;
const PERFORMANCES = `\`${PROJECT_ID}.${DATASET_ID}.performances\``;

// Latest snapshot count below this fraction of the prior 7-day median means a
// report file (FY26 or FY27) likely failed to arrive or parse.
const PARTIAL_INGEST_THRESHOLD = 0.9;
// Revenue falling below this fraction of the prior snapshot flags a likely parse
// error (small refund-driven dips stay above it).
const REVENUE_DROP_THRESHOLD = 0.75;
// Ignore revenue drops on shows with less than this much prior revenue.
const REVENUE_DROP_MIN_PRIOR = 500;

let bigqueryClient = null;
const getBigQueryClient = () => {
  if (!bigqueryClient) bigqueryClient = initializeBigQuery();
  return bigqueryClient;
};

const freshnessQuery = `
  WITH latest AS (
    SELECT MAX(snapshot_date) AS max_date FROM ${SNAPSHOTS}
  )
  SELECT
    CAST(latest.max_date AS STRING) AS latest_snapshot_date,
    CAST(CURRENT_DATE('America/Chicago') AS STRING) AS today,
    DATE_DIFF(CURRENT_DATE('America/Chicago'), latest.max_date, DAY) AS days_stale,
    (SELECT COUNT(*) FROM ${SNAPSHOTS} s WHERE s.snapshot_date = latest.max_date) AS latest_row_count,
    (SELECT CAST(APPROX_QUANTILES(cnt, 2)[OFFSET(1)] AS INT64) FROM (
      SELECT COUNT(*) AS cnt FROM ${SNAPSHOTS} s
      WHERE s.snapshot_date < latest.max_date
        AND s.snapshot_date >= DATE_SUB(latest.max_date, INTERVAL 7 DAY)
      GROUP BY s.snapshot_date
    )) AS median_prior_row_count
  FROM latest
`;

const missingUpcomingQuery = `
  SELECT p.performance_code, p.title, CAST(p.performance_date AS STRING) AS performance_date
  FROM ${PERFORMANCES} p
  WHERE p.performance_date >= CURRENT_DATE('America/Chicago')
    AND IFNULL(p.cancelled, FALSE) = FALSE
    AND p.has_sales_data = TRUE
    AND NOT EXISTS (
      SELECT 1 FROM ${SNAPSHOTS} s
      WHERE s.performance_code = p.performance_code
        AND s.snapshot_date = (SELECT MAX(snapshot_date) FROM ${SNAPSHOTS})
    )
  ORDER BY p.performance_date
`;

const revenueDropQuery = `
  WITH latest AS (
    SELECT MAX(snapshot_date) AS d FROM ${SNAPSHOTS}
  ),
  prior AS (
    SELECT MAX(snapshot_date) AS d FROM ${SNAPSHOTS} WHERE snapshot_date < (SELECT d FROM latest)
  ),
  cur AS (
    SELECT performance_code, total_revenue FROM ${SNAPSHOTS} WHERE snapshot_date = (SELECT d FROM latest)
  ),
  prev AS (
    SELECT performance_code, total_revenue FROM ${SNAPSHOTS} WHERE snapshot_date = (SELECT d FROM prior)
  )
  SELECT
    p.performance_code,
    p.title,
    CAST(p.performance_date AS STRING) AS performance_date,
    prev.total_revenue AS prior_revenue,
    cur.total_revenue AS latest_revenue
  FROM cur
  JOIN prev USING (performance_code)
  JOIN ${PERFORMANCES} p USING (performance_code)
  WHERE p.performance_date >= CURRENT_DATE('America/Chicago')
    AND IFNULL(p.cancelled, FALSE) = FALSE
    AND prev.total_revenue > ${REVENUE_DROP_MIN_PRIOR}
    AND cur.total_revenue < prev.total_revenue * ${REVENUE_DROP_THRESHOLD}
  ORDER BY prev.total_revenue - cur.total_revenue DESC
`;

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ message: 'Method not allowed' }) };
  }

  try {
    const bigquery = getBigQueryClient();

    const [[freshnessRows], [missingRows], [dropRows]] = await Promise.all([
      bigquery.query({ query: freshnessQuery, location: 'US' }),
      bigquery.query({ query: missingUpcomingQuery, location: 'US' }),
      bigquery.query({ query: revenueDropQuery, location: 'US' })
    ]);

    const fresh = freshnessRows[0];
    const failures = [];
    const warnings = [];

    if (fresh.days_stale >= 1) {
      failures.push({
        check: 'staleness',
        message: `Latest snapshot is ${fresh.latest_snapshot_date} (${fresh.days_stale} day(s) stale). The daily ingest may not have run or is processing backlogged reports.`
      });
    }

    if (fresh.median_prior_row_count && fresh.latest_row_count < fresh.median_prior_row_count * PARTIAL_INGEST_THRESHOLD) {
      failures.push({
        check: 'partial_ingest',
        message: `Latest snapshot has ${fresh.latest_row_count} rows vs a prior 7-day median of ${fresh.median_prior_row_count}. One of the daily report files (FY26/FY27) likely did not arrive or failed to parse.`
      });
    }

    if (missingRows.length > 0) {
      failures.push({
        check: 'missing_upcoming',
        message: `${missingRows.length} upcoming performance(s) with prior sales data are missing from the latest snapshot.`,
        performances: missingRows
      });
    }

    if (dropRows.length > 0) {
      warnings.push({
        check: 'revenue_drop',
        message: `${dropRows.length} upcoming performance(s) show a revenue drop of more than ${Math.round((1 - REVENUE_DROP_THRESHOLD) * 100)}% since the prior snapshot. Possible parse error (or a large legitimate refund).`,
        performances: dropRows
      });
    }

    const status = failures.length > 0 ? 'fail' : (warnings.length > 0 ? 'warn' : 'ok');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status,
        checkedAt: new Date().toISOString(),
        latestSnapshotDate: fresh.latest_snapshot_date,
        latestRowCount: fresh.latest_row_count,
        medianPriorRowCount: fresh.median_prior_row_count,
        failures,
        warnings
      })
    };

  } catch (error) {
    console.error('Pipeline health check error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        status: 'error',
        message: `Health check itself failed: ${error.message}`,
        checkedAt: new Date().toISOString()
      })
    };
  }
};
