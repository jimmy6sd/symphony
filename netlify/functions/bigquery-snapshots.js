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

      case 'get-subscription-data':
        return await getSubscriptionData(bigquery, params, headers);

      case 'get-subscription-history':
        return await getSubscriptionHistory(bigquery, params, headers);

      case 'get-ytd-comparison':
        return await getYTDComparison(bigquery, params, headers);

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
      COALESCE(p.single_budget_goal, 0) as single_budget_goal,
      COALESCE(p.subscription_budget_goal, 0) as subscription_budget_goal,
      COALESCE(s.single_tickets_sold, 0) as single_tickets_sold,
      COALESCE(s.fixed_tickets_sold, 0) as subscription_tickets_sold,
      COALESCE(s.non_fixed_tickets_sold, 0) as non_fixed_tickets_sold,
      COALESCE(s.total_tickets_sold, 0) as total_tickets_sold,
      COALESCE(s.single_revenue, 0) as single_revenue,
      COALESCE(s.fixed_revenue, 0) as fixed_revenue,
      COALESCE(s.total_revenue, 0) as total_revenue,
      COALESCE(s.non_fixed_revenue, 0) as non_fixed_revenue,
      COALESCE(s.capacity_percent, 0) as capacity_percent,
      COALESCE(s.budget_percent, 0) as budget_percent,
      COALESCE(s.single_atp, 0) as single_atp,
      COALESCE(s.overall_atp, 0) as overall_atp,
      COALESCE(s.fixed_atp, 0) as fixed_atp,
      COALESCE(s.non_fixed_atp, 0) as non_fixed_atp,
      COALESCE(c.comp_tickets, s.comp_tickets, 0) as comp_tickets,
      s.snapshot_date as last_updated,
      p.updated_at as metadata_updated_at
    FROM \`${PROJECT_ID}.${DATASET_ID}.performances\` p
    LEFT JOIN (
      SELECT
        performance_code,
        snapshot_date,
        single_tickets_sold,
        fixed_tickets_sold,
        non_fixed_tickets_sold,
        total_tickets_sold,
        single_revenue,
        fixed_revenue,
        total_revenue,
        non_fixed_revenue,
        capacity_percent,
        budget_percent,
        single_atp,
        overall_atp,
        fixed_atp,
        non_fixed_atp,
        comp_tickets
      FROM \`${PROJECT_ID}.${DATASET_ID}.performance_sales_snapshots\`
      QUALIFY ROW_NUMBER() OVER (PARTITION BY performance_code ORDER BY snapshot_date DESC, created_at DESC) = 1
    ) s
      ON p.performance_code = s.performance_code
    LEFT JOIN (
      SELECT performance_code, comp_tickets
      FROM \`${PROJECT_ID}.${DATASET_ID}.performance_sales_snapshots\`
      WHERE comp_tickets IS NOT NULL AND comp_tickets > 0
      QUALIFY ROW_NUMBER() OVER (PARTITION BY performance_code ORDER BY snapshot_date DESC, created_at DESC) = 1
    ) c
      ON p.performance_code = c.performance_code
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
    nonFixedTicketsSold: row.non_fixed_tickets_sold || 0,
    singleTicketRevenue: row.single_revenue || 0,
    subscriptionRevenue: row.fixed_revenue || 0,
    totalRevenue: row.total_revenue || 0,
    occupancyGoal: row.occupancy_goal || 85,
    budgetGoal: row.budget_goal || 0,
    capacityPercent: row.capacity_percent || 0,
    budgetPercent: row.budget_percent || 0,
    compTickets: row.comp_tickets || 0,
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
      comp_tickets,
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
        s.total_tickets_sold,
        s.total_revenue,
        ROW_NUMBER() OVER (PARTITION BY s.performance_code ORDER BY s.snapshot_date DESC, s.created_at DESC) as rn
      FROM \`${PROJECT_ID}.${DATASET_ID}.performance_sales_snapshots\` s
      INNER JOIN FuturePerformances fp ON s.performance_code = fp.performance_code
    ),
    WeekAgoSnapshots AS (
      -- Find most recent snapshot from 5-10 days ago (LAST WEEK's data)
      -- ⚡ OPTIMIZATION: Simpler date range instead of complex DATE_DIFF calculation
      SELECT
        s.performance_code,
        s.snapshot_date,
        s.total_tickets_sold,
        s.total_revenue,
        l.snapshot_date as latest_date,
        ROW_NUMBER() OVER (
          PARTITION BY s.performance_code
          ORDER BY s.snapshot_date DESC, s.created_at DESC
        ) as rn
      FROM \`${PROJECT_ID}.${DATASET_ID}.performance_sales_snapshots\` s
      INNER JOIN LatestSnapshots l ON s.performance_code = l.performance_code AND l.rn = 1
      WHERE s.snapshot_date BETWEEN DATE_SUB(l.snapshot_date, INTERVAL 10 DAY)
                                AND DATE_SUB(l.snapshot_date, INTERVAL 5 DAY)
    )
    SELECT
      l.performance_code,
      l.snapshot_date as this_week_date,
      l.total_tickets_sold as current_tickets,
      w.snapshot_date as last_week_date,
      w.total_tickets_sold as week_ago_tickets,
      l.total_tickets_sold - COALESCE(w.total_tickets_sold, 0) as tickets_change,
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

// Get subscription package sales data with day-over-day changes and category projections
async function getSubscriptionData(bigquery, params, headers) {
  const { category, season = '26-27' } = params;

  // Build filter conditions
  let filterConditions = [];
  if (category) filterConditions.push(`category = '${category}'`);
  if (season) filterConditions.push(`season = '${season}'`);
  const filterClause = filterConditions.length > 0 ? `AND ${filterConditions.join(' AND ')}` : '';

  // Get latest subscription snapshot data
  // Note: Using CTEs to materialize data before JOIN (BigQuery doesn't support subqueries in JOIN predicates)
  const query = `
    WITH SnapshotDates AS (
      SELECT
        MAX(snapshot_date) as latest_date,
        MAX(CASE WHEN snapshot_date < (SELECT MAX(snapshot_date) FROM \`${PROJECT_ID}.${DATASET_ID}.subscription_sales_snapshots\`) THEN snapshot_date END) as prev_date
      FROM \`${PROJECT_ID}.${DATASET_ID}.subscription_sales_snapshots\`
    ),
    LatestData AS (
      SELECT *
      FROM \`${PROJECT_ID}.${DATASET_ID}.subscription_sales_snapshots\`
      WHERE snapshot_date = (SELECT latest_date FROM SnapshotDates)
      ${filterClause}
    ),
    PreviousData AS (
      SELECT *
      FROM \`${PROJECT_ID}.${DATASET_ID}.subscription_sales_snapshots\`
      WHERE snapshot_date = (SELECT prev_date FROM SnapshotDates)
    )
    SELECT
      l.snapshot_date,
      l.season,
      l.category,
      l.package_type,
      l.package_name,
      l.package_seats,
      l.perf_seats,
      l.total_amount,
      l.paid_amount,
      l.orders,
      -- Day-over-day changes
      l.package_seats - COALESCE(p.package_seats, l.package_seats) as package_seats_change,
      l.total_amount - COALESCE(p.total_amount, l.total_amount) as revenue_change,
      l.orders - COALESCE(p.orders, l.orders) as orders_change
    FROM LatestData l
    LEFT JOIN PreviousData p
      ON l.package_name = p.package_name
      AND l.category = p.category
    ORDER BY l.category, l.package_type, l.package_name
  `;

  const [rows] = await bigquery.query({
    query,
    location: 'US'
  });

  // Transform data
  const data = rows.map(row => ({
    snapshot_date: typeof row.snapshot_date === 'object' ? row.snapshot_date.value : row.snapshot_date,
    season: row.season,
    category: row.category,
    package_type: row.package_type,
    package_name: row.package_name,
    package_seats: row.package_seats,
    perf_seats: row.perf_seats,
    total_amount: row.total_amount,
    paid_amount: row.paid_amount,
    orders: row.orders
  }));

  // Build day-over-day lookup
  const dayOverDay = {};
  rows.forEach(row => {
    dayOverDay[row.package_name] = {
      package_seats_change: row.package_seats_change || 0,
      revenue_change: row.revenue_change || 0,
      orders_change: row.orders_change || 0
    };
  });

  // Calculate category rollup projections (for 26-27 vs 25-26 comparison)
  const categoryProjections = await calculateCategoryProjections(bigquery, data, season);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      data,
      dayOverDay,
      categoryProjections,
      _meta: {
        timestamp: new Date().toISOString(),
        packageCount: data.length,
        currentSeason: season
      }
    })
  };
}

