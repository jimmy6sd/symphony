// Simple PDF Webhook Receiver for Symphony Dashboard
// Accepts raw PDF data from Make.com and handles all processing internally

const { BigQuery } = require('@google-cloud/bigquery');
const crypto = require('crypto');

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
      // It's JSON content
      credentials = JSON.parse(credentialsEnv);
    } else {
      // It's a file path
      const fs = require('fs');
      const path = require('path');
      const credentialsFile = path.resolve(credentialsEnv);
      console.log(`🔐 Loading credentials from file: ${credentialsFile}`);
      const credentialsJson = fs.readFileSync(credentialsFile, 'utf8');
      credentials = JSON.parse(credentialsJson);
    }

    // Fix escaped newlines, which is common in env vars
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

// Main webhook handler
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

  const executionId = `webhook_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  try {
    console.log(`📨 PDF webhook received - Execution ID: ${executionId}`);

    const requestData = JSON.parse(event.body);

    // Log pipeline execution start
    const bigquery = initializeBigQuery();
    await logPipelineStart(bigquery, executionId, requestData);

    // Determine the input type and process accordingly
    let performanceData;

    if (requestData.pdf_base64) {
      // Handle base64 PDF data
      console.log('📄 Processing base64 PDF data');
      performanceData = await processPdfBase64(requestData.pdf_base64, requestData.metadata);

    } else if (requestData.pdf_text) {
      // Handle pre-extracted text
      console.log('📝 Processing extracted PDF text');
      performanceData = await processPdfText(requestData.pdf_text, requestData.metadata);

    } else if (requestData.pdf_url) {
      // Handle PDF URL (download and process)
      console.log('🔗 Processing PDF from URL');
      performanceData = await processPdfUrl(requestData.pdf_url, requestData.metadata);

    } else {
      throw new Error('No valid PDF data provided (expected pdf_base64, pdf_text, or pdf_url)');
    }

    // Create data snapshot
    const snapshotId = await createDataSnapshot(bigquery, {
      metadata: requestData.metadata,
      performances: performanceData
    }, executionId);

    // Process the performance data with existing smart merge logic
    const processedData = await processPerformanceData(bigquery, performanceData, snapshotId, executionId);

    // Update pipeline execution log with success
    await updatePipelineExecution(bigquery, executionId, {
      status: 'completed',
      end_time: new Date().toISOString(),
      records_processed: processedData.processed || 1,
      records_inserted: processedData.inserted || 1,
      records_updated: processedData.updated || 0
    });

    console.log(`✅ PDF webhook processing completed - Execution ID: ${executionId}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        execution_id: executionId,
        snapshot_id: snapshotId,
        summary: {
          received: performanceData?.length || 0,
          processed: processedData.processed,
          inserted: processedData.inserted,
          updated: processedData.updated,
          trends_adjusted: processedData.trendsAdjusted,
          anomalies_detected: processedData.anomalies
        },
        message: 'PDF processed successfully via webhook'
      })
    };

  } catch (error) {
    console.error(`❌ PDF webhook processing failed - Execution ID: ${executionId}:`, error.message);

    try {
      const bigquery = initializeBigQuery();
      await updatePipelineExecution(bigquery, executionId, {
        status: 'failed',
        end_time: new Date().toISOString(),
        error_message: error.message
      });
    } catch (logError) {
      console.error('Failed to log error:', logError.message);
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'PDF webhook processing failed',
        execution_id: executionId,
        message: error.message
      })
    };
  }
};

// Process base64 PDF data
async function processPdfBase64(base64Data, metadata) {
  console.log('🔍 Extracting text from base64 PDF...');

  // Convert base64 to buffer
  const pdfBuffer = Buffer.from(base64Data, 'base64');

  // Extract text using pdf-parse (need to add this dependency)
  const pdfParse = require('pdf-parse');
  const pdfData = await pdfParse(pdfBuffer);

  console.log(`📝 Extracted ${pdfData.text.length} characters from PDF`);

  // Parse the extracted text
  return await parseTessituraText(pdfData.text, metadata);
}

// Process pre-extracted PDF text
async function processPdfText(text, metadata) {
  console.log('🔍 Parsing pre-extracted PDF text...');
  return await parseTessituraText(text, metadata);
}

