// Update Performance Metadata - Budget, Capacity, and other editable fields
// This endpoint ONLY updates metadata in the performances table
// Sales data comes from snapshots and is NOT editable here

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

// Main handler
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'PUT, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'PUT') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed. Use PUT to update metadata.' })
    };
  }

  try {
    const bigquery = initializeBigQuery();
    const data = JSON.parse(event.body || '{}');

    return await updatePerformanceMetadata(bigquery, data, headers);
  } catch (error) {
    console.error('Update metadata error:', error);
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

// Update performance metadata (budget, capacity, title, etc.)
async function updatePerformanceMetadata(bigquery, data, headers) {
  const { performanceId, performanceCode, updates } = data;

  // Must provide either performanceId or performanceCode
  if (!performanceId && !performanceCode) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: 'Either performanceId or performanceCode is required'
      })
    };
  }

  if (!updates || Object.keys(updates).length === 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: 'No updates provided'
      })
    };
  }

  // Whitelist of editable metadata fields
  // Sales data fields are NOT editable here (they come from snapshots)
  const allowedFields = [
    'title',
    'series',
    'venue',
    'season',
    'performance_date',
    'capacity',           // ✅ EDITABLE
    'budget_goal',        // ✅ EDITABLE
    'occupancy_goal'      // ✅ EDITABLE
  ];

  // Filter updates to only allowed fields
  const setClauses = [];
  const params = [];

  for (const [field, value] of Object.entries(updates)) {
    if (allowedFields.includes(field)) {
      setClauses.push(`${field} = ?`);
      params.push(value);
    } else {
      console.warn(`⚠️  Ignoring non-editable field: ${field}`);
    }
  }

  if (setClauses.length === 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: 'No valid fields to update',
        allowedFields: allowedFields
      })
    };
  }

  // Add updated_at timestamp
  setClauses.push('updated_at = CURRENT_TIMESTAMP()');

  // Build WHERE clause
  let whereClause;
  if (performanceId) {
    whereClause = 'performance_id = ?';
    params.push(parseInt(performanceId));
  } else {
    whereClause = 'performance_code = ?';
    params.push(performanceCode);
  }

  const updateQuery = `
    UPDATE \`${PROJECT_ID}.${DATASET_ID}.performances\`
    SET ${setClauses.join(', ')}
    WHERE ${whereClause}
  `;

  console.log(`📝 Updating metadata for ${performanceId || performanceCode}:`, updates);

  await bigquery.query({
    query: updateQuery,
    params: params,
    location: 'US'
  });

  // Fetch updated record to return
  const selectQuery = `
    SELECT *
    FROM \`${PROJECT_ID}.${DATASET_ID}.performances\`
    WHERE ${whereClause}
  `;

  const [rows] = await bigquery.query({
    query: selectQuery,
    params: [performanceId ? parseInt(performanceId) : performanceCode],
    location: 'US'
  });

  if (rows.length === 0) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Performance not found' })
    };
  }

  const updated = rows[0];

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      message: 'Metadata updated successfully',
      performance: {
        ...updated,
        performance_date: typeof updated.performance_date === 'object'
          ? updated.performance_date.value
          : updated.performance_date,
        updated_at: typeof updated.updated_at === 'object'
          ? updated.updated_at.value
          : updated.updated_at
      }
    })
  };
}
