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

    // Initialize BigQuery (matches pattern from bigquery-data.js)
    const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (!credentialsEnv) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable not set');
    }

    let credentials;

    // Check if it's a file path or JSON content
    if (credentialsEnv.startsWith('{')) {
      // It's JSON content (production)
      credentials = JSON.parse(credentialsEnv);
    } else {
      // It's a file path (local development)
      const fs = require('fs');
      const path = require('path');
      const credentialsFile = path.resolve(credentialsEnv);
      const credentialsJson = fs.readFileSync(credentialsFile, 'utf8');
      credentials = JSON.parse(credentialsJson);
    }

    // Fix escaped newlines in private key
    if (credentials.private_key && credentials.private_key.includes('\\\\n')) {
      credentials.private_key = credentials.private_key.replace(/\\\\n/g, '\n');
    }

    const bigquery = new BigQuery({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || credentials.project_id,
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
      location: 'US'
    });

    // Build UPDATE query with parameterized queries (safe from SQL injection)
    const setClauses = [];
    const params = [];

    Object.entries(updates).forEach(([field, value]) => {
      setClauses.push(`${field} = ?`);
      params.push(value);
    });

    // Add performance_code parameter at the end
    params.push(performance_code);

    const updateQuery = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.performances\`
      SET
        ${setClauses.join(',\n        ')},
        updated_at = CURRENT_TIMESTAMP()
      WHERE performance_code = ?
    `;

    console.log('Executing update for:', performance_code, 'with fields:', Object.keys(updates));

    // Execute update using parameterized query
    await bigquery.query({
      query: updateQuery,
      params: params,
      location: 'US'
    });

    // ⚡ CACHE INVALIDATION: Clear cached dashboard data since metadata was updated
    try {
      const cacheInvalidateUrl = `${process.env.URL || 'http://localhost:8888'}/.netlify/functions/bigquery-snapshots?action=invalidate-cache`;
      const cacheResponse = await fetch(cacheInvalidateUrl);
      if (cacheResponse.ok) {
        console.log('🗑️ Dashboard cache invalidated after metadata update');
      }
    } catch (error) {
      console.warn('⚠️ Cache invalidation failed (non-critical):', error.message);
    }

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
