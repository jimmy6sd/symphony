// Safe READ-ONLY BigQuery status check
// This script ONLY reads data, does NOT write or import anything

const { BigQuery } = require('@google-cloud/bigquery');

async function checkBigQueryStatus() {
  try {
    console.log('🔍 Checking BigQuery status (READ-ONLY)...\n');

    const bigquery = new BigQuery({
      projectId: 'kcsymphony',
      keyFilename: './symphony-bigquery-key.json'
    });

    // Check what tables exist
    console.log('📋 Checking available tables...');
    const [tables] = await bigquery.dataset('symphony_dashboard').getTables();
    console.log(`   Found ${tables.length} tables:`, tables.map(t => t.id).join(', '));

    // Check performance data
    const perfQuery = `
      SELECT
        COUNT(*) as total_performances,
        COUNT(DISTINCT performance_code) as unique_codes,
        SUM(single_tickets_sold) as total_single_tickets,
        SUM(subscription_tickets_sold) as total_subscription_tickets,
        SUM(total_revenue) as total_revenue,
        MAX(updated_at) as last_update,
        COUNTIF(has_sales_data = true) as with_sales_data,
        COUNTIF(has_sales_data = false) as without_sales_data
      FROM \`kcsymphony.symphony_dashboard.performances\`
    `;

    console.log('\n📊 Querying performance data...');
    const [perfRows] = await bigquery.query({ query: perfQuery, location: 'US' });

    if (perfRows.length > 0) {
      const stats = perfRows[0];
      console.log('\n✅ BIGQUERY PERFORMANCE DATA:');
      console.log(`   Total Performances: ${stats.total_performances}`);
      console.log(`   Unique Codes: ${stats.unique_codes}`);
      console.log(`   With Sales Data: ${stats.with_sales_data}`);
      console.log(`   Without Sales Data: ${stats.without_sales_data}`);
      console.log(`   Total Single Tickets: ${stats.total_single_tickets?.toLocaleString() || 0}`);
      console.log(`   Total Subscription Tickets: ${stats.total_subscription_tickets?.toLocaleString() || 0}`);
      console.log(`   Total Revenue: $${stats.total_revenue?.toLocaleString() || 0}`);
      console.log(`   Last Update: ${stats.last_update}`);
    }

    // Check snapshots
    const snapshotQuery = `
      SELECT
        COUNT(*) as total_snapshots,
        MAX(snapshot_date) as latest_snapshot_date,
        source_identifier
      FROM \`kcsymphony.symphony_dashboard.data_snapshots\`
      GROUP BY source_identifier
      ORDER BY MAX(snapshot_date) DESC
      LIMIT 5
    `;

    console.log('\n📸 Checking data snapshots...');
    const [snapshotRows] = await bigquery.query({ query: snapshotQuery, location: 'US' });

    if (snapshotRows.length > 0) {
      console.log('\n📅 RECENT SNAPSHOTS:');
      snapshotRows.forEach((snap, i) => {
        console.log(`   ${i + 1}. ${snap.source_identifier}`);
        console.log(`      Date: ${snap.latest_snapshot_date}`);
        console.log(`      Count: ${snap.total_snapshots}`);
      });
    } else {
      console.log('   No snapshots found in BigQuery');
    }

    // Check pipeline executions
    const pipelineQuery = `
      SELECT
        execution_id,
        pipeline_type,
        status,
        start_time,
        source_file,
        records_processed,
        records_inserted,
        records_updated
      FROM \`kcsymphony.symphony_dashboard.pipeline_execution_log\`
      ORDER BY start_time DESC
      LIMIT 5
    `;

    console.log('\n⚙️  Checking pipeline execution history...');
    const [pipelineRows] = await bigquery.query({ query: pipelineQuery, location: 'US' });

    if (pipelineRows.length > 0) {
      console.log('\n📜 RECENT PIPELINE EXECUTIONS:');
      pipelineRows.forEach((exec, i) => {
        console.log(`   ${i + 1}. ${exec.source_file || 'unknown'}`);
        console.log(`      Status: ${exec.status}`);
        console.log(`      Time: ${exec.start_time}`);
        console.log(`      Processed: ${exec.records_processed || 0}, Inserted: ${exec.records_inserted || 0}, Updated: ${exec.records_updated || 0}`);
      });
    } else {
      console.log('   No pipeline executions found in BigQuery');
    }

    // Compare with local data
    const fs = require('fs');
    const localData = JSON.parse(fs.readFileSync('data/dashboard.json', 'utf8'));

    console.log('\n🔄 COMPARISON WITH LOCAL DATA:');
    console.log(`   Local performances: ${localData.length}`);
    console.log(`   BigQuery performances: ${perfRows[0]?.total_performances || 0}`);

    const diff = localData.length - (perfRows[0]?.total_performances || 0);
    if (diff > 0) {
      console.log(`   ⚠️  Local has ${diff} MORE performances than BigQuery`);
    } else if (diff < 0) {
      console.log(`   ⚠️  BigQuery has ${Math.abs(diff)} MORE performances than local`);
    } else {
      console.log(`   ✅ Local and BigQuery have the same number of performances`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkBigQueryStatus();
