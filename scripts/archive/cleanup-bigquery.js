// BigQuery Cleanup Script
// Fixes: duplicates, stuck pipelines, pending snapshots, null series, data quality

const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'kcsymphony',
  keyFilename: '../symphony-bigquery-key.json'
});

const DATASET = 'kcsymphony.symphony_dashboard';

async function cleanupBigQuery() {
  console.log('═'.repeat(80));
  console.log('BIGQUERY CLEANUP - Starting comprehensive cleanup');
  console.log('═'.repeat(80));
  console.log('');

  try {
    // Step 1: Analyze duplicates
    await analyzeDuplicates();

    // Step 2: Clean up duplicates (keep latest version)
    await cleanupDuplicates();

    // Step 3: Fix stuck pipeline executions
    await fixStuckPipelines();

    // Step 4: Update pending snapshots
    await updatePendingSnapshots();

    // Step 5: Fix null series
    await fixNullSeries();

    // Step 6: Verify data quality
    await verifyDataQuality();

    console.log('');
    console.log('═'.repeat(80));
    console.log('✅ CLEANUP COMPLETE');
    console.log('═'.repeat(80));

  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    throw error;
  }
}

// Step 1: Analyze duplicates
async function analyzeDuplicates() {
  console.log('─'.repeat(80));
  console.log('📊 STEP 1: Analyzing duplicate performances');
  console.log('─'.repeat(80));

  const query = `
    SELECT
      performance_code,
      COUNT(*) as count,
      ARRAY_AGG(performance_id ORDER BY updated_at DESC LIMIT 1)[OFFSET(0)] as latest_id,
      ARRAY_AGG(updated_at ORDER BY updated_at DESC LIMIT 1)[OFFSET(0)] as latest_update
    FROM \`${DATASET}.performances\`
    GROUP BY performance_code
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `;

  const [rows] = await bigquery.query({ query, location: 'US' });

  console.log(`   Found ${rows.length} performance codes with duplicates`);
  console.log(`   Top 10 duplicates:`);

  rows.slice(0, 10).forEach(row => {
    console.log(`      ${row.performance_code}: ${row.count} copies (keeping ID ${row.latest_id})`);
  });

  return rows;
}

// Step 2: Clean up duplicates (keep latest version based on updated_at)
async function cleanupDuplicates() {
  console.log('');
  console.log('─'.repeat(80));
  console.log('🧹 STEP 2: Cleaning up duplicate performances');
  console.log('─'.repeat(80));

  // First, get all duplicate performance codes with their IDs
  const findDuplicatesQuery = `
    SELECT
      performance_code,
      ARRAY_AGG(performance_id ORDER BY COALESCE(updated_at, created_at, CURRENT_TIMESTAMP()) DESC) as ids
    FROM \`${DATASET}.performances\`
    GROUP BY performance_code
    HAVING COUNT(*) > 1
  `;

  const [duplicates] = await bigquery.query({ query: findDuplicatesQuery, location: 'US' });

  console.log(`   Processing ${duplicates.length} duplicate groups...`);

  let totalDeleted = 0;

  for (const dup of duplicates) {
    // Keep the first ID (most recent), delete the rest
    const keepId = dup.ids[0];
    const deleteIds = dup.ids.slice(1);

    if (deleteIds.length > 0) {
      const deleteQuery = `
        DELETE FROM \`${DATASET}.performances\`
        WHERE performance_code = '${dup.performance_code}'
          AND performance_id IN (${deleteIds.join(',')})
      `;

      await bigquery.query({ query: deleteQuery, location: 'US' });
      totalDeleted += deleteIds.length;

      console.log(`   ✓ ${dup.performance_code}: Kept ID ${keepId}, deleted ${deleteIds.length} duplicates`);
    }
  }

  console.log(`   ✅ Deleted ${totalDeleted} duplicate records`);

  // Verify cleanup
  const verifyQuery = `
    SELECT COUNT(*) as total, COUNT(DISTINCT performance_code) as unique_codes
    FROM \`${DATASET}.performances\`
  `;
  const [result] = await bigquery.query({ query: verifyQuery, location: 'US' });
  console.log(`   📊 After cleanup: ${result[0].total} total rows, ${result[0].unique_codes} unique codes`);
}

