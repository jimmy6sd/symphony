// Google Cloud Function: PDF Webhook Receiver for Symphony Dashboard
// Accepts raw PDF data from Make.com and handles all processing internally

const { BigQuery } = require('@google-cloud/bigquery');
const { Storage } = require('@google-cloud/storage');
const crypto = require('crypto');
const functions = require('@google-cloud/functions-framework');

// Initialize Google Cloud clients with shared credentials
const initializeCredentials = () => {
  try {
    const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

    if (!credentialsEnv) {
      // Use Application Default Credentials (ADC) - preferred for GCF
      return null;
    }

    let credentials;

    // Check if it's JSON content
    if (credentialsEnv.startsWith('{')) {
      credentials = JSON.parse(credentialsEnv);
    } else {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON must be JSON string, not file path (GCF uses ADC by default)');
    }

    // Fix escaped newlines
    if (credentials.private_key && credentials.private_key.includes('\\n')) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }

    return credentials;
  } catch (error) {
    console.error('Credentials initialization error:', error.message);
    throw error;
  }
};

// Initialize BigQuery client
const initializeBigQuery = () => {
  const credentials = initializeCredentials();

  if (credentials) {
    return new BigQuery({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || credentials.project_id,
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
      location: 'US'
    });
  } else {
    // Use Application Default Credentials (recommended for GCF)
    return new BigQuery({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      location: 'US'
    });
  }
};

// Initialize Cloud Storage client
const initializeStorage = () => {
  const credentials = initializeCredentials();

  if (credentials) {
    return new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || credentials.project_id,
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      }
    });
  } else {
    // Use Application Default Credentials (recommended for GCF)
    return new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
    });
  }
};

// Backup PDF to Google Cloud Storage
async function backupPdfToStorage(base64Data, executionId, metadata) {
  try {
    const storage = initializeStorage();
    const bucketName = process.env.GCS_PDF_BACKUP_BUCKET || 'symphony-dashboard-pdfs';

    // Create date-based path: 2025/10/filename.pdf
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const timestamp = now.toISOString().replace(/[:.]/g, '-').substring(0, 19);

    // Generate filename with timestamp and execution ID
    const originalFilename = metadata?.filename || 'performance_sales_summary';
    const cleanFilename = originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${year}/${month}/${cleanFilename}_${timestamp}_${executionId}.pdf`;

    console.log(`💾 Backing up PDF to gs://${bucketName}/${filename}`);

    // Convert base64 to buffer
    const pdfBuffer = Buffer.from(base64Data, 'base64');

    // Upload to GCS
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(filename);

    await file.save(pdfBuffer, {
      metadata: {
        contentType: 'application/pdf',
        metadata: {
          executionId: executionId,
          uploadedAt: now.toISOString(),
          originalFilename: metadata?.filename || 'unknown',
          emailSubject: metadata?.email_subject || 'unknown',
          emailDate: metadata?.email_date || 'unknown',
          source: 'pdf_webhook'
        }
      }
    });

    console.log(`✅ PDF backed up successfully to Cloud Storage`);
    console.log(`   Location: gs://${bucketName}/${filename}`);
    console.log(`   Size: ${Math.round(pdfBuffer.length / 1024)}KB`);

    return { success: true, filename: filename };
  } catch (error) {
    // Don't fail the webhook if backup fails - just log it
    console.error('⚠️  PDF backup failed (continuing with processing):', error.message);
    return { success: false, error: error.message };
  }
}

