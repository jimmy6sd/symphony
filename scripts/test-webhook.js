// Test script for the simplified PDF webhook
// Tests different input formats and webhook functionality

const https = require('https');
const fs = require('fs');

// Sample test data for different input types
const testCases = {
  // Test case 1: Pre-extracted text (simplest)
  text_input: {
    pdf_text: `
Performance Sales Summary - December 2025

Performance ID: 88888
Code: WEBHOOK01
Title: Test Symphony Performance - Webhook
Series: Test Series
Date: 12/25/2025
Venue: Test Concert Hall
Capacity: 1200

Ticket Sales:
Single Tickets: 850
Subscription: 75
Total Sold: 925

Revenue:
Total Revenue: $42,500
Budget Goal: $45,000
Occupancy: 77.1%
    `,
    metadata: {
      filename: "test-webhook-report.pdf",
      email_subject: "Test Webhook Performance Data",
      email_date: new Date().toISOString(),
      email_id: "test_webhook_123",
      source: "webhook_test"
    }
  },

  // Test case 2: Multiple performances in text
  multi_performance: {
    pdf_text: `
Performance Sales Summary - December 2025

Performance ID: 88889
Code: WEBHOOK02
Title: Holiday Pops Concert
Date: 12/24/2025
Single Tickets: 950
Subscription: 50
Revenue: $35,000

Performance ID: 88890
Code: WEBHOOK03
Title: New Year's Gala
Date: 12/31/2025
Single Tickets: 1100
Subscription: 100
Revenue: $55,000
    `,
    metadata: {
      filename: "multi-performance-report.pdf",
      source: "webhook_test_multi"
    }
  },

  // Test case 3: Base64 PDF (would need a real PDF for this)
  // base64_input: {
  //   pdf_base64: "JVBERi0xLjQK...", // Would need real PDF base64
  //   metadata: { filename: "test.pdf" }
  // }
};

async function testWebhook(testCase, caseName) {
  console.log(`\n🧪 Testing webhook with: ${caseName}`);
  console.log('=' .repeat(50));

  const url = process.env.NETLIFY_SITE_URL || 'http://localhost:8888';
  const hostname = url.includes('localhost') ? 'localhost' : url.replace(/https?:\/\//, '');
  const path = '/.netlify/functions/pdf-webhook';
  const postData = JSON.stringify(testCase);

  const options = {
    hostname: hostname,
    port: hostname === 'localhost' ? 8888 : 443,
    path: path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const protocol = hostname.includes('localhost') ? require('http') : https;

    console.log(`🌐 Making request to: ${hostname}${path}`);

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
            console.log('✅ Test PASSED');
            console.log(`   Execution ID: ${response.execution_id}`);
            console.log(`   Snapshot ID: ${response.snapshot_id}`);
            console.log(`   Summary:`);
            console.log(`     - Received: ${response.summary.received} performances`);
            console.log(`     - Processed: ${response.summary.processed}`);
            console.log(`     - Inserted: ${response.summary.inserted}`);
            console.log(`     - Updated: ${response.summary.updated}`);
            console.log(`     - Trends Adjusted: ${response.summary.trends_adjusted}`);
            console.log(`     - Anomalies: ${response.summary.anomalies_detected}`);
          } else {
            console.log('❌ Test FAILED');
            console.log('📋 Response Data:');
            console.log(JSON.stringify(response, null, 2));
          }

          resolve({ success: res.statusCode === 200 && response.success, response });
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

    // Log the payload being sent (truncated for readability)
    console.log('📤 Payload preview:');
    const payloadPreview = {
      ...testCase,
      pdf_text: testCase.pdf_text ? testCase.pdf_text.substring(0, 100) + '...' : undefined,
      pdf_base64: testCase.pdf_base64 ? '[BASE64 DATA]' : undefined
    };
    console.log(JSON.stringify(payloadPreview, null, 2));

    req.write(postData);
    req.end();
  });
}

