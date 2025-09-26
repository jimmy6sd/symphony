// PDF Data Processor for Symphony Dashboard
// Receives parsed PDF data from Make.com and implements smart merge logic

const { BigQuery } = require('@google-cloud/bigquery');
const crypto = require('crypto');

// Initialize BigQuery client
const initializeBigQuery = () => {
  try {
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (!credentialsJson) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable not set');
    }

    const credentials = JSON.parse(credentialsJson);

    // Fix escaped newlines, which is common in env vars
    if (credentials.private_key && credentials.private_key.includes('\\n')) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
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

// Main handler function
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const executionId = `exec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  try {
    const bigquery = initializeBigQuery();
    const requestData = JSON.parse(event.body);

    console.log(`🔄 Starting PDF data processing - Execution ID: ${executionId}`);

    // Log pipeline execution start
    await logPipelineExecution(bigquery, {
      execution_id: executionId,
      pipeline_type: 'pdf_import',
      status: 'running',
      start_time: new Date().toISOString(),
      source_file: requestData.metadata?.filename || 'unknown',
      source_email: requestData.metadata?.email_id || null,
      triggered_by: 'make.com'
    });

    // Validate incoming data
    const validationResult = validateIncomingData(requestData);
    if (!validationResult.isValid) {
      throw new Error(`Data validation failed: ${validationResult.errors.join(', ')}`);
    }

    // Create data snapshot
    const snapshotId = await createDataSnapshot(bigquery, requestData, executionId);

    // Process the performance data
    const processedData = await processPerformanceData(bigquery, requestData.performances, snapshotId, executionId);

    // Update pipeline execution log with success
    await updatePipelineExecution(bigquery, executionId, {
      status: 'completed',
      end_time: new Date().toISOString(),
      records_received: requestData.performances?.length || 0,
      records_processed: processedData.processed,
      records_inserted: processedData.inserted,
      records_updated: processedData.updated,
      trends_adjusted: processedData.trendsAdjusted,
      anomalies_detected: processedData.anomalies
    });

    console.log(`✅ PDF data processing completed successfully - Execution ID: ${executionId}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        execution_id: executionId,
        snapshot_id: snapshotId,
        summary: {
          received: requestData.performances?.length || 0,
          processed: processedData.processed,
          inserted: processedData.inserted,
          updated: processedData.updated,
          trends_adjusted: processedData.trendsAdjusted,
          anomalies_detected: processedData.anomalies
        },
        message: 'PDF data processed successfully'
      })
    };

  } catch (error) {
    console.error(`❌ PDF data processing failed - Execution ID: ${executionId}:`, error.message);

    // Update pipeline execution log with failure
    try {
      const bigquery = initializeBigQuery();
      await updatePipelineExecution(bigquery, executionId, {
        status: 'failed',
        end_time: new Date().toISOString(),
        error_message: error.message,
        error_code: error.code || 'PROCESSING_ERROR'
      });
    } catch (logError) {
      console.error('Failed to log error:', logError.message);
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'PDF processing failed',
        execution_id: executionId,
        message: error.message
      })
    };
  }
};

