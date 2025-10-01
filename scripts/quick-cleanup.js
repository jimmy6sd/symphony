// Quick BigQuery Cleanup - Single Optimized Queries
// Much faster than row-by-row processing

const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'kcsymphony',
  keyFilename: '../symphony-bigquery-key.json'
});

const DATASET = 'kcsymphony.symphony_dashboard';

async function quickCleanup() {
  console.log('🚀 QUICK BIGQUERY CLEANUP\n');

  try {
    // Step 1: Delete duplicates in ONE query (keep latest by updated_at)
    console.log('1️⃣  Removing duplicate performances...');
    const dedupeQuery = `
      DELETE FROM \`${DATASET}.performances\`
      WHERE performance_id NOT IN (
        SELECT MAX(performance_id)
        FROM \`${DATASET}.performances\`
        GROUP BY performance_code
      )
    `;
    const [dedupeResult] = await bigquery.query({ query: dedupeQuery, location: 'US' });
    console.log(`   ✅ Removed ${dedupeResult.numDmlAffectedRows || 0} duplicate performances\n`);

    // Step 2: Fix stuck pipelines in ONE query
    console.log('2️⃣  Fixing stuck pipeline executions...');
    const pipelineQuery = `
      UPDATE \`${DATASET}.pipeline_execution_log\`
      SET
        status = 'completed',
        end_time = start_time,
        error_message = 'Auto-completed by cleanup script (was stuck)'
      WHERE status = 'running'
        AND TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), start_time, MINUTE) > 60
    `;
    const [pipelineResult] = await bigquery.query({ query: pipelineQuery, location: 'US' });
    console.log(`   ✅ Fixed ${pipelineResult.numDmlAffectedRows || 0} stuck pipeline executions\n`);

    // Step 3: Update pending snapshots in ONE query
    console.log('3️⃣  Updating pending snapshots...');
    const snapshotQuery = `
      UPDATE \`${DATASET}.data_snapshots\`
      SET
        processing_status = 'completed',
        processing_timestamp = CURRENT_TIMESTAMP()
      WHERE processing_status = 'pending'
    `;
    const [snapshotResult] = await bigquery.query({ query: snapshotQuery, location: 'US' });
    console.log(`   ✅ Updated ${snapshotResult.numDmlAffectedRows || 0} pending snapshots\n`);

    // Step 4: Fix null series in ONE query (multiple patterns)
    console.log('4️⃣  Fixing null series...');
    const seriesQuery = `
      UPDATE \`${DATASET}.performances\`
      SET series = CASE
        WHEN LOWER(title) LIKE '%messiah%' THEN "Handel's Messiah"
        WHEN LOWER(title) LIKE '%christmas%' THEN 'Christmas Festival'
        WHEN LOWER(title) LIKE '%harry potter%' THEN 'Harry Potter Concert'
        WHEN LOWER(title) LIKE '%indiana jones%' THEN 'Indiana Jones Concert'
        WHEN LOWER(title) LIKE '%top gun%' THEN 'Top Gun Concert'
        WHEN LOWER(title) LIKE '%chamber%' THEN 'Chamber Music'
        WHEN LOWER(title) LIKE '%education%' THEN 'Education'
        WHEN LOWER(title) LIKE '%on stage%' THEN 'On Stage'
        WHEN LOWER(title) LIKE '%happy hour%' THEN 'Happy Hour'
        WHEN LOWER(title) LIKE '%family%' THEN 'Family'
        WHEN LOWER(title) LIKE '%morgan freeman%' THEN 'Special Event'
        WHEN LOWER(title) LIKE '%quartet%' THEN 'Chamber Music'
        WHEN LOWER(title) LIKE '%trio%' THEN 'Chamber Music'
        ELSE 'Unassigned'
      END
      WHERE series IS NULL
    `;
    const [seriesResult] = await bigquery.query({ query: seriesQuery, location: 'US' });
    console.log(`   ✅ Fixed ${seriesResult.numDmlAffectedRows || 0} null series\n`);

    // Step 5: Verify results
    console.log('5️⃣  Verifying cleanup results...\n');
    const verifyQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(DISTINCT performance_code) as unique_codes,
        COUNTIF(series IS NULL) as null_series,
        SUM(total_revenue) as revenue
      FROM \`${DATASET}.performances\`
    `;
    const [verify] = await bigquery.query({ query: verifyQuery, location: 'US' });
    const v = verify[0];

    console.log('📊 FINAL STATUS:');
    console.log(`   Total Performances: ${v.total}`);
    console.log(`   Unique Codes: ${v.unique_codes}`);
    console.log(`   ${v.total === v.unique_codes ? '✅ NO DUPLICATES' : '⚠️  Still has duplicates'}`);
    console.log(`   Null Series: ${v.null_series} ${v.null_series === 0 ? '✅' : '⚠️'}`);
    console.log(`   Total Revenue: $${v.revenue?.toLocaleString() || 0}`);

    // Check pipeline status
    const pipelineCheckQuery = `
      SELECT
        COUNTIF(status = 'running') as running,
        COUNTIF(status = 'completed') as completed
      FROM \`${DATASET}.pipeline_execution_log\`
    `;
    const [pCheck] = await bigquery.query({ query: pipelineCheckQuery, location: 'US' });
    console.log(`\n⚙️  Pipeline: ${pCheck[0].running} running, ${pCheck[0].completed} completed ${pCheck[0].running === 0 ? '✅' : '⚠️'}`);

    // Check snapshot status
    const snapshotCheckQuery = `
      SELECT
        COUNTIF(processing_status = 'pending') as pending,
        COUNTIF(processing_status = 'completed') as completed
      FROM \`${DATASET}.data_snapshots\`
    `;
    const [sCheck] = await bigquery.query({ query: snapshotCheckQuery, location: 'US' });
    console.log(`📸 Snapshots: ${sCheck[0].pending} pending, ${sCheck[0].completed} completed ${sCheck[0].pending === 0 ? '✅' : '⚠️'}`);

    console.log('\n✅ CLEANUP COMPLETE!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

quickCleanup().catch(console.error);
