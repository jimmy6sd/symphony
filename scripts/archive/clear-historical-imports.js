const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

const bigquery = new BigQuery({
  projectId: 'kcsymphony',
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

async function clearHistoricalImports() {
  console.log('🗑️  Clearing old historical_pdf_import snapshots...\n');

  const query = `
    DELETE FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    WHERE source = 'historical_pdf_import'
  `;

  const [job] = await bigquery.query({ query, location: 'US' });
  const deletedRows = parseInt(job.statistics?.query?.numDmlAffectedRows || '0');

  console.log(`✅ Deleted ${deletedRows} historical snapshot records\n`);
  console.log('Ready to re-run: npm run backfill-historical');
}

clearHistoricalImports().catch(console.error);
