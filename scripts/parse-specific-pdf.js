// Parse a specific PDF and show the data
const fs = require('fs');
const PDFParser = require('pdf2json');

const pdfPath = process.argv[2] || 'FY26 Performance Sales Summary_1133029.pdf';

console.log(`📄 Parsing PDF: ${pdfPath}\n`);

const pdfParser = new PDFParser();

pdfParser.on('pdfParser_dataError', errData => {
  console.error('❌ PDF parsing error:', errData.parserError);
  process.exit(1);
});

pdfParser.on('pdfParser_dataReady', pdfData => {
  const performances = [];

  for (const page of pdfData.Pages) {
    // Collect all text items
    const allItems = [];
    for (const textItem of page.Texts) {
      const content = decodeURIComponent(textItem.R[0].T);
      allItems.push(content);
    }

    // Find performance codes and extract data
    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i];

      // Check if this is a performance code (25XXXXY format, not a total row)
      if (item.match(/^25\d{4}[A-Z]$/) && !allItems[i-1]?.includes('Total')) {
        const performanceCode = item;
        let idx = i + 1;

        const dateTime = allItems[idx++] || '';
        const budgetStr = allItems[idx++] || '0%';
        const fixedCountStr = allItems[idx++] || '0';
        const fixedRevStr = allItems[idx++] || '0.00';
        const nonFixedCountStr = allItems[idx++] || '0';
        const nonFixedRevStr = allItems[idx++] || '0.00';
        const singleCountStr = allItems[idx++] || '0';
        const singleRevStr = allItems[idx++] || '0.00';
        const subtotalStr = allItems[idx++] || '0.00';

        // Check for reserved
        let reservedStr = '0';
        let reservedRevStr = '0.00';
        const isCurrency = (str) => /^\d{1,3}(,\d{3})*\.\d{2}$/.test(str);
        const isCount = (str) => /^[\d,]+$/.test(str);

        if (idx < allItems.length && isCount(allItems[idx])) {
          reservedStr = allItems[idx++];
          if (idx < allItems.length && isCurrency(allItems[idx])) {
            reservedRevStr = allItems[idx++];
          }
        }

        const totalStr = allItems[idx++] || subtotalStr;
        const availStr = allItems[idx++] || '0';
        const capacityStr = allItems[idx++] || '0.0%';

        const budgetPercent = parseFloat(budgetStr.replace('%', '')) || 0;
        const fixedCount = parseInt(fixedCountStr.replace(/,/g, '')) || 0;
        const nonFixedCount = parseInt(nonFixedCountStr.replace(/,/g, '')) || 0;
        const singleCount = parseInt(singleCountStr.replace(/,/g, '')) || 0;
        const totalRevenue = parseFloat(totalStr.replace(/,/g, '')) || 0;
        const capacityPercent = parseFloat(capacityStr.replace('%', '')) || 0;

        const subscriptionTickets = fixedCount + nonFixedCount;
        const totalTickets = subscriptionTickets + singleCount;

        performances.push({
          performance_code: performanceCode,
          date: dateTime,
          single_tickets: singleCount,
          subscription_tickets: subscriptionTickets,
          total_tickets: totalTickets,
          total_revenue: totalRevenue,
          capacity_percent: capacityPercent,
          budget_percent: budgetPercent
        });
      }
    }
  }

  console.log(`✅ Parsed ${performances.length} performances\n`);
  console.log('=' .repeat(80));

  // Show first 10 performances
  performances.slice(0, 10).forEach((perf, i) => {
    console.log(`${i+1}. ${perf.performance_code} (${perf.date})`);
    console.log(`   Single: ${perf.single_tickets}, Sub: ${perf.subscription_tickets}, Total: ${perf.total_tickets}`);
    console.log(`   Revenue: $${Math.round(perf.total_revenue).toLocaleString()}`);
    console.log(`   Capacity: ${perf.capacity_percent}%, Budget: ${perf.budget_percent}%`);
    console.log('');
  });

  if (performances.length > 10) {
    console.log(`... and ${performances.length - 10} more performances\n`);
  }

  // Save to JSON
  const outputPath = 'parsed-pdf-data.json';
  fs.writeFileSync(outputPath, JSON.stringify(performances, null, 2));
  console.log(`💾 Saved full data to: ${outputPath}`);
  console.log('');

  // Summary stats
  const totalTickets = performances.reduce((sum, p) => sum + p.total_tickets, 0);
  const totalRevenue = performances.reduce((sum, p) => sum + p.total_revenue, 0);
  console.log('📊 Summary:');
  console.log(`   Total performances: ${performances.length}`);
  console.log(`   Total tickets sold: ${totalTickets.toLocaleString()}`);
  console.log(`   Total revenue: $${Math.round(totalRevenue).toLocaleString()}`);
});

pdfParser.loadPDF(pdfPath);
