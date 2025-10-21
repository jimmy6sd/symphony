// BigQuery Snapshots API - Longitudinal sales tracking
// This is the NEW snapshot-based API that works alongside the existing bigquery-data.js
// Uses performance_sales_snapshots table for historical tracking

const { BigQuery } = require('@google-cloud/bigquery');

// Initialize BigQuery client
const initializeBigQuery = () => {
  try {
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
      const credentialsFile = path.resolve(credentialsEnv);
      const credentialsJson = fs.readFileSync(credentialsFile, 'utf8');
      credentials = JSON.parse(credentialsJson);
    }

    if (credentials.private_key && credentials.private_key.includes('\\\\n')) {
      credentials.private_key = credentials.private_key.replace(/\\\\n/g, '\n');
    }

    return new BigQuery({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || credentials.project_id,
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
      location: 'US'
    });
  } catch (error) {
    console.error('BigQuery initialization error:', error.message);
    throw error;
  }
};

const DATASET_ID = process.env.BIGQUERY_DATASET || 'symphony_dashboard';
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony';

// Main handler function
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const bigquery = initializeBigQuery();
    const { action, ...params } = event.queryStringParameters || {};

    switch (action) {
      case 'get-performances':
        return await getPerformancesWithLatestSnapshots(bigquery, params, headers);

      case 'get-performance-history':
        return await getPerformanceHistory(bigquery, params, headers);

      case 'get-sales-progression':
        return await getSalesProgression(bigquery, params, headers);

      default:
        return await getPerformancesWithLatestSnapshots(bigquery, params, headers);
    }
  } catch (error) {
    console.error('BigQuery snapshots function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};

// Get performances with latest snapshot data (replaces old get-performances)
async function getPerformancesWithLatestSnapshots(bigquery, params, headers) {
  const {
    season,
    series,
    dateFrom,
    dateTo,
    limit = '1000',
    offset = '0'
  } = params;

  // Use CTE to get latest snapshot per performance, then join with metadata
  let query = `
    WITH latest_snapshots AS (
      SELECT
        performance_code,
        snapshot_date,
        single_tickets_sold,
        subscription_tickets_sold,
        total_tickets_sold,
        total_revenue,
        capacity_percent,
        budget_percent,
        ROW_NUMBER() OVER (PARTITION BY performance_code ORDER BY snapshot_date DESC) as rn
      FROM \`${PROJECT_ID}.${DATASET_ID}.performance_sales_snapshots\`
    )
    SELECT
      p.performance_id,
      p.performance_code,
      p.title,
      p.series,
      p.performance_date,
      p.venue,
      p.season,
      p.capacity,
      p.occupancy_goal,
      p.budget_goal,
      COALESCE(s.single_tickets_sold, 0) as single_tickets_sold,
      COALESCE(s.subscription_tickets_sold, 0) as subscription_tickets_sold,
      COALESCE(s.total_tickets_sold, 0) as total_tickets_sold,
      COALESCE(s.total_revenue, 0) as total_revenue,
      COALESCE(s.capacity_percent, 0) as capacity_percent,
      COALESCE(s.budget_percent, 0) as budget_percent,
      s.snapshot_date as last_updated,
      p.updated_at as metadata_updated_at
    FROM \`${PROJECT_ID}.${DATASET_ID}.performances\` p
    LEFT JOIN latest_snapshots s
      ON p.performance_code = s.performance_code AND s.rn = 1
    WHERE 1=1
  `;

  const queryParams = [];

  if (season) {
    query += ` AND p.season = ?`;
    queryParams.push(season);
  }

  if (series) {
    query += ` AND p.series = ?`;
    queryParams.push(series);
  }

  if (dateFrom) {
    query += ` AND p.performance_date >= ?`;
    queryParams.push(dateFrom);
  }

  if (dateTo) {
    query += ` AND p.performance_date <= ?`;
    queryParams.push(dateTo);
  }

  query += `
    ORDER BY p.performance_date ASC
    LIMIT ${parseInt(limit)}
    OFFSET ${parseInt(offset)}
  `;

  const options = {
    query: query,
    params: queryParams,
    location: 'US',
  };

  const [rows] = await bigquery.query(options);

  // Transform for frontend compatibility
  const performances = rows.map(row => ({
    ...row,
    date: typeof row.performance_date === 'object' ? row.performance_date.value : row.performance_date,
    id: row.performance_code,
    performanceId: row.performance_id,
    singleTicketsSold: row.single_tickets_sold || 0,
    subscriptionTicketsSold: row.subscription_tickets_sold || 0,
    totalRevenue: row.total_revenue || 0,
    occupancyGoal: row.occupancy_goal || 85,
    budgetGoal: row.budget_goal || 0,
    capacityPercent: row.capacity_percent || 0,
    budgetPercent: row.budget_percent || 0,
    lastUpdated: row.last_updated ? (typeof row.last_updated === 'object' ? row.last_updated.value : row.last_updated) : null,
    weeklySales: []  // Placeholder for compatibility
  }));

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(performances)
  };
}

// Get full history of snapshots for a performance (for trending/charting)
async function getPerformanceHistory(bigquery, params, headers) {
  const { performanceCode } = params;

  if (!performanceCode) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'performanceCode query parameter required' })
    };
  }

  const query = `
    SELECT
      snapshot_id,
      performance_code,
      snapshot_date,
      single_tickets_sold,
      subscription_tickets_sold,
      total_tickets_sold,
      total_revenue,
      capacity_percent,
      budget_percent,
      source,
      created_at
    FROM \`${PROJECT_ID}.${DATASET_ID}.performance_sales_snapshots\`
    WHERE performance_code = ?
    ORDER BY snapshot_date ASC
  `;

  const [rows] = await bigquery.query({
    query,
    params: [performanceCode],
    location: 'US'
  });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      performanceCode,
      snapshots: rows.map(row => ({
        ...row,
        snapshot_date: typeof row.snapshot_date === 'object' ? row.snapshot_date.value : row.snapshot_date,
        created_at: typeof row.created_at === 'object' ? row.created_at.value : row.created_at
      }))
    })
  };
}

