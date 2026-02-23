// Add global annotation columns to performance_annotations table
// New columns: scope, annotation_date, annotation_end_date
const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

async function addGlobalAnnotationColumns() {
  try {
    console.log('Adding global annotation columns to performance_annotations table...\n');

    const bigquery = new BigQuery({
      projectId: 'kcsymphony',
      keyFilename: path.join(__dirname, '..', '..', 'symphony-bigquery-key.json')
    });

    const tableName = '`kcsymphony.symphony_dashboard.performance_annotations`';

    const newColumns = [
      { name: 'scope', type: 'STRING', description: '"production" or "global"' },
      { name: 'annotation_date', type: 'DATE', description: 'Calendar date for global annotations (or start date for intervals)' },
      { name: 'annotation_end_date', type: 'DATE', description: 'End date for global interval annotations' }
    ];

    for (const col of newColumns) {
      console.log(`Adding column: ${col.name} (${col.type})...`);

      const addColumnQuery = `
        ALTER TABLE ${tableName}
        ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
      `;

      try {
        const [job] = await bigquery.createQueryJob({
          query: addColumnQuery,
          location: 'US'
        });
        await job.getQueryResults();
        console.log(`  ${col.name} added!\n`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`  ${col.name} already exists, skipping...\n`);
        } else {
          throw error;
        }
      }
    }

    // Verify updated schema
    console.log('Verifying updated schema...\n');
    const dataset = bigquery.dataset('symphony_dashboard');
    const table = dataset.table('performance_annotations');
    const [metadata] = await table.getMetadata();

    console.log('Complete Table Schema:');
    metadata.schema.fields.forEach(field => {
      const isNew = newColumns.find(col => col.name === field.name);
      const marker = isNew ? '  <-- NEW' : '';
      console.log(`   - ${field.name} (${field.type})${marker}`);
    });
    console.log('');

    console.log('Schema update complete!');

  } catch (error) {
    console.error('Error adding columns:', error.message);
    console.error(error);
    process.exit(1);
  }
}

addGlobalAnnotationColumns();
