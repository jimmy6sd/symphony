/**
 * Complete Schema Migration - Add Remaining Columns
 *
 * Adds remaining columns that were missed or rate-limited in initial migration
 */

const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

const CONFIG = {
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony',
  dataset: 'symphony_dashboard',
  table: 'performance_sales_snapshots'
};

// Remaining columns to add
const REMAINING_COLUMNS = [
  {
    name: 'performance_time',
    type: 'STRING',
    description: 'Performance time (e.g., "7:30 PM", "2:00 PM")'
  },
  {
    name: 'fixed_tickets_sold',
    type: 'INT64',
    description: 'Fixed package tickets (subscriptions)'
  },
  {
    name: 'reserved_tickets',
    type: 'INT64',
    description: 'Reserved/comp tickets'
  },
  {
    name: 'fixed_revenue',
    type: 'FLOAT64',
    description: 'Revenue from fixed packages (subscriptions)'
  },
  {
    name: 'available_seats',
    type: 'INT64',
    description: 'Remaining available seats at snapshot time'
  },
  {
    name: 'fixed_atp',
    type: 'FLOAT64',
    description: 'Average ticket price for fixed packages: fixed_revenue / fixed_tickets_sold'
  },
  {
    name: 'non_fixed_atp',
    type: 'FLOAT64',
    description: 'Average ticket price for non-fixed packages: non_fixed_revenue / non_fixed_tickets_sold'
  },
  {
    name: 'single_atp',
    type: 'FLOAT64',
    description: 'Average ticket price for single tickets: single_revenue / single_tickets_sold'
  },
  {
    name: 'overall_atp',
    type: 'FLOAT64',
    description: 'Overall average ticket price: total_revenue / total_tickets_sold'
  }
];

// Sleep helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function completeSchemas() {
  console.log('🔧 Completing Schema Migration');
  console.log('━'.repeat(80));
  console.log(`Project: ${CONFIG.projectId}`);
  console.log(`Table: ${CONFIG.dataset}.${CONFIG.table}`);
  console.log(`Columns to add: ${REMAINING_COLUMNS.length}`);
  console.log('━'.repeat(80));
  console.log('');

  const bigquery = new BigQuery({
    projectId: CONFIG.projectId,
    location: 'US'
  });

  let added = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < REMAINING_COLUMNS.length; i++) {
    const col = REMAINING_COLUMNS[i];

    console.log(`[${i + 1}/${REMAINING_COLUMNS.length}] Adding ${col.name} (${col.type})...`);

    try {
      const query = `
        ALTER TABLE \`${CONFIG.projectId}.${CONFIG.dataset}.${CONFIG.table}\`
        ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
        OPTIONS(description="${col.description}")
      `;

      const [job] = await bigquery.createQueryJob({
        query,
        location: 'US',
        useLegacySql: false
      });

      await job.getQueryResults();

      console.log(`   ✅ Added successfully`);
      added++;

      // Wait 10 seconds between operations to avoid rate limits
      if (i < REMAINING_COLUMNS.length - 1) {
        console.log(`   ⏳ Waiting 10 seconds to avoid rate limits...`);
        await sleep(10000);
      }

    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log(`   ℹ️  Already exists (skipped)`);
        skipped++;
      } else if (error.message.includes('rate limit')) {
        console.log(`   ⚠️  Rate limit hit - waiting 30 seconds...`);
        await sleep(30000);
        i--; // Retry this column
      } else {
        console.log(`   ❌ Error: ${error.message}`);
        failed++;
      }
    }
  }

  console.log('\n' + '━'.repeat(80));
  console.log('📊 Summary:');
  console.log(`   ✅ Added: ${added}`);
  console.log(`   ℹ️  Skipped (already exist): ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log('━'.repeat(80));

  if (failed === 0) {
    console.log('\n🎉 Schema migration complete!');
  } else {
    console.log('\n⚠️  Some columns failed to add. Review errors above.');
  }
}

completeSchemas().catch(error => {
  console.error('\n❌ Migration failed:', error.message);
  process.exit(1);
});