// Process PDF from URL
async function processPdfUrl(url, metadata) {
  console.log('📥 Downloading PDF from URL...');

  const https = require('https');
  const pdfParse = require('pdf-parse');

  // Download PDF
  const pdfBuffer = await downloadPdf(url);

  // Extract text
  const pdfData = await pdfParse(pdfBuffer);

  console.log(`📝 Extracted ${pdfData.text.length} characters from downloaded PDF`);

  // Parse the extracted text
  return await parseTessituraText(pdfData.text, metadata);
}

// Download PDF from URL
function downloadPdf(url) {
  return new Promise((resolve, reject) => {
    const https = require('https');

    https.get(url, (response) => {
      const chunks = [];

      response.on('data', (chunk) => {
        chunks.push(chunk);
      });

      response.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    }).on('error', reject);
  });
}

// Intelligent Tessitura PDF text parsing
async function parseTessituraText(text, metadata) {
  console.log('🧠 Applying intelligent Tessitura text parsing...');

  const performances = [];
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  // Multiple parsing strategies for different Tessitura report formats
  const strategies = [
    parseDirectLineFormat,  // Add new strategy first for raw line format
    parseTabularFormat,
    parseNarrativeFormat,
    parseDetailedReportFormat,
    parseSummaryFormat
  ];

  let parsed = false;

  for (const strategy of strategies) {
    try {
      const result = await strategy(lines, metadata);
      if (result && result.length > 0) {
        performances.push(...result);
        parsed = true;
        console.log(`✅ Successfully parsed ${result.length} performances using ${strategy.name}`);
        break;
      }
    } catch (error) {
      console.log(`⚠️ Strategy ${strategy.name} failed: ${error.message}`);
    }
  }

  if (!parsed) {
    // Fallback: extract any recognizable data
    const fallbackData = await extractFallbackData(lines, metadata);
    if (fallbackData.length > 0) {
      performances.push(...fallbackData);
      console.log(`🔄 Used fallback extraction: ${fallbackData.length} performances`);
    } else {
      throw new Error('Could not parse PDF with any known Tessitura format');
    }
  }

  return performances;
}

// Strategy 1: Direct line format (for raw Tessitura export lines)
async function parseDirectLineFormat(lines) {
  const performances = [];

  for (const line of lines) {
    // Match Tessitura direct export format:
    // 251010E 10/10/2025 8:00 PM 51.1% 485 32,899.00 15 1,101.60 292 16,098.70 50,099.30 0 0.00 50,099.30 659 51.2%

    // Look for lines that start with a performance code (letters + numbers)
    const directMatch = line.match(/^([A-Z0-9]+)\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(.+)/);

    if (directMatch) {
      console.log(`🎯 Found direct line format: ${line}`);

      // Split the line into components
      const parts = line.split(/\s+/);

      if (parts.length >= 10) {
        // Extract data from the expected positions
        const performanceCode = parts[0];  // 251010E
        const date = parts[1];             // 10/10/2025
        const time = parts[2] + ' ' + parts[3];  // 8:00 PM
        // parts[4] is occupancy percentage // 51.1%
        const singleTickets = parseInt(parts[5]) || 0;     // 485
        const singleRevenue = parseFloat(parts[6].replace(/,/g, '')) || 0;  // 32,899.00
        // parts[7] and parts[8] appear to be other ticket categories
        const subscriptionTickets = parseInt(parts[9]) || 0;  // 292
        const subscriptionRevenue = parseFloat(parts[10].replace(/,/g, '')) || 0;  // 16,098.70
        const totalRevenue = parseFloat(parts[11].replace(/,/g, '')) || 0;  // 50,099.30

        const performance = {
          performance_id: Date.now() + Math.floor(Math.random() * 1000),
          performance_code: performanceCode,
          title: `Performance ${performanceCode}`,
          performance_date: parseDate(date) || '2025-01-01',
          venue: 'SY-Lyric Theatre',
          series: 'Classical',
          season: '25-26 Classical',
          capacity: 1000,
          single_tickets_sold: singleTickets,
          subscription_tickets_sold: subscriptionTickets,
          total_revenue: totalRevenue,
          occupancy_goal: 85,
          budget_goal: 0
        };

        console.log(`✅ Parsed performance: ${performanceCode} - ${singleTickets} single, ${subscriptionTickets} subscription, $${totalRevenue} revenue`);
        performances.push(performance);
      }
    }
  }

  return performances;
}

