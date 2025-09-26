// Test script for PDF data processor
// Creates sample data and tests the Netlify function

const https = require('https');
const fs = require('fs');

// Sample test data that mimics Make.com output
const testData = {
  metadata: {
    filename: "test-performance-report.pdf",
    email_id: "test_email_123",
    processed_date: new Date().toISOString().split('T')[0],
    source: "tessitura_pdf_test"
  },
  performances: [
    {
      performance_id: 99999,
      performance_code: "TEST001",
      title: "Test Performance - PDF Pipeline",
      series: "Test Series",
      performance_date: "2025-12-31",
      venue: "Test Venue",
      season: "25-26 Test",
      capacity: 1000,
      single_tickets_sold: 750,
      subscription_tickets_sold: 50,
      total_revenue: 25000,
      occupancy_goal: 85,
      budget_goal: 30000
    }
  ]
};

async function testPdfProcessor() {
  console.log('🧪 Testing PDF Data Processor...\n');

  // Save test data to file for reference
  fs.writeFileSync('test-pdf-data.json', JSON.stringify(testData, null, 2));
  console.log('📁 Test data saved to test-pdf-data.json');

  const hostname = process.env.NETLIFY_SITE_URL || 'localhost:8888';
  const path = '/.netlify/functions/pdf-data-processor';
  const postData = JSON.stringify(testData);

  const options = {
    hostname: hostname.replace(/https?:\/\//, ''),
    port: hostname.includes('localhost') ? 8888 : 443,
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
          console.log('📋 Response Data:');
          console.log(JSON.stringify(response, null, 2));

          if (res.statusCode === 200 && response.success) {
            console.log('\n✅ Test PASSED - PDF processor working correctly!');
            console.log(`   Execution ID: ${response.execution_id}`);
            console.log(`   Snapshot ID: ${response.snapshot_id}`);
            console.log(`   Records processed: ${response.summary.processed}`);
          } else {
            console.log('\n❌ Test FAILED - Check error details above');
          }

          resolve(response);
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

    req.write(postData);
    req.end();
  });
}

// Clean up test data
async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');

  if (process.env.NODE_ENV !== 'production') {
    try {
      // In a real scenario, you might want to remove the test performance
      console.log('⚠️  Test data left in database for inspection');
      console.log('   Test performance ID: 99999');
      console.log('   You can manually remove it if needed');
    } catch (error) {
      console.log('⚠️  Could not clean up test data:', error.message);
    }
  }
}

// Main execution
async function main() {
  try {
    await testPdfProcessor();
    await cleanup();
    console.log('\n🎉 PDF processor test completed!');
  } catch (error) {
    console.error('\n💥 Test failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { testPdfProcessor, testData };