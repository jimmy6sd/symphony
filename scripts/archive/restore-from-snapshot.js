// Restore performances from the most recent complete snapshot

const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'kcsymphony',
  keyFilename: '../symphony-bigquery-key.json'
});

const DATASET = 'kcsymphony.symphony_dashboard';

async function restoreFromSnapshot() {
  console.log('🔄 RESTORING PERFORMANCES FROM SNAPSHOT\n');

  try {
    // Step 1: Find the latest good snapshot with the most performances
    console.log('1️⃣  Finding best snapshot to restore from...');
    const snapshotQuery = `
      SELECT
        snapshot_id,
        snapshot_date,
        source_identifier,
        performance_count,
        total_tickets_in_snapshot,
        total_revenue_in_snapshot
      FROM \`${DATASET}.data_snapshots\`
      WHERE performance_count > 50
        AND processing_status = 'completed'
      ORDER BY performance_count DESC, snapshot_date DESC
      LIMIT 1
    `;

    const [snapshots] = await bigquery.query({ query: snapshotQuery, location: 'US' });

    if (snapshots.length === 0) {
      console.error('❌ No suitable snapshots found for restoration!');
      return;
    }

    const bestSnapshot = snapshots[0];
    console.log(`   Found snapshot: ${bestSnapshot.snapshot_id}`);
    console.log(`   Source: ${bestSnapshot.source_identifier}`);
    console.log(`   Date: ${bestSnapshot.snapshot_date?.value || 'unknown'}`);
    console.log(`   Performances: ${bestSnapshot.performance_count}`);
    console.log(`   Revenue: $${bestSnapshot.total_revenue_in_snapshot?.toLocaleString() || 0}\n`);

    // Step 2: Get the processed data from the snapshot
    console.log('2️⃣  Extracting performance data from snapshot...');
    const dataQuery = `
      SELECT processed_data
      FROM \`${DATASET}.data_snapshots\`
      WHERE snapshot_id = '${bestSnapshot.snapshot_id}'
    `;

    const [dataRows] = await bigquery.query({ query: dataQuery, location: 'US' });

    if (!dataRows[0] || !dataRows[0].processed_data) {
      console.error('❌ No processed data found in snapshot!');
      return;
    }

    const performances = dataRows[0].processed_data;
    console.log(`   Extracted ${performances.length} performances\n`);

    // Step 3: Clear current performances table
    console.log('3️⃣  Clearing current performances table...');
    const clearQuery = `DELETE FROM \`${DATASET}.performances\` WHERE 1=1`;
    await bigquery.query({ query: clearQuery, location: 'US' });
    console.log(`   ✅ Cleared performances table\n`);

    // Step 4: Insert snapshot data back into performances table
    console.log('4️⃣  Restoring performances from snapshot...');

    for (const perf of performances) {
      const insertQuery = `
        INSERT INTO \`${DATASET}.performances\`
        (performance_id, performance_code, title, series, performance_date, venue, season,
         capacity, single_tickets_sold, subscription_tickets_sold, total_tickets_sold,
         total_revenue, occupancy_goal, budget_goal, capacity_percent, budget_percent,
         occupancy_percent, has_sales_data, created_at, updated_at)
        VALUES (
          ${perf.performance_id || 0},
          '${perf.performance_code?.replace(/'/g, "\\'")}',
          '${(perf.title || '').replace(/'/g, "\\'")}',
          ${perf.series ? `'${perf.series.replace(/'/g, "\\'")}'` : 'NULL'},
          '${perf.performance_date || '2025-01-01'}',
          '${(perf.venue || 'Unknown').replace(/'/g, "\\'")}',
          '${(perf.season || 'Unknown').replace(/'/g, "\\'")}',
          ${perf.capacity || 1500},
          ${perf.single_tickets_sold || perf.single_ticket_sold || 0},
          ${perf.subscription_tickets_sold || 0},
          ${(perf.single_tickets_sold || perf.single_ticket_sold || 0) + (perf.subscription_tickets_sold || 0)},
          ${perf.total_revenue || 0},
          ${perf.occupancy_goal || 85},
          ${perf.budget_goal || 0},
          ${perf.capacity_percent || 0},
          ${perf.budget_percent || 0},
          ${perf.occupancy_percent || perf.capacity_percent || 0},
          ${perf.has_sales_data !== undefined ? perf.has_sales_data : 'true'},
          CURRENT_TIMESTAMP(),
          CURRENT_TIMESTAMP()
        )
      `;

      await bigquery.query({ query: insertQuery, location: 'US' });
    }

    console.log(`   ✅ Restored ${performances.length} performances\n`);

    // Step 5: Verify restoration
    console.log('5️⃣  Verifying restoration...\n');
    const verifyQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(DISTINCT performance_code) as unique_codes,
        SUM(total_revenue) as revenue,
        MIN(performance_date) as earliest,
        MAX(performance_date) as latest
      FROM \`${DATASET}.performances\`
    `;

    const [verify] = await bigquery.query({ query: verifyQuery, location: 'US' });
    const v = verify[0];

    console.log('📊 RESTORATION COMPLETE:');
    console.log(`   Total Performances: ${v.total}`);
    console.log(`   Unique Codes: ${v.unique_codes}`);
    console.log(`   Date Range: ${v.earliest?.value} to ${v.latest?.value}`);
    console.log(`   Total Revenue: $${v.revenue?.toLocaleString() || 0}`);
    console.log(`   ${v.total === v.unique_codes ? '✅ No duplicates' : '⚠️  Has duplicates'}\n`);

    console.log('✅ DATABASE RESTORED SUCCESSFULLY!');

  } catch (error) {
    console.error('❌ Restoration failed:', error.message);
    throw error;
  }
}

restoreFromSnapshot().catch(console.error);