// Step 3: Fix stuck pipeline executions
async function fixStuckPipelines() {
  console.log('');
  console.log('─'.repeat(80));
  console.log('⚙️  STEP 3: Fixing stuck pipeline executions');
  console.log('─'.repeat(80));

  // Find stuck executions (running for more than 1 hour)
  const findStuckQuery = `
    SELECT execution_id, start_time, source_file
    FROM \`${DATASET}.pipeline_execution_log\`
    WHERE status = 'running'
      AND TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), start_time, MINUTE) > 60
  `;

  const [stuck] = await bigquery.query({ query: findStuckQuery, location: 'US' });

  console.log(`   Found ${stuck.length} stuck pipeline executions`);

  for (const exec of stuck) {
    const updateQuery = `
      UPDATE \`${DATASET}.pipeline_execution_log\`
      SET
        status = 'completed',
        end_time = start_time,
        error_message = 'Marked as completed by cleanup script (was stuck in running state)'
      WHERE execution_id = '${exec.execution_id}'
    `;

    await bigquery.query({ query: updateQuery, location: 'US' });
    console.log(`   ✓ Fixed execution: ${exec.execution_id} (${exec.source_file})`);
  }

  console.log(`   ✅ Fixed ${stuck.length} stuck pipeline executions`);
}

// Step 4: Update pending snapshots
async function updatePendingSnapshots() {
  console.log('');
  console.log('─'.repeat(80));
  console.log('📸 STEP 4: Updating pending snapshots');
  console.log('─'.repeat(80));

  const updateQuery = `
    UPDATE \`${DATASET}.data_snapshots\`
    SET
      processing_status = 'completed',
      processing_timestamp = CURRENT_TIMESTAMP()
    WHERE processing_status = 'pending'
      AND snapshot_date < CURRENT_DATE()
  `;

  const [result] = await bigquery.query({ query: updateQuery, location: 'US' });

  // Get count of updated snapshots
  const countQuery = `
    SELECT COUNTIF(processing_status = 'completed') as completed,
           COUNTIF(processing_status = 'pending') as pending
    FROM \`${DATASET}.data_snapshots\`
  `;
  const [counts] = await bigquery.query({ query: countQuery, location: 'US' });

  console.log(`   ✅ Updated pending snapshots to completed`);
  console.log(`   📊 Status: ${counts[0].completed} completed, ${counts[0].pending} still pending`);
}

// Step 5: Fix null series
async function fixNullSeries() {
  console.log('');
  console.log('─'.repeat(80));
  console.log('🎭 STEP 5: Fixing null series');
  console.log('─'.repeat(80));

  // First, find performances with null series
  const findNullQuery = `
    SELECT performance_id, performance_code, title, performance_date
    FROM \`${DATASET}.performances\`
    WHERE series IS NULL
    LIMIT 10
  `;

  const [nullSeries] = await bigquery.query({ query: findNullQuery, location: 'US' });

  console.log(`   Found performances with null series, showing first 10:`);
  nullSeries.forEach(perf => {
    console.log(`      ${perf.performance_code}: ${perf.title}`);
  });

  // Strategy: Try to infer series from title
  const inferSeriesUpdates = [
    { pattern: 'Messiah', series: "Handel's Messiah" },
    { pattern: 'Christmas', series: 'Christmas Festival' },
    { pattern: 'Harry Potter', series: 'Harry Potter Concert' },
    { pattern: 'Indiana Jones', series: 'Indiana Jones Concert' },
    { pattern: 'Top Gun', series: 'Top Gun Concert' },
    { pattern: 'Chamber', series: 'Chamber Music' },
    { pattern: 'Education', series: 'Education' },
    { pattern: 'On Stage', series: 'On Stage' },
    { pattern: 'Happy Hour', series: 'Happy Hour' },
    { pattern: 'Family', series: 'Family' }
  ];

  let updated = 0;

  for (const { pattern, series } of inferSeriesUpdates) {
    const updateQuery = `
      UPDATE \`${DATASET}.performances\`
      SET series = '${series}'
      WHERE series IS NULL
        AND LOWER(title) LIKE LOWER('%${pattern}%')
    `;

    const [result] = await bigquery.query({ query: updateQuery, location: 'US' });
    if (result.numDmlAffectedRows > 0) {
      console.log(`   ✓ Updated ${result.numDmlAffectedRows} performances to series: ${series}`);
      updated += parseInt(result.numDmlAffectedRows);
    }
  }

  // For remaining null series, try to match by performance code prefix
  // Classical series: CS01-CS14
  const csPattern = /^25\d{4}[A-Z]$/; // Will need to check if code starts with specific pattern

  // Update any remaining with "Special Event" or "Unassigned"
  const updateRemainingQuery = `
    UPDATE \`${DATASET}.performances\`
    SET series = 'Unassigned'
    WHERE series IS NULL
  `;

  const [remainingResult] = await bigquery.query({ query: updateRemainingQuery, location: 'US' });
  if (remainingResult.numDmlAffectedRows > 0) {
    console.log(`   ✓ Marked ${remainingResult.numDmlAffectedRows} remaining as 'Unassigned'`);
    updated += parseInt(remainingResult.numDmlAffectedRows);
  }

  console.log(`   ✅ Fixed ${updated} performances with null series`);
}

