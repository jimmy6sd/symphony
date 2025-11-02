const { BigQuery } = require('@google-cloud/bigquery');

async function verifyOctober8th() {
  const bigquery = new BigQuery({
    projectId: 'kcsymphony',
    location: 'US'
  });

  const query = `
    SELECT
      snapshot_date,
      COUNT(*) as snapshot_count,
      STRING_AGG(DISTINCT source ORDER BY source) as sources
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
    GROUP BY snapshot_date
    ORDER BY snapshot_date
  `;

  const [rows] = await bigquery.query({ query });

  console.log('📊 Snapshot Coverage (all sources):\n');
  rows.forEach(row => {
    console.log(`  ${row.snapshot_date.value}: ${row.snapshot_count} snapshots [${row.sources}]`);
  });

  console.log(`\n✅ Total unique dates: ${rows.length}`);
  console.log(`📈 Total snapshots: ${rows.reduce((sum, r) => sum + r.snapshot_count, 0)}`);

  // Check for October 8th specifically
  const oct8 = rows.find(r => r.snapshot_date.value === '2025-10-08');
  if (oct8) {
    console.log(`\n🎯 October 8th data confirmed: ${oct8.snapshot_count} snapshots`);
  } else {
    console.log('\n❌ October 8th data NOT found');
  }

  // Check for gaps
  console.log('\n🔍 Checking for date gaps...\n');
  const dates = rows.map(r => r.snapshot_date.value);
  const startDate = new Date('2025-09-24');
  const endDate = new Date('2025-11-02');
  const missing = [];

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    if (!dates.includes(dateStr)) {
      missing.push(dateStr);
    }
  }

  if (missing.length > 0) {
    console.log(`❌ Missing dates (${missing.length}):`);
    missing.forEach(d => console.log(`  ${d}`));
  } else {
    console.log('✅ No date gaps found!');
  }
}

verifyOctober8th().catch(console.error);