// Strategy 2: Tabular format (most common)
async function parseTabularFormat(lines) {
  const performances = [];
  let headerFound = false;
  let columnMap = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Look for table header
    if (!headerFound && (line.includes('Performance') || line.includes('Code') || line.includes('Date'))) {
      const headers = line.split(/\s{2,}|\t/); // Split on multiple spaces or tabs

      // Map column positions
      headers.forEach((header, index) => {
        const h = header.toLowerCase();
        if (h.includes('id')) columnMap.id = index;
        if (h.includes('code')) columnMap.code = index;
        if (h.includes('title') || h.includes('name')) columnMap.title = index;
        if (h.includes('date')) columnMap.date = index;
        if (h.includes('venue')) columnMap.venue = index;
        if (h.includes('single') || h.includes('individual')) columnMap.single = index;
        if (h.includes('subscription') || h.includes('sub')) columnMap.subscription = index;
        if (h.includes('revenue') || h.includes('sales')) columnMap.revenue = index;
        if (h.includes('capacity')) columnMap.capacity = index;
      });

      headerFound = true;
      continue;
    }

    // Parse data rows
    if (headerFound && line.match(/^\d+/) || line.match(/^[A-Z0-9]{5,}/)) {
      const columns = line.split(/\s{2,}|\t/);

      const performance = {
        performance_id: extractNumber(columns[columnMap.id]),
        performance_code: columns[columnMap.code] || `GEN${Date.now()}`,
        title: columns[columnMap.title] || 'Unknown Performance',
        performance_date: parseDate(columns[columnMap.date]) || '2025-01-01',
        venue: columns[columnMap.venue] || 'Unknown Venue',
        series: 'Unknown Series',
        season: '25-26 Unknown',
        capacity: extractNumber(columns[columnMap.capacity]) || 1000,
        single_tickets_sold: extractNumber(columns[columnMap.single]) || 0,
        subscription_tickets_sold: extractNumber(columns[columnMap.subscription]) || 0,
        total_revenue: extractCurrency(columns[columnMap.revenue]) || 0,
        occupancy_goal: 85,
        budget_goal: 0
      };

      if (performance.performance_id || performance.performance_code !== `GEN${Date.now()}`) {
        performances.push(performance);
      }
    }
  }

  return performances;
}