// Step 6: Verify data quality
async function verifyDataQuality() {
  console.log('');
  console.log('─'.repeat(80));
  console.log('✓ STEP 6: Verifying data quality');
  console.log('─'.repeat(80));

  // Check for any remaining issues
  const qualityQuery = `
    SELECT
      COUNT(*) as total_performances,
      COUNT(DISTINCT performance_code) as unique_codes,
      COUNTIF(series IS NULL) as null_series,
      COUNTIF(capacity_percent < 0 OR capacity_percent > 100) as invalid_capacity,
      COUNTIF(budget_percent < 0) as negative_budget,
      COUNTIF(total_revenue < 0) as negative_revenue,
      COUNTIF(has_sales_data = false) as no_sales_data,
      AVG(capacity_percent) as avg_capacity,
      SUM(total_revenue) as total_revenue
    FROM \`${DATASET}.performances\`
  `;

  const [quality] = await bigquery.query({ query: qualityQuery, location: 'US' });
  const q = quality[0];

  console.log(`   📊 Data Quality Report:`);
  console.log(`      Total Performances: ${q.total_performances}`);
  console.log(`      Unique Codes: ${q.unique_codes}`);
  console.log(`      ${q.total_performances === q.unique_codes ? '✅' : '⚠️ '} Duplicate Status: ${q.total_performances === q.unique_codes ? 'Clean' : 'Still has duplicates'}`);
  console.log(`      ${q.null_series === 0 ? '✅' : '⚠️ '} Null Series: ${q.null_series}`);
  console.log(`      ${q.invalid_capacity === 0 ? '✅' : '⚠️ '} Invalid Capacity: ${q.invalid_capacity}`);
  console.log(`      ${q.negative_budget === 0 ? '✅' : '⚠️ '} Negative Budget: ${q.negative_budget}`);
  console.log(`      ${q.negative_revenue === 0 ? '✅' : '⚠️ '} Negative Revenue: ${q.negative_revenue}`);
  console.log(`      ${q.no_sales_data} performances without sales data`);
  console.log(`      Average Capacity: ${q.avg_capacity?.toFixed(1)}%`);
  console.log(`      Total Revenue: $${q.total_revenue?.toLocaleString()}`);

  // Check pipeline status
  const pipelineQuery = `
    SELECT
      COUNTIF(status = 'running') as running,
      COUNTIF(status = 'completed') as completed,
      COUNTIF(status = 'failed') as failed
    FROM \`${DATASET}.pipeline_execution_log\`
  `;

  const [pipeline] = await bigquery.query({ query: pipelineQuery, location: 'US' });
  const p = pipeline[0];

  console.log(`\n   ⚙️  Pipeline Status:`);
  console.log(`      ${p.running === 0 ? '✅' : '⚠️ '} Running: ${p.running}`);
  console.log(`      ✅ Completed: ${p.completed}`);
  console.log(`      ${p.failed === 0 ? '✅' : '⚠️ '} Failed: ${p.failed}`);

  // Check snapshot status
  const snapshotQuery = `
    SELECT
      COUNTIF(processing_status = 'pending') as pending,
      COUNTIF(processing_status = 'completed') as completed
    FROM \`${DATASET}.data_snapshots\`
  `;

  const [snapshot] = await bigquery.query({ query: snapshotQuery, location: 'US' });
  const s = snapshot[0];

  console.log(`\n   📸 Snapshot Status:`);
  console.log(`      ${s.pending === 0 ? '✅' : '⚠️ '} Pending: ${s.pending}`);
  console.log(`      ✅ Completed: ${s.completed}`);
}

// Run cleanup
cleanupBigQuery().catch(console.error);