// Validate incoming data structure
function validateIncomingData(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    errors.push('Invalid data format');
  }

  if (!Array.isArray(data.performances)) {
    errors.push('Missing or invalid performances array');
  }

  if (data.performances && data.performances.length === 0) {
    errors.push('Empty performances array');
  }

  // Validate each performance record
  if (data.performances) {
    data.performances.forEach((perf, index) => {
      if (!perf.performance_id && !perf.performance_code) {
        errors.push(`Performance ${index}: Missing performance_id or performance_code`);
      }
      if (!perf.title) {
        errors.push(`Performance ${index}: Missing title`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Create data snapshot record
async function createDataSnapshot(bigquery, data, executionId) {
  const snapshotId = `snap_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const today = new Date().toISOString().split('T')[0];

  const totalTickets = data.performances?.reduce((sum, perf) =>
    sum + (perf.total_tickets_sold || 0), 0) || 0;
  const totalRevenue = data.performances?.reduce((sum, perf) =>
    sum + (perf.total_revenue || 0), 0) || 0;

  const snapshotData = {
    snapshot_id: snapshotId,
    snapshot_date: today,
    source_type: 'pdf_tessitura',
    source_identifier: data.metadata?.filename || `execution_${executionId}`,
    raw_data: JSON.stringify(data),
    processed_data: JSON.stringify(data.performances),
    performance_count: data.performances?.length || 0,
    total_tickets_in_snapshot: totalTickets,
    total_revenue_in_snapshot: totalRevenue,
    processing_status: 'pending'
  };

  const query = `
    INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.data_snapshots\`
    (snapshot_id, snapshot_date, source_type, source_identifier, raw_data, processed_data,
     performance_count, total_tickets_in_snapshot, total_revenue_in_snapshot, processing_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  await bigquery.query({
    query,
    params: Object.values(snapshotData),
    location: 'US'
  });

  console.log(`📸 Created data snapshot: ${snapshotId}`);
  return snapshotId;
}

// Process performance data with smart merging
async function processPerformanceData(bigquery, performances, snapshotId, executionId) {
  let processed = 0, inserted = 0, updated = 0, trendsAdjusted = 0, anomalies = 0;

  for (const perfData of performances) {
    try {
      // Get existing performance data
      const existingPerf = await getExistingPerformance(bigquery, perfData);

      if (existingPerf) {
        // Update existing performance
        const updateResult = await updateExistingPerformance(bigquery, perfData, existingPerf, snapshotId);
        updated++;

        if (updateResult.trendAdjusted) {
          trendsAdjusted++;
        }
        if (updateResult.anomalyDetected) {
          anomalies++;
        }
      } else {
        // Insert new performance
        await insertNewPerformance(bigquery, perfData, snapshotId);
        inserted++;
      }

      processed++;
    } catch (error) {
      console.error(`Error processing performance ${perfData.performance_id || perfData.performance_code}:`, error.message);
      anomalies++;
    }
  }

  // Mark snapshot as processed
  await bigquery.query({
    query: `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.data_snapshots\`
      SET processing_status = 'processed', updated_at = CURRENT_TIMESTAMP()
      WHERE snapshot_id = ?
    `,
    params: [snapshotId],
    location: 'US'
  });

  return { processed, inserted, updated, trendsAdjusted, anomalies };
}

// Get existing performance data
async function getExistingPerformance(bigquery, perfData) {
  const query = `
    SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.performances\`
    WHERE performance_id = ? OR performance_code = ?
    LIMIT 1
  `;

  const [rows] = await bigquery.query({
    query,
    params: [perfData.performance_id, perfData.performance_code],
    location: 'US'
  });

  return rows.length > 0 ? rows[0] : null;
}

// Update existing performance with trend preservation
async function updateExistingPerformance(bigquery, newData, existingData, snapshotId) {
  const adjustmentId = `adj_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  let trendAdjusted = false;
  let anomalyDetected = false;

  // Check for significant changes
  const ticketsDiff = (newData.total_tickets_sold || 0) - (existingData.total_tickets_sold || 0);
  const revenueDiff = (newData.total_revenue || 0) - (existingData.total_revenue || 0);

  // Detect anomalies (unusual decreases or massive increases)
  if (ticketsDiff < -50 || (ticketsDiff > existingData.total_tickets_sold * 2)) {
    anomalyDetected = true;
    console.log(`⚠️ Anomaly detected for ${newData.performance_code}: ${ticketsDiff} ticket difference`);
  }

  // Update main performance record
  const updateQuery = `
    UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.performances\`
    SET
      single_tickets_sold = ?,
      subscription_tickets_sold = ?,
      total_revenue = ?,
      has_sales_data = true,
      updated_at = CURRENT_TIMESTAMP()
    WHERE performance_id = ?
  `;

  await bigquery.query({
    query: updateQuery,
    params: [
      newData.single_tickets_sold || 0,
      newData.subscription_tickets_sold || 0,
      newData.total_revenue || 0,
      existingData.performance_id
    ],
    location: 'US'
  });

  // If there are significant changes, adjust trends
  if (Math.abs(ticketsDiff) > 10) {
    await adjustSalesTrends(bigquery, existingData.performance_id, ticketsDiff, adjustmentId);
    trendAdjusted = true;
  }

  // Log the adjustment
  await logTrendAdjustment(bigquery, {
    adjustment_id: adjustmentId,
    performance_id: existingData.performance_id,
    snapshot_id: snapshotId,
    adjustment_type: ticketsDiff > 0 ? 'backfill' : 'correction',
    old_total_tickets: existingData.total_tickets_sold,
    new_total_tickets: newData.total_tickets_sold,
    tickets_difference: ticketsDiff,
    old_total_revenue: existingData.total_revenue,
    new_total_revenue: newData.total_revenue,
    revenue_difference: revenueDiff,
    trend_velocity_preserved: trendAdjusted
  });

  return { trendAdjusted, anomalyDetected };
}

// Insert new performance
async function insertNewPerformance(bigquery, perfData, snapshotId) {
  const insertQuery = `
    INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.performances\`
    (performance_id, performance_code, title, series, performance_date, venue, season,
     capacity, single_tickets_sold, subscription_tickets_sold, total_revenue,
     occupancy_goal, budget_goal, has_sales_data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  await bigquery.query({
    query: insertQuery,
    params: [
      perfData.performance_id,
      perfData.performance_code,
      perfData.title,
      perfData.series || 'Unknown',
      perfData.performance_date,
      perfData.venue || 'Unknown',
      perfData.season || 'Unknown',
      perfData.capacity || 0,
      perfData.single_tickets_sold || 0,
      perfData.subscription_tickets_sold || 0,
      perfData.total_revenue || 0,
      perfData.occupancy_goal || 85,
      perfData.budget_goal || 0,
      (perfData.single_tickets_sold > 0 || perfData.total_revenue > 0)
    ],
    location: 'US'
  });
}

// Smart algorithm to adjust sales trends
async function adjustSalesTrends(bigquery, performanceId, ticketsDiff, adjustmentId) {
  // This implements the proportional backfill algorithm
  // Get existing weekly sales data
  const [weeklyRows] = await bigquery.query({
    query: `
      SELECT * FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.weekly_sales\`
      WHERE performance_id = ?
      ORDER BY week_number ASC
    `,
    params: [performanceId],
    location: 'US'
  });

  if (weeklyRows.length === 0 || ticketsDiff === 0) {
    return; // No historical data to adjust
  }

  // Calculate proportional adjustments
  const totalHistoricalTickets = weeklyRows.reduce((sum, week) => sum + week.tickets_sold, 0);
  const weeklyAdjustments = [];

  for (const week of weeklyRows) {
    const proportion = totalHistoricalTickets > 0 ? week.tickets_sold / totalHistoricalTickets : 0;
    const adjustment = Math.round(ticketsDiff * proportion);
    const newTickets = Math.max(0, week.tickets_sold + adjustment);

    weeklyAdjustments.push({
      week: week.week_number,
      old_value: week.tickets_sold,
      new_value: newTickets
    });

    // Update the weekly sales record
    await bigquery.query({
      query: `
        UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.weekly_sales\`
        SET
          tickets_sold = ?,
          last_adjusted = CURRENT_TIMESTAMP(),
          adjustment_id = ?,
          data_source = 'pdf_adjusted'
        WHERE performance_id = ? AND week_number = ?
      `,
      params: [newTickets, adjustmentId, performanceId, week.week_number],
      location: 'US'
    });
  }

  console.log(`📈 Adjusted ${weeklyRows.length} weekly sales records for performance ${performanceId}`);
  return weeklyAdjustments;
}

// Helper functions for logging
async function logPipelineExecution(bigquery, data) {
  const query = `
    INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.pipeline_execution_log\`
    (execution_id, pipeline_type, status, start_time, source_file, source_email, triggered_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  await bigquery.query({
    query,
    params: [
      data.execution_id,
      data.pipeline_type,
      data.status,
      data.start_time,
      data.source_file,
      data.source_email,
      data.triggered_by
    ],
    location: 'US'
  });
}

async function updatePipelineExecution(bigquery, executionId, updates) {
  const setClauses = [];
  const params = [];

  for (const [key, value] of Object.entries(updates)) {
    setClauses.push(`${key} = ?`);
    params.push(value);
  }

  params.push(executionId);

  const query = `
    UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.pipeline_execution_log\`
    SET ${setClauses.join(', ')}
    WHERE execution_id = ?
  `;

  await bigquery.query({
    query,
    params,
    location: 'US'
  });
}

async function logTrendAdjustment(bigquery, data) {
  const query = `
    INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.trend_adjustments\`
    (adjustment_id, performance_id, snapshot_id, adjustment_type, old_total_tickets,
     new_total_tickets, tickets_difference, old_total_revenue, new_total_revenue,
     revenue_difference, trend_velocity_preserved, adjustment_algorithm, confidence_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'proportional', 0.8)
  `;

  await bigquery.query({
    query,
    params: [
      data.adjustment_id,
      data.performance_id,
      data.snapshot_id,
      data.adjustment_type,
      data.old_total_tickets,
      data.new_total_tickets,
      data.tickets_difference,
      data.old_total_revenue,
      data.new_total_revenue,
      data.revenue_difference,
      data.trend_velocity_preserved
    ],
    location: 'US'
  });
}