// Test with sample Make.com payload format
function createMakeComPayload() {
  return {
    pdf_text: `
Performance Report - Test Data

Performance ID: 99999
Performance Code: MAKECOM01
Title: Make.com Test Performance
Series: Test Automation
Performance Date: 01/15/2025
Venue: Automation Theater
Season: 25-26 Testing
Capacity: 800

Sales Data:
Individual Tickets Sold: 650
Subscription Tickets: 45
Total Revenue: $28,750

Metrics:
Occupancy Goal: 85%
Budget Goal: $30,000
Current Occupancy: 86.9%
Budget Achievement: 95.8%
    `,
    metadata: {
      filename: "makecom-test-report.pdf",
      email_subject: "Daily Performance Report - Automation Test",
      email_date: new Date().toISOString(),
      email_id: "makecom_test_456",
      source: "make_com_webhook"
    }
  };
}

async function runAllTests() {
  console.log('🚀 Starting PDF Webhook Tests...\n');

  const results = [];

  // Test each predefined case
  for (const [caseName, testCase] of Object.entries(testCases)) {
    try {
      const result = await testWebhook(testCase, caseName);
      results.push({ case: caseName, ...result });
    } catch (error) {
      console.error(`💥 Test ${caseName} failed:`, error.message);
      results.push({ case: caseName, success: false, error: error.message });
    }
  }

  // Test Make.com format
  try {
    const makeComTest = createMakeComPayload();
    const result = await testWebhook(makeComTest, 'make_com_format');
    results.push({ case: 'make_com_format', ...result });
  } catch (error) {
    console.error('💥 Make.com format test failed:', error.message);
    results.push({ case: 'make_com_format', success: false, error: error.message });
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 TEST SUMMARY');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.success).length;
  const total = results.length;

  results.forEach(result => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${result.case}`);
    if (!result.success && result.error) {
      console.log(`     Error: ${result.error}`);
    }
  });

  console.log(`\n🎯 Results: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log('🎉 All tests passed! Webhook is ready for Make.com integration.');
  } else {
    console.log('⚠️  Some tests failed. Check the errors above and fix issues before deploying.');
  }

  // Save test results
  fs.writeFileSync('webhook-test-results.json', JSON.stringify(results, null, 2));
  console.log('\n📁 Test results saved to: webhook-test-results.json');
}

// Main execution
async function main() {
  try {
    await runAllTests();
  } catch (error) {
    console.error('\n💥 Test suite failed:', error.message);
    process.exit(1);
  }
}

// Command line options
const args = process.argv.slice(2);

if (args.includes('--help')) {
  console.log(`
PDF Webhook Test Suite

Usage:
  node test-webhook.js                    # Run all tests
  node test-webhook.js --case text_input  # Run specific test case
  node test-webhook.js --makecom          # Test Make.com format only

Available test cases:
  - text_input: Simple text extraction test
  - multi_performance: Multiple performances in one PDF
  - make_com_format: Simulates Make.com webhook payload
  `);
  process.exit(0);
}

if (args.includes('--makecom')) {
  // Test only Make.com format
  testWebhook(createMakeComPayload(), 'make_com_format')
    .then(() => console.log('🎉 Make.com test completed'))
    .catch(err => console.error('💥 Make.com test failed:', err));
} else if (args.includes('--case')) {
  // Test specific case
  const caseIndex = args.indexOf('--case');
  const caseName = args[caseIndex + 1];

  if (testCases[caseName]) {
    testWebhook(testCases[caseName], caseName)
      .then(() => console.log(`🎉 Test ${caseName} completed`))
      .catch(err => console.error(`💥 Test ${caseName} failed:`, err));
  } else {
    console.error(`❌ Unknown test case: ${caseName}`);
    console.log('Available cases:', Object.keys(testCases).join(', '));
  }
} else {
  // Run all tests
  main();
}

module.exports = { testWebhook, testCases, createMakeComPayload };