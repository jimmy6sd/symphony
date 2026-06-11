// Migration: Add performance_code column to performance_annotations table
// This supports performance-scoped annotations (tied to individual performances)

require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');

async function migrate() {
    const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    let credentials;

    if (credentialsEnv.startsWith('{')) {
        credentials = JSON.parse(credentialsEnv);
    } else {
        const fs = require('fs');
        const path = require('path');
        credentials = JSON.parse(fs.readFileSync(path.resolve(credentialsEnv), 'utf8'));
    }

    if (credentials.private_key && credentials.private_key.includes('\\n')) {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }

    const bigquery = new BigQuery({
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || credentials.project_id,
        credentials: {
            client_email: credentials.client_email,
            private_key: credentials.private_key,
        },
        location: 'US'
    });

    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony';
    const dataset = process.env.BIGQUERY_DATASET || 'symphony_dashboard';
    const table = 'performance_annotations';

    console.log(`Adding performance_code column to ${projectId}.${dataset}.${table}...`);

    const query = `
        ALTER TABLE \`${projectId}.${dataset}.${table}\`
        ADD COLUMN IF NOT EXISTS performance_code STRING
    `;

    try {
        await bigquery.query({ query, location: 'US' });
        console.log('Migration complete: performance_code column added.');
    } catch (error) {
        if (error.message.includes('Column already exists')) {
            console.log('Column performance_code already exists, skipping.');
        } else {
            throw error;
        }
    }
}

migrate().catch(err => {
    console.error('Migration failed:', err.message);
    process.exit(1);
});
