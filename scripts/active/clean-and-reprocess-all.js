const { BigQuery } = require('@google-cloud/bigquery');

async function cleanAndReprocess() {
  const bigquery = new BigQuery({
    projectId: 'kcsymphony',
    location: 'US'
  });

  console.log('🗑️  Step 1: Removing ALL historical PDF import data to start fresh...\n');

  // Delete all data from PDF imports to start completely fresh
  const deleteQuery = `
    DELETE FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    WHERE source IN ('historical_pdf_import', 'historical_pdf_import_v2', 'pdf_reprocess')
  `;

  const [job] = await bigquery.createQueryJob({ query: deleteQuery });
  await job.getQueryResults();

  console.log('✅ Cleaned up all historical PDF import data\n');

  // Check what's left
  const checkQuery = `
    SELECT
      source,
      COUNT(*) as total_snapshots,
      COUNT(DISTINCT snapshot_date) as unique_dates
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    GROUP BY source
    ORDER BY source
  `;

  const [rows] = await bigquery.query({ query: checkQuery });

  console.log('📊 Remaining data in database:\n');
  rows.forEach(row => {
    console.log(`  ${row.source}: ${row.total_snapshots} snapshots, ${row.unique_dates} unique dates`);
  });

  console.log('\n✅ Ready to reprocess all PDFs!');
  console.log('\nRun this command to reprocess all 45 PDFs:');
  console.log('  export GOOGLE_APPLICATION_CREDENTIALS="./symphony-bigquery-key.json" && node scripts/active/reprocess-pdfs-from-bucket.js');
}

cleanAndReprocess().catch(console.error);
