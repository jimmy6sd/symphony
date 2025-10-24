// Test GCS PDF backup using same logic as webhook
const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

// Same initialization as webhook
const initializeCredentials = () => {
  try {
    const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (!credentialsEnv) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable not set');
    }

    let credentials;

    if (credentialsEnv.startsWith('{')) {
      credentials = JSON.parse(credentialsEnv);
    } else {
      const credentialsFile = path.resolve(credentialsEnv);
      console.log(`🔐 Loading credentials from file: ${credentialsFile}`);
      const credentialsJson = fs.readFileSync(credentialsFile, 'utf8');
      credentials = JSON.parse(credentialsJson);
    }

    if (credentials.private_key && credentials.private_key.includes('\\\\n')) {
      credentials.private_key = credentials.private_key.replace(/\\\\n/g, '\n');
    }

    return credentials;
  } catch (error) {
    console.error('Credentials initialization error:', error.message);
    throw error;
  }
};

const initializeStorage = () => {
  const credentials = initializeCredentials();
  return new Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || credentials.project_id,
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    }
  });
};

// Same backup function as webhook
async function backupPdfToStorage(pdfPath) {
  try {
    const storage = initializeStorage();
    const bucketName = process.env.GCS_PDF_BACKUP_BUCKET || 'symphony-dashboard-pdfs';
    const executionId = `test_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    console.log(`\n📄 Reading PDF file: ${pdfPath}`);
    const pdfBuffer = fs.readFileSync(pdfPath);
    console.log(`✅ Read ${pdfBuffer.length} bytes (${Math.round(pdfBuffer.length / 1024)}KB)`);

    // Create date-based path: 2025/10/filename.pdf
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const timestamp = now.toISOString().replace(/[:.]/g, '-').substring(0, 19);

    const originalFilename = path.basename(pdfPath);
    const cleanFilename = originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${year}/${month}/${cleanFilename}_${timestamp}_${executionId}.pdf`;

    console.log(`\n💾 Backing up PDF to Cloud Storage...`);
    console.log(`   Bucket: gs://${bucketName}`);
    console.log(`   Path: ${filename}`);

    // Upload to GCS
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(filename);

    await file.save(pdfBuffer, {
      metadata: {
        contentType: 'application/pdf',
        metadata: {
          executionId: executionId,
          uploadedAt: now.toISOString(),
          originalFilename: originalFilename,
          source: 'test_script'
        }
      }
    });

    console.log(`\n✅ PDF backed up successfully!`);
    console.log(`   Location: gs://${bucketName}/${filename}`);
    console.log(`   Size: ${Math.round(pdfBuffer.length / 1024)}KB`);
    console.log(`   URL: https://console.cloud.google.com/storage/browser/${bucketName}/${year}/${month}`);

    return filename;
  } catch (error) {
    console.error(`\n❌ PDF backup failed:`, error.message);
    console.error('\nFull error:');
    console.error(error);
    throw error;
  }
}

async function main() {
  console.log('🧪 Testing GCS PDF Backup (same logic as webhook)\n');
  console.log('='.repeat(60));

  const pdfFile = process.argv[2] || 'FY26 Performance Sales Summary_1133029.pdf';

  if (!fs.existsSync(pdfFile)) {
    console.error(`❌ PDF file not found: ${pdfFile}`);
    console.error('\nUsage: node scripts/test-gcs-backup.js [path-to-pdf]');
    process.exit(1);
  }

  try {
    await backupPdfToStorage(pdfFile);
    console.log('\n' + '='.repeat(60));
    console.log('✅ Test complete - backup works!');
    console.log('='.repeat(60));
  } catch (error) {
    console.log('\n' + '='.repeat(60));
    console.log('❌ Test failed - backup does not work');
    console.log('='.repeat(60));
    process.exit(1);
  }
}

main();