// Get sales progression over time (builds weekly sales from snapshots)
async function getSalesProgression(bigquery, params, headers) {
  const { performanceCode } = params;

  if (!performanceCode) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'performanceCode query parameter required' })
    };
  }

  // Get performance date first
  const perfQuery = `
    SELECT performance_date
    FROM \`${PROJECT_ID}.${DATASET_ID}.performances\`
    WHERE performance_code = ?
  `;

  const [perfRows] = await bigquery.query({
    query: perfQuery,
    params: [performanceCode],
    location: 'US'
  });

  if (perfRows.length === 0) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Performance not found' })
    };
  }

  const performanceDate = typeof perfRows[0].performance_date === 'object'
    ? perfRows[0].performance_date.value
    : perfRows[0].performance_date;

  // Get all snapshots and calculate weeks before performance
  const snapshotQuery = `
    SELECT
      snapshot_date,
      total_tickets_sold,
      total_revenue,
      capacity_percent,
      DATE_DIFF('${performanceDate}', snapshot_date, DAY) as days_before_performance
    FROM \`${PROJECT_ID}.${DATASET_ID}.performance_sales_snapshots\`
    WHERE performance_code = ?
    ORDER BY snapshot_date ASC
  `;

  const [snapshots] = await bigquery.query({
    query: snapshotQuery,
    params: [performanceCode],
    location: 'US'
  });

  // Convert to weekly progression
  const weeklyData = snapshots.map(snap => ({
    date: typeof snap.snapshot_date === 'object' ? snap.snapshot_date.value : snap.snapshot_date,
    weeksOut: Math.ceil(snap.days_before_performance / 7),
    ticketsSold: snap.total_tickets_sold,
    revenue: snap.total_revenue,
    capacityPercent: snap.capacity_percent
  }));

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      performanceCode,
      performanceDate,
      progression: weeklyData
    })
  };
}
