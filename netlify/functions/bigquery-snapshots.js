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

// ⚡ OPTIMIZATION: Singleton BigQuery client (initialized once, reused across requests)
let bigqueryClient = null;

const getBigQueryClient = () => {
  if (!bigqueryClient) {
    console.log('🔧 Initializing BigQuery client (one-time setup)');
    bigqueryClient = initializeBigQuery();
  }
  return bigqueryClient;
};

// ⚡ OPTIMIZATION: Serverless function cache (since data updates once daily)
// Cache TTL: 2 hours (data updates daily in morning, so 2hr cache is safe)
// Cache can be bypassed with ?nocache=1 parameter
const cache = {
  initialLoad: null,
  timestamp: null,
  TTL: 2 * 60 * 60 * 1000  // 2 hours in milliseconds
};

const isCacheValid = () => {
  if (!cache.timestamp || !cache.initialLoad) return false;
  const age = Date.now() - cache.timestamp;
  return age < cache.TTL;
};

const getCacheAge = () => {
  if (!cache.timestamp) return null;
  return Math.floor((Date.now() - cache.timestamp) / 1000); // age in seconds
};

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
    // ⚡ OPTIMIZATION: Reuse BigQuery client instead of initializing every time
    const bigquery = getBigQueryClient();
    const { action, ...params } = event.queryStringParameters || {};

    switch (action) {
      case 'get-initial-load':
        // ⚡ OPTIMIZATION: Run both queries in parallel for initial dashboard load
        return await getInitialLoad(bigquery, params, headers);

      case 'invalidate-cache':
        // 🔄 Cache invalidation endpoint (call after PDF import or admin edits)
        cache.initialLoad = null;
        cache.timestamp = null;
        console.log('🗑️ Cache invalidated');
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Cache invalidated successfully',
            timestamp: new Date().toISOString()
          })
        };

      case 'get-performances':
        return await getPerformancesWithLatestSnapshots(bigquery, params, headers);

      case 'get-performance-history':
        return await getPerformanceHistory(bigquery, params, headers);

      case 'get-sales-progression':
        return await getSalesProgression(bigquery, params, headers);

      case 'get-all-week-over-week':
        return await getAllWeekOverWeek(bigquery, params, headers);

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

