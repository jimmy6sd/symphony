const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony',
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

async function checkCompTickets() {
  console.log('='.repeat(80));
  console.log('COMP TICKETS DATA QUALITY INVESTIGATION');
  console.log('='.repeat(80));
  console.log();

  try {
    // Query 1: Top 15 performances by comp_tickets
    console.log('📊 Query 1: Top 15 Performances by Comp Tickets (Latest Snapshot)');
    console.log('-'.repeat(80));

    const query1 = `
      SELECT
        p.performance_code,
        p.title,
        p.performance_date,
        s.comp_tickets,
        s.single_tickets_sold,
        s.snapshot_date
      FROM \`kcsymphony.symphony_dashboard.performances\` p
      JOIN \`kcsymphony.symphony_dashboard.performance_sales_snapshots\` s
        ON p.performance_code = s.performance_code
      WHERE s.comp_tickets > 0
      QUALIFY ROW_NUMBER() OVER (PARTITION BY s.performance_code ORDER BY s.snapshot_date DESC) = 1
      ORDER BY s.comp_tickets DESC
      LIMIT 15
    `;

    const [rows1] = await bigquery.query(query1);

    if (rows1.length === 0) {
      console.log('❌ NO performances with comp_tickets > 0 found.');
      console.log();
      return;
    }

    console.log();
    rows1.forEach((row, idx) => {
      console.log(`${idx + 1}. ${row.performance_code} - ${row.title}`);
      console.log(`   Date: ${row.performance_date} | Snapshot: ${row.snapshot_date.value}`);
      console.log(`   Comp Tickets: ${row.comp_tickets} | Single Tickets: ${row.single_tickets_sold}`);
      console.log();
    });

    console.log('='.repeat(80));
    console.log();

    // Query 2: History for top performance
    const topPerformance = rows1[0];
    console.log(`📈 Query 2: Comp Tickets History for ${topPerformance.performance_code}`);
    console.log(`   Title: ${topPerformance.title}`);
    console.log(`   Performance Date: ${topPerformance.performance_date}`);
    console.log('-'.repeat(80));

    const query2 = `
      SELECT
        performance_code,
        snapshot_date,
        comp_tickets,
        single_tickets_sold,
        total_tickets_sold
      FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
      WHERE performance_code = '${topPerformance.performance_code}'
      ORDER BY snapshot_date
    `;

    const [rows2] = await bigquery.query(query2);

    console.log();
    console.log('Snapshot Date | Comp Tickets | Single Tickets | Total Tickets');
    console.log('-'.repeat(70));

    rows2.forEach(row => {
      const snapshot = row.snapshot_date.value || row.snapshot_date;
      const comps = String(row.comp_tickets).padStart(6);
      const singles = String(row.single_tickets_sold).padStart(6);
      const total = String(row.total_tickets_sold).padStart(6);

      console.log(`${snapshot} | ${comps} | ${singles} | ${total}`);
    });

    console.log();
    console.log('='.repeat(80));
    console.log();
    console.log('✅ Analysis complete');
    console.log();

    // Summary statistics
    console.log('📊 Summary Statistics:');
    console.log(`   - Total performances with comps: ${rows1.length}`);
    console.log(`   - Highest comp count: ${topPerformance.comp_tickets} (${topPerformance.performance_code})`);
    console.log(`   - Snapshots for top performance: ${rows2.length}`);
    console.log();

  } catch (error) {
    console.error('❌ Error querying BigQuery:', error.message);
    throw error;
  }
}

checkCompTickets().catch(console.error);