// Calculate category-level projections comparing current season to target comp
async function calculateCategoryProjections(bigquery, currentData, currentSeason) {
  // Only calculate for Classical and Pops (they have historical data)
  const categories = ['Classical', 'Pops'];

  // Calculate target season (previous season)
  // e.g., 26-27 -> 25-26, 25-26 -> 24-25
  const [startYear] = currentSeason.split('-').map(y => parseInt(y));
  const targetSeason = `${String(startYear - 1).padStart(2, '0')}-${String(startYear).padStart(2, '0')}`;

  // Check if we have current season data
  const hasCurrentData = currentData.length > 0 && currentData[0].season === currentSeason;

  if (!hasCurrentData) {
    // No current season data yet - return placeholder state
    return {
      status: 'awaiting_data',
      message: `Awaiting ${currentSeason} subscription data`,
      categories: {}
    };
  }

  // Calculate current totals by category
  const currentByCategory = {};
  currentData.forEach(pkg => {
    const cat = pkg.category;
    if (!currentByCategory[cat]) {
      currentByCategory[cat] = { packages: 0, revenue: 0, orders: 0 };
    }
    currentByCategory[cat].packages += pkg.package_seats || 0;
    currentByCategory[cat].revenue += pkg.total_amount || 0;
    currentByCategory[cat].orders += pkg.orders || 0;
  });

  // Get current snapshot date
  const currentSnapshotDate = currentData[0]?.snapshot_date;

  // Get target comp data at same calendar date (1 year ago)
  const targetCompData = await getTargetCompAtDate(bigquery, targetSeason, currentSnapshotDate);

  // Get target comp final totals from subscription_historical_data
  const targetFinalData = await getTargetCompFinals(bigquery, targetSeason);

  // Calculate projections for each category
  const projections = {};

  for (const cat of categories) {
    const current = currentByCategory[cat] || { packages: 0, revenue: 0, orders: 0 };
    const targetAtDate = targetCompData[cat] || { packages: 0, revenue: 0 };
    const targetFinal = targetFinalData[cat] || { packages: 0, revenue: 0 };

    // Calculate variance at current date
    const packagesVariance = current.packages - targetAtDate.packages;
    const revenueVariance = current.revenue - targetAtDate.revenue;

    // Project final (apply variance to target final, floor at current)
    const projectedPackages = Math.max(current.packages, targetFinal.packages + packagesVariance);
    const projectedRevenue = Math.max(current.revenue, targetFinal.revenue + revenueVariance);

    // Calculate variance vs target final
    const varianceVsTarget = projectedPackages - targetFinal.packages;
    const varianceVsTargetRevenue = projectedRevenue - targetFinal.revenue;
    const variancePercent = targetFinal.packages > 0 ? (varianceVsTarget / targetFinal.packages * 100) : 0;

    projections[cat] = {
      current: {
        packages: current.packages,
        revenue: current.revenue,
        orders: current.orders,
        snapshotDate: currentSnapshotDate
      },
      targetAtDate: {
        packages: targetAtDate.packages,
        revenue: targetAtDate.revenue,
        snapshotDate: targetAtDate.snapshotDate
      },
      targetFinal: {
        packages: targetFinal.packages,
        revenue: targetFinal.revenue
      },
      projected: {
        packages: Math.round(projectedPackages),
        revenue: Math.round(projectedRevenue)
      },
      variance: {
        vsDatePackages: packagesVariance,
        vsDateRevenue: revenueVariance,
        vsTargetPackages: varianceVsTarget,
        vsTargetRevenue: varianceVsTargetRevenue,
        vsTargetPercent: Math.round(variancePercent * 10) / 10
      }
    };
  }

  return {
    status: 'active',
    currentSeason,
    targetSeason,
    categories: projections
  };
}

