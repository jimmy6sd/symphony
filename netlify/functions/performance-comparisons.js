// Performance Sales Comparisons API
// Handles CRUD operations for custom comparison lines on sales progression charts

const { BigQuery } = require('@google-cloud/bigquery');
const { v4: uuidv4 } = require('uuid');

// Initialize BigQuery client
const initializeBigQuery = () => {
  try {
    const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (!credentialsEnv) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable not set');
    }

    let credentials;

    // Check if it's a file path or JSON content
    if (credentialsEnv.startsWith('{')) {
      credentials = JSON.parse(credentialsEnv);
    } else {
      const fs = require('fs');
      const path = require('path');
      const credentialsFile = path.resolve(credentialsEnv);
      const credentialsJson = fs.readFileSync(credentialsFile, 'utf8');
      credentials = JSON.parse(credentialsJson);
    }

    // Fix escaped newlines
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
const TABLE_ID = 'performance_sales_comparisons';

// Main handler
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const bigquery = initializeBigQuery();
    const method = event.httpMethod;
    const path = event.path;

    // Parse comparison ID from path if present
    const pathMatch = path.match(/\/performance-comparisons\/([^/]+)$/);
    const comparisonId = pathMatch ? pathMatch[1] : null;

    switch (method) {
      case 'GET':
        return await getComparisons(bigquery, event.queryStringParameters, headers);

      case 'POST':
        return await createComparison(bigquery, JSON.parse(event.body || '{}'), headers);

      case 'PUT':
        if (!comparisonId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Comparison ID required for update' })
          };
        }
        return await updateComparison(bigquery, comparisonId, JSON.parse(event.body || '{}'), headers);

      case 'DELETE':
        if (!comparisonId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Comparison ID required for delete' })
          };
        }
        return await deleteComparison(bigquery, comparisonId, headers);

      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
  } catch (error) {
    console.error('API error:', error);
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

// GET - Fetch comparisons for a performance
async function getComparisons(bigquery, params, headers) {
  const { performanceId } = params || {};

  if (!performanceId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'performanceId query parameter required' })
    };
  }

  const query = `
    SELECT
      comparison_id,
      performance_id,
      comparison_name,
      weeks_data,
      line_color,
      line_style,
      is_target,
      created_at,
      updated_at
    FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
    WHERE performance_id = ?
    ORDER BY is_target DESC, created_at DESC
  `;

  const [rows] = await bigquery.query({
    query,
    params: [String(performanceId)], // Convert to string for BigQuery
    location: 'US'
  });

  // Parse weeks_data CSV into array for convenience
  const comparisons = rows.map(row => ({
    ...row,
    weeksArray: parseWeeksData(row.weeks_data)
  }));

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(comparisons)
  };
}

