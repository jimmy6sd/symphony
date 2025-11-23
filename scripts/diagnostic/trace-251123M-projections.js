/**
 * Trace Projection Calculations for Performance 251123M
 *
 * This script retrieves real data from BigQuery and walks through
 * the projection calculation logic step-by-step with actual numbers.
 */

const { BigQuery } = require('@google/cloud-bigquery');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Initialize BigQuery
const initializeBigQuery = () => {
  const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  let credentials;

  if (credentialsEnv.startsWith('{')) {
    credentials = JSON.parse(credentialsEnv);
  } else {
    const credentialsFile = path.resolve(credentialsEnv);
    credentials = JSON.parse(fs.readFileSync(credentialsFile, 'utf8'));
  }

  if (credentials.private_key?.includes('\\\\n')) {
    credentials.private_key = credentials.private_key.replace(/\\\\n/g, '\n');
  }

  return new BigQuery({
    projectId: 'kcsymphony',
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
    location: 'US'
  });
};

async function traceProjections() {
  console.log('=' .repeat(80));
  console.log('PROJECTION CALCULATION TRACE FOR PERFORMANCE 251123M');
  console.log('=' .repeat(80));
  console.log();

  const bigquery = initializeBigQuery();

  // 1. Get performance 251123M with all snapshots
  console.log('STEP 1: Retrieving Performance 251123M Data');
  console.log('-'.repeat(80));

  const perfQuery = `
    SELECT
      p.performance_id,
      p.performance_code,
      p.title,
      p.series,
      p.performance_date,
      p.venue,
      p.capacity,
      p.occupancy_goal,
      p.budget_goal,
      p.single_budget_goal,
      p.subscription_budget_goal,
      p.target_comparison_performance_id,
      p.created_at,
      p.updated_at
    FROM \`kcsymphony.symphony_dashboard.performances\` p
    WHERE p.performance_code = '251123M'
  `;

  const [perfRows] = await bigquery.query({ query: perfQuery });

  if (perfRows.length === 0) {
    console.log('❌ Performance 251123M not found!');
    return;
  }

  const performance = perfRows[0];
  console.log('Performance Details:');
  console.log(JSON.stringify(performance, null, 2));
  console.log();

  // 2. Get all snapshots for 251123M
  console.log('STEP 2: Retrieving All Snapshots for 251123M');
  console.log('-'.repeat(80));

  const snapshotsQuery = `
    SELECT
      snapshot_id,
      performance_code,
      snapshot_date,
      single_tickets_sold,
      fixed_tickets_sold,
      non_fixed_tickets_sold,
      total_tickets_sold,
      single_revenue,
      fixed_revenue,
      non_fixed_revenue,
      total_revenue,
      capacity_percent,
      budget_percent,
      single_atp,
      overall_atp,
      fixed_atp,
      non_fixed_atp,
      paid_attendance,
      comp_count,
      source,
      created_at
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    WHERE performance_code = '251123M'
    ORDER BY snapshot_date ASC
  `;

  const [snapshots] = await bigquery.query({ query: snapshotsQuery });

  console.log(`Found ${snapshots.length} snapshots:`);
  snapshots.forEach((snap, idx) => {
    console.log(`\nSnapshot ${idx + 1}:`);
    console.log(`  Date: ${snap.snapshot_date.value}`);
    console.log(`  Single Tickets Sold: ${snap.single_tickets_sold}`);
    console.log(`  Fixed Tickets Sold: ${snap.fixed_tickets_sold}`);
    console.log(`  Total Tickets Sold: ${snap.total_tickets_sold}`);
    console.log(`  Single Revenue: $${snap.single_revenue}`);
    console.log(`  Total Revenue: $${snap.total_revenue}`);
    console.log(`  Single ATP: $${snap.single_atp}`);
    console.log(`  Capacity %: ${snap.capacity_percent}%`);
    console.log(`  Budget %: ${snap.budget_percent}%`);
  });
  console.log();

  // 3. Get target comparison performance data
  const targetCompId = performance.target_comparison_performance_id;

  if (targetCompId) {
    console.log('STEP 3: Retrieving Target Comparison Performance Data');
    console.log('-'.repeat(80));
    console.log(`Target Comparison Performance ID: ${targetCompId}`);
    console.log();

    const targetPerfQuery = `
      SELECT
        p.performance_id,
        p.performance_code,
        p.title,
        p.series,
        p.performance_date,
        p.capacity
      FROM \`kcsymphony.symphony_dashboard.performances\` p
      WHERE p.performance_id = ${targetCompId}
    `;

    const [targetPerfRows] = await bigquery.query({ query: targetPerfQuery });

    if (targetPerfRows.length > 0) {
      const targetPerf = targetPerfRows[0];
      console.log('Target Performance Details:');
      console.log(JSON.stringify(targetPerf, null, 2));
      console.log();

      // Get target performance snapshots
      const targetSnapshotsQuery = `
        SELECT
          snapshot_date,
          single_tickets_sold,
          fixed_tickets_sold,
          total_tickets_sold,
          single_revenue,
          total_revenue,
          single_atp,
          capacity_percent,
          budget_percent
        FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
        WHERE performance_code = '${targetPerf.performance_code}'
        ORDER BY snapshot_date ASC
      `;

      const [targetSnapshots] = await bigquery.query({ query: targetSnapshotsQuery });

      console.log(`Found ${targetSnapshots.length} snapshots for target comp:`);
      targetSnapshots.forEach((snap, idx) => {
        console.log(`\nTarget Snapshot ${idx + 1}:`);
        console.log(`  Date: ${snap.snapshot_date.value}`);
        console.log(`  Single Tickets Sold: ${snap.single_tickets_sold}`);
        console.log(`  Total Tickets Sold: ${snap.total_tickets_sold}`);
        console.log(`  Single Revenue: $${snap.single_revenue}`);
      });
      console.log();
    }
  } else {
    console.log('STEP 3: No Target Comparison Performance Set');
    console.log('-'.repeat(80));
    console.log('⚠️ Performance 251123M does not have a target_comparison_performance_id set');
    console.log();
  }

  // 4. Get user-created comparisons from performance_comparisons table
  console.log('STEP 4: Retrieving User-Created Comparisons');
  console.log('-'.repeat(80));

  const compsQuery = `
    SELECT
      comparison_id,
      performance_code,
      comparison_name,
      comparison_performance_code,
      line_color,
      line_style,
      is_target,
      created_at
    FROM \`kcsymphony.symphony_dashboard.performance_comparisons\`
    WHERE performance_code = '251123M'
    ORDER BY created_at ASC
  `;

  const [comparisons] = await bigquery.query({ query: compsQuery });

  if (comparisons.length > 0) {
    console.log(`Found ${comparisons.length} user-created comparison(s):`);

    for (const comp of comparisons) {
      console.log(`\nComparison: ${comp.comparison_name}`);
      console.log(`  Comparison Performance Code: ${comp.comparison_performance_code}`);
      console.log(`  Line Color: ${comp.line_color}`);
      console.log(`  Line Style: ${comp.line_style}`);
      console.log(`  Is Target: ${comp.is_target}`);
      console.log(`  Created: ${comp.created_at.value}`);

      // Get snapshots for this comparison performance
      const compSnapshotsQuery = `
        SELECT
          snapshot_date,
          single_tickets_sold,
          total_tickets_sold,
          single_revenue,
          total_revenue
        FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
        WHERE performance_code = '${comp.comparison_performance_code}'
        ORDER BY snapshot_date ASC
      `;

      const [compSnapshots] = await bigquery.query({ query: compSnapshotsQuery });

      console.log(`  Snapshots: ${compSnapshots.length}`);
      compSnapshots.forEach((snap, idx) => {
        console.log(`    Week ${idx + 1}: ${snap.snapshot_date.value} - ${snap.single_tickets_sold} single tickets`);
      });
    }
    console.log();
  } else {
    console.log('No user-created comparisons found for 251123M');
    console.log();
  }

  // 5. Calculate projection using the formula from sales-projections.js
  console.log('STEP 5: Calculate Projection Using Real Data');
  console.log('-'.repeat(80));

  const latestSnapshot = snapshots[snapshots.length - 1];
  const currentSingleTickets = latestSnapshot.single_tickets_sold;
  const subscriptionTickets = latestSnapshot.fixed_tickets_sold;
  const capacity = performance.capacity;
  const availableSingleCapacity = capacity - subscriptionTickets;

  console.log('Current State:');
  console.log(`  Latest Snapshot Date: ${latestSnapshot.snapshot_date.value}`);
  console.log(`  Current Single Tickets Sold: ${currentSingleTickets}`);
  console.log(`  Subscription Tickets Sold: ${subscriptionTickets}`);
  console.log(`  Total Capacity: ${capacity}`);
  console.log(`  Available Single Capacity: ${availableSingleCapacity}`);
  console.log();

  // Calculate weeks until performance
  const today = new Date();
  const perfDate = new Date(performance.performance_date.value);
  const daysUntil = Math.ceil((perfDate - today) / (1000 * 60 * 60 * 24));
  const exactWeeksUntil = Math.max(0, daysUntil / 7);

  console.log('Time Calculation:');
  console.log(`  Performance Date: ${performance.performance_date.value}`);
  console.log(`  Today: ${today.toISOString().split('T')[0]}`);
  console.log(`  Days Until Performance: ${daysUntil}`);
  console.log(`  Exact Weeks Until Performance: ${exactWeeksUntil.toFixed(2)}`);
  console.log();

  // If we have a target comparison with is_target=true, calculate comp-based projection
  const targetComp = comparisons.find(c => c.is_target);

  if (targetComp) {
    console.log('PROJECTION METHOD: Comp-Based (using target comparison)');
    console.log('-'.repeat(80));

    // Get target comp snapshots
    const compSnapshotsQuery = `
      SELECT
        snapshot_date,
        single_tickets_sold
      FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
      WHERE performance_code = '${targetComp.comparison_performance_code}'
      ORDER BY snapshot_date ASC
    `;

    const [compSnapshots] = await bigquery.query({ query: compSnapshotsQuery });
    const weeksArray = compSnapshots.map(s => s.single_tickets_sold);
    const numWeeks = weeksArray.length;

    console.log(`Target Comp: ${targetComp.comparison_name}`);
    console.log(`Target Comp Performance Code: ${targetComp.comparison_performance_code}`);
    console.log(`Target Comp Weeks of Data: ${numWeeks}`);
    console.log(`Target Comp Sales Progression: [${weeksArray.join(', ')}]`);
    console.log();

    // Calculate interpolated target comp value at current week
    const lowerWeek = Math.floor(exactWeeksUntil);
    const upperWeek = Math.ceil(exactWeeksUntil);
    const lowerWeekIndex = numWeeks - 1 - lowerWeek;
    const upperWeekIndex = numWeeks - 1 - upperWeek;

    console.log('Interpolation Calculation:');
    console.log(`  Exact Weeks Until: ${exactWeeksUntil.toFixed(2)}`);
    console.log(`  Lower Week: ${lowerWeek}, Index: ${lowerWeekIndex}`);
    console.log(`  Upper Week: ${upperWeek}, Index: ${upperWeekIndex}`);

    if (lowerWeekIndex < 0 || upperWeekIndex >= numWeeks) {
      console.log(`  ⚠️ Week out of range! Cannot calculate projection.`);
      console.log(`  Need index between 0 and ${numWeeks - 1}, got ${lowerWeekIndex} to ${upperWeekIndex}`);
    } else {
      let targetCompCurrent;
      if (lowerWeek === upperWeek) {
        targetCompCurrent = weeksArray[lowerWeekIndex];
        console.log(`  Exact integer week - using direct value: ${targetCompCurrent}`);
      } else {
        const lowerValue = weeksArray[lowerWeekIndex];
        const upperValue = weeksArray[upperWeekIndex];
        const fraction = exactWeeksUntil - lowerWeek;
        targetCompCurrent = lowerValue + (upperValue - lowerValue) * fraction;
        console.log(`  Lower Value (week ${lowerWeek}): ${lowerValue}`);
        console.log(`  Upper Value (week ${upperWeek}): ${upperValue}`);
        console.log(`  Fraction: ${fraction.toFixed(4)}`);
        console.log(`  Interpolated Target Comp Current: ${targetCompCurrent.toFixed(2)}`);
      }

      const targetCompFinal = weeksArray[numWeeks - 1];
      const variance = currentSingleTickets - targetCompCurrent;
      let projectionValue = targetCompFinal + variance;

      // Cap at available single capacity
      if (availableSingleCapacity > 0) {
        projectionValue = Math.min(projectionValue, availableSingleCapacity);
      }

      const projected = Math.round(projectionValue);

      console.log();
      console.log('PROJECTION CALCULATION:');
      console.log(`  Target Comp Current (at ${exactWeeksUntil.toFixed(2)} weeks): ${Math.round(targetCompCurrent)}`);
      console.log(`  Target Comp Final (week 0): ${targetCompFinal}`);
      console.log(`  Current Single Tickets: ${currentSingleTickets}`);
      console.log(`  Variance: ${currentSingleTickets} - ${Math.round(targetCompCurrent)} = ${Math.round(variance)}`);
      console.log(`  Projection Formula: ${targetCompFinal} + ${Math.round(variance)} = ${Math.round(projectionValue)}`);
      console.log(`  Capped at Available Single Capacity: ${availableSingleCapacity}`);
      console.log(`  FINAL PROJECTED SINGLE TICKETS: ${projected}`);
      console.log();

      // Calculate projected revenue
      const currentSingleATP = latestSnapshot.single_atp || 0;
      const projectedRevenue = Math.round(projected * currentSingleATP);

      console.log('PROJECTED REVENUE:');
      console.log(`  Current Single ATP: $${currentSingleATP.toFixed(2)}`);
      console.log(`  Projected Single Tickets: ${projected}`);
      console.log(`  PROJECTED SINGLE REVENUE: $${projectedRevenue.toLocaleString()}`);
    }
  } else {
    console.log('PROJECTION METHOD: Pacing-Based (no target comp set)');
    console.log('-'.repeat(80));
    console.log('⚠️ No target comparison marked with is_target=true');
    console.log('Would use standard pacing table for projection');
  }

  console.log();
  console.log('=' .repeat(80));
  console.log('TRACE COMPLETE');
  console.log('=' .repeat(80));
}

// Run the trace
if (require.main === module) {
  traceProjections()
    .then(() => {
      console.log('\n✅ Trace complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Trace failed:', error.message);
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = { traceProjections };
