const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

async function checkCurrentComps() {
  try {
    const bigquery = new BigQuery({
      projectId: 'kcsymphony',
      keyFilename: path.join(__dirname, '..', 'symphony-bigquery-key.json')
    });

    // Count total comparisons and unique performances
    const countQuery = `
      SELECT
        COUNT(*) as total_comps,
        COUNT(DISTINCT performance_id) as unique_performances
      FROM \`kcsymphony.symphony_dashboard.performance_sales_comparisons\`
    `;

    const [countRows] = await bigquery.query({ query: countQuery, location: 'US' });
    console.log('📊 CURRENT DATABASE STATE:');
    console.log(`   Total comparisons: ${countRows[0].total_comps}`);
    console.log(`   Unique performances: ${countRows[0].unique_performances}`);
    console.log('');

    // Get list of all performances with comps
    const listQuery = `
      SELECT DISTINCT performance_id
      FROM \`kcsymphony.symphony_dashboard.performance_sales_comparisons\`
      ORDER BY performance_id
    `;

    const [listRows] = await bigquery.query({ query: listQuery, location: 'US' });
    const currentPerformances = listRows.map(r => r.performance_id);

    console.log('📋 PERFORMANCES WITH COMPS IN DATABASE:');
    console.log(`   ${currentPerformances.join(', ')}`);
    console.log('');

    // Check for most recent import timestamp
    const timestampQuery = `
      SELECT
        MAX(created_at) as last_import,
        MIN(created_at) as first_import
      FROM \`kcsymphony.symphony_dashboard.performance_sales_comparisons\`
    `;

    const [timestampRows] = await bigquery.query({ query: timestampQuery, location: 'US' });
    if (timestampRows[0].last_import) {
      console.log('⏰ IMPORT HISTORY:');
      console.log(`   First import: ${new Date(timestampRows[0].first_import.value).toLocaleString()}`);
      console.log(`   Last import:  ${new Date(timestampRows[0].last_import.value).toLocaleString()}`);
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkCurrentComps();