// Strategy 2: Narrative format (paragraph style)
async function parseNarrativeFormat(lines) {
  const performances = [];
  let currentPerformance = {};

  for (const line of lines) {
    // Look for performance identifiers
    const idMatch = line.match(/(?:Performance\s+ID|ID):\s*(\d+)/i);
    if (idMatch) {
      if (Object.keys(currentPerformance).length > 0) {
        performances.push(currentPerformance);
      }
      currentPerformance = { performance_id: parseInt(idMatch[1]) };
      continue;
    }

    const codeMatch = line.match(/(?:Code|Performance\s+Code):\s*([A-Z0-9]+)/i);
    if (codeMatch) {
      currentPerformance.performance_code = codeMatch[1];
      continue;
    }

    const titleMatch = line.match(/(?:Title|Name):\s*(.+?)(?:\s+Series:|$)/i);
    if (titleMatch) {
      currentPerformance.title = titleMatch[1].trim();
      continue;
    }

    const dateMatch = line.match(/(?:Date|Performance\s+Date):\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
    if (dateMatch) {
      currentPerformance.performance_date = parseDate(dateMatch[1]);
      continue;
    }

    const ticketsMatch = line.match(/(?:Single|Individual).*?(\d+).*?(?:Subscription|Sub).*?(\d+)/i);
    if (ticketsMatch) {
      currentPerformance.single_tickets_sold = parseInt(ticketsMatch[1]);
      currentPerformance.subscription_tickets_sold = parseInt(ticketsMatch[2]);
      continue;
    }

    const revenueMatch = line.match(/(?:Revenue|Sales).*?\$?([\d,]+\.?\d*)/i);
    if (revenueMatch) {
      currentPerformance.total_revenue = extractCurrency(revenueMatch[1]);
      continue;
    }
  }

  // Add the last performance
  if (Object.keys(currentPerformance).length > 0) {
    performances.push(currentPerformance);
  }

  // Fill in missing fields with defaults
  return performances.map(perf => ({
    performance_id: perf.performance_id || Date.now(),
    performance_code: perf.performance_code || `AUTO${Date.now()}`,
    title: perf.title || 'Unknown Performance',
    performance_date: perf.performance_date || '2025-01-01',
    venue: perf.venue || 'Unknown Venue',
    series: 'Unknown Series',
    season: '25-26 Unknown',
    capacity: perf.capacity || 1000,
    single_tickets_sold: perf.single_tickets_sold || 0,
    subscription_tickets_sold: perf.subscription_tickets_sold || 0,
    total_revenue: perf.total_revenue || 0,
    occupancy_goal: 85,
    budget_goal: 0
  }));
}

// Strategy 3: Detailed report format
async function parseDetailedReportFormat(lines) {
  // Implementation for detailed Tessitura reports
  return parseNarrativeFormat(lines); // Fallback for now
}

// Strategy 4: Summary format
async function parseSummaryFormat(lines) {
  // Implementation for summary reports
  return parseNarrativeFormat(lines); // Fallback for now
}

// Fallback data extraction
async function extractFallbackData(lines, metadata) {
  console.log('🔄 Attempting fallback data extraction...');

  // Extract any numbers that look like performance data
  const performances = [];
  const text = lines.join(' ');

  // Look for patterns like "Performance 12345" or "Code ABC123"
  const performanceMatches = text.match(/(?:Performance|Code)\s*[:\-]?\s*([A-Z0-9]{3,})/gi);

  if (performanceMatches && performanceMatches.length > 0) {
    performanceMatches.forEach((match, index) => {
      const code = match.replace(/(?:Performance|Code)\s*[:\-]?\s*/i, '');

      performances.push({
        performance_id: Date.now() + index,
        performance_code: code,
        title: `Performance ${code}`,
        performance_date: '2025-01-01',
        venue: 'Unknown Venue',
        series: 'Unknown Series',
        season: '25-26 Unknown',
        capacity: 1000,
        single_tickets_sold: 0,
        subscription_tickets_sold: 0,
        total_revenue: 0,
        occupancy_goal: 85,
        budget_goal: 0
      });
    });
  }

  return performances;
}

// Utility functions
function extractNumber(str) {
  if (!str) return null;
  const match = str.toString().match(/\d+/);
  return match ? parseInt(match[0]) : null;
}

function extractCurrency(str) {
  if (!str) return null;
  const match = str.toString().replace(/[$,]/g, '').match(/\d+\.?\d*/);
  return match ? parseFloat(match[0]) : null;
}

function parseDate(dateStr) {
  if (!dateStr) return null;

  // Handle various date formats
  const formats = [
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // MM/DD/YYYY
    /(\d{4})-(\d{1,2})-(\d{1,2})/, // YYYY-MM-DD
    /(\d{1,2})-(\d{1,2})-(\d{4})/ // MM-DD-YYYY
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      if (format === formats[1]) {
        // YYYY-MM-DD format
        return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
      } else {
        // MM/DD/YYYY or MM-DD-YYYY format
        return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
      }
    }
  }

  return '2025-01-01'; // Default fallback
}

// Import shared functions from the original PDF processor
const DATASET_ID = process.env.BIGQUERY_DATASET || 'symphony_dashboard';

// Reuse existing functions from pdf-data-processor.js
async function createDataSnapshot(bigquery, data, executionId) {
  const snapshotId = `snap_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const today = new Date().toISOString().split('T')[0];

  const totalTickets = data.performances?.reduce((sum, perf) =>
    sum + (perf.single_tickets_sold || 0) + (perf.subscription_tickets_sold || 0), 0) || 0;
  const totalRevenue = data.performances?.reduce((sum, perf) =>
    sum + (perf.total_revenue || 0), 0) || 0;

  const snapshotData = {
    snapshot_id: snapshotId,
    snapshot_date: today,
    source_type: 'pdf_webhook',
    source_identifier: data.metadata?.filename || `webhook_${executionId}`,
    raw_data: data,
    processed_data: data.performances,
    performance_count: data.performances?.length || 0,
    total_tickets_in_snapshot: totalTickets,
    total_revenue_in_snapshot: totalRevenue,
    processing_status: 'pending'
  };

  const query = `
    INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.data_snapshots\`
    (snapshot_id, snapshot_date, source_type, source_identifier, raw_data, processed_data,
     performance_count, total_tickets_in_snapshot, total_revenue_in_snapshot, processing_status)
    VALUES (
      '${snapshotId}',
      '${today}',
      'pdf_webhook',
      '${(data.metadata?.filename || `webhook_${executionId}`).replace(/'/g, "\\'")}',
      PARSE_JSON('${JSON.stringify(data).replace(/'/g, "\\'")}'),
      PARSE_JSON('${JSON.stringify(data.performances).replace(/'/g, "\\'")}'),
      ${data.performances?.length || 0},
      ${totalTickets},
      ${totalRevenue},
      'pending'
    )
  `;

  await bigquery.query({
    query,
    location: 'US'
  });

  console.log(`📸 Created data snapshot: ${snapshotId}`);
  return snapshotId;
}

