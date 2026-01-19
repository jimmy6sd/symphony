// Query ytd_weekly_totals table to explore data
// Shows fiscal years, date ranges, and sample data

const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');
const fs = require('fs');

// Initialize BigQuery
const initializeBigQuery = () => {
  const credentialsPath = path.join(__dirname, '../../symphony-bigquery-key.json');

  if (!fs.existsSync(credentialsPath)) {
    throw new Error(`Credentials file not found at: ${credentialsPath}`);
  }

  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

  if (credentials.private_key && credentials.private_key.includes('\\\\n')) {
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

async function queryYTDWeeklyTotals() {
  console.log('🔍 Querying ytd_weekly_totals table...\n');

  const bigquery = initializeBigQuery();
  const projectId = 'kcsymphony';
  const datasetId = 'symphony_dashboard';

  // Query 1: Count total rows
  console.log('📊 TOTAL ROWS:');
  const countQuery = `
    SELECT COUNT(*) as total_rows
    FROM \`${projectId}.${datasetId}.ytd_weekly_totals\`
  `;

  const [countRows] = await bigquery.query({ query: countQuery, location: 'US' });
  console.log(`Total rows: ${countRows[0].total_rows}`);
  console.log('');

  // Query 2: Get fiscal years and their date ranges
  console.log('📅 FISCAL YEARS AND DATE RANGES:');
  const yearsQuery = `
    SELECT
      fiscal_year,
      MIN(week_end_date) as first_week_end,
      MAX(week_end_date) as last_week_end,
      COUNT(*) as week_count
    FROM \`${projectId}.${datasetId}.ytd_weekly_totals\`
    GROUP BY fiscal_year
    ORDER BY fiscal_year
  `;

  const [yearRows] = await bigquery.query({ query: yearsQuery, location: 'US' });

  yearRows.forEach(row => {
    const firstDate = typeof row.first_week_end === 'object' ? row.first_week_end.value : row.first_week_end;
    const lastDate = typeof row.last_week_end === 'object' ? row.last_week_end.value : row.last_week_end;

    console.log(`${row.fiscal_year}:`);
    console.log(`  Date range: ${firstDate} to ${lastDate}`);
    console.log(`  Weeks: ${row.week_count}`);
    console.log('');
  });

  // Query 3: Get sample rows for each fiscal year
  console.log('📋 SAMPLE DATA (First 2 weeks of each fiscal year):');
  const sampleQuery = `
    WITH RankedWeeks AS (
      SELECT
        fiscal_year,
        fiscal_week,
        iso_week,
        week_end_date,
        ytd_tickets_sold,
        ytd_single_tickets,
        ytd_subscription_tickets,
        ytd_revenue,
        performance_count,
        ROW_NUMBER() OVER (PARTITION BY fiscal_year ORDER BY fiscal_week) as rn
      FROM \`${projectId}.${datasetId}.ytd_weekly_totals\`
    )
    SELECT *
    FROM RankedWeeks
    WHERE rn <= 2
    ORDER BY fiscal_year, fiscal_week
  `;

  const [sampleRows] = await bigquery.query({ query: sampleQuery, location: 'US' });

  let currentFY = null;
  sampleRows.forEach(row => {
    if (currentFY !== row.fiscal_year) {
      if (currentFY !== null) console.log('');
      console.log(`\n${row.fiscal_year}:`);
      currentFY = row.fiscal_year;
    }

    const weekEnd = typeof row.week_end_date === 'object' ? row.week_end_date.value : row.week_end_date;

    console.log(`  Week ${row.fiscal_week} (ISO: ${row.iso_week}) | End: ${weekEnd}`);
    console.log(`    YTD Tickets: ${row.ytd_tickets_sold || 0} (Single: ${row.ytd_single_tickets || 0}, Sub: ${row.ytd_subscription_tickets || 0})`);
    console.log(`    YTD Revenue: $${(row.ytd_revenue || 0).toLocaleString()}`);
    console.log(`    Performances: ${row.performance_count || 0}`);
  });

  // Query 4: Get most recent week for each fiscal year
  console.log('\n\n📈 LATEST YTD TOTALS (Most recent week for each fiscal year):');
  const latestQuery = `
    WITH LatestWeeks AS (
      SELECT
        fiscal_year,
        fiscal_week,
        iso_week,
        week_end_date,
        ytd_tickets_sold,
        ytd_single_tickets,
        ytd_subscription_tickets,
        ytd_revenue,
        performance_count,
        ROW_NUMBER() OVER (PARTITION BY fiscal_year ORDER BY fiscal_week DESC) as rn
      FROM \`${projectId}.${datasetId}.ytd_weekly_totals\`
    )
    SELECT *
    FROM LatestWeeks
    WHERE rn = 1
    ORDER BY fiscal_year
  `;

  const [latestRows] = await bigquery.query({ query: latestQuery, location: 'US' });

  latestRows.forEach(row => {
    const weekEnd = typeof row.week_end_date === 'object' ? row.week_end_date.value : row.week_end_date;

    console.log(`\n${row.fiscal_year} (through Week ${row.fiscal_week} ending ${weekEnd}):`);
    console.log(`  YTD Tickets Sold: ${(row.ytd_tickets_sold || 0).toLocaleString()}`);
    console.log(`    - Single: ${(row.ytd_single_tickets || 0).toLocaleString()}`);
    console.log(`    - Subscription: ${(row.ytd_subscription_tickets || 0).toLocaleString()}`);
    console.log(`  YTD Revenue: $${(row.ytd_revenue || 0).toLocaleString()}`);
    console.log(`  Total Performances: ${row.performance_count || 0}`);
  });

  // Query 5: Check for data quality issues
  console.log('\n\n🔍 DATA QUALITY CHECK:');
  const qualityQuery = `
    SELECT
      COUNT(*) as total_rows,
      COUNT(DISTINCT fiscal_year) as distinct_years,
      SUM(CASE WHEN ytd_tickets_sold IS NULL THEN 1 ELSE 0 END) as null_tickets,
      SUM(CASE WHEN ytd_revenue IS NULL THEN 1 ELSE 0 END) as null_revenue,
      SUM(CASE WHEN ytd_tickets_sold < 0 THEN 1 ELSE 0 END) as negative_tickets,
      SUM(CASE WHEN ytd_revenue < 0 THEN 1 ELSE 0 END) as negative_revenue
    FROM \`${projectId}.${datasetId}.ytd_weekly_totals\`
  `;

  const [qualityRows] = await bigquery.query({ query: qualityQuery, location: 'US' });
  const quality = qualityRows[0];

  console.log(`Total rows: ${quality.total_rows}`);
  console.log(`Distinct fiscal years: ${quality.distinct_years}`);
  console.log(`Rows with NULL tickets: ${quality.null_tickets}`);
  console.log(`Rows with NULL revenue: ${quality.null_revenue}`);
  console.log(`Rows with negative tickets: ${quality.negative_tickets}`);
  console.log(`Rows with negative revenue: ${quality.negative_revenue}`);

  if (quality.null_tickets === 0 && quality.null_revenue === 0 &&
      quality.negative_tickets === 0 && quality.negative_revenue === 0) {
    console.log('✅ All data quality checks passed!');
  } else {
    console.log('⚠️  Data quality issues detected');
  }

  console.log('\n✅ Query complete!');
}

// Run the query
queryYTDWeeklyTotals().catch(error => {
  console.error('❌ Error querying ytd_weekly_totals:', error.message);
  process.exit(1);
});
