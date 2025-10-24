// Verify comp data structure
const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

async function verifyCompData() {
  try {
    console.log('🔍 Verifying comp data in BigQuery...\n');

    const bigquery = new BigQuery({
      projectId: 'kcsymphony',
      keyFilename: path.join(__dirname, '..', 'symphony-bigquery-key.json')
    });

    // Check a specific performance that should have comp
    const query = `
      SELECT
        comparison_id,
        performance_id,
        comparison_name,
        weeks_data,
        line_color,
        line_style,
        is_target
      FROM \`kcsymphony.symphony_dashboard.performance_sales_comparisons\`
      WHERE performance_id = '251101E'
    `;

    const [rows] = await bigquery.query({
      query,
      location: 'US'
    });

    if (rows.length === 0) {
      console.log('❌ No comps found for 251101E');
      return;
    }

    console.log(`✅ Found ${rows.length} comp(s) for 251101E:\n`);

    rows.forEach(comp => {
      console.log(`Comparison: ${comp.comparison_name}`);
      console.log(`  is_target: ${comp.is_target}`);
      console.log(`  line_color: ${comp.line_color}`);
      console.log(`  line_style: ${comp.line_style}`);
      console.log(`  weeks_data: ${comp.weeks_data}`);

      // Parse the weeks data
      const weeksArray = comp.weeks_data.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
      console.log(`  weeksArray length: ${weeksArray.length}`);
      console.log(`  weeksArray sample: [${weeksArray.slice(0, 5).join(', ')}...]`);
      console.log('');
    });

    // Test the exact format the API would return
    console.log('📤 API Response Format:');
    const apiFormat = rows.map(row => ({
      ...row,
      weeksArray: row.weeks_data.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v))
    }));
    console.log(JSON.stringify(apiFormat, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

verifyCompData();
