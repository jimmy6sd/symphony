const fs = require('fs');
const path = require('path');

// Simulate the webhook by calling it with the PDF
async function testPdfUpdate() {
  const pdfPath = path.join(__dirname, 'FY26 Performance Sales Summary_1126300.pdf');
  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfBase64 = pdfBuffer.toString('base64');

  const webhookUrl = 'http://localhost:8888/.netlify/functions/pdf-webhook';

  const payload = {
    pdf_base64: pdfBase64,
    metadata: {
      filename: 'FY26 Performance Sales Summary_1126300.pdf',
      upload_date: new Date().toISOString()
    }
  };

  console.log('📤 Sending PDF to webhook...');
  console.log('PDF size:', (pdfBase64.length / 1024).toFixed(2), 'KB');

  const https = require('http');
  const data = JSON.stringify(payload);

  const options = {
    hostname: 'localhost',
    port: 8888,
    path: '/.netlify/functions/pdf-webhook',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  const req = https.request(options, (res) => {
    let responseData = '';

    res.on('data', (chunk) => {
      responseData += chunk;
    });

    res.on('end', () => {
      console.log('\n📥 Webhook response:');
      console.log('Status:', res.statusCode);
      try {
        const result = JSON.parse(responseData);
        console.log(JSON.stringify(result, null, 2));
      } catch (e) {
        console.log(responseData);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Error:', error.message);
  });

  req.write(data);
  req.end();
}

testPdfUpdate();
