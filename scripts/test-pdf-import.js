/**
 * Test PDF Import - Quick Test Without BigQuery Insert
 *
 * Usage: node scripts/test-pdf-import.js <pdf-file-or-directory>
 */

const fs = require('fs');
const path = require('path');
const { parsePDF, extractSnapshotDate } = require('./process-pdf-bucket.js');

async function testImport() {
  const inputPath = process.argv[2];

  if (!inputPath) {
    console.error('Usage: node scripts/test-pdf-import.js <pdf-file-or-directory>');
    process.exit(1);
  }

  console.log('📊 Testing PDF Import (No BigQuery)');
  console.log('═'.repeat(80));
  console.log('');

  const stats = fs.statSync(inputPath);
  const files = [];

  if (stats.isDirectory()) {
    console.log(`📁 Scanning directory: ${inputPath}\n`);
    const dirFiles = fs.readdirSync(inputPath)
      .filter(f => f.toLowerCase().endsWith('.pdf'));
    files.push(...dirFiles.map(f => path.join(inputPath, f)));
    console.log(`Found ${files.length} PDF files\n`);
  } else if (inputPath.toLowerCase().endsWith('.pdf')) {
    files.push(inputPath);
  } else {
    console.error('❌ Input must be a PDF file or directory');
    process.exit(1);
  }

  const allSnapshots = [];

  for (const filepath of files) {
    const filename = path.basename(filepath);
    const snapshotDate = extractSnapshotDate(filename, filepath);

    console.log(`📄 ${filename}`);
    console.log(`   Date: ${snapshotDate}`);

    try {
      const performances = await parsePDF(filepath, filename);
      console.log(`   ✅ Parsed ${performances.length} performances`);

      // Show first 3 performances
      if (performances.length > 0) {
        console.log('   Sample data:');
        performances.slice(0, 3).forEach(perf => {
          console.log(`     ${perf.performance_code}: ${perf.total_tickets} tickets, $${Math.round(perf.total_revenue).toLocaleString()}`);
        });
      }

      const snapshots = performances.map(perf => ({
        snapshot_id: `${perf.performance_code}_${snapshotDate}_pdf`,
        performance_code: perf.performance_code,
        snapshot_date: snapshotDate,
        single_tickets_sold: perf.single_tickets,
        subscription_tickets_sold: perf.subscription_tickets,
        total_tickets_sold: perf.total_tickets,
        total_revenue: perf.total_revenue,
        capacity_percent: perf.capacity_percent,
        budget_percent: perf.budget_percent,
        source: 'historical_pdf_import',
        source_filename: filename
      }));

      allSnapshots.push(...snapshots);

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }

    console.log('');
  }

  console.log('═'.repeat(80));
  console.log('📈 SUMMARY');
  console.log('═'.repeat(80));
  console.log(`Files processed: ${files.length}`);
  console.log(`Total snapshots: ${allSnapshots.length}`);

  if (allSnapshots.length > 0) {
    const byDate = {};
    allSnapshots.forEach(s => {
      byDate[s.snapshot_date] = (byDate[s.snapshot_date] || 0) + 1;
    });

    console.log('\nSnapshots by date:');
    Object.keys(byDate).sort().forEach(date => {
      console.log(`  ${date}: ${byDate[date]} performances`);
    });

    const totalTickets = allSnapshots.reduce((sum, s) => sum + s.total_tickets_sold, 0);
    const totalRevenue = allSnapshots.reduce((sum, s) => sum + s.total_revenue, 0);

    console.log(`\nTotal tickets: ${totalTickets.toLocaleString()}`);
    console.log(`Total revenue: $${Math.round(totalRevenue).toLocaleString()}`);

    // Save to JSON
    const outputPath = 'test-pdf-import-output.json';
    fs.writeFileSync(outputPath, JSON.stringify({
      extractedAt: new Date().toISOString(),
      filesProcessed: files.length,
      totalSnapshots: allSnapshots.length,
      snapshots: allSnapshots
    }, null, 2));

    console.log(`\n💾 Saved to: ${outputPath}`);
  }

  console.log('\n✅ Test complete!');
  console.log('\n🎯 To import to BigQuery:');
  console.log(`   node scripts/process-pdf-bucket.js ${inputPath}`);
}

testImport()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