// Get target comp category totals at same calendar date (1 year prior)
// Uses subscription_historical_data (weekly aggregates) for historical seasons
async function getTargetCompAtDate(bigquery, targetSeason, currentDate) {
  if (!currentDate) return {};

  // Calculate ISO week number for the current date
  const currentDateObj = new Date(currentDate);
  const weekNumber = getISOWeek(currentDateObj);

  // Query subscription_historical_data for nearest week
  const query = `
    SELECT
      series as category,
      snapshot_date,
      week_number,
      total_units as packages,
      total_revenue as revenue
    FROM \`${PROJECT_ID}.${DATASET_ID}.subscription_historical_data\`
    WHERE season = '${targetSeason}'
      AND series IN ('Classical', 'Pops')
      AND is_final = FALSE
    ORDER BY ABS(week_number - ${weekNumber}) ASC
  `;

  try {
    const [rows] = await bigquery.query({ query, location: 'US' });

    // Get the closest week for each category
    const result = {};
    const seenCategories = new Set();

    rows.forEach(row => {
      if (!seenCategories.has(row.category)) {
        seenCategories.add(row.category);
        result[row.category] = {
          packages: row.packages || 0,
          revenue: row.revenue || 0,
          weekNumber: row.week_number,
          snapshotDate: row.snapshot_date ? (typeof row.snapshot_date === 'object' ? row.snapshot_date.value : row.snapshot_date) : null
        };
      }
    });
    return result;
  } catch (error) {
    console.error('Error getting target comp at date:', error);
    return {};
  }
}

