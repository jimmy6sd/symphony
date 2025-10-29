/**
 * Process Local PDF Files Through Webhook
 *
 * Reads the PDF files in the root directory, extracts text, and sends them
 * through the webhook to populate BigQuery with real data.
 *
 * USAGE:
 *   node scripts/process-pdfs-through-webhook.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const pdf = require('pdf-parse');

// Configuration
const CONFIG = {
  pdfDirectory: '.',  // Root directory
  webhookUrl: 'http://localhost:8888/.netlify/functions/pdf-webhook',
  pdfFiles: [
    'FY26 Performance Sales Summary_1124675.pdf',
    'FY26 Performance Sales Summary_1126300.pdf'
  ]
};

/**
 * Extract text from PDF file
 */
async function extractPdfText(pdfPath) {
  console.log(`📄 Reading PDF: ${pdfPath}`);

  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdf(dataBuffer);

  console.log(`✅ Extracted ${data.text.length} characters from PDF`);
  console.log(`📊 Pages: ${data.numpages}`);

  return data.text;
}

/**
 * Send PDF text through webhook
 */
async function sendToWebhook(pdfText, filename) {
  console.log(`\n🌐 Sending to webhook: ${filename}`);
  console.log('=' .repeat(60));

  const payload = {
    pdf_text: pdfText,
    metadata: {
      filename: filename,
      source: 'local_pdf_processing',
      processed_at: new Date().toISOString(),
      email_subject: `Performance Sales Summary - ${filename}`,
      email_date: new Date().toISOString()
    }
  };

  const postData = JSON.stringify(payload);

  // Parse webhook URL
  const url = new URL(CONFIG.webhookUrl);
  const protocol = url.protocol === 'https:' ? https : require('http');

  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 8888),
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    console.log(`🚀 Making request to: ${url.hostname}${url.pathname}`);

    const req = protocol.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);

          console.log(`\n📊 Response Status: ${res.statusCode}`);

          if (res.statusCode === 200 && response.success) {
            console.log('✅ Webhook processing SUCCESSFUL');
            console.log(`   Execution ID: ${response.execution_id}`);
            console.log(`   Snapshot ID: ${response.snapshot_id}`);
            console.log(`   Summary:`);
            console.log(`     - Received: ${response.summary.received} performances`);
            console.log(`     - Processed: ${response.summary.processed}`);
            console.log(`     - Inserted: ${response.summary.inserted}`);
            console.log(`     - Updated: ${response.summary.updated}`);
            console.log(`     - Trends Adjusted: ${response.summary.trends_adjusted || 0}`);
            console.log(`     - Anomalies: ${response.summary.anomalies_detected || 0}`);

            resolve({ success: true, response });
          } else {
            console.log('❌ Webhook processing FAILED');
            console.log('📋 Response:', JSON.stringify(response, null, 2));
            resolve({ success: false, response });
          }
        } catch (error) {
          console.error('❌ Error parsing response:', error.message);
          console.log('Raw response:', data);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request error:', error.message);
      reject(error);
    });

    // Log payload preview
    console.log('📤 Payload preview:');
    console.log(`   Text length: ${pdfText.length} characters`);
    console.log(`   Filename: ${filename}`);
    console.log(`   First 200 chars: ${pdfText.substring(0, 200)}...`);

    req.write(postData);
    req.end();
  });
}

/**
 * Process all PDF files
 */
async function processAllPdfs() {
  console.log('🚀 Processing Local PDF Files Through Webhook\n');
  console.log('=' .repeat(60));

  const results = [];

  for (const pdfFile of CONFIG.pdfFiles) {
    const pdfPath = path.join(CONFIG.pdfDirectory, pdfFile);

    try {
      // Check if file exists
      if (!fs.existsSync(pdfPath)) {
        console.error(`❌ PDF file not found: ${pdfPath}`);
        results.push({
          file: pdfFile,
          success: false,
          error: 'File not found'
        });
        continue;
      }

      // Extract text from PDF
      const pdfText = await extractPdfText(pdfPath);

      // Send through webhook
      const result = await sendToWebhook(pdfText, pdfFile);

      results.push({
        file: pdfFile,
        success: result.success,
        response: result.response
      });

      // Wait a bit between requests
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`❌ Error processing ${pdfFile}:`, error.message);
      results.push({
        file: pdfFile,
        success: false,
        error: error.message
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 PROCESSING SUMMARY');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.success).length;
  const total = results.length;

  results.forEach(result => {
    const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
    console.log(`${status} - ${result.file}`);
    if (!result.success && result.error) {
      console.log(`     Error: ${result.error}`);
    } else if (result.success && result.response) {
      console.log(`     Performances: ${result.response.summary?.received || 0}`);
    }
  });

  console.log(`\n🎯 Results: ${successful}/${total} PDFs processed successfully`);

  // Save results
  const outputPath = 'pdf-processing-results.json';
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n📁 Results saved to: ${outputPath}`);

  if (successful === total) {
    console.log('\n🎉 All PDFs processed successfully!');
    console.log('✅ BigQuery should now have performance data');
    console.log('📊 Next: Run query to verify data was inserted');
  } else {
    console.log('\n⚠️  Some PDFs failed to process. Check errors above.');
  }

  return results;
}

/**
 * Verify data was inserted into BigQuery
 */
async function verifyDataInBigQuery() {
  console.log('\n' + '='.repeat(60));
  console.log('🔍 VERIFYING BIGQUERY DATA');
  console.log('='.repeat(60));

  console.log('\nTo verify the data was inserted, run:');
  console.log('  node scripts/query-performances-table.js');
  console.log('\nThis will show you the performances with sales data.');
}

// Main execution
if (require.main === module) {
  processAllPdfs()
    .then(async (results) => {
      await verifyDataInBigQuery();

      const allSuccess = results.every(r => r.success);
      process.exit(allSuccess ? 0 : 1);
    })
    .catch(error => {
      console.error('\n💥 Fatal error:', error.message);
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = { extractPdfText, sendToWebhook, processAllPdfs };
