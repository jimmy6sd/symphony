const { BigQuery } = require('@google-cloud/bigquery');

async function deleteBadSnapshots() {
  const bigquery = new BigQuery({
    projectId: 'kcsymphony',
    location: 'US'
  });

  const query = `
    DELETE FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    WHERE source = 'pdf_reprocess'
  `;

  console.log('🗑️  Deleting all pdf_reprocess snapshots...');

  const [job] = await bigquery.createQueryJob({ query });
  const [rows] = await job.getQueryResults();

  console.log('✅ Deleted bad snapshot data');
}

deleteBadSnapshots().catch(console.error);