// POST - Create new comparison
async function createComparison(bigquery, data, headers) {
  const {
    performanceId,
    comparisonName,
    weeksData,
    lineColor = '#4285f4',
    lineStyle = 'dashed',
    isTarget = false
  } = data;

  // Validation
  if (!performanceId || !comparisonName || !weeksData) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: 'Missing required fields',
        required: ['performanceId', 'comparisonName', 'weeksData']
      })
    };
  }

  // Validate weeksData format (should be CSV string)
  const weeksArray = parseWeeksData(weeksData);
  if (weeksArray.length === 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: 'Invalid weeksData format. Expected comma-separated numbers (e.g., "1200,2400,3500")'
      })
    };
  }

  const comparisonId = uuidv4();
  const now = new Date().toISOString();

  // Business Rule: If setting this as target, unset all other targets for this performance
  if (isTarget) {
    const unsetQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
      SET is_target = FALSE, updated_at = CURRENT_TIMESTAMP()
      WHERE performance_id = ? AND is_target = TRUE
    `;

    await bigquery.query({
      query: unsetQuery,
      params: [String(performanceId)],
      location: 'US'
    });
  }

  const query = `
    INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
    (comparison_id, performance_id, comparison_name, weeks_data, line_color, line_style, is_target, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, TIMESTAMP(?), TIMESTAMP(?))
  `;

  await bigquery.query({
    query,
    params: [
      comparisonId,
      String(performanceId), // Convert to string for BigQuery
      comparisonName,
      weeksData.trim(),
      lineColor,
      lineStyle,
      isTarget,
      now,
      now
    ],
    location: 'US'
  });

  return {
    statusCode: 201,
    headers,
    body: JSON.stringify({
      comparisonId,
      performanceId,
      comparisonName,
      weeksData: weeksData.trim(),
      lineColor,
      lineStyle,
      isTarget,
      weeksArray,
      createdAt: now
    })
  };
}

// PUT - Update existing comparison
async function updateComparison(bigquery, comparisonId, data, headers) {
  const {
    comparisonName,
    weeksData,
    lineColor,
    lineStyle,
    isTarget
  } = data;

  // Business Rule: If setting this as target, first get performance_id, then unset other targets
  if (isTarget === true) {
    // Get performance_id for this comparison
    const getPerformanceQuery = `
      SELECT performance_id
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
      WHERE comparison_id = ?
    `;

    const [perfRows] = await bigquery.query({
      query: getPerformanceQuery,
      params: [comparisonId],
      location: 'US'
    });

    if (perfRows.length > 0) {
      const performanceId = perfRows[0].performance_id;

      // Unset all other targets for this performance
      const unsetQuery = `
        UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
        SET is_target = FALSE, updated_at = CURRENT_TIMESTAMP()
        WHERE performance_id = ? AND comparison_id != ? AND is_target = TRUE
      `;

      await bigquery.query({
        query: unsetQuery,
        params: [performanceId, comparisonId],
        location: 'US'
      });
    }
  }

  // Build dynamic update query based on provided fields
  const updates = [];
  const params = [];

  if (comparisonName !== undefined) {
    updates.push('comparison_name = ?');
    params.push(comparisonName);
  }
  if (weeksData !== undefined) {
    // Validate weeksData
    const weeksArray = parseWeeksData(weeksData);
    if (weeksArray.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid weeksData format'
        })
      };
    }
    updates.push('weeks_data = ?');
    params.push(weeksData.trim());
  }
  if (lineColor !== undefined) {
    updates.push('line_color = ?');
    params.push(lineColor);
  }
  if (lineStyle !== undefined) {
    updates.push('line_style = ?');
    params.push(lineStyle);
  }
  if (isTarget !== undefined) {
    updates.push('is_target = ?');
    params.push(isTarget);
  }

  if (updates.length === 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'No fields to update' })
    };
  }

  updates.push('updated_at = CURRENT_TIMESTAMP()');
  params.push(comparisonId);

  const query = `
    UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
    SET ${updates.join(', ')}
    WHERE comparison_id = ?
  `;

  await bigquery.query({
    query,
    params,
    location: 'US'
  });

  // Fetch updated record
  const selectQuery = `
    SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
    WHERE comparison_id = ?
  `;

  const [rows] = await bigquery.query({
    query: selectQuery,
    params: [comparisonId],
    location: 'US'
  });

  if (rows.length === 0) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Comparison not found' })
    };
  }

  const updated = rows[0];

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      ...updated,
      weeksArray: parseWeeksData(updated.weeks_data)
    })
  };
}

// DELETE - Remove comparison
async function deleteComparison(bigquery, comparisonId, headers) {
  const query = `
    DELETE FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
    WHERE comparison_id = ?
  `;

  await bigquery.query({
    query,
    params: [comparisonId],
    location: 'US'
  });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      message: 'Comparison deleted successfully',
      comparisonId
    })
  };
}

// Helper: Parse CSV weeks data into array
function parseWeeksData(csvString) {
  if (!csvString || typeof csvString !== 'string') {
    return [];
  }

  return csvString
    .split(',')
    .map(v => parseFloat(v.trim()))
    .filter(v => !isNaN(v));
}