// ⚡ OPTIMIZATION: Get initial dashboard data (performances + W/W) in one parallel request
// Instead of 2 sequential requests (2.2s), runs both queries in parallel (~1.2s)
// ⚡ CACHING: Since data updates once daily, cache for 2 hours (typical request: <50ms)
async function getInitialLoad(bigquery, params, headers) {
  try {
    // Check for cache bypass parameter (?nocache=1 or ?nocache=true)
    const bypassCache = params.nocache === '1' || params.nocache === 'true';

    // Return cached data if valid (unless bypassed)
    if (!bypassCache && isCacheValid()) {
      const cacheAgeSeconds = getCacheAge();
      console.log(`✅ Serving from cache (age: ${cacheAgeSeconds}s, TTL: ${cache.TTL/1000}s)`);

      // Add cache metadata to response
      const cachedData = JSON.parse(cache.initialLoad);
      cachedData._meta.cached = true;
      cachedData._meta.cacheAge = cacheAgeSeconds;

      return {
        statusCode: 200,
        headers: {
          ...headers,
          'X-Cache': 'HIT',
          'X-Cache-Age': cacheAgeSeconds.toString()
        },
        body: JSON.stringify(cachedData)
      };
    }

    // Cache miss or bypassed - fetch fresh data
    console.log(`🔄 Fetching fresh data (cache ${bypassCache ? 'bypassed' : 'miss'})`);
    console.time('get-initial-load');

    // Run both queries in parallel
    const [performancesResult, wowResult] = await Promise.all([
      getPerformancesWithLatestSnapshots(bigquery, params, headers),
      getAllWeekOverWeek(bigquery, params, headers)
    ]);

    console.timeEnd('get-initial-load');

    // Parse the response bodies (they're JSON strings)
    const performances = JSON.parse(performancesResult.body);
    const weekOverWeek = JSON.parse(wowResult.body);

    const responseData = {
      performances,
      weekOverWeek,
      _meta: {
        timestamp: new Date().toISOString(),
        performanceCount: performances.length,
        wowCount: Object.keys(weekOverWeek).length,
        cached: false,
        cacheTTL: cache.TTL / 1000 // TTL in seconds
      }
    };

    // Update cache
    cache.initialLoad = JSON.stringify(responseData);
    cache.timestamp = Date.now();
    console.log(`💾 Cached data (TTL: ${cache.TTL/1000}s)`);

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'X-Cache': 'MISS'
      },
      body: cache.initialLoad
    };
  } catch (error) {
    console.error('Error in getInitialLoad:', error);
    throw error;
  }
}

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

  // Get performances with latest snapshot data only (for table display)
  // Historical snapshots are lazy-loaded on-demand when modal opens
  // ⚡ OPTIMIZATION: Use QUALIFY for efficient window function filtering
  let query = `
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
      COALESCE(s.single_revenue, 0) as single_revenue,
      COALESCE(s.fixed_revenue, 0) as fixed_revenue,
      COALESCE(s.non_fixed_revenue, 0) as non_fixed_revenue,
      COALESCE(s.capacity_percent, 0) as capacity_percent,
      COALESCE(s.budget_percent, 0) as budget_percent,
      COALESCE(s.single_atp, 0) as single_atp,
      COALESCE(s.overall_atp, 0) as overall_atp,
      COALESCE(s.fixed_atp, 0) as fixed_atp,
      COALESCE(s.non_fixed_atp, 0) as non_fixed_atp,
      s.snapshot_date as last_updated,
      p.updated_at as metadata_updated_at
    FROM \`${PROJECT_ID}.${DATASET_ID}.performances\` p
    LEFT JOIN (
      SELECT
        performance_code,
        snapshot_date,
        single_tickets_sold,
        subscription_tickets_sold,
        total_tickets_sold,
        total_revenue,
        single_revenue,
        fixed_revenue,
        non_fixed_revenue,
        capacity_percent,
        budget_percent,
        single_atp,
        overall_atp,
        fixed_atp,
        non_fixed_atp
      FROM \`${PROJECT_ID}.${DATASET_ID}.performance_sales_snapshots\`
      QUALIFY ROW_NUMBER() OVER (PARTITION BY performance_code ORDER BY snapshot_date DESC, created_at DESC) = 1
    ) s
      ON p.performance_code = s.performance_code
    WHERE (p.cancelled = FALSE OR p.cancelled IS NULL)
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
      single_revenue,
      fixed_revenue,
      non_fixed_revenue,
      capacity_percent,
      budget_percent,
      single_atp,
      overall_atp,
      fixed_atp,
      non_fixed_atp,
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

// Get week-over-week changes for all performances in one efficient query
// W/W = (This Week's Tickets) - (Last Week's Tickets)
// Example: This week = 100 tickets, Last week = 80 tickets => W/W = +20
// IMPORTANT: Only calculate W/W for FUTURE performances (not yet happened)
async function getAllWeekOverWeek(bigquery, params, headers) {
  const query = `
    WITH FuturePerformances AS (
      -- Only include performances that haven't happened yet
      SELECT performance_code, performance_date
      FROM \`${PROJECT_ID}.${DATASET_ID}.performances\`
      WHERE performance_date > CURRENT_DATE()
    ),
    LatestSnapshots AS (
      -- Get most recent snapshot for each FUTURE performance (THIS WEEK's data)
      SELECT
        s.performance_code,
        s.snapshot_date,
        s.single_tickets_sold,
        s.total_revenue,
        ROW_NUMBER() OVER (PARTITION BY s.performance_code ORDER BY s.snapshot_date DESC) as rn
      FROM \`${PROJECT_ID}.${DATASET_ID}.performance_sales_snapshots\` s
      INNER JOIN FuturePerformances fp ON s.performance_code = fp.performance_code
    ),
    WeekAgoSnapshots AS (
      -- Find most recent snapshot from 5-10 days ago (LAST WEEK's data)
      -- ⚡ OPTIMIZATION: Simpler date range instead of complex DATE_DIFF calculation
      SELECT
        s.performance_code,
        s.snapshot_date,
        s.single_tickets_sold,
        s.total_revenue,
        l.snapshot_date as latest_date,
        ROW_NUMBER() OVER (
          PARTITION BY s.performance_code
          ORDER BY s.snapshot_date DESC
        ) as rn
      FROM \`${PROJECT_ID}.${DATASET_ID}.performance_sales_snapshots\` s
      INNER JOIN LatestSnapshots l ON s.performance_code = l.performance_code AND l.rn = 1
      WHERE s.snapshot_date BETWEEN DATE_SUB(l.snapshot_date, INTERVAL 10 DAY)
                                AND DATE_SUB(l.snapshot_date, INTERVAL 5 DAY)
    )
    SELECT
      l.performance_code,
      l.snapshot_date as this_week_date,
      l.single_tickets_sold as current_tickets,
      w.snapshot_date as last_week_date,
      w.single_tickets_sold as week_ago_tickets,
      l.single_tickets_sold - COALESCE(w.single_tickets_sold, 0) as tickets_change,
      l.total_revenue as current_revenue,
      w.total_revenue as week_ago_revenue,
      l.total_revenue - COALESCE(w.total_revenue, 0) as revenue_change,
      DATE_DIFF(l.snapshot_date, w.snapshot_date, DAY) as days_diff
    FROM LatestSnapshots l
    LEFT JOIN WeekAgoSnapshots w ON l.performance_code = w.performance_code AND w.rn = 1
    WHERE l.rn = 1
  `;

  const [rows] = await bigquery.query({
    query,
    location: 'US'
  });

  // Transform to object keyed by performance_code
  const wowData = {};
  rows.forEach(row => {
    // Only mark as available if we have a week-ago snapshot AND it's within reasonable range (5-10 days)
    const hasWeekAgoData = row.week_ago_tickets !== null;
    const daysAgo = row.days_diff || 0;
    const isReasonableRange = daysAgo >= 5 && daysAgo <= 10;

    wowData[row.performance_code] = {
      tickets: hasWeekAgoData ? (row.tickets_change || 0) : 0,
      revenue: hasWeekAgoData ? (row.revenue_change || 0) : 0,
      available: hasWeekAgoData && isReasonableRange,
      daysAgo: daysAgo
    };
  });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(wowData)
  };
}
