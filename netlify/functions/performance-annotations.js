// Performance Annotations API
// Handles CRUD operations for annotations on group sales charts

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
const TABLE_ID = 'performance_annotations';

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

    // Parse annotation ID from path if present
    const pathMatch = path.match(/\/performance-annotations\/([^/]+)$/);
    const annotationId = pathMatch ? pathMatch[1] : null;

    switch (method) {
      case 'GET':
        return await getAnnotations(bigquery, event.queryStringParameters, headers);

      case 'POST':
        return await createAnnotation(bigquery, JSON.parse(event.body || '{}'), headers);

      case 'PUT':
        if (!annotationId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Annotation ID required for update' })
          };
        }
        return await updateAnnotation(bigquery, annotationId, JSON.parse(event.body || '{}'), headers);

      case 'DELETE':
        if (!annotationId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Annotation ID required for delete' })
          };
        }
        return await deleteAnnotation(bigquery, annotationId, headers);

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

// GET - Fetch annotations
async function getAnnotations(bigquery, params, headers) {
  const { groupTitle, tags, allTags, scope, includeGlobal } = params || {};

  // Return all distinct tags for autocomplete
  if (allTags === 'true') {
    return await getAllTags(bigquery, headers);
  }

  // Filter by tags across all groups
  if (tags && !groupTitle) {
    return await getAnnotationsByTags(bigquery, tags, headers);
  }

  // Fetch only global annotations
  if (scope === 'global') {
    return await getGlobalAnnotations(bigquery, headers);
  }

  // Fetch annotations for a specific group (optionally including global)
  if (!groupTitle) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'groupTitle, tags, scope, or allTags query parameter required' })
    };
  }

  let query;
  let queryParams;

  if (includeGlobal === 'true') {
    query = `
      SELECT
        annotation_id, group_title, annotation_type, week_number,
        start_week, end_week, label, description, color, tags,
        scope, annotation_date, annotation_end_date,
        created_at, updated_at
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
      WHERE group_title = ? OR scope = 'global'
      ORDER BY COALESCE(week_number, start_week) DESC
    `;
    queryParams = [groupTitle];
  } else {
    query = `
      SELECT
        annotation_id, group_title, annotation_type, week_number,
        start_week, end_week, label, description, color, tags,
        scope, annotation_date, annotation_end_date,
        created_at, updated_at
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
      WHERE group_title = ?
      ORDER BY COALESCE(week_number, start_week) DESC
    `;
    queryParams = [groupTitle];
  }

  const [rows] = await bigquery.query({
    query,
    params: queryParams,
    location: 'US'
  });

  const annotations = rows.map(row => ({
    ...row,
    tags: parseTags(row.tags)
  }));

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(annotations)
  };
}

// GET - Fetch global annotations only
async function getGlobalAnnotations(bigquery, headers) {
  const query = `
    SELECT
      annotation_id, group_title, annotation_type, week_number,
      start_week, end_week, label, description, color, tags,
      scope, annotation_date, annotation_end_date,
      created_at, updated_at
    FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
    WHERE scope = 'global'
    ORDER BY annotation_date DESC, created_at DESC
  `;

  const [rows] = await bigquery.query({ query, location: 'US' });

  const annotations = rows.map(row => ({
    ...row,
    tags: parseTags(row.tags)
  }));

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(annotations)
  };
}

// GET - Fetch annotations filtered by tags
async function getAnnotationsByTags(bigquery, tagsParam, headers) {
  const tagList = tagsParam.split(',').map(t => t.trim()).filter(t => t.length > 0);

  if (tagList.length === 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'tags must contain at least one tag' })
    };
  }

  // Build WHERE clause that matches any of the provided tags
  const conditions = tagList.map(() => 'LOWER(tags) LIKE ?').join(' OR ');
  const params = tagList.map(t => `%${t.toLowerCase()}%`);

  const query = `
    SELECT
      annotation_id, group_title, annotation_type, week_number,
      start_week, end_week, label, description, color, tags,
      scope, annotation_date, annotation_end_date,
      created_at, updated_at
    FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
    WHERE ${conditions}
    ORDER BY group_title, COALESCE(week_number, start_week) DESC
  `;

  const [rows] = await bigquery.query({ query, params, location: 'US' });

  const annotations = rows.map(row => ({
    ...row,
    tags: parseTags(row.tags)
  }));

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(annotations)
  };
}

// GET - Return all distinct tags used across all annotations
async function getAllTags(bigquery, headers) {
  const query = `
    SELECT tags
    FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
    WHERE tags IS NOT NULL AND tags != ''
  `;

  const [rows] = await bigquery.query({ query, location: 'US' });

  // Split all CSV tag strings, deduplicate, and sort
  const tagSet = new Set();
  rows.forEach(row => {
    parseTags(row.tags).forEach(tag => tagSet.add(tag));
  });

  const allTagsList = Array.from(tagSet).sort();

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(allTagsList)
  };
}

