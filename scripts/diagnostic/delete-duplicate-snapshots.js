// Script to delete duplicate snapshots from 2025-11-24
// Run with: node scripts/diagnostic/delete-duplicate-snapshots.js

const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');

// Initialize BigQuery
const credentialsPath = path.join(__dirname, '../../symphony-bigquery-key.json');
const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
const bigquery = new BigQuery({
  projectId: 'kcsymphony',
  credentials: { client_email: credentials.client_email, private_key: credentials.private_key },
  location: 'US'
});

async function deleteDuplicates() {
  console.log('Deleting duplicate snapshots from 2025-11-24...\n');

  // First, let's see what we're about to delete
  const previewQuery = `
    WITH DuplicateDates AS (
      SELECT performance_code, snapshot_date
      FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
      WHERE snapshot_date = '2025-11-24'
      GROUP BY performance_code, snapshot_date
      HAVING COUNT(*) > 1
    ),
    RankedSnapshots AS (
      SELECT
        s.snapshot_id,
        s.performance_code,
        s.total_tickets_sold,
        s.created_at,
        ROW_NUMBER() OVER (PARTITION BY s.performance_code ORDER BY s.created_at DESC) as rn
      FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\` s
      INNER JOIN DuplicateDates d
        ON s.performance_code = d.performance_code
        AND s.snapshot_date = d.snapshot_date
    )
    SELECT snapshot_id, performance_code, total_tickets_sold, created_at
    FROM RankedSnapshots
    WHERE rn > 1
    ORDER BY performance_code
  `;

  console.log('Preview - records to be deleted:');
  const [previewRows] = await bigquery.query({ query: previewQuery, location: 'US' });
  console.log(`Found ${previewRows.length} duplicate records to delete\n`);

  // Show a few examples
  console.log('Sample records being deleted:');
  previewRows.slice(0, 5).forEach(r => {
    console.log(`  ${r.performance_code}: ${r.total_tickets_sold} tickets`);
  });
  console.log('  ...\n');

  // Now delete
  const deleteQuery = `
    DELETE FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    WHERE snapshot_id IN (
      WITH DuplicateDates AS (
        SELECT performance_code, snapshot_date
        FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
        WHERE snapshot_date = '2025-11-24'
        GROUP BY performance_code, snapshot_date
        HAVING COUNT(*) > 1
      ),
      RankedSnapshots AS (
        SELECT
          s.snapshot_id,
          ROW_NUMBER() OVER (PARTITION BY s.performance_code ORDER BY s.created_at DESC) as rn
        FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\` s
        INNER JOIN DuplicateDates d
          ON s.performance_code = d.performance_code
          AND s.snapshot_date = d.snapshot_date
      )
      SELECT snapshot_id FROM RankedSnapshots WHERE rn > 1
    )
  `;

  console.log('Executing delete...');
  const [job] = await bigquery.createQueryJob({
    query: deleteQuery,
    location: 'US'
  });

  await job.getQueryResults();

  // Get row count from job metadata
  const [metadata] = await job.getMetadata();
  const rowsDeleted = metadata.statistics?.query?.numDmlAffectedRows || 'unknown';

  console.log(`\n✅ Successfully deleted ${rowsDeleted} duplicate snapshot records!`);

  // Verify 251223E now has only one snapshot per date
  console.log('\nVerifying 251223E...');
  const verifyQuery = `
    SELECT snapshot_date, COUNT(*) as count, MAX(total_tickets_sold) as tickets
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    WHERE performance_code = '251223E'
    GROUP BY snapshot_date
    ORDER BY snapshot_date DESC
    LIMIT 5
  `;

  const [verifyRows] = await bigquery.query({ query: verifyQuery, location: 'US' });
  console.log('251223E snapshot counts by date:');
  verifyRows.forEach(r => {
    const date = typeof r.snapshot_date === 'object' ? r.snapshot_date.value : r.snapshot_date;
    console.log(`  ${date}: ${r.count} snapshot(s), ${r.tickets} tickets`);
  });
}

deleteDuplicates().catch(console.error);