// Main HTTP function handler for Google Cloud Functions
functions.http('pdfWebhook', async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).send('');
    return;
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const executionId = `webhook_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  try {
    console.log(`📨 PDF webhook received - Execution ID: ${executionId}`);

    const requestData = req.body;

    // Debug: Log what fields we received
    const receivedFields = Object.keys(requestData);
    console.log(`📋 Received fields: ${receivedFields.join(', ')}`);
    if (requestData.pdf_base64) {
      console.log(`📄 pdf_base64 length: ${requestData.pdf_base64.length} characters`);
    }
    if (requestData.pdf_text) {
      console.log(`📝 pdf_text length: ${requestData.pdf_text.length} characters`);
    }

    // Log pipeline execution start
    const bigquery = initializeBigQuery();
    await logPipelineStart(bigquery, executionId, requestData);

    // BACKUP: Save PDF to Cloud Storage before processing
    let backupResult = null;
    if (requestData.pdf_base64) {
      console.log('🔄 Attempting PDF backup...');
      backupResult = await backupPdfToStorage(requestData.pdf_base64, executionId, requestData.metadata);
      console.log(`💾 Backup result: ${JSON.stringify(backupResult)}`);
    } else if (requestData.pdf_text) {
      // PDF was sent as pre-extracted text, cannot backup
      backupResult = { success: false, error: 'PDF sent as text - cannot backup. Configure Make.com to send pdf_base64 field with raw PDF data.' };
    } else {
      backupResult = { success: false, error: 'No PDF data received (expected pdf_base64 or pdf_text field)' };
    }

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

    res.status(200).json({
      success: true,
      execution_id: executionId,
      snapshot_id: snapshotId,
      backup: backupResult || { success: false, error: 'No backup attempted' },
      summary: {
        received: performanceData?.length || 0,
        processed: processedData.processed,
        inserted: processedData.inserted,
        updated: processedData.updated,
        trends_adjusted: processedData.trendsAdjusted,
        anomalies_detected: processedData.anomalies
      },
      message: 'PDF processed successfully via webhook'
    });

  } catch (error) {
    console.error(`❌ PDF webhook processing failed - Execution ID: ${executionId}:`, error.message);
    console.error('Stack trace:', error.stack);

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

    res.status(500).json({
      error: 'PDF webhook processing failed',
      execution_id: executionId,
      message: error.message
    });
  }
});

// Process base64 PDF data
async function processPdfBase64(base64Data, metadata) {
  console.log('🔍 Extracting text from base64 PDF...');

  // Convert base64 to buffer
  const pdfBuffer = Buffer.from(base64Data, 'base64');

  // Extract text using pdf2json (preserves table structure)
  const PDFParser = require('pdf2json');
  const pdfParser = new PDFParser();

  const performances = await new Promise((resolve, reject) => {
    pdfParser.on('pdfParser_dataError', errData => reject(errData.parserError));
    pdfParser.on('pdfParser_dataReady', pdfData => {
      const performances = [];

      for (const page of pdfData.Pages) {
        // Collect all text items and sort by position
        const allItems = [];
        for (const textItem of page.Texts) {
          const content = decodeURIComponent(textItem.R[0].T);
          allItems.push(content);
        }

        // Find performance codes and extract data following each code
        const isCurrency = (str) => /^\d{1,3}(,\d{3})*\.\d{2}$/.test(str);
        const isPercent = (str) => /^\d+\.\d+%$/.test(str);
        const isCount = (str) => /^\d+$/.test(str);

        for (let i = 0; i < allItems.length; i++) {
          const item = allItems[i];

          // Check if this is a performance code (25XXXXY or 25XXXXYY format, not a total row)
          if (item.match(/^25\d{4}[A-Z]{1,2}$/) && !allItems[i-1]?.includes('Total')) {
            const performanceCode = item;

            // Expected sequence: [Code, DateTime, Budget%, FixedCount, FixedRev, NonFixedCount, NonFixedRev, SingleCount, SingleRev, Subtotal, Reserved, ReservedRev, Total, Avail, Capacity%]
            let idx = i + 1;

            const dateTime = allItems[idx++] || '';
            const budgetStr = allItems[idx++] || '0%';
            const fixedCountStr = allItems[idx++] || '0';
            const fixedRevStr = allItems[idx++] || '0.00';
            const nonFixedCountStr = allItems[idx++] || '0';
            const nonFixedRevStr = allItems[idx++] || '0.00';
            const singleCountStr = allItems[idx++] || '0';
            const singleRevStr = allItems[idx++] || '0.00';
            const subtotalStr = allItems[idx++] || '0.00';

            // Reserved and Reserved Revenue (check if next item is a count)
            let reservedStr = '0';
            let reservedRevStr = '0.00';
            if (idx < allItems.length && isCount(allItems[idx])) {
              reservedStr = allItems[idx++];
              if (idx < allItems.length && isCurrency(allItems[idx])) {
                reservedRevStr = allItems[idx++];
              }
            }

            // Total, Avail, Capacity%
            const totalStr = allItems[idx++] || subtotalStr;
            const availStr = allItems[idx++] || '0';
            const capacityStr = allItems[idx++] || '0.0%';

            const budgetPercent = parseFloat(budgetStr.replace('%', '')) || 0;
            const fixedCount = parseInt(fixedCountStr.replace(/,/g, '')) || 0;
            const fixedRevenue = parseFloat(fixedRevStr.replace(/,/g, '')) || 0;
            const nonFixedCount = parseInt(nonFixedCountStr.replace(/,/g, '')) || 0;
            const nonFixedRevenue = parseFloat(nonFixedRevStr.replace(/,/g, '')) || 0;
            const singleCount = parseInt(singleCountStr.replace(/,/g, '')) || 0;
            const singleRevenue = parseFloat(singleRevStr.replace(/,/g, '')) || 0;
            const totalRevenue = parseFloat(totalStr.replace(/,/g, '')) || 0;
            const availSeats = parseInt(availStr.replace(/,/g, '')) || 0;
            const capacityPercent = parseFloat(capacityStr.replace('%', '')) || 0;

            // Fixed packages = subscriptions
            const subscriptionTickets = fixedCount;
            // Single tickets + Non-Fixed packages = single tickets
            const singleTicketsTotal = singleCount + nonFixedCount;
            const totalSold = subscriptionTickets + singleTicketsTotal;

            // NOTE: Only sales data is included here (goes to snapshots table)
            // Metadata (capacity, budget_goal, etc.) comes from performances table
            const performance = {
              performance_code: performanceCode,
              performance_date: parseDate(dateTime) || '2025-01-01',
              single_tickets_sold: singleTicketsTotal,
              subscription_tickets_sold: subscriptionTickets,
              total_revenue: totalRevenue,
              capacity_percent: capacityPercent,  // From report (can validate)
              budget_percent: budgetPercent       // From report
            };

            console.log(`✅ Parsed: ${performanceCode} (${dateTime}) - ${singleTicketsTotal} single (incl. non-fixed), ${subscriptionTickets} sub (fixed only), $${Math.round(totalRevenue)} revenue, ${capacityPercent}% capacity`);
            performances.push(performance);
          }
        }
      }

      resolve(performances);
    });

    pdfParser.parseBuffer(pdfBuffer);
  });

  console.log(`📊 Parsed ${performances.length} performances from PDF`);

  // Return performances array
  return performances;
}

// Process pre-extracted PDF text
async function processPdfText(text, metadata) {
  console.log('🔍 Parsing pre-extracted PDF text...');
  return await parseTessituraText(text, metadata);
}

// Process PDF from URL
async function processPdfUrl(url, metadata) {
  console.log('📥 Downloading PDF from URL...');

  // Download PDF
  const pdfBuffer = await downloadPdf(url);

  // Extract and parse using pdf2json (same as processPdfBase64)
  const PDFParser = require('pdf2json');
  const pdfParser = new PDFParser();

  const performances = await new Promise((resolve, reject) => {
    pdfParser.on('pdfParser_dataError', errData => reject(errData.parserError));
    pdfParser.on('pdfParser_dataReady', pdfData => {
      const performances = [];

      for (const page of pdfData.Pages) {
        // Collect all text items
        const allItems = [];
        for (const textItem of page.Texts) {
          const content = decodeURIComponent(textItem.R[0].T);
          allItems.push(content);
        }

        // Find performance codes and extract data following each code
        const isCurrency = (str) => /^\d{1,3}(,\d{3})*\.\d{2}$/.test(str);
        const isCount = (str) => /^\d+$/.test(str);

        for (let i = 0; i < allItems.length; i++) {
          const item = allItems[i];

          // Check if this is a performance code (25XXXXY or 25XXXXYY format, not a total row)
          if (item.match(/^25\d{4}[A-Z]{1,2}$/) && !allItems[i-1]?.includes('Total')) {
            const performanceCode = item;

            let idx = i + 1;
            const dateTime = allItems[idx++] || '';
            const budgetStr = allItems[idx++] || '0%';
            const fixedCountStr = allItems[idx++] || '0';
            const fixedRevStr = allItems[idx++] || '0.00';
            const nonFixedCountStr = allItems[idx++] || '0';
            const nonFixedRevStr = allItems[idx++] || '0.00';
            const singleCountStr = allItems[idx++] || '0';
            const singleRevStr = allItems[idx++] || '0.00';
            const subtotalStr = allItems[idx++] || '0.00';

            let reservedStr = '0';
            let reservedRevStr = '0.00';
            if (idx < allItems.length && isCount(allItems[idx])) {
              reservedStr = allItems[idx++];
              if (idx < allItems.length && isCurrency(allItems[idx])) {
                reservedRevStr = allItems[idx++];
              }
            }

            const totalStr = allItems[idx++] || subtotalStr;
            const availStr = allItems[idx++] || '0';
            const capacityStr = allItems[idx++] || '0.0%';

            const budgetPercent = parseFloat(budgetStr.replace('%', '')) || 0;
            const fixedCount = parseInt(fixedCountStr.replace(/,/g, '')) || 0;
            const fixedRevenue = parseFloat(fixedRevStr.replace(/,/g, '')) || 0;
            const nonFixedCount = parseInt(nonFixedCountStr.replace(/,/g, '')) || 0;
            const nonFixedRevenue = parseFloat(nonFixedRevStr.replace(/,/g, '')) || 0;
            const singleCount = parseInt(singleCountStr.replace(/,/g, '')) || 0;
            const singleRevenue = parseFloat(singleRevStr.replace(/,/g, '')) || 0;
            const totalRevenue = parseFloat(totalStr.replace(/,/g, '')) || 0;
            const availSeats = parseInt(availStr.replace(/,/g, '')) || 0;
            const capacityPercent = parseFloat(capacityStr.replace('%', '')) || 0;

            const subscriptionTickets = fixedCount;
            const singleTicketsTotal = singleCount + nonFixedCount;
            const totalSold = subscriptionTickets + singleTicketsTotal;

            performances.push({
              performance_code: performanceCode,
              performance_date: parseDate(dateTime) || '2025-01-01',
              single_tickets_sold: singleTicketsTotal,
              subscription_tickets_sold: subscriptionTickets,
              total_revenue: totalRevenue,
              capacity_percent: capacityPercent,
              budget_percent: budgetPercent
            });

            console.log(`✅ Parsed: ${performanceCode} (${dateTime}) - ${singleCount} single, ${subscriptionTickets} sub, $${Math.round(totalRevenue)} revenue, ${capacityPercent}% capacity`);
          }
        }
      }

      resolve(performances);
    });

    pdfParser.parseBuffer(pdfBuffer);
  });

  console.log(`📊 Parsed ${performances.length} performances from downloaded PDF`);
  return performances;
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

  console.log(`📄 Total lines to parse: ${lines.length}`);
  console.log(`📋 First 5 lines of text:\n${lines.slice(0, 5).map((l, i) => `  ${i+1}. ${l.substring(0, 100)}${l.length > 100 ? '...' : ''}`).join('\n')}`);

  // Multiple parsing strategies for different Tessitura report formats
  const strategies = [
    parseTabularFormat,
    parseDirectLineFormat,
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
  console.log(`🔍 parseDirectLineFormat: Checking ${lines.length} lines...`);
  const performances = [];
  let matchedLines = 0;
  let failedParses = 0;

  for (const line of lines) {
    // Match Tessitura compact export format (no spaces between code and date)
    const compactMatch = line.match(/^(\d{6}[A-Z])(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2}\s+[AP]M)(.+)/);

    if (compactMatch) {
      matchedLines++;
      console.log(`📍 Line ${matchedLines}: MATCHED pattern for "${compactMatch[1]}" (${compactMatch[2]} ${compactMatch[3]})`);
      const performanceCode = compactMatch[1];
      const date = compactMatch[2];
      const time = compactMatch[3];
      const dataSection = compactMatch[4];

      // Parse budget percent
      const budgetMatch = dataSection.match(/^([0-9.]+)%/);
      if (!budgetMatch) {
        console.log(`   ❌ Failed: No budget% match in data section`);
        failedParses++;
        continue;
      }
      const budgetPercent = parseFloat(budgetMatch[1]);

      // Extract capacity from end
      const capacityMatch = dataSection.match(/(\d{1,2}\.\d+)%$/);
      if (!capacityMatch) {
        console.log(`   ❌ Failed: No capacity% match`);
        failedParses++;
        continue;
      }
      const capacityPercent = parseFloat(capacityMatch[1]);

      let remaining = dataSection.substring(0, dataSection.length - capacityMatch[0].length);

      // Helper functions for parsing
      const extractCurrencyWithAppendedDigits = (str) => {
        const match = str.match(/(\d{1,3}(?:,\d{3})*\.\d{2})(\d*)$/);
        if (match) {
          const currencyStr = match[1];
          const appendedDigits = match[2];
          const value = parseFloat(currencyStr.replace(/,/g, ''));
          const newStr = str.substring(0, str.length - match[0].length);
          return { value, remaining: newStr, appended: appendedDigits };
        }
        return null;
      };

      const extractCurrencyFromEnd = (str) => {
        const match = str.match(/(\d{1,3}(?:,\d{3})*\.\d{2})$/);
        if (match) {
          const value = parseFloat(match[1].replace(/,/g, ''));
          const newStr = str.substring(0, str.length - match[1].length);
          return { value, remaining: newStr };
        }
        return null;
      };

      const extractCountRevenuePair = (str) => {
        const currResult = extractCurrencyFromEnd(str);
        if (!currResult) return null;

        const countMatch = currResult.remaining.match(/([\d,]+)$/);
        if (!countMatch) return null;

        return {
          count: parseInt(countMatch[1].replace(/,/g, '')),
          revenue: currResult.value,
          remaining: currResult.remaining.substring(0, currResult.remaining.length - countMatch[1].length)
        };
      };

      // Extract total revenue and available seats
      const totalResult = extractCurrencyWithAppendedDigits(remaining);
      if (!totalResult) {
        failedParses++;
        continue;
      }
      const totalRevenue = totalResult.value;
      const availSeats = totalResult.appended ? parseInt(totalResult.appended) : 0;
      remaining = totalResult.remaining;

      // Extract reserved revenue
      const reservedResult = extractCurrencyFromEnd(remaining);
      if (!reservedResult) {
        failedParses++;
        continue;
      }
      remaining = reservedResult.remaining;

      // Extract subtotal revenue
      const subtotalResult = extractCurrencyFromEnd(remaining);
      if (!subtotalResult) {
        failedParses++;
        continue;
      }
      remaining = subtotalResult.remaining;

      // Extract Single tickets
      const singleResult = extractCountRevenuePair(remaining);
      if (!singleResult) {
        failedParses++;
        continue;
      }
      const singleCount = singleResult.count;
      remaining = singleResult.remaining;

      // Extract Non-Fixed packages
      const nonFixedResult = extractCountRevenuePair(remaining);
      if (!nonFixedResult) {
        failedParses++;
        continue;
      }
      const nonFixedPkgCount = nonFixedResult.count;
      remaining = nonFixedResult.remaining;

      // Extract Fixed packages
      const fixedResult = extractCountRevenuePair(remaining);
      if (!fixedResult) {
        failedParses++;
        continue;
      }
      const fixedPkgCount = fixedResult.count;

      // Calculate total subscription tickets
      const subscriptionTickets = fixedPkgCount + nonFixedPkgCount;

      const performance = {
        performance_code: performanceCode,
        performance_date: parseDate(date) || '2025-01-01',
        single_tickets_sold: singleCount,
        subscription_tickets_sold: subscriptionTickets,
        total_revenue: totalRevenue,
        capacity_percent: capacityPercent,
        budget_percent: budgetPercent
      };

      console.log(`   ✅ SUCCESS: ${performanceCode} (${date})`);
      performances.push(performance);
    }
  }

  console.log(`📊 parseDirectLineFormat: ${performances.length} successfully extracted`);
  return performances;
}

// Strategy 2: Tabular format (most common)
async function parseTabularFormat(lines) {
  const performances = [];

  for (const line of lines) {
    const parts = line.split(/\t+/);

    if (parts.length >= 10 && parts[0].match(/^25\d{4}[A-Z]{1,2}$/)) {
      const performanceCode = parts[0];
      const dateTime = parts[1];
      const budgetPercent = parseFloat(parts[2]) || 0;

      const fixedCount = parseInt(parts[3]) || 0;
      const fixedRevenue = parseFloat(parts[4].replace(/,/g, '')) || 0;
      const nonFixedCount = parseInt(parts[5]) || 0;
      const nonFixedRevenue = parseFloat(parts[6].replace(/,/g, '')) || 0;
      const singleCount = parseInt(parts[7]) || 0;
      const singleRevenue = parseFloat(parts[8].replace(/,/g, '')) || 0;
      const subtotalRevenue = parseFloat(parts[9].replace(/,/g, '')) || 0;

      const totalRevenue = parts.length > 11 ? parseFloat(parts[11].replace(/,/g, '')) : subtotalRevenue;
      const availSeats = parts.length > 12 ? parseInt(parts[12]) || 0 : 0;
      const capacityPercent = parts.length > 13 ? parseFloat(parts[13]) : 0;

      const subscriptionTickets = fixedCount;
      const singleTicketsTotal = singleCount + nonFixedCount;

      const performance = {
        performance_code: performanceCode,
        performance_date: parseDate(dateTime) || '2025-01-01',
        single_tickets_sold: singleTicketsTotal,
        subscription_tickets_sold: subscriptionTickets,
        total_revenue: totalRevenue,
        capacity_percent: capacityPercent,
        budget_percent: budgetPercent
      };

      performances.push(performance);
    }
  }

  return performances;
}

// Strategy 3: Narrative format (placeholder)
async function parseNarrativeFormat(lines) {
  return [];
}

// Strategy 4: Detailed report format (placeholder)
async function parseDetailedReportFormat(lines) {
  return [];
}

// Strategy 5: Summary format (placeholder)
async function parseSummaryFormat(lines) {
  return [];
}

// Fallback data extraction (placeholder)
async function extractFallbackData(lines, metadata) {
  return [];
}

// Utility function to parse dates
function parseDate(dateStr) {
  if (!dateStr) return null;

  const formats = [
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
    /(\d{4})-(\d{1,2})-(\d{1,2})/,
    /(\d{1,2})-(\d{1,2})-(\d{4})/
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      if (format === formats[1]) {
        return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
      } else {
        return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
      }
    }
  }

  return '2025-01-01';
}

// BigQuery functions
const DATASET_ID = process.env.BIGQUERY_DATASET || 'symphony_dashboard';

async function createDataSnapshot(bigquery, data, executionId) {
  const snapshotId = `snap_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  try {
    const today = new Date().toISOString().split('T')[0];

    const totalTickets = data.performances?.reduce((sum, perf) =>
      sum + (perf.single_tickets_sold || 0) + (perf.subscription_tickets_sold || 0), 0) || 0;
    const totalRevenue = data.performances?.reduce((sum, perf) =>
      sum + (perf.total_revenue || 0), 0) || 0;

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
  } catch (error) {
    console.log('Data snapshots table not found - skipping snapshot creation');
  }

  return snapshotId;
}

