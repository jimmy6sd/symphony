// Create performance_annotations table in BigQuery
const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

async function createAnnotationsTable() {
  try {
    console.log('Creating performance_annotations table...\n');

    const bigquery = new BigQuery({
      projectId: 'kcsymphony',
      keyFilename: path.join(__dirname, '..', '..', 'symphony-bigquery-key.json')
    });

    const tableName = '`kcsymphony.symphony_dashboard.performance_annotations`';

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        annotation_id STRING NOT NULL,
        group_title STRING NOT NULL,
        annotation_type STRING NOT NULL,
        week_number FLOAT64,
        start_week FLOAT64,
        end_week FLOAT64,
        label STRING NOT NULL,
        description STRING,
        color STRING DEFAULT '#e74c3c',
        tags STRING,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
      )
    `;

    console.log('Running CREATE TABLE query...');
    const [job] = await bigquery.createQueryJob({
      query: createTableQuery,
      location: 'US'
    });
    await job.getQueryResults();
    console.log('performance_annotations table created successfully!');

  } catch (error) {
    if (error.message.includes('Already Exists')) {
      console.log('Table already exists.');
    } else {
      console.error('Error:', error.message);
      process.exit(1);
    }
  }
}

createAnnotationsTable();
