const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  keyFilename: './symphony-bigquery-key.json',
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
});

const DATASET_ID = 'symphony_dashboard';

async function removeGenericPerformances() {
  console.log('🗑️  Removing performances with generic "Performance" titles...\n');

  const performanceCodes = [
    '251011A', '251011B', '251011C',
    '251205M', '251206C', '251206A', '251206B', '251215M'
  ];

  try {
    // First, check what we're about to delete
    const checkQuery = `
      SELECT performance_code, title, series, has_sales_data
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.performances\`
      WHERE performance_code IN (${performanceCodes.map(c => `'${c}'`).join(', ')})
    `;

    const [checkRows] = await bigquery.query(checkQuery);
    console.log(`Found ${checkRows.length} performances to delete:`);
    checkRows.forEach(row => {
      console.log(`  - ${row.performance_code}: ${row.title} (${row.series})`);
    });

    if (checkRows.length === 0) {
      console.log('\n✅ No performances to delete. Already clean!');
      return;
    }

    // Delete them
    const deleteQuery = `
      DELETE FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.performances\`
      WHERE performance_code IN (${performanceCodes.map(c => `'${c}'`).join(', ')})
    `;

    await bigquery.query(deleteQuery);
    console.log(`\n✅ Deleted ${checkRows.length} performances`);

    // Verify final count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.performances\`
    `;

    const [countRows] = await bigquery.query(countQuery);
    console.log(`\n📊 Final performance count: ${countRows[0].total}`);

    if (countRows[0].total === 118) {
      console.log('✅ Back to clean 118 performances!');
    } else {
      console.log(`⚠️  Expected 118, got ${countRows[0].total}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

removeGenericPerformances();