async function processPerformanceData(bigquery, performances, snapshotId, executionId) {
  let processed = 0, inserted = 0, updated = 0, trendsAdjusted = 0, anomalies = 0;

  console.log(`🚀 Batch processing ${performances.length} performances with dual-write...`);

  const codes = performances.map(p => `'${p.performance_code}'`).join(',');
  const checkQuery = `
    SELECT performance_code, performance_id
    FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.performances\`
    WHERE performance_code IN (${codes})
  `;

  const [existingRows] = await bigquery.query({ query: checkQuery, location: 'US' });
  const existingCodes = new Map(existingRows.map(row => [row.performance_code, row.performance_id]));

  console.log(`📋 Found ${existingCodes.size}/${performances.length} existing performances`);

  // Separate new and existing performances
  const newPerfs = [];
  const existingPerfs = [];

  for (const p of performances) {
    if (existingCodes.has(p.performance_code)) {
      existingPerfs.push(p);
    } else {
      console.log(`➕ New performance detected: ${p.performance_code}`);
      newPerfs.push(p);
    }
  }

  // CREATE NEW PERFORMANCES
  if (newPerfs.length > 0) {
    console.log(`🆕 Inserting ${newPerfs.length} new performances...`);

    const newPerfValues = newPerfs.map(p => {
      const perfId = parseInt(p.performance_code.substring(2)); // Extract numeric ID from code
      // Extract series from performance code (e.g., CS04, PS1)
      const seriesMatch = p.performance_code.match(/^25(\d{4})/);
      const series = seriesMatch ? `Series-${seriesMatch[1].substring(0, 2)}` : 'Unknown';

      return `(
        ${perfId},
        '${p.performance_code}',
        'Performance ${p.performance_code}',
        '${series}',
        DATE('${p.performance_date || '2025-01-01'}'),
        'HELZBERG HALL',
        '25-26 Classical',
        ${p.single_tickets_sold || 0},
        ${p.subscription_tickets_sold || 0},
        ${(p.single_tickets_sold || 0) + (p.subscription_tickets_sold || 0)},
        ${p.total_revenue || 0},
        1600,
        ${p.capacity_percent || 0},
        85,
        ${p.budget_percent > 0 ? Math.round((p.total_revenue / p.budget_percent) * 100) : 0},
        ${p.budget_percent || 0},
        0,
        'Classical',
        NULL,
        true,
        false,
        CURRENT_TIMESTAMP(),
        CURRENT_TIMESTAMP(),
        CURRENT_TIMESTAMP()
      )`;
    }).join(',\n');

    const insertNewPerfs = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.performances\`
      (performance_id, performance_code, title, series, performance_date, venue, season,
       single_tickets_sold, subscription_tickets_sold, total_tickets_sold, total_revenue,
       capacity, capacity_percent, occupancy_goal, budget_goal, budget_percent,
       single_ticket_atp, performance_type, supplemental,
       has_sales_data, has_excel_data, created_at, updated_at, last_pdf_import_date)
      VALUES ${newPerfValues}
    `;

    await bigquery.query({ query: insertNewPerfs, location: 'US' });

    // Add new performances to the existingCodes map for snapshot creation
    for (const p of newPerfs) {
      const perfId = parseInt(p.performance_code.substring(2));
      existingCodes.set(p.performance_code, perfId);
    }

    inserted += newPerfs.length;
    console.log(`✅ Created ${newPerfs.length} new performances`);
  }

  const validPerfs = [...existingPerfs, ...newPerfs];

  if (validPerfs.length === 0) {
    console.log('⚠️  No valid performances to process');
    return { processed, inserted, updated, trendsAdjusted, anomalies };
  }

  // INSERT SNAPSHOTS
  console.log(`📸 Inserting ${validPerfs.length} snapshots...`);

  const snapshotValues = validPerfs.map(p => {
    const perfId = existingCodes.get(p.performance_code);
    return `(
      '${crypto.randomBytes(8).toString('hex')}',
      ${perfId},
      '${p.performance_code}',
      CURRENT_DATE(),
      ${p.single_tickets_sold || 0},
      ${p.subscription_tickets_sold || 0},
      ${(p.single_tickets_sold || 0) + (p.subscription_tickets_sold || 0)},
      ${p.total_revenue || 0},
      ${p.capacity_percent || 0},
      ${p.budget_percent || 0},
      'pdf_webhook',
      CURRENT_TIMESTAMP()
    )`;
  }).join(',\n');

  const insertSnapshots = `
    INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.performance_sales_snapshots\`
    (snapshot_id, performance_id, performance_code, snapshot_date,
     single_tickets_sold, subscription_tickets_sold, total_tickets_sold,
     total_revenue, capacity_percent, budget_percent, source, created_at)
    VALUES ${snapshotValues}
  `;

  await bigquery.query({ query: insertSnapshots, location: 'US' });
  const snapshotsInserted = validPerfs.length;
  console.log(`✅ Inserted ${snapshotsInserted} snapshots`);

  // UPDATE EXISTING PERFORMANCES (don't update newly created ones, they already have data)
  if (existingPerfs.length > 0) {
    console.log(`🔄 Updating ${existingPerfs.length} existing performances...`);

    const batchUpdate = `
      UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.performances\`
      SET
        performance_date = CASE performance_code ${existingPerfs.map(p => `WHEN '${p.performance_code}' THEN DATE('${p.performance_date || '2025-01-01'}')`).join(' ')} END,
        single_tickets_sold = CASE performance_code ${existingPerfs.map(p => `WHEN '${p.performance_code}' THEN ${p.single_tickets_sold || 0}`).join(' ')} END,
        subscription_tickets_sold = CASE performance_code ${existingPerfs.map(p => `WHEN '${p.performance_code}' THEN ${p.subscription_tickets_sold || 0}`).join(' ')} END,
        total_tickets_sold = CASE performance_code ${existingPerfs.map(p => `WHEN '${p.performance_code}' THEN ${(p.single_tickets_sold || 0) + (p.subscription_tickets_sold || 0)}`).join(' ')} END,
        total_revenue = CASE performance_code ${existingPerfs.map(p => `WHEN '${p.performance_code}' THEN ${p.total_revenue || 0}`).join(' ')} END,
        capacity_percent = CASE performance_code ${existingPerfs.map(p => `WHEN '${p.performance_code}' THEN ${p.capacity_percent || 0}`).join(' ')} END,
        budget_percent = CASE performance_code ${existingPerfs.map(p => `WHEN '${p.performance_code}' THEN ${p.budget_percent || 0}`).join(' ')} END,
        has_sales_data = true,
        last_pdf_import_date = CURRENT_TIMESTAMP(),
        updated_at = CURRENT_TIMESTAMP()
      WHERE performance_code IN (${existingPerfs.map(p => `'${p.performance_code}'`).join(',')})
    `;

    await bigquery.query({ query: batchUpdate, location: 'US' });
    updated = existingPerfs.length;
    console.log(`✅ Updated ${updated} existing performances`);
  }

  processed = validPerfs.length;

  console.log(`✅ Processing complete: ${newPerfs.length} created + ${updated} updated + ${snapshotsInserted} snapshots`);

  return { processed, inserted, updated, trendsAdjusted, anomalies };
}

async function logPipelineStart(bigquery, executionId, requestData) {
  try {
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
  } catch (error) {
    console.log('Pipeline logging table not found - skipping');
  }
}

async function updatePipelineExecution(bigquery, executionId, updates) {
  try {
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
  } catch (error) {
    console.log('Pipeline logging table not found - skipping');
  }
}
