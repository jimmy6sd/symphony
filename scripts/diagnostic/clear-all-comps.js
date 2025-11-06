// Clear all comparison data from BigQuery
const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');
const readline = require('readline');

async function clearAllComps() {
  try {
    console.log('🗑️  Clear All Comparison Data\n');

    const bigquery = new BigQuery({
      projectId: 'kcsymphony',
      keyFilename: path.join(__dirname, '..', '..', 'symphony-bigquery-key.json')
    });

    // Get current count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM \`kcsymphony.symphony_dashboard.performance_sales_comparisons\`
    `;

    const [countRows] = await bigquery.query({
      query: countQuery,
      location: 'US'
    });

    const currentCount = countRows[0].total;
    console.log(`📊 Current comps in database: ${currentCount}`);

    if (currentCount === 0) {
      console.log('✅ Table is already empty. Nothing to clear.');
      return;
    }

    // Confirm deletion
    console.log('\n⚠️  WARNING: This will DELETE ALL comparison data!');
    console.log('   You can reimport from CSV afterwards.\n');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      rl.question('Continue? (yes/no): ', resolve);
    });

    rl.close();

    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Cancelled. No data deleted.');
      return;
    }

    // Delete all records
    console.log('\n🗑️  Deleting all records...');

    const deleteQuery = `
      DELETE FROM \`kcsymphony.symphony_dashboard.performance_sales_comparisons\`
      WHERE TRUE
    `;

    await bigquery.query({
      query: deleteQuery,
      location: 'US'
    });

    console.log('✅ All comparison data deleted!');
    console.log('\n💡 Next step: Reimport data from CSV');
    console.log('   node scripts/active/import-historical-comps-v2.js');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

clearAllComps();
