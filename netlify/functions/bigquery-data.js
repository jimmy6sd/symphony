// BigQuery Data Management Function for Symphony Dashboard
// Handles data retrieval and updates for Netlify deployment

const { BigQuery } = require('@google-cloud/bigquery');

// Initialize BigQuery client
const initializeBigQuery = () => {
  try {
    const json = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (!json) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable not set');
    }

    const creds = JSON.parse(json);

    // Fix escaped newlines, which is common in env vars
    if (creds.private_key && creds.private_key.includes('\\n')) {
      creds.private_key = creds.private_key.replace(/\\n/g, '\n');
    }

    return new BigQuery({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || creds.project_id,
      credentials: {
        client_email: creds.client_email,
        private_key: creds.private_key,
      },
      location: 'US'
    });
  } catch (error) {
    console.error('BigQuery initialization error:', error.message);
    throw error;
  }
};

const DATASET_ID = process.env.BIGQUERY_DATASET || 'symphony_dashboard';

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
        return await getPerformances(bigquery, params, headers);
      case 'get-performance-detail':
        return await getPerformanceDetail(bigquery, params, headers);
      case 'update-performance':
        return await updatePerformance(bigquery, JSON.parse(event.body), headers);
      case 'sync-data':
        return await syncDataFromSource(bigquery, headers);
      default:
        return await getPerformances(bigquery, params, headers);
    }
  } catch (error) {
    console.error('BigQuery function error:', error);
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

// Get performances with optional filtering
async function getPerformances(bigquery, params, headers) {
  const {
    season,
    series,
    dateFrom,
    dateTo,
    hasRevenue,
    limit = '1000',  // Increased default limit to get all performances
    offset = '0'
  } = params;

  let query = `
    SELECT
      performance_id,
      performance_code,
      title,
      series,
      performance_date,
      venue,
      season,
      capacity,
      single_tickets_sold,
      subscription_tickets_sold,
      total_tickets_sold,
      total_revenue,
      occupancy_goal,
      budget_goal,
      capacity_percent,
      budget_percent,
      occupancy_percent,
      has_sales_data,
      updated_at
    FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.performances\`
    WHERE 1=1
  `;

  const queryParams = [];

  if (season) {
    query += ` AND season = ?`;
    queryParams.push(season);
  }

  if (series) {
    query += ` AND series = ?`;
    queryParams.push(series);
  }

  if (dateFrom) {
    query += ` AND performance_date >= ?`;
    queryParams.push(dateFrom);
  }

  if (dateTo) {
    query += ` AND performance_date <= ?`;
    queryParams.push(dateTo);
  }

  if (hasRevenue === 'true') {
    query += ` AND total_revenue > 0`;
  }

  query += `
    ORDER BY performance_date ASC
    LIMIT ${parseInt(limit)}
    OFFSET ${parseInt(offset)}
  `;

  const options = {
    query: query,
    params: queryParams,
    location: 'US',
  };

  const [rows] = await bigquery.query(options);

  // Transform dates for frontend compatibility and remove duplicates
  const uniquePerformances = new Map();

  rows.forEach(row => {
    // Use performance_id as key to deduplicate
    if (!uniquePerformances.has(row.performance_id)) {
      uniquePerformances.set(row.performance_id, {
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
        hasSalesData: row.has_sales_data || false,
        // Add weekly sales placeholder for compatibility
        weeklySales: []
      });
    }
  });

  const performances = Array.from(uniquePerformances.values());

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(performances)
  };
}

// Get detailed performance data including weekly sales
async function getPerformanceDetail(bigquery, params, headers) {
  const { performanceId } = params;

  if (!performanceId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Performance ID is required' })
    };
  }

  // Get performance details
  const performanceQuery = `
    SELECT
      *
    FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.performances\`
    WHERE performance_id = ?
  `;

  // Get weekly sales data
  const weeklySalesQuery = `
    SELECT
      week_number,
      tickets_sold,
      percentage,
      cumulative_tickets,
      cumulative_percentage
    FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.weekly_sales\`
    WHERE performance_id = ?
    ORDER BY week_number ASC
  `;

  const [performanceRows] = await bigquery.query({
    query: performanceQuery,
    params: [parseInt(performanceId)],
    location: 'US'
  });

  const [salesRows] = await bigquery.query({
    query: weeklySalesQuery,
    params: [parseInt(performanceId)],
    location: 'US'
  });

  if (performanceRows.length === 0) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Performance not found' })
    };
  }

  const performance = performanceRows[0];
  const weeklySales = salesRows.map(row => ({
    week: row.week_number,
    ticketsSold: row.tickets_sold,
    percentage: row.percentage,
    cumulativeTickets: row.cumulative_tickets,
    cumulativePercentage: row.cumulative_percentage
  }));

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      ...performance,
      weeklySales
    })
  };
}

// Update performance data
async function updatePerformance(bigquery, data, headers) {
  const {
    performanceId,
    singleTicketsSold,
    subscriptionTicketsSold,
    totalRevenue,
    weeklySales
  } = data;

  if (!performanceId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Performance ID is required' })
    };
  }

  // Update main performance record
  const updateQuery = `
    UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.performances\`
    SET
      single_tickets_sold = ?,
      subscription_tickets_sold = ?,
      total_revenue = ?,
      has_sales_data = TRUE,
      updated_at = CURRENT_TIMESTAMP()
    WHERE performance_id = ?
  `;

  await bigquery.query({
    query: updateQuery,
    params: [
      singleTicketsSold || 0,
      subscriptionTicketsSold || 0,
      totalRevenue || 0,
      parseInt(performanceId)
    ],
    location: 'US'
  });

  // Update weekly sales if provided
  if (weeklySales && weeklySales.length > 0) {
    // Delete existing weekly sales
    await bigquery.query({
      query: `DELETE FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.weekly_sales\` WHERE performance_id = ?`,
      params: [parseInt(performanceId)],
      location: 'US'
    });

    // Insert new weekly sales data
    const salesData = weeklySales.map(week => [
      parseInt(performanceId),
      week.week,
      week.ticketsSold,
      week.percentage,
      week.cumulativeTickets || null,
      week.cumulativePercentage || null
    ]);

    const insertQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.weekly_sales\`
      (performance_id, week_number, tickets_sold, percentage, cumulative_tickets, cumulative_percentage)
      VALUES ${salesData.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')}
    `;

    await bigquery.query({
      query: insertQuery,
      params: salesData.flat(),
      location: 'US'
    });
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true, message: 'Performance updated successfully' })
  };
}

// Sync data from external source (Tessitura API)
async function syncDataFromSource(bigquery, headers) {
  // This would typically fetch from Tessitura API and update BigQuery
  // For now, return a placeholder response

  const refreshId = `refresh_${Date.now()}`;

  // Log the sync operation
  const logQuery = `
    INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.refresh_log\`
    (refresh_id, refresh_type, start_time, status)
    VALUES (?, 'manual', CURRENT_TIMESTAMP(), 'completed')
  `;

  await bigquery.query({
    query: logQuery,
    params: [refreshId],
    location: 'US'
  });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      message: 'Data sync initiated',
      refreshId
    })
  };
}