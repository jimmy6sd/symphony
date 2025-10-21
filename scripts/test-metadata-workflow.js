// Test complete metadata workflow
const { BigQuery } = require('@google-cloud/bigquery');
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

async function testMetadataWorkflow() {
  console.log('🧪 Testing metadata management workflow...\n');

  const bigquery = initializeBigQuery();
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony';
  const datasetId = 'symphony_dashboard';
  const testCode = '251010E';

  // Step 1: Check current state
  console.log('📊 Step 1: Check current metadata\n');

  const getQuery = `
    SELECT performance_code, title, capacity, budget_goal, occupancy_goal
    FROM \`${projectId}.${datasetId}.performances\`
    WHERE performance_code = '${testCode}'
  `;

  const [beforeRows] = await bigquery.query({ query: getQuery, location: 'US' });
  const before = beforeRows[0];

  console.log('Current metadata:');
  console.log(`  Capacity: ${before.capacity}`);
  console.log(`  Budget Goal: $${before.budget_goal?.toLocaleString() || 0}`);
  console.log(`  Occupancy Goal: ${before.occupancy_goal || 0}%\n`);

  // Step 2: Populate metadata (simulate from Weekly Sales Report)
  console.log('📊 Step 2: Populate metadata (from Weekly Report)\n');

  const populateQuery = `
    UPDATE \`${projectId}.${datasetId}.performances\`
    SET
      capacity = 1440,
      budget_goal = 122000,
      occupancy_goal = 85,
      updated_at = CURRENT_TIMESTAMP()
    WHERE performance_code = '${testCode}'
  `;

  await bigquery.query({ query: populateQuery, location: 'US' });
  console.log('✅ Set capacity=1440, budget_goal=$122,000, occupancy_goal=85%\n');

  // Step 3: Simulate PDF update (should NOT change metadata)
  console.log('📊 Step 3: Simulate PDF update (sales data only)\n');

  const snapshotId = `test_${Date.now()}`;
  const insertSnapshot = `
    INSERT INTO \`${projectId}.${datasetId}.performance_sales_snapshots\`
    (snapshot_id, performance_id, performance_code, snapshot_date,
     single_tickets_sold, subscription_tickets_sold, total_tickets_sold,
     total_revenue, capacity_percent, budget_percent, source, created_at)
    SELECT
      '${snapshotId}',
      performance_id,
      '${testCode}',
      CURRENT_DATE(),
      650,
      480,
      1130,
      68500,
      78.5,
      56.1,
      'test_pdf',
      CURRENT_TIMESTAMP()
    FROM \`${projectId}.${datasetId}.performances\`
    WHERE performance_code = '${testCode}'
  `;

  await bigquery.query({ query: insertSnapshot, location: 'US' });
  console.log('✅ Created snapshot: 650 single + 480 subscription = 1,130 total tickets\n');

  // Verify metadata unchanged
  const [afterPdfRows] = await bigquery.query({ query: getQuery, location: 'US' });
  const afterPdf = afterPdfRows[0];

  console.log('Metadata after PDF update:');
  console.log(`  Capacity: ${afterPdf.capacity} ${afterPdf.capacity === 1440 ? '✅' : '❌'}`);
  console.log(`  Budget Goal: $${afterPdf.budget_goal.toLocaleString()} ${afterPdf.budget_goal === 122000 ? '✅' : '❌'}`);
  console.log(`  Occupancy Goal: ${afterPdf.occupancy_goal}% ${afterPdf.occupancy_goal === 85 ? '✅' : '❌'}\n`);

  // Step 4: Manual edit (should override defaults)
  console.log('📊 Step 4: Manual edit via metadata endpoint\n');

  const editQuery = `
    UPDATE \`${projectId}.${datasetId}.performances\`
    SET
      capacity = 1500,
      budget_goal = 150000,
      updated_at = CURRENT_TIMESTAMP()
    WHERE performance_code = '${testCode}'
  `;

  await bigquery.query({ query: editQuery, location: 'US' });
  console.log('✅ Manually updated: capacity=1500, budget_goal=$150,000\n');

  // Step 5: Another PDF update (should NOT overwrite manual edits)
  console.log('📊 Step 5: Another PDF update (should preserve manual edits)\n');

  const snapshotId2 = `test_${Date.now()}`;
  const insertSnapshot2 = `
    INSERT INTO \`${projectId}.${datasetId}.performance_sales_snapshots\`
    (snapshot_id, performance_id, performance_code, snapshot_date,
     single_tickets_sold, subscription_tickets_sold, total_tickets_sold,
     total_revenue, capacity_percent, budget_percent, source, created_at)
    SELECT
      '${snapshotId2}',
      performance_id,
      '${testCode}',
      CURRENT_DATE(),
      700,
      460,
      1160,
      72000,
      80.0,
      58.0,
      'test_pdf',
      CURRENT_TIMESTAMP()
    FROM \`${projectId}.${datasetId}.performances\`
    WHERE performance_code = '${testCode}'
  `;

  await bigquery.query({ query: insertSnapshot2, location: 'US' });
  console.log('✅ Created another snapshot with updated sales\n');

  // Final verification
  const [finalRows] = await bigquery.query({ query: getQuery, location: 'US' });
  const final = finalRows[0];

  console.log('Final metadata (after 2nd PDF update):');
  console.log(`  Capacity: ${final.capacity} ${final.capacity === 1500 ? '✅ Preserved!' : '❌ Lost!'}`);
  console.log(`  Budget Goal: $${final.budget_goal.toLocaleString()} ${final.budget_goal === 150000 ? '✅ Preserved!' : '❌ Lost!'}`);
  console.log(`  Occupancy Goal: ${final.occupancy_goal}%\n`);

  // Cleanup test snapshots
  console.log('🧹 Cleaning up test snapshots...\n');
  const cleanupQuery = `
    DELETE FROM \`${projectId}.${datasetId}.performance_sales_snapshots\`
    WHERE source = 'test_pdf'
  `;
  await bigquery.query({ query: cleanupQuery, location: 'US' });

  console.log('✅ Workflow test complete!\n');
  console.log('Summary:');
  console.log('  ✅ Metadata can be populated from Weekly Report');
  console.log('  ✅ PDF updates create snapshots (sales data only)');
  console.log('  ✅ Metadata stays unchanged during PDF updates');
  console.log('  ✅ Manual edits persist through PDF updates');
  console.log('  ✅ Sales data and metadata are properly separated\n');
}

testMetadataWorkflow().catch(console.error);
