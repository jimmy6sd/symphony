// Check how many comps exist per performance
const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

async function checkCompCounts() {
  try {
    console.log('🔍 Checking comp counts per performance...\n');

    const bigquery = new BigQuery({
      projectId: 'kcsymphony',
      keyFilename: path.join(__dirname, '..', '..', 'symphony-bigquery-key.json')
    });

    // Get count of comps per performance
    const countQuery = `
      SELECT
        performance_id,
        COUNT(*) as comp_count,
        SUM(CASE WHEN is_target = TRUE THEN 1 ELSE 0 END) as target_count
      FROM \`kcsymphony.symphony_dashboard.performance_sales_comparisons\`
      GROUP BY performance_id
      ORDER BY comp_count DESC
      LIMIT 20
    `;

    const [countRows] = await bigquery.query({
      query: countQuery,
      location: 'US'
    });

    console.log('📊 Top 20 Performances by Comp Count:');
    console.log('═'.repeat(60));
    countRows.forEach(row => {
      const warning = row.comp_count > 1 ? ' ⚠️ MULTIPLE' : '';
      const targetWarning = row.target_count > 1 ? ' 🚨 MULTIPLE TARGETS' : '';
      console.log(`${row.performance_id}: ${row.comp_count} comps (${row.target_count} target)${warning}${targetWarning}`);
    });

    // Check for a specific performance
    console.log('\n🔍 Sample Performance Details (251122E):');
    console.log('═'.repeat(60));

    const detailQuery = `
      SELECT
        comparison_id,
        performance_id,
        comparison_name,
        is_target,
        created_at,
        comp_date,
        atp
      FROM \`kcsymphony.symphony_dashboard.performance_sales_comparisons\`
      WHERE performance_id = '251122E'
      ORDER BY created_at DESC
    `;

    const [detailRows] = await bigquery.query({
      query: detailQuery,
      location: 'US'
    });

    if (detailRows.length === 0) {
      console.log('No comps found for 251122E');
    } else {
      detailRows.forEach(row => {
        const targetBadge = row.is_target ? '🎯' : '  ';
        const metaBadge = row.atp ? '📊' : '  ';
        console.log(`${targetBadge}${metaBadge} ${row.comparison_name}`);
        console.log(`   ID: ${row.comparison_id.substring(0, 8)}...`);
        console.log(`   Created: ${row.created_at}`);
        console.log(`   Target: ${row.is_target}`);
        console.log('');
      });
    }

    // Get total count
    const totalQuery = `
      SELECT COUNT(*) as total
      FROM \`kcsymphony.symphony_dashboard.performance_sales_comparisons\`
    `;

    const [totalRows] = await bigquery.query({
      query: totalQuery,
      location: 'US'
    });

    console.log('═'.repeat(60));
    console.log(`📊 TOTAL COMPS IN DATABASE: ${totalRows[0].total}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

checkCompCounts();
