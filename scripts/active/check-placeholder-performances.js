const { BigQuery } = require('@google-cloud/bigquery');

async function checkPlaceholders() {
  const bigquery = new BigQuery({
    projectId: 'kcsymphony',
    location: 'US'
  });

  const query = `
    SELECT performance_code, title, series, performance_date
    FROM \`kcsymphony.symphony_dashboard.performances\`
    WHERE title LIKE 'Performance %'
    ORDER BY performance_code
  `;

  const [rows] = await bigquery.query({ query });

  console.log('🎭 Performances with placeholder titles:\n');
  rows.forEach(r => {
    console.log(`  ${r.performance_code}: "${r.title}" | Series: ${r.series || 'NULL'} | Date: ${r.performance_date.value}`);
  });

  console.log(`\n📊 Total: ${rows.length} performances with placeholder names`);

  // Export just the codes for easy searching
  console.log('\n📋 Performance codes to search in Excel:');
  rows.forEach(r => {
    console.log(`  ${r.performance_code}`);
  });
}

checkPlaceholders().catch(console.error);
