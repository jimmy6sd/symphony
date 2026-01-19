const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'kcsymphony',
  keyFilename: './symphony-bigquery-key.json'
});

const query = `
SELECT
  fiscal_year,
  source,
  COUNT(*) as weeks,
  MAX(ytd_revenue) as max_revenue,
  MAX(ytd_single_tickets) as max_tickets
FROM \`kcsymphony.symphony_dashboard.ytd_weekly_totals\`
GROUP BY fiscal_year, source
ORDER BY fiscal_year, source
`;

async function runQuery() {
  try {
    const [rows] = await bigquery.query(query);

    console.log('\n=== YTD Weekly Totals: Source Comparison ===\n');
    console.log('Expected values from validated JSON:');
    console.log('  FY23: $4.0M, FY24: $4.98M, FY25: $5.49M, FY26: $2.52M\n');
    console.log('Fiscal Year | Source           | Weeks | Max Revenue    | Max Tickets');
    console.log('------------|------------------|-------|----------------|-------------');

    rows.forEach(row => {
      const fy = row.fiscal_year;
      const source = (row.source || 'null').padEnd(16);
      const weeks = String(row.weeks).padStart(5);
      const revenue = '$' + (row.max_revenue / 1000000).toFixed(2) + 'M';
      const tickets = String(row.max_tickets).padStart(11);
      console.log(`FY${fy}        | ${source} | ${weeks} | ${revenue.padEnd(14)} | ${tickets}`);
    });

    console.log('\n');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

runQuery();
