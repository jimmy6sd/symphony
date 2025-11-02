const { BigQuery } = require('@google-cloud/bigquery');

async function deduplicateSnapshots() {
  const bigquery = new BigQuery({
    projectId: 'kcsymphony',
    location: 'US'
  });

  console.log('🔍 Analyzing duplicates...\n');

  // First, check how many duplicates we have
  const checkQuery = `
    SELECT
      COUNT(*) as total_snapshots,
      COUNT(DISTINCT CONCAT(performance_code, '|', CAST(snapshot_date AS STRING))) as unique_combinations,
      COUNT(*) - COUNT(DISTINCT CONCAT(performance_code, '|', CAST(snapshot_date AS STRING))) as duplicates
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
  `;

  const [checkResults] = await bigquery.query({ query: checkQuery });
  const stats = checkResults[0];

  console.log(`📊 Current state:`);
  console.log(`  Total snapshots: ${stats.total_snapshots}`);
  console.log(`  Unique combinations: ${stats.unique_combinations}`);
  console.log(`  Duplicates: ${stats.duplicates}\n`);

  if (stats.duplicates === 0) {
    console.log('✅ No duplicates found!');
    return;
  }

  console.log('🗑️  Removing duplicates (keeping most recent by created_at)...\n');

  // Delete duplicates, keeping only the most recent snapshot for each (performance_code, snapshot_date)
  const dedupeQuery = `
    DELETE FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    WHERE snapshot_id IN (
      SELECT snapshot_id
      FROM (
        SELECT
          snapshot_id,
          ROW_NUMBER() OVER (
            PARTITION BY performance_code, snapshot_date
            ORDER BY created_at DESC, snapshot_id DESC
          ) as rn
        FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
      )
      WHERE rn > 1
    )
  `;

  const [job] = await bigquery.createQueryJob({ query: dedupeQuery });
  const [rows] = await job.getQueryResults();

  console.log('✅ Deduplication complete!\n');

  // Re-check stats
  const [checkResults2] = await bigquery.query({ query: checkQuery });
  const stats2 = checkResults2[0];

  console.log(`📊 After deduplication:`);
  console.log(`  Total snapshots: ${stats2.total_snapshots}`);
  console.log(`  Unique combinations: ${stats2.unique_combinations}`);
  console.log(`  Duplicates: ${stats2.duplicates}\n`);

  console.log(`✅ Removed ${stats.total_snapshots - stats2.total_snapshots} duplicate snapshots`);
}

deduplicateSnapshots().catch(console.error);
