// Manually update dashboard from parsed PDF (simulates webhook)
const { BigQuery } = require('@google-cloud/bigquery');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const initializeBigQuery = () => {
  const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  let credentials;

  if (credentialsEnv.startsWith('{')) {
    credentials = JSON.parse(credentialsEnv);
  } else {
    const credentialsFile = path.resolve(credentialsEnv);
    credentials = JSON.parse(fs.readFileSync(credentialsFile, 'utf8'));
  }

  if (credentials.private_key?.includes('\\\\n')) {
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
};

async function manualUpdate() {
  console.log('🔄 Manual Dashboard Update from PDF\n');
  console.log('=' .repeat(80));

  // Load parsed PDF data
  const pdfData = JSON.parse(fs.readFileSync('parsed-pdf-data.json', 'utf8'));
  console.log(`📄 Loaded ${pdfData.length} performances from PDF\n`);

  const bigquery = initializeBigQuery();
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const datasetId = 'symphony_dashboard';

  // Get performance IDs
  const codes = pdfData.map(p => `'${p.performance_code}'`).join(',');
  const checkQuery = `
    SELECT performance_code, performance_id
    FROM \`${projectId}.${datasetId}.performances\`
    WHERE performance_code IN (${codes})
  `;

  const [existingRows] = await bigquery.query({ query: checkQuery, location: 'US' });
  const existingCodes = new Map(existingRows.map(row => [row.performance_code, row.performance_id]));

  console.log(`✅ Found ${existingCodes.size}/${pdfData.length} existing performances\n`);

  // Filter to valid performances
  const validPerfs = pdfData.filter(p => existingCodes.has(p.performance_code));
  const skipped = pdfData.filter(p => !existingCodes.has(p.performance_code));

  if (skipped.length > 0) {
    console.log(`⏭️  Skipping ${skipped.length} unknown performances:`);
    skipped.forEach(p => console.log(`   - ${p.performance_code}`));
    console.log('');
  }

  // STEP 1: INSERT SNAPSHOTS
  console.log(`📸 Creating ${validPerfs.length} snapshots with today's date...\n`);

  const snapshotValues = validPerfs.map(p => {
    const perfId = existingCodes.get(p.performance_code);
    return `(
      '${crypto.randomBytes(8).toString('hex')}',
      ${perfId},
      '${p.performance_code}',
      CURRENT_DATE(),
      ${p.single_tickets},
      ${p.subscription_tickets},
      ${p.total_tickets},
      ${p.total_revenue},
      ${p.capacity_percent},
      ${p.budget_percent},
      'manual_pdf_update',
      CURRENT_TIMESTAMP()
    )`;
  }).join(',\n');

  const insertSnapshots = `
    INSERT INTO \`${projectId}.${datasetId}.performance_sales_snapshots\`
    (snapshot_id, performance_id, performance_code, snapshot_date,
     single_tickets_sold, subscription_tickets_sold, total_tickets_sold,
     total_revenue, capacity_percent, budget_percent, source, created_at)
    VALUES ${snapshotValues}
  `;

  await bigquery.query({ query: insertSnapshots, location: 'US' });
  console.log(`✅ Inserted ${validPerfs.length} snapshots\n`);

  // STEP 2: UPDATE PERFORMANCES
  console.log(`🔄 Updating ${validPerfs.length} performances...\n`);

  const batchUpdate = `
    UPDATE \`${projectId}.${datasetId}.performances\`
    SET
      single_tickets_sold = CASE performance_code ${validPerfs.map(p => `WHEN '${p.performance_code}' THEN ${p.single_tickets}`).join(' ')} END,
      subscription_tickets_sold = CASE performance_code ${validPerfs.map(p => `WHEN '${p.performance_code}' THEN ${p.subscription_tickets}`).join(' ')} END,
      total_tickets_sold = CASE performance_code ${validPerfs.map(p => `WHEN '${p.performance_code}' THEN ${p.total_tickets}`).join(' ')} END,
      total_revenue = CASE performance_code ${validPerfs.map(p => `WHEN '${p.performance_code}' THEN ${p.total_revenue}`).join(' ')} END,
      capacity_percent = CASE performance_code ${validPerfs.map(p => `WHEN '${p.performance_code}' THEN ${p.capacity_percent}`).join(' ')} END,
      budget_percent = CASE performance_code ${validPerfs.map(p => `WHEN '${p.performance_code}' THEN ${p.budget_percent}`).join(' ')} END,
      has_sales_data = true,
      last_pdf_import_date = CURRENT_TIMESTAMP(),
      updated_at = CURRENT_TIMESTAMP()
    WHERE performance_code IN (${validPerfs.map(p => `'${p.performance_code}'`).join(',')})
  `;

  await bigquery.query({ query: batchUpdate, location: 'US' });
  console.log(`✅ Updated ${validPerfs.length} performances\n`);

  console.log('=' .repeat(80));
  console.log('🎉 Dashboard update complete!\n');
  console.log('Summary:');
  console.log(`   ${validPerfs.length} performances updated`);
  console.log(`   ${validPerfs.length} new snapshots created`);
  console.log(`   ${skipped.length} performances skipped (not in database)`);
  console.log('');
  console.log('✅ Dashboard now shows current data from PDF');
}

manualUpdate()
  .then(() => console.log('\n✅ Manual update complete'))
  .catch(error => {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
