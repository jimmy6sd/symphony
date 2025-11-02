const { BigQuery } = require('@google-cloud/bigquery');

async function updateTitles() {
  const bigquery = new BigQuery({
    projectId: 'kcsymphony',
    location: 'US'
  });

  console.log('🔧 Updating performance titles in BigQuery...\n');

  // Update Drum Safari performances
  const drumSafariUpdate = `
    UPDATE \`kcsymphony.symphony_dashboard.performances\`
    SET
      title = 'Drum Safari',
      updated_at = CURRENT_TIMESTAMP()
    WHERE performance_code IN ('251011A', '251011B', '251011C')
  `;

  console.log('📝 Updating Drum Safari (251011A, 251011B, 251011C)...');
  const [drumJob] = await bigquery.createQueryJob({ query: drumSafariUpdate });
  await drumJob.getQueryResults();
  console.log('✅ Drum Safari titles updated\n');

  // Update Holiday Harmonies performances
  const holidayUpdate = `
    UPDATE \`kcsymphony.symphony_dashboard.performances\`
    SET
      title = 'Holiday Harmonies',
      updated_at = CURRENT_TIMESTAMP()
    WHERE performance_code IN ('251206A', '251206B', '251206C')
  `;

  console.log('📝 Updating Holiday Harmonies (251206A, 251206B, 251206C)...');
  const [holidayJob] = await bigquery.createQueryJob({ query: holidayUpdate });
  await holidayJob.getQueryResults();
  console.log('✅ Holiday Harmonies titles updated\n');

  // Verify the updates
  const verifyQuery = `
    SELECT performance_code, title, performance_date, series
    FROM \`kcsymphony.symphony_dashboard.performances\`
    WHERE performance_code IN ('251011A', '251011B', '251011C', '251206A', '251206B', '251206C')
    ORDER BY performance_code
  `;

  console.log('🔍 Verifying updates...\n');
  const [rows] = await bigquery.query({ query: verifyQuery });

  console.log('📊 Updated Performances:\n');
  rows.forEach(r => {
    console.log(`  ${r.performance_code}: "${r.title}" | ${r.performance_date.value} | Series: ${r.series}`);
  });

  console.log('\n✅ All titles updated successfully!');
  console.log('\n⚠️  Note: Performances 251205M and 251215M show "#Error" in the PDF');
  console.log('   These may need to be corrected in Tessitura first.');
}

updateTitles().catch(console.error);
