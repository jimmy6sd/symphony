/**
 * Test Webhook with Real PDF File
 *
 * This will process a PDF through the webhook to see if it actually
 * writes to BigQuery correctly.
 */

const fs = require('fs');
const http = require('http');

async function testWebhookWithPDF(pdfPath) {
  console.log('🧪 Testing Webhook with Real PDF\n');
  console.log('=' .repeat(60));
  console.log(`📄 PDF File: ${pdfPath}\n`);

  // 1. Read PDF as base64
  console.log('📖 Step 1: Reading PDF file...');
  const dataBuffer = fs.readFileSync(pdfPath);
  const base64Data = dataBuffer.toString('base64');
  console.log(`✅ Read ${dataBuffer.length} bytes (${Math.round(base64Data.length/1024)}KB base64)\n`);

  // 2. Prepare webhook payload with base64 PDF
  console.log('📦 Step 2: Preparing webhook payload...');
  const payload = {
    pdf_base64: base64Data,
    metadata: {
      filename: pdfPath,
      source: 'local_test',
      processed_at: new Date().toISOString(),
      email_subject: `Test: ${pdfPath}`,
      email_date: new Date().toISOString()
    }
  };

  const postData = JSON.stringify(payload);
  console.log(`✅ Payload size: ${postData.length} bytes\n`);

  // 3. Send to webhook
  console.log('🌐 Step 3: Sending to webhook...');
  console.log('URL: http://localhost:8888/.netlify/functions/pdf-webhook\n');

  const options = {
    hostname: 'localhost',
    port: 8888,
    path: '/.netlify/functions/pdf-webhook',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`📊 Response Status: ${res.statusCode}\n`);

        try {
          const response = JSON.parse(data);

          if (res.statusCode === 200 && response.success) {
            console.log('✅ WEBHOOK SUCCESSFUL!\n');
            console.log('Response Details:');
            console.log(`  Execution ID: ${response.execution_id}`);
            console.log(`  Snapshot ID: ${response.snapshot_id || 'N/A'}`);
            console.log('');
            console.log('Summary:');
            console.log(`  Received: ${response.summary?.received || 0} performances`);
            console.log(`  Processed: ${response.summary?.processed || 0}`);
            console.log(`  Inserted: ${response.summary?.inserted || 0}`);
            console.log(`  Updated: ${response.summary?.updated || 0}`);
            console.log('');
            console.log('Message:', response.message);

            resolve({ success: true, response });
          } else {
            console.log('❌ WEBHOOK FAILED\n');
            console.log('Full response:');
            console.log(JSON.stringify(response, null, 2));

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
      console.error('❌ Request failed:', error.message);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function main() {
  // Test with the second PDF (appears to be newer based on numbers)
  const pdfFile = 'FY26 Performance Sales Summary_1126300.pdf';

  try {
    const result = await testWebhookWithPDF(pdfFile);

    if (result.success) {
      console.log('\n' + '='.repeat(60));
      console.log('✅ NEXT STEPS');
      console.log('='.repeat(60));
      console.log('1. Verify data in BigQuery:');
      console.log('   node scripts/check-webhook-data.js');
      console.log('');
      console.log('2. Look for performances with last_pdf_import_date set');
      console.log('');
      console.log('3. Compare to see if data actually changed');
    } else {
      console.log('\n' + '='.repeat(60));
      console.log('❌ WEBHOOK TEST FAILED');
      console.log('='.repeat(60));
      console.log('Check the error above to debug the webhook');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