// Calculate ISO week number from date
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Get target comp final totals from subscription_historical_data
async function getTargetCompFinals(bigquery, targetSeason) {
  const query = `
    SELECT
      series as category,
      total_units as packages,
      total_revenue as revenue
    FROM \`${PROJECT_ID}.${DATASET_ID}.subscription_historical_data\`
    WHERE season = '${targetSeason}'
      AND is_final = TRUE
      AND series IN ('Classical', 'Pops')
  `;

  try {
    const [rows] = await bigquery.query({ query, location: 'US' });

    const result = {};
    rows.forEach(row => {
      result[row.category] = {
        packages: row.packages || 0,
        revenue: row.revenue || 0
      };
    });
    return result;
  } catch (error) {
    console.error('Error getting target comp finals:', error);
    return {};
  }
}

// Get subscription historical data for sales curve charts
// Returns weekly snapshots grouped by season for comparison
async function getSubscriptionHistory(bigquery, params, headers) {
  const { series } = params;

  if (!series) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'series parameter required (Classical or Pops)' })
    };
  }

  // Query all historical data for this series
  const query = `
    SELECT
      series,
      season,
      snapshot_date,
      week_number,
      new_units,
      new_revenue,
      renewal_units,
      renewal_revenue,
      total_units,
      total_revenue,
      is_final
    FROM \`${PROJECT_ID}.${DATASET_ID}.subscription_historical_data\`
    WHERE series = @series
    ORDER BY season DESC, week_number ASC
  `;

  const [rows] = await bigquery.query({
    query,
    params: { series },
    location: 'US'
  });

  // Group by season
  const seasons = {};
  rows.forEach(row => {
    const season = row.season;
    if (!seasons[season]) {
      seasons[season] = {
        season,
        snapshots: [],
        final: null
      };
    }

    const snapshot = {
      snapshot_date: row.snapshot_date ? (typeof row.snapshot_date === 'object' ? row.snapshot_date.value : row.snapshot_date) : null,
      week_number: row.week_number,
      new_units: row.new_units,
      new_revenue: row.new_revenue,
      renewal_units: row.renewal_units,
      renewal_revenue: row.renewal_revenue,
      total_units: row.total_units,
      total_revenue: row.total_revenue
    };

    if (row.is_final) {
      seasons[season].final = snapshot;
    } else {
      seasons[season].snapshots.push(snapshot);
    }
  });

  // Sort snapshots within each season by week_number
  Object.values(seasons).forEach(s => {
    s.snapshots.sort((a, b) => a.week_number - b.week_number);
  });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      series,
      seasons,
      _meta: {
        timestamp: new Date().toISOString(),
        seasonCount: Object.keys(seasons).length
      }
    })
  };
}

