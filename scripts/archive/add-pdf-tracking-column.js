const { BigQuery } = require('@google-cloud/bigquery');

const DATASET_ID = 'symphony_dashboard';
const TABLE_ID = 'performances';

async function addPdfTrackingColumn() {
  const bigquery = new BigQuery({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
  });

  console.log('🔧 Adding last_pdf_import_date column to performances table...\n');

  try {
    // Add the new column
    const query = `
      ALTER TABLE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
      ADD COLUMN IF NOT EXISTS last_pdf_import_date TIMESTAMP
    `;

    console.log('Executing ALTER TABLE query...');
    const [job] = await bigquery.createQueryJob({ query });
    await job.getQueryResults();

    console.log('✅ Column added successfully!\n');

    // Verify the schema
    const [metadata] = await bigquery
      .dataset(DATASET_ID)
      .table(TABLE_ID)
      .getMetadata();

    console.log('📋 Updated table schema:');
    const relevantFields = metadata.schema.fields
      .filter(f => ['performance_code', 'last_pdf_import_date', 'updated_at'].includes(f.name))
      .map(f => `  - ${f.name}: ${f.type}${f.mode === 'NULLABLE' ? ' (nullable)' : ''}`);

    console.log(relevantFields.join('\n'));
    console.log('\n✨ Ready to track PDF imports!');

  } catch (error) {
    console.error('❌ Error adding column:', error);
    throw error;
  }
}

if (require.main === module) {
  addPdfTrackingColumn().catch(console.error);
}

module.exports = { addPdfTrackingColumn };
