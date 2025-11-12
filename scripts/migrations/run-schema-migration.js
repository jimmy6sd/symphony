/**
 * BigQuery Schema Migration Runner
 *
 * Safely executes the schema migration to add granular revenue fields.
 *
 * USAGE:
 *   node scripts/migrations/run-schema-migration.js [--dry-run]
 *
 * OPTIONS:
 *   --dry-run    Show migration SQL without executing
 */

const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const DRY_RUN = process.argv.includes('--dry-run');

// Configuration
const CONFIG = {
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony',
  dataset: 'symphony_dashboard',
  table: 'performance_sales_snapshots'
};

async function runMigration() {
  console.log('🔧 BigQuery Schema Migration');
  console.log('━'.repeat(80));
  console.log(`Project: ${CONFIG.projectId}`);
  console.log(`Table: ${CONFIG.dataset}.${CONFIG.table}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE EXECUTION'}`);
  console.log('━'.repeat(80));
  console.log('');

  // Read migration SQL file
  const sqlPath = path.join(__dirname, 'add-granular-revenue-fields.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf8');

  // Extract ALTER TABLE statements (skip comments and empty lines)
  const statements = sqlContent
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt && stmt.startsWith('ALTER TABLE'));

  console.log(`📋 Found ${statements.length} ALTER TABLE statements\n`);

  if (DRY_RUN) {
    console.log('🔍 DRY RUN - Statements to be executed:\n');
    statements.forEach((stmt, idx) => {
      // Extract column name
      const colMatch = stmt.match(/ADD COLUMN IF NOT EXISTS (\w+)/);
      const colName = colMatch ? colMatch[1] : 'unknown';
      console.log(`${idx + 1}. ADD COLUMN: ${colName}`);
    });
    console.log('\n✅ Dry run complete. Run without --dry-run to execute migration.');
    return;
  }

  // Initialize BigQuery client
  const bigquery = new BigQuery({
    projectId: CONFIG.projectId,
    location: 'US'
  });

  console.log('🚀 Starting migration...\n');

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';';

    // Extract column name for logging
    const colMatch = statement.match(/ADD COLUMN IF NOT EXISTS (\w+)/);
    const colName = colMatch ? colMatch[1] : 'unknown';

    try {
      console.log(`[${i + 1}/${statements.length}] Adding column: ${colName}...`);

      const [job] = await bigquery.createQueryJob({
        query: statement,
        location: 'US',
        useLegacySql: false
      });

      await job.getQueryResults();

      console.log(`   ✅ Success`);
      successCount++;
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log(`   ℹ️  Column already exists (skipped)`);
        successCount++;
      } else {
        console.error(`   ❌ Error: ${error.message}`);
        errorCount++;
      }
    }
  }

  console.log('\n' + '━'.repeat(80));
  console.log('📊 Migration Summary:');
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log('━'.repeat(80));

  if (errorCount === 0) {
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Verify schema with verification query');
    console.log('   2. Deploy updated Cloud Function');
    console.log('   3. Update reimport script');
    console.log('   4. Run historical data reimport');

    console.log('\n🔍 Verification query:');
    console.log('bq query --use_legacy_sql=false "');
    console.log('SELECT column_name, data_type, description');
    console.log(`FROM \`${CONFIG.projectId}.${CONFIG.dataset}.INFORMATION_SCHEMA.COLUMNS\``);
    console.log(`WHERE table_name = '${CONFIG.table}'`);
    console.log('  AND column_name IN (');
    console.log("    'performance_time',");
    console.log("    'fixed_tickets_sold', 'non_fixed_tickets_sold', 'reserved_tickets',");
    console.log("    'fixed_revenue', 'non_fixed_revenue', 'single_revenue', 'reserved_revenue', 'subtotal_revenue',");
    console.log("    'available_seats',");
    console.log("    'fixed_atp', 'non_fixed_atp', 'single_atp', 'overall_atp'");
    console.log('  )');
    console.log('ORDER BY ordinal_position"');
  } else {
    console.log('\n⚠️  Migration completed with errors. Please review the errors above.');
    process.exit(1);
  }
}

// Run migration
runMigration().catch(error => {
  console.error('\n❌ Migration failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});
