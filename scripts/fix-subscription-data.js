/**
 * Fix Historical Subscription Data in BigQuery
 *
 * Problem: subscription_tickets_sold incorrectly included both fixed and non-fixed packages
 * Solution: Recalculate so only fixed packages = subscriptions, non-fixed packages = single tickets
 *
 * This script:
 * 1. Reads all snapshots from BigQuery (performance_sales_snapshots table)
 * 2. Pulls raw PDF data from data_snapshots to get fixed/non-fixed breakdown
 * 3. Recalculates subscription_tickets_sold = fixed_packages_count (only)
 * 4. Recalculates single_tickets_sold = original_single + non_fixed_packages_count
 * 5. Updates the performance_sales_snapshots table with corrected values
 */

require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');

const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GCP_PROJECT_ID;
const bigquery = new BigQuery({
  projectId: projectId,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

const dataset = bigquery.dataset('symphony_dashboard');

async function fixSubscriptionData() {
  console.log('🔧 Starting subscription data fix...\n');
  console.log(`📊 Project: ${projectId}`);
  console.log(`📊 Dataset: symphony_dashboard\n`);

  try {
    // Step 1: Get all data_snapshots with raw PDF data
    console.log('📸 Fetching raw snapshot data with package breakdown...');
    const [rawSnapshots] = await bigquery.query({
      query: `
        SELECT
          snapshot_id,
          snapshot_date,
          source_identifier,
          processed_data
        FROM \`${projectId}.symphony_dashboard.data_snapshots\`
        WHERE processing_status = 'processed'
        ORDER BY snapshot_date DESC
        LIMIT 50
      `,
      location: 'US'
    });

    console.log(`✅ Found ${rawSnapshots.length} raw snapshots\n`);

    if (rawSnapshots.length === 0) {
      console.log('⚠️  No snapshots found in data_snapshots table.');
      console.log('   This script requires raw PDF data to recalculate fixed/non-fixed packages.');
      console.log('   The code fixes have been applied, so future data will be correct.');
      return;
    }

    // Step 2: Parse the JSON data to extract package breakdowns
    console.log('🔍 Extracting package breakdown from raw data...\n');

    const packageBreakdown = new Map();  // performance_code -> { fixed, nonFixed }
    let samplesShown = 0;

    for (const snapshot of rawSnapshots) {
      try {
        const processedData = JSON.parse(snapshot.processed_data);

        if (Array.isArray(processedData)) {
          processedData.forEach(perf => {
            if (perf.performance_code && perf.fixed_packages_count !== undefined) {
              const key = perf.performance_code;
              const fixed = parseInt(perf.fixed_packages_count) || 0;
              const nonFixed = parseInt(perf.non_fixed_packages_count) || 0;

              packageBreakdown.set(key, {  fixed, nonFixed });

              if (samplesShown < 3) {
                console.log(`   ${key}: Fixed=${fixed}, Non-Fixed=${nonFixed}`);
                samplesShown++;
              }
            }
          });
        }
      } catch (err) {
        console.warn(`⚠️  Could not parse snapshot ${snapshot.snapshot_id}:`, err.message);
      }
    }

    console.log(`\n✅ Extracted package data for ${packageBreakdown.size} performances\n`);

    if (packageBreakdown.size === 0) {
      console.log('⚠️  No package breakdown data found in snapshots.');
      console.log('   The code fixes have been applied for future data.');
      return;
    }

    // Step 3: Get all performance sales snapshots that need updating
    console.log('📊 Fetching performance sales snapshots to update...');
    const [snapshots] = await bigquery.query({
      query: `
        SELECT
          snapshot_id,
          performance_code,
          snapshot_date,
          single_tickets_sold,
          subscription_tickets_sold,
          total_tickets_sold
        FROM \`${projectId}.symphony_dashboard.performance_sales_snapshots\`
        WHERE performance_code IN (${Array.from(packageBreakdown.keys()).map(k => `'${k}'`).join(', ')})
        ORDER BY snapshot_date DESC, performance_code
      `,
      location: 'US'
    });

    console.log(`✅ Found ${snapshots.length} snapshots to recalculate\n`);

    // Step 4: Recalculate and prepare updates
    console.log('🔄 Recalculating subscription/single ticket values...\n');

    const updates = [];
    let samplesCalculated = 0;

    for (const snapshot of snapshots) {
      const packages = packageBreakdown.get(snapshot.performance_code);

      if (!packages) {
        continue;  // Skip if we don't have package data
      }

      const oldSubscription = snapshot.subscription_tickets_sold || 0;
      const oldSingle = snapshot.single_tickets_sold || 0;
      const oldTotal = snapshot.total_tickets_sold || (oldSubscription + oldSingle);

      // NEW CALCULATION (CORRECT):
      // subscription = fixed only
      // single = everything else (old single + non-fixed)
      const newSubscription = packages.fixed;
      const newSingle = oldTotal - newSubscription;  // Everything else

      // Validate the math
      if (newSubscription + newSingle !== oldTotal) {
        console.warn(`⚠️  Math error for ${snapshot.performance_code}: old total ${oldTotal} != new total ${newSubscription + newSingle}`);
        continue;
      }

      updates.push({
        snapshot_id: snapshot.snapshot_id,
        performance_code: snapshot.performance_code,
        snapshot_date: snapshot.snapshot_date,
        old_subscription: oldSubscription,
        old_single: oldSingle,
        new_subscription: newSubscription,
        new_single: newSingle,
        fixed: packages.fixed,
        nonFixed: packages.nonFixed
      });

      // Log sample changes
      if (samplesCalculated < 5 && oldSubscription !== newSubscription) {
        console.log(`${snapshot.performance_code} (${snapshot.snapshot_date}):`);
        console.log(`  OLD: ${oldSingle} single + ${oldSubscription} subscription = ${oldTotal} total`);
        console.log(`  NEW: ${newSingle} single + ${newSubscription} subscription = ${newSubscription + newSingle} total`);
        console.log(`  Package breakdown: ${packages.fixed} fixed, ${packages.nonFixed} non-fixed\n`);
        samplesCalculated++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Total snapshots: ${snapshots.length}`);
    console.log(`   Will update: ${updates.length}`);
    console.log(`   Skipped (no package data): ${snapshots.length - updates.length}\n`);

    if (updates.length === 0) {
      console.log('✅ No updates needed!');
      return;
    }

    // Step 5: Execute updates in batches
    console.log('💾 Updating BigQuery performance_sales_snapshots table...\n');

    const batchSize = 100;
    let totalUpdated = 0;

    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);

      // Build batch UPDATE query
      for (const update of batch) {
        const updateQuery = `
          UPDATE \`${projectId}.symphony_dashboard.performance_sales_snapshots\`
          SET
            subscription_tickets_sold = ${update.new_subscription},
            single_tickets_sold = ${update.new_single},
            total_tickets_sold = ${update.new_subscription + update.new_single}
          WHERE snapshot_id = '${update.snapshot_id}'
        `;

        await bigquery.query({ query: updateQuery, location: 'US' });
        totalUpdated++;
      }

      console.log(`   Updated ${Math.min(i + batchSize, updates.length)}/${updates.length} snapshots...`);
    }

    console.log(`\n✅ Successfully updated ${totalUpdated} snapshots!`);
    console.log('\n🎉 Subscription data fix complete!');

    // Step 6: Verification query
    console.log('\n🔍 Running verification query...\n');
    const [verification] = await bigquery.query({
      query: `
        SELECT
          COUNT(*) as total_snapshots,
          SUM(single_tickets_sold) as total_single,
          SUM(subscription_tickets_sold) as total_subscription,
          AVG(subscription_tickets_sold * 100.0 / NULLIF(single_tickets_sold + subscription_tickets_sold, 0)) as avg_subscription_pct
        FROM \`${projectId}.symphony_dashboard.performance_sales_snapshots\`
      `,
      location: 'US'
    });

    console.log('📊 After fix:');
    console.log(`   Total snapshots: ${verification[0].total_snapshots}`);
    console.log(`   Total single tickets: ${Math.round(verification[0].total_single)}`);
    console.log(`   Total subscription tickets: ${Math.round(verification[0].total_subscription)}`);
    console.log(`   Average subscription %: ${verification[0].avg_subscription_pct?.toFixed(1)}%`);

  } catch (error) {
    console.error('❌ Error fixing subscription data:', error);
    throw error;
  }
}

// Run the fix
fixSubscriptionData()
  .then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
