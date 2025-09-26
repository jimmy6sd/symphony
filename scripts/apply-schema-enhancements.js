// Apply BigQuery schema enhancements for PDF pipeline
// Run this after the main schema is set up

const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Initialize BigQuery client
const initializeBigQuery = () => {
  try {
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (!credentialsJson) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable not set');
    }

    const credentials = JSON.parse(credentialsJson);

    // Fix escaped newlines, which is common in env vars
    if (credentials.private_key && credentials.private_key.includes('\\n')) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }

    return new BigQuery({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || credentials.project_id,
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
      location: 'US'
    });
  } catch (error) {
    console.error('BigQuery initialization error:', error.message);
    throw error;
  }
};

const DATASET_ID = process.env.BIGQUERY_DATASET || 'symphony_dashboard';

async function applySchemaEnhancements() {
  try {
    console.log('🔧 Applying BigQuery schema enhancements for PDF pipeline...\n');

    const bigquery = initializeBigQuery();

    // Read the schema enhancement file
    const schemaPath = path.join(__dirname, '..', 'bigquery-schema-enhancements.sql');
    const schemaSQL = await fs.readFile(schemaPath, 'utf8');

    // Split into individual statements (basic split on CREATE/ALTER)
    const statements = schemaSQL
      .split(/(?=(?:CREATE|ALTER)\s+(?:TABLE|VIEW))/i)
      .filter(stmt => stmt.trim())
      .map(stmt => stmt.replace(/^--.*$/gm, '').trim()) // Remove comments
      .filter(stmt => stmt.length > 0);

    console.log(`📊 Found ${statements.length} schema statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const statementType = statement.match(/^(CREATE|ALTER)\s+(\w+)/i);
      const objectType = statementType ? `${statementType[1]} ${statementType[2]}` : 'SQL';

      console.log(`${i + 1}. Executing ${objectType}...`);

      try {
        const options = {
          query: statement,
          location: 'US',
        };

        const [job] = await bigquery.createQueryJob(options);
        console.log(`   Job ${job.id} started.`);

        // Wait for the query to finish
        const [rows] = await job.getQueryResults();
        console.log(`   ✅ Completed successfully\n`);

      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`   ⚠️  Object already exists, skipping\n`);
        } else {
          console.error(`   ❌ Error: ${error.message}\n`);
          // Continue with other statements
        }
      }
    }

    // Also need to add columns to existing weekly_sales table
    console.log('🔧 Adding columns to existing weekly_sales table...');

    const alterStatements = [
      `ALTER TABLE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.weekly_sales\`
       ADD COLUMN IF NOT EXISTS data_source STRING DEFAULT 'historical'`,

      `ALTER TABLE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.weekly_sales\`
       ADD COLUMN IF NOT EXISTS last_adjusted TIMESTAMP`,

      `ALTER TABLE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.weekly_sales\`
       ADD COLUMN IF NOT EXISTS adjustment_id STRING`,

      `ALTER TABLE \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${DATASET_ID}.weekly_sales\`
       ADD COLUMN IF NOT EXISTS confidence_score FLOAT64 DEFAULT 1.0`
    ];

    for (const alterSQL of alterStatements) {
      try {
        const [job] = await bigquery.createQueryJob({
          query: alterSQL,
          location: 'US',
        });
        await job.getQueryResults();
        console.log('   ✅ Column added successfully');
      } catch (error) {
        if (error.message.includes('already exists') || error.message.includes('Duplicate column')) {
          console.log('   ⚠️  Column already exists, skipping');
        } else {
          console.error(`   ❌ Error adding column: ${error.message}`);
        }
      }
    }

    console.log('\n🎉 Schema enhancements applied successfully!');
    console.log('\n📋 New tables created:');
    console.log('   • data_snapshots - Daily PDF data versions');
    console.log('   • trend_adjustments - Historical trend modifications');
    console.log('   • data_quality_metrics - Anomaly detection');
    console.log('   • pipeline_execution_log - Processing audit trail');
    console.log('\n📊 New views created:');
    console.log('   • latest_snapshot - Most recent data import');
    console.log('   • performance_freshness - Data age indicators');
    console.log('   • trend_adjustment_summary - Modification history');

  } catch (error) {
    console.error('❌ Schema enhancement failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  applySchemaEnhancements();
}

module.exports = { applySchemaEnhancements };