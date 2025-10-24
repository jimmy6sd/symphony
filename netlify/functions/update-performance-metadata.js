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
    let bigquery;
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      // Production: Use JSON credentials from environment variable
      const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
      bigquery = new BigQuery({
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
        credentials: credentials
      });
    } else {
      // Local development: Use key file
      bigquery = new BigQuery({
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
      });
    }

    // Build UPDATE query dynamically with proper escaping
    const setClauses = [];
    Object.entries(updates).forEach(([field, value]) => {
      if (value === null || value === undefined) {
        setClauses.push(`${field} = NULL`);
      } else if (typeof value === 'string') {
        // Escape single quotes for SQL
        const escapedValue = value.replace(/'/g, "''");
        setClauses.push(`${field} = '${escapedValue}'`);
      } else if (typeof value === 'boolean') {
        setClauses.push(`${field} = ${value ? 'TRUE' : 'FALSE'}`);
      } else if (typeof value === 'number') {
        setClauses.push(`${field} = ${value}`);
      } else {
        setClauses.push(`${field} = ${value}`);
      }
    });

    const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.performances\`
      SET
        ${setClauses.join(',\n        ')},
        updated_at = CURRENT_TIMESTAMP()
      WHERE performance_code = '${performance_code.replace(/'/g, "''")}'
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
        updated_fields: updateFields
      })
    };

  } catch (error) {
    console.error('Error updating performance metadata:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code
    });

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: 'Failed to update performance metadata',
        error: error.message,
        errorType: error.name,
        errorCode: error.code,
        details: error.errors ? error.errors.map(e => e.message).join(', ') : undefined
      })
    };
  }
};