// Get YTD comparison data for year-over-year analysis
// Returns weekly YTD totals grouped by fiscal year
async function getYTDComparison(bigquery, params, headers) {
  const { fiscalYears, weekType = 'fiscal', attributionMode = 'snapshot' } = params;

  // Default to all available years
  const yearsFilter = fiscalYears
    ? fiscalYears.split(',').map(y => `'${y.trim()}'`).join(',')
    : "'FY23','FY24','FY25','FY26'";

  // Select week column based on weekType parameter
  const weekColumn = weekType === 'iso' ? 'iso_week' : 'fiscal_week';

  // Query historical data (FY23-FY25)
  // Two modes: snapshot (from ytd_weekly_totals) or performance (from ytd_historical_performances)
  let histQuery;

  if (attributionMode === 'performance') {
    // Performance attribution: Revenue attributed to when concerts occurred
    // Use ytd_historical_performances table with performance dates and actual revenue
    histQuery = `
      WITH performance_data AS (
        SELECT
          CASE
            WHEN season = '22-23' THEN 'FY23'
            WHEN season = '23-24' THEN 'FY24'
            WHEN season = '24-25' THEN 'FY25'
            ELSE NULL
          END as fiscal_year,
          ${weekColumn} as week,
          fiscal_week,
          iso_week,
          performance_date,
          COALESCE(single_revenue, 0) + COALESCE(subscription_revenue, 0) as total_revenue,
          COALESCE(single_tickets, 0) + COALESCE(subscription_tickets, 0) as total_tickets,
          COALESCE(single_revenue, 0) as single_revenue,
          COALESCE(single_tickets, 0) as single_tickets,
          COALESCE(subscription_revenue, 0) as subscription_revenue,
          COALESCE(subscription_tickets, 0) as subscription_tickets
        FROM \`${PROJECT_ID}.${DATASET_ID}.ytd_historical_performances\`
        WHERE season IN ('22-23', '23-24', '24-25')
      ),
      weekly_totals AS (
        SELECT
          fiscal_year,
          week,
          fiscal_week,
          iso_week,
          SUM(total_revenue) as week_revenue,
          SUM(total_tickets) as week_tickets,
          SUM(single_revenue) as week_single_revenue,
          SUM(single_tickets) as week_single_tickets,
          SUM(subscription_revenue) as week_subscription_revenue,
          SUM(subscription_tickets) as week_subscription_tickets,
          COUNT(*) as performance_count
        FROM performance_data
        GROUP BY fiscal_year, week, fiscal_week, iso_week
      ),
      ytd_running_totals AS (
        SELECT
          fiscal_year,
          week,
          fiscal_week,
          iso_week,
          SUM(week_revenue) OVER (PARTITION BY fiscal_year ORDER BY week) as ytd_revenue,
          SUM(week_tickets) OVER (PARTITION BY fiscal_year ORDER BY week) as ytd_tickets,
          SUM(week_single_revenue) OVER (PARTITION BY fiscal_year ORDER BY week) as ytd_single_revenue,
          SUM(week_single_tickets) OVER (PARTITION BY fiscal_year ORDER BY week) as ytd_single_tickets,
          SUM(week_subscription_revenue) OVER (PARTITION BY fiscal_year ORDER BY week) as ytd_subscription_revenue,
          SUM(week_subscription_tickets) OVER (PARTITION BY fiscal_year ORDER BY week) as ytd_subscription_tickets,
          SUM(performance_count) OVER (PARTITION BY fiscal_year ORDER BY week) as ytd_performance_count
        FROM weekly_totals
      )
      SELECT
        fiscal_year,
        week,
        fiscal_week,
        iso_week,
        NULL as week_end_date,
        ytd_tickets as ytd_tickets_sold,
        ytd_single_tickets,
        ytd_subscription_tickets,
        ytd_revenue,
        ytd_single_revenue,
        ytd_subscription_revenue,
        ytd_performance_count as performance_count
      FROM ytd_running_totals
      WHERE fiscal_year IN (${yearsFilter})
      ORDER BY fiscal_year, week
    `;
  } else {
    // Snapshot attribution: Revenue attributed to when sales data was captured (current behavior)
    // Filter to excel-validated-json source only (verified accurate data)
    // Deduplicate by taking the latest entry per fiscal_year + fiscal_week
    histQuery = `
      WITH ranked AS (
        SELECT
          fiscal_year,
          ${weekColumn} as week,
          iso_week,
          fiscal_week,
          week_end_date,
          ytd_tickets_sold,
          ytd_single_tickets,
          ytd_subscription_tickets,
          ytd_revenue,
          ytd_single_revenue,
          ytd_subscription_revenue,
          performance_count,
          ROW_NUMBER() OVER (
            PARTITION BY fiscal_year, fiscal_week
            ORDER BY week_end_date DESC, ytd_tickets_sold DESC
          ) as rn
        FROM \`${PROJECT_ID}.${DATASET_ID}.ytd_weekly_totals\`
        WHERE fiscal_year IN (${yearsFilter})
          AND source = 'excel-validated-json'
      )
      SELECT * EXCEPT(rn)
      FROM ranked
      WHERE rn = 1
      ORDER BY fiscal_year, ${weekColumn}
    `;
  }

  // Query live FY26 data from snapshots (current YTD by week)
  // FY26 = season starting with '25-26' (July 2025 - June 2026)
  // Two modes: snapshot (when sales captured) or performance (when concerts occurred)
  let liveQuery;

  if (attributionMode === 'performance') {
    // Performance attribution: Group by performance_date week
    liveQuery = `
      WITH latest_snapshots AS (
        SELECT
          s.performance_code,
          p.performance_date,
          s.snapshot_date,
          s.single_tickets_sold,
          s.single_revenue,
          COALESCE(s.fixed_tickets_sold, 0) + COALESCE(s.non_fixed_tickets_sold, 0) as subscription_tickets,
          COALESCE(s.fixed_revenue, 0) + COALESCE(s.non_fixed_revenue, 0) as subscription_revenue,
          ROW_NUMBER() OVER (
            PARTITION BY s.performance_code
            ORDER BY s.snapshot_date DESC
          ) as rn
        FROM \`${PROJECT_ID}.${DATASET_ID}.performances\` p
        JOIN \`${PROJECT_ID}.${DATASET_ID}.performance_sales_snapshots\` s
          ON p.performance_code = s.performance_code
        WHERE p.season LIKE '25-26%'
          AND (p.cancelled IS NULL OR p.cancelled = false)
      ),
      weekly_totals AS (
        SELECT
          DATE_TRUNC(performance_date, WEEK(SATURDAY)) as week_start,
          SUM(single_tickets_sold) as week_single_tickets,
          SUM(single_revenue) as week_single_revenue,
          SUM(subscription_tickets) as week_subscription_tickets,
          SUM(subscription_revenue) as week_subscription_revenue,
          SUM(COALESCE(single_tickets_sold, 0) + COALESCE(subscription_tickets, 0)) as week_total_tickets,
          SUM(COALESCE(single_revenue, 0) + COALESCE(subscription_revenue, 0)) as week_total_revenue,
          COUNT(DISTINCT performance_code) as perf_count
        FROM latest_snapshots
        WHERE rn = 1
        GROUP BY week_start
      ),
      ytd_running_totals AS (
        SELECT
          week_start,
          SUM(week_total_revenue) OVER (ORDER BY week_start) as total_revenue,
          SUM(week_total_tickets) OVER (ORDER BY week_start) as total_tickets,
          SUM(week_single_revenue) OVER (ORDER BY week_start) as single_revenue,
          SUM(week_single_tickets) OVER (ORDER BY week_start) as single_tickets,
          SUM(week_subscription_revenue) OVER (ORDER BY week_start) as subscription_revenue,
          SUM(week_subscription_tickets) OVER (ORDER BY week_start) as subscription_tickets,
          SUM(perf_count) OVER (ORDER BY week_start) as perf_count
        FROM weekly_totals
      )
      SELECT
        week_start,
        single_tickets,
        single_revenue,
        subscription_tickets,
        subscription_revenue,
        total_tickets,
        total_revenue,
        perf_count,
        -- Calculate fiscal week (ISO week offset by 26: ISO week 27 = fiscal week 1)
        CASE WHEN EXTRACT(ISOWEEK FROM week_start) >= 27
             THEN EXTRACT(ISOWEEK FROM week_start) - 26
             ELSE EXTRACT(ISOWEEK FROM week_start) + 26 END as fiscal_week,
        EXTRACT(ISOWEEK FROM week_start) as iso_week
      FROM ytd_running_totals
      ORDER BY week_start
    `;
  } else {
    // Snapshot attribution: Group by snapshot_date week (current behavior)
    liveQuery = `
      WITH latest_snapshots AS (
        SELECT
          s.performance_code,
          s.snapshot_date,
          s.single_tickets_sold,
          s.single_revenue,
          COALESCE(s.fixed_tickets_sold, 0) + COALESCE(s.non_fixed_tickets_sold, 0) as subscription_tickets,
          COALESCE(s.fixed_revenue, 0) + COALESCE(s.non_fixed_revenue, 0) as subscription_revenue,
          ROW_NUMBER() OVER (
            PARTITION BY s.performance_code, DATE_TRUNC(s.snapshot_date, WEEK(SATURDAY))
            ORDER BY s.snapshot_date DESC
          ) as rn
        FROM \`${PROJECT_ID}.${DATASET_ID}.performances\` p
        JOIN \`${PROJECT_ID}.${DATASET_ID}.performance_sales_snapshots\` s
          ON p.performance_code = s.performance_code
        WHERE p.season LIKE '25-26%'
          AND (p.cancelled IS NULL OR p.cancelled = false)
      ),
      weekly_totals AS (
        SELECT
          DATE_TRUNC(snapshot_date, WEEK(SATURDAY)) as week_start,
          SUM(single_tickets_sold) as single_tickets,
          SUM(single_revenue) as single_revenue,
          SUM(subscription_tickets) as subscription_tickets,
          SUM(subscription_revenue) as subscription_revenue,
          SUM(COALESCE(single_tickets_sold, 0) + COALESCE(subscription_tickets, 0)) as total_tickets,
          SUM(COALESCE(single_revenue, 0) + COALESCE(subscription_revenue, 0)) as total_revenue,
          COUNT(DISTINCT performance_code) as perf_count
        FROM latest_snapshots
        WHERE rn = 1
        GROUP BY week_start
      )
      SELECT
        week_start,
        single_tickets,
        single_revenue,
        subscription_tickets,
        subscription_revenue,
        total_tickets,
        total_revenue,
        perf_count,
        -- Calculate fiscal week (ISO week offset by 26: ISO week 27 = fiscal week 1)
        CASE WHEN EXTRACT(ISOWEEK FROM week_start) >= 27
             THEN EXTRACT(ISOWEEK FROM week_start) - 26
             ELSE EXTRACT(ISOWEEK FROM week_start) + 26 END as fiscal_week,
        EXTRACT(ISOWEEK FROM week_start) as iso_week
      FROM weekly_totals
      ORDER BY week_start
    `;
  }

  // Run both queries in parallel
  const [[histRows], [liveRows]] = await Promise.all([
    bigquery.query({ query: histQuery, location: 'US' }),
    bigquery.query({ query: liveQuery, location: 'US' })
  ]);

  // Transform historical data to frontend-friendly format grouped by year
  const byYear = {};
  histRows.forEach(row => {
    const fy = row.fiscal_year;
    if (!byYear[fy]) {
      byYear[fy] = [];
    }

    // Handle week_end_date - may be null in performance attribution mode
    let dateValue = null;
    if (row.week_end_date) {
      dateValue = typeof row.week_end_date === 'object' ? row.week_end_date.value : row.week_end_date;
    }

    byYear[fy].push({
      week: row.week,
      fiscalWeek: row.fiscal_week,
      isoWeek: row.iso_week,
      date: dateValue,
      tickets: row.ytd_tickets_sold || 0,
      singleTickets: row.ytd_single_tickets || 0,
      subscriptionTickets: row.ytd_subscription_tickets || 0,
      revenue: row.ytd_revenue || 0,
      singleRevenue: row.ytd_single_revenue || 0,
      subscriptionRevenue: row.ytd_subscription_revenue || 0,
      performanceCount: row.performance_count || 0
    });
  });

  // Add live FY26 data as "FY26 Current" series
  if (liveRows && liveRows.length > 0) {
    byYear['FY26 Current'] = [];
    let cumulativeTickets = 0;
    let cumulativeRevenue = 0;

    // Sort by week and calculate running totals
    const sortedLive = liveRows.sort((a, b) => {
      const dateA = typeof a.week_start === 'object' ? a.week_start.value : a.week_start;
      const dateB = typeof b.week_start === 'object' ? b.week_start.value : b.week_start;
      return dateA.localeCompare(dateB);
    });

    sortedLive.forEach(row => {
      const weekNum = weekType === 'iso' ? row.iso_week : row.fiscal_week;
      const weekStart = typeof row.week_start === 'object' ? row.week_start.value : row.week_start;

      // The query already gives us the snapshot totals for each week
      // which represent YTD at that point (sum of all performances' current sold)
      byYear['FY26 Current'].push({
        week: weekNum,
        fiscalWeek: row.fiscal_week,
        isoWeek: row.iso_week,
        date: weekStart,
        tickets: row.total_tickets || 0,
        singleTickets: row.single_tickets || 0,
        subscriptionTickets: row.subscription_tickets || 0,
        revenue: row.total_revenue || 0,
        singleRevenue: row.single_revenue || 0,
        subscriptionRevenue: row.subscription_revenue || 0,
        performanceCount: row.perf_count || 0,
        source: 'live-snapshots'
      });
    });
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      data: byYear,
      _meta: {
        timestamp: new Date().toISOString(),
        fiscalYears: Object.keys(byYear).sort(),
        weekType: weekType,
        attributionMode: attributionMode,
        attributionModeSupport: {
          'FY23': ['snapshot', 'performance'],
          'FY24': ['snapshot', 'performance'],
          'FY25': ['snapshot', 'performance'],
          'FY26': ['snapshot', 'performance']
        },
        totalRecords: histRows.length,
        liveDataWeeks: liveRows?.length || 0
      }
    })
  };
}
