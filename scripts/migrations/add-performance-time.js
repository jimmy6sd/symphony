const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

async function addPerformanceTime() {
  const bigquery = new BigQuery({
    projectId: 'kcsymphony',
    location: 'US'
  });

  console.log('Adding performance_time column...');

  try {
    const query = `
      ALTER TABLE \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
      ADD COLUMN IF NOT EXISTS performance_time STRING
      OPTIONS(description='Performance time like 7:30 PM or 2:00 PM')
    `;

    const [job] = await bigquery.createQueryJob({
      query,
      location: 'US',
      useLegacySql: false
    });

    await job.getQueryResults();
    console.log('✅ performance_time column added successfully!');

  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('ℹ️  performance_time already exists');
    } else {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }
}

addPerformanceTime();
