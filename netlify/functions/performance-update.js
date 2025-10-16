// Simplified webhook that receives parsed performance data from Make.com
// and updates BigQuery without doing any PDF parsing

const { BigQuery } = require('@google-cloud/bigquery');

const DATASET_ID = process.env.BIGQUERY_DATASET || 'symphony_dashboard';

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const requestData = JSON.parse(event.body);
    console.log('📥 Received performance update request');

    // Validate input
    if (!requestData.performances || !Array.isArray(requestData.performances)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing or invalid performances array' })
      };
    }

    console.log(`📊 Processing ${requestData.performances.length} performances`);

    // Initialize BigQuery
    const bigquery = new BigQuery({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
    });

    // Process updates
    const result = await updatePerformances(bigquery, requestData.performances);

    console.log('✅ Update complete:', result);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Performance data updated successfully',
        ...result
      })
    };

  } catch (error) {
    console.error('❌ Error:', error);
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

async function updatePerformances(bigquery, performances) {
  let updated = 0, skipped = 0;

  // Get all existing performance codes in one query
  const performanceCodes = performances.map(p => `'${p.performance_code}'`).join(',');

  const checkQuery = `
    SELECT performance_code
    FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.performances\`
    WHERE performance_code IN (${performanceCodes})
  `;

  const [existingRows] = await bigquery.query({ query: checkQuery, location: 'US' });
  const existingCodes = new Set(existingRows.map(row => row.performance_code));

  console.log(`📋 Found ${existingCodes.size} existing performances out of ${performances.length}`);

  // Filter to only valid performances
  const validPerformances = performances.filter(p => {
    if (existingCodes.has(p.performance_code)) {
      return true;
    } else {
      console.log(`⏭️  Skipped unknown: ${p.performance_code}`);
      skipped++;
      return false;
    }
  });

  if (validPerformances.length === 0) {
    console.log('⚠️  No valid performances to update');
    return { updated: 0, skipped };
  }

  // Batch update using CASE statements (much faster than individual updates)
  const batchUpdateQuery = `
    UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.performances\`
    SET
      performance_date = CASE performance_code
        ${validPerformances.map(p => `WHEN '${p.performance_code}' THEN '${p.performance_date}'`).join('\n        ')}
        ELSE performance_date
      END,
      single_tickets_sold = CASE performance_code
        ${validPerformances.map(p => `WHEN '${p.performance_code}' THEN ${p.single_tickets_sold || 0}`).join('\n        ')}
        ELSE single_tickets_sold
      END,
      subscription_tickets_sold = CASE performance_code
        ${validPerformances.map(p => `WHEN '${p.performance_code}' THEN ${p.subscription_tickets_sold || 0}`).join('\n        ')}
        ELSE subscription_tickets_sold
      END,
      total_tickets_sold = CASE performance_code
        ${validPerformances.map(p => `WHEN '${p.performance_code}' THEN ${(p.single_tickets_sold || 0) + (p.subscription_tickets_sold || 0)}`).join('\n        ')}
        ELSE total_tickets_sold
      END,
      total_revenue = CASE performance_code
        ${validPerformances.map(p => `WHEN '${p.performance_code}' THEN ${p.total_revenue || 0}`).join('\n        ')}
        ELSE total_revenue
      END,
      capacity_percent = CASE performance_code
        ${validPerformances.map(p => `WHEN '${p.performance_code}' THEN ${p.capacity_percent || 0}`).join('\n        ')}
        ELSE capacity_percent
      END,
      budget_percent = CASE performance_code
        ${validPerformances.map(p => `WHEN '${p.performance_code}' THEN ${p.budget_percent || 0}`).join('\n        ')}
        ELSE budget_percent
      END,
      has_sales_data = true,
      last_pdf_import_date = CURRENT_TIMESTAMP(),
      updated_at = CURRENT_TIMESTAMP()
    WHERE performance_code IN (${validPerformances.map(p => `'${p.performance_code}'`).join(',')})
  `;

  await bigquery.query({ query: batchUpdateQuery, location: 'US' });

  updated = validPerformances.length;
  console.log(`✅ Batch updated ${updated} performances`);

  return { updated, skipped };
}