// POST - Create annotation
async function createAnnotation(bigquery, data, headers) {
  const {
    groupTitle,
    annotationType,
    weekNumber,
    startWeek,
    endWeek,
    label,
    description = '',
    color = '#e74c3c',
    tags = [],
    scope = 'production',
    annotationDate,
    annotationEndDate
  } = data;

  const isGlobal = scope === 'global';

  // Validation
  if (!annotationType || !label) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: 'Missing required fields',
        required: ['annotationType', 'label']
      })
    };
  }

  if (!isGlobal && !groupTitle) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'groupTitle is required for production-scoped annotations' })
    };
  }

  if (annotationType !== 'point' && annotationType !== 'interval') {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'annotationType must be "point" or "interval"' })
    };
  }

  // Annotations can use calendar dates or week numbers for positioning
  const hasDate = !!annotationDate;
  const hasWeek = (annotationType === 'point' && weekNumber !== undefined && weekNumber !== null) ||
                  (annotationType === 'interval' && startWeek !== undefined && endWeek !== undefined);

  if (!hasDate && !hasWeek) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Either annotationDate or weekNumber/startWeek+endWeek is required' })
    };
  }

  if (hasDate && annotationType === 'interval' && !annotationEndDate) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'annotationEndDate is required for interval annotations using dates' })
    };
  }

  const annotationId = uuidv4();
  const now = new Date().toISOString();
  const tagsString = Array.isArray(tags) ? tags.join(',') : (tags || '');

  // Build INSERT dynamically to avoid null parameter type issues with BigQuery
  const columns = ['annotation_id', 'annotation_type', 'label', 'description', 'color', 'tags', 'scope', 'created_at', 'updated_at'];
  const values = ['?', '?', '?', '?', '?', '?', '?', 'TIMESTAMP(?)', 'TIMESTAMP(?)'];
  const params = [annotationId, annotationType, label, description, color, tagsString, scope || 'production', now, now];

  if (groupTitle) {
    columns.push('group_title');
    values.push('?');
    params.push(groupTitle);
  }

  if (annotationDate) {
    columns.push('annotation_date');
    values.push('DATE(?)');
    params.push(annotationDate);
    if (annotationType === 'interval' && annotationEndDate) {
      columns.push('annotation_end_date');
      values.push('DATE(?)');
      params.push(annotationEndDate);
    }
  }

  if (weekNumber !== undefined && weekNumber !== null) {
    columns.push('week_number');
    values.push('?');
    params.push(weekNumber);
  }
  if (startWeek !== undefined) {
    columns.push('start_week');
    values.push('?');
    params.push(startWeek);
  }
  if (endWeek !== undefined) {
    columns.push('end_week');
    values.push('?');
    params.push(endWeek);
  }

  const query = `
    INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
    (${columns.join(', ')})
    VALUES (${values.join(', ')})
  `;

  await bigquery.query({
    query,
    params,
    location: 'US'
  });

  return {
    statusCode: 201,
    headers,
    body: JSON.stringify({
      annotation_id: annotationId,
      group_title: groupTitle || null,
      annotation_type: annotationType,
      week_number: annotationType === 'point' && !isGlobal ? weekNumber : null,
      start_week: annotationType === 'interval' && !isGlobal ? startWeek : null,
      end_week: annotationType === 'interval' && !isGlobal ? endWeek : null,
      label,
      description,
      color,
      scope: scope || 'production',
      annotation_date: annotationDate || null,
      annotation_end_date: annotationEndDate || null,
      tags: Array.isArray(tags) ? tags : parseTags(tags),
      created_at: now
    })
  };
}

// PUT - Update annotation
async function updateAnnotation(bigquery, annotationId, data, headers) {
  const {
    annotationType,
    weekNumber,
    startWeek,
    endWeek,
    label,
    description,
    color,
    tags,
    scope,
    annotationDate,
    annotationEndDate
  } = data;

  const updates = [];
  const params = [];

  if (annotationType !== undefined) {
    updates.push('annotation_type = ?');
    params.push(annotationType);
  }
  if (weekNumber !== undefined) {
    updates.push('week_number = ?');
    params.push(weekNumber);
  }
  if (startWeek !== undefined) {
    updates.push('start_week = ?');
    params.push(startWeek);
  }
  if (endWeek !== undefined) {
    updates.push('end_week = ?');
    params.push(endWeek);
  }
  if (label !== undefined) {
    updates.push('label = ?');
    params.push(label);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    params.push(description);
  }
  if (color !== undefined) {
    updates.push('color = ?');
    params.push(color);
  }
  if (tags !== undefined) {
    updates.push('tags = ?');
    params.push(Array.isArray(tags) ? tags.join(',') : tags);
  }
  if (scope !== undefined) {
    updates.push('scope = ?');
    params.push(scope);
  }
  if (annotationDate !== undefined) {
    updates.push('annotation_date = DATE(?)');
    params.push(annotationDate);
  }
  if (annotationEndDate !== undefined) {
    updates.push('annotation_end_date = DATE(?)');
    params.push(annotationEndDate);
  }

  if (updates.length === 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'No fields to update' })
    };
  }

  updates.push('updated_at = CURRENT_TIMESTAMP()');
  params.push(annotationId);

  const query = `
    UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
    SET ${updates.join(', ')}
    WHERE annotation_id = ?
  `;

  await bigquery.query({ query, params, location: 'US' });

  // Fetch updated record
  const selectQuery = `
    SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
    WHERE annotation_id = ?
  `;

  const [rows] = await bigquery.query({
    query: selectQuery,
    params: [annotationId],
    location: 'US'
  });

  if (rows.length === 0) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Annotation not found' })
    };
  }

  const updated = rows[0];
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      ...updated,
      tags: parseTags(updated.tags)
    })
  };
}

// DELETE - Remove annotation
async function deleteAnnotation(bigquery, annotationId, headers) {
  const query = `
    DELETE FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
    WHERE annotation_id = ?
  `;

  await bigquery.query({
    query,
    params: [annotationId],
    location: 'US'
  });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      message: 'Annotation deleted successfully',
      annotationId
    })
  };
}

// Helper: Parse CSV tags into array
function parseTags(csvString) {
  if (!csvString || typeof csvString !== 'string') {
    return [];
  }
  return csvString
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0);
}
