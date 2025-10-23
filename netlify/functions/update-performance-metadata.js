const { BigQuery } = require('@google-cloud/bigquery');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const DATASET_ID = 'symphony_dashboard';

// Verify JWT token
const verifyToken = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No valid authorization header');
  }

  const token = authHeader.substring(7);
  return jwt.verify(token, JWT_SECRET);
};

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ message: 'Method not allowed' })
    };
  }

  try {
    // Verify authentication
    const authHeader = event.headers.authorization;
    const decoded = verifyToken(authHeader);

    console.log(`User ${decoded.username} updating performance metadata`);

    // Parse request body
    const { performance_code, updates } = JSON.parse(event.body);

    if (!performance_code || !updates) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Missing performance_code or updates' })
      };
    }

    // Validate that only metadata fields are being updated (not sales data)
    const allowedFields = ['title', 'series', 'performance_date', 'venue', 'season', 'capacity', 'occupancy_goal', 'budget_goal', 'cancelled'];
    const updateFields = Object.keys(updates);
    const invalidFields = updateFields.filter(field => !allowedFields.includes(field));

    if (invalidFields.length > 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          message: `Cannot update fields: ${invalidFields.join(', ')}. Only metadata can be edited manually.`
        })
      };
    }

    // Initialize BigQuery
    const bigquery = new BigQuery({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
    });

    // Build UPDATE query dynamically
    const setClauses = [];
    Object.entries(updates).forEach(([field, value]) => {
      if (typeof value === 'string') {
        setClauses.push(`${field} = '${value.replace(/'/g, "\\'")}'`);
      } else if (typeof value === 'boolean') {
        setClauses.push(`${field} = ${value ? 'TRUE' : 'FALSE'}`);
      } else {
        setClauses.push(`${field} = ${value}`);
      }
    });

    const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.performances\`
      SET
        ${setClauses.join(',\n        ')},
        updated_at = CURRENT_TIMESTAMP()
      WHERE performance_code = '${performance_code}'
    `;

    console.log('Executing update:', updateQuery);

    // Execute update
    const [job] = await bigquery.createQueryJob({
      query: updateQuery,
      location: 'US'
    });

    await job.getQueryResults();

    console.log(`✅ Successfully updated metadata for ${performance_code}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Performance metadata updated successfully',
        performance_code: performance_code,
        updated_fields: updateFields,
        updated_by: decoded.username
      })
    };

  } catch (error) {
    console.error('Error updating performance metadata:', error);

    if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: 'Invalid or expired token' })
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: 'Failed to update performance metadata',
        error: error.message
      })
    };
  }
};
