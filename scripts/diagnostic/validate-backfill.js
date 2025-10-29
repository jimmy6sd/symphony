/**
 * Validate Historical Backfill
 *
 * This script validates the historical data backfill by:
 * 1. Querying BigQuery for all imported snapshots
 * 2. Analyzing date coverage and gaps
 * 3. Checking snapshot counts per performance
 * 4. Identifying any anomalies or issues
 */

const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

// Initialize BigQuery
const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony',
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

const DATASET_ID = process.env.BIGQUERY_DATASET || 'symphony_dashboard';
const TABLE_ID = 'performance_sales_snapshots';

async function validateBackfill() {
  console.log('═'.repeat(80));
  console.log('📊 Historical Backfill Validation');
  console.log('═'.repeat(80));
  console.log('');

  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony';

  // 1. Get total snapshot count
  console.log('📈 Querying snapshot statistics...\n');

  const totalCountQuery = `
    SELECT
      COUNT(*) as total_snapshots,
      COUNT(DISTINCT snapshot_date) as unique_dates,
      COUNT(DISTINCT performance_code) as unique_performances,
      MIN(snapshot_date) as earliest_date,
      MAX(snapshot_date) as latest_date,
      COUNT(DISTINCT CASE WHEN source = 'historical_pdf_import' THEN snapshot_id END) as historical_count,
      COUNT(DISTINCT CASE WHEN source = 'webhook' THEN snapshot_id END) as webhook_count
    FROM \`${projectId}.${DATASET_ID}.${TABLE_ID}\`
  `;

  const [totalResults] = await bigquery.query({ query: totalCountQuery, location: 'US' });
  const stats = totalResults[0];

  console.log('📊 OVERALL STATISTICS');
  console.log('═'.repeat(80));
  console.log(`   Total snapshots: ${stats.total_snapshots.toLocaleString()}`);
  console.log(`   Historical imports: ${stats.historical_count.toLocaleString()}`);
  console.log(`   Webhook imports: ${stats.webhook_count.toLocaleString()}`);
  console.log(`   Unique dates: ${stats.unique_dates}`);
  console.log(`   Unique performances: ${stats.unique_performances}`);
  console.log(`   Date range: ${stats.earliest_date.value} to ${stats.latest_date.value}`);
  console.log('');

  // 2. Get snapshots by date
  const byDateQuery = `
    SELECT
      snapshot_date,
      COUNT(*) as snapshot_count,
      COUNT(DISTINCT performance_code) as performance_count
    FROM \`${projectId}.${DATASET_ID}.${TABLE_ID}\`
    WHERE source = 'historical_pdf_import'
    GROUP BY snapshot_date
    ORDER BY snapshot_date
  `;

  const [dateResults] = await bigquery.query({ query: byDateQuery, location: 'US' });

  console.log('📅 SNAPSHOTS BY DATE (Historical imports only)');
  console.log('═'.repeat(80));

  if (dateResults.length === 0) {
    console.log('   ⚠️  No historical imports found');
  } else {
    dateResults.forEach(row => {
      console.log(`   ${row.snapshot_date.value}: ${row.snapshot_count} snapshots, ${row.performance_count} performances`);
    });
  }
  console.log('');

  // 3. Check for date gaps
  let gaps = [];
  if (dateResults.length > 1) {
    console.log('🔍 CHECKING FOR DATE GAPS');
    console.log('═'.repeat(80));

    const dates = dateResults.map(r => r.snapshot_date.value);

    for (let i = 1; i < dates.length; i++) {
      const prevDate = new Date(dates[i - 1]);
      const currDate = new Date(dates[i]);
      const diffDays = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));

      if (diffDays > 1) {
        gaps.push({
          from: dates[i - 1],
          to: dates[i],
          days: diffDays
        });
      }
    }

    if (gaps.length === 0) {
      console.log('   ✅ No gaps found - continuous daily coverage');
    } else {
      console.log(`   ⚠️  Found ${gaps.length} gap(s):`);
      gaps.forEach(gap => {
        console.log(`      ${gap.from} to ${gap.to} (${gap.days} days)`);
      });
    }
    console.log('');
  }

  // 4. Get top performances by snapshot count
  const topPerformancesQuery = `
    SELECT
      performance_code,
      COUNT(*) as snapshot_count,
      MIN(snapshot_date) as first_snapshot,
      MAX(snapshot_date) as last_snapshot,
      MAX(total_tickets_sold) as max_tickets,
      MAX(total_revenue) as max_revenue
    FROM \`${projectId}.${DATASET_ID}.${TABLE_ID}\`
    WHERE source = 'historical_pdf_import'
    GROUP BY performance_code
    ORDER BY snapshot_count DESC
    LIMIT 10
  `;

  const [perfResults] = await bigquery.query({ query: topPerformancesQuery, location: 'US' });

  console.log('🎭 TOP PERFORMANCES BY SNAPSHOT COUNT');
  console.log('═'.repeat(80));
  perfResults.forEach(row => {
    const dateRange = `${row.first_snapshot.value} to ${row.last_snapshot.value}`;
    console.log(`   ${row.performance_code}: ${row.snapshot_count} snapshots (${dateRange})`);
    console.log(`      Max tickets: ${row.max_tickets}, Max revenue: $${row.max_revenue.toFixed(2)}`);
  });
  console.log('');

  // 5. Check for anomalies
  console.log('🔍 CHECKING FOR ANOMALIES');
  console.log('═'.repeat(80));

  const anomaliesQuery = `
    SELECT
      performance_code,
      COUNT(*) as snapshot_count
    FROM \`${projectId}.${DATASET_ID}.${TABLE_ID}\`
    WHERE source = 'historical_pdf_import'
    GROUP BY performance_code
    HAVING snapshot_count < 5 OR snapshot_count > 50
    ORDER BY snapshot_count DESC
  `;

  const [anomalyResults] = await bigquery.query({ query: anomaliesQuery, location: 'US' });

  if (anomalyResults.length === 0) {
    console.log('   ✅ No anomalies detected - all performances have reasonable snapshot counts');
  } else {
    console.log(`   ⚠️  Found ${anomalyResults.length} performance(s) with unusual snapshot counts:`);
    anomalyResults.forEach(row => {
      const status = row.snapshot_count < 5 ? 'too few' : 'too many';
      console.log(`      ${row.performance_code}: ${row.snapshot_count} snapshots (${status})`);
    });
  }
  console.log('');

  // 6. Summary and recommendations
  console.log('═'.repeat(80));
  console.log('📋 VALIDATION SUMMARY');
  console.log('═'.repeat(80));

  const isValid = dateResults.length > 0 && gaps.length === 0 && anomalyResults.length < 10;

  if (isValid) {
    console.log('   ✅ Backfill looks good!');
    console.log('');
    console.log('🎯 Next steps:');
    console.log('   1. Update performance modal to display historical sales curves');
    console.log('   2. Build D3 visualizations for time-series data');
    console.log('   3. Implement trend analysis and predictions');
  } else {
    console.log('   ⚠️  Some issues detected (see above)');
    console.log('');
    console.log('🔧 Recommendations:');
    if (dateResults.length === 0) {
      console.log('   - Run backfill: npm run backfill-historical');
    }
    if (gaps.length > 0) {
      console.log('   - Check for missing PDFs in GCS bucket');
      console.log('   - Re-run backfill for missing date ranges');
    }
    if (anomalyResults.length >= 10) {
      console.log('   - Review performance codes with unusual snapshot counts');
      console.log('   - Check PDF parsing logic for accuracy');
    }
  }

  console.log('');
}

// Run validation
if (require.main === module) {
  validateBackfill()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Validation error:', error);
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = { validateBackfill };