// Import the complex processing logic from the original function
async function processPerformanceData(bigquery, performances, snapshotId, executionId) {
  let processed = 0, inserted = 0, updated = 0, trendsAdjusted = 0, anomalies = 0;

  for (const perfData of performances) {
    try {
      // First, check if this performance already exists in performances table
      const checkQuery = `
        SELECT performance_id, single_tickets_sold, subscription_tickets_sold, total_revenue
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.performances\`
        WHERE performance_code = '${perfData.performance_code}'
      `;

      const [existingRows] = await bigquery.query({ query: checkQuery, location: 'US' });

      if (existingRows.length > 0) {
        // Update existing record
        const updateQuery = `
          UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.performances\`
          SET
            single_tickets_sold = ${perfData.single_tickets_sold || 0},
            subscription_tickets_sold = ${perfData.subscription_tickets_sold || 0},
            total_tickets_sold = ${(perfData.single_tickets_sold || 0) + (perfData.subscription_tickets_sold || 0)},
            total_revenue = ${perfData.total_revenue || 0},
            capacity_percent = ${perfData.capacity_percent || 0},
            budget_percent = ${perfData.budget_percent || 0},
            occupancy_percent = ${perfData.occupancy_percent || 0},
            has_sales_data = true,
            updated_at = CURRENT_TIMESTAMP()
          WHERE performance_code = '${perfData.performance_code}'
        `;

        await bigquery.query({ query: updateQuery, location: 'US' });
        updated++;
        console.log(`📊 Updated performance: ${perfData.performance_code}`);

      } else {
        // Insert new record
        const insertQuery = `
          INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.performances\`
          (performance_id, performance_code, title, series, performance_date, venue, season,
           capacity, single_tickets_sold, subscription_tickets_sold, total_tickets_sold,
           total_revenue, occupancy_goal, budget_goal, capacity_percent, budget_percent,
           occupancy_percent, has_sales_data, updated_at)
          VALUES (
            ${perfData.performance_id || 0},
            '${perfData.performance_code}',
            '${(perfData.title || '').replace(/'/g, "\\'")}',
            '${(perfData.series || '').replace(/'/g, "\\'")}',
            '${perfData.performance_date || '2025-01-01'}',
            '${(perfData.venue || 'Unknown').replace(/'/g, "\\'")}',
            '${(perfData.season || 'Unknown').replace(/'/g, "\\'")}',
            ${perfData.capacity || 1500},
            ${perfData.single_tickets_sold || 0},
            ${perfData.subscription_tickets_sold || 0},
            ${(perfData.single_tickets_sold || 0) + (perfData.subscription_tickets_sold || 0)},
            ${perfData.total_revenue || 0},
            ${perfData.occupancy_goal || 85},
            ${perfData.budget_goal || 0},
            ${perfData.capacity_percent || 0},
            ${perfData.budget_percent || 0},
            ${perfData.occupancy_percent || 0},
            true,
            CURRENT_TIMESTAMP()
          )
        `;

        await bigquery.query({ query: insertQuery, location: 'US' });
        inserted++;
        console.log(`📝 Inserted new performance: ${perfData.performance_code}`);
      }

      processed++;

    } catch (error) {
      console.error(`❌ Error processing performance ${perfData.performance_code}:`, error.message);
      anomalies++;
    }
  }

  return { processed, inserted, updated, trendsAdjusted, anomalies };
}

// Pipeline logging functions
async function logPipelineStart(bigquery, executionId, requestData) {
  const query = `
    INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.pipeline_execution_log\`
    (execution_id, pipeline_type, status, start_time, source_file, triggered_by)
    VALUES (?, 'pdf_webhook', 'running', ?, ?, 'make.com')
  `;

  await bigquery.query({
    query,
    params: [
      executionId,
      new Date().toISOString(),
      requestData.metadata?.filename || 'unknown'
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