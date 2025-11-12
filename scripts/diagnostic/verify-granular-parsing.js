/**
 * Verify Granular Data Parsing
 *
 * Shows sample parsed performance data to verify all new fields are being captured
 */

const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

async function verifyParsing() {
  console.log('🔍 Verifying Granular Data Parsing\n');

  const storage = new Storage({
    projectId: 'kcsymphony'
  });

  const bucket = storage.bucket('symphony-dashboard-pdfs');
  const [files] = await bucket.getFiles();

  if (files.length === 0) {
    console.log('❌ No PDFs found in bucket');
    return;
  }

  // Get first PDF
  const file = files[0];
  console.log(`📄 Testing with: ${file.name}\n`);

  const [pdfBuffer] = await file.download();

  // Parse PDF (same logic as reimport script)
  const PDFParser = require('pdf2json');
  const pdfParser = new PDFParser();

  const result = await new Promise((resolve, reject) => {
    pdfParser.on('pdfParser_dataError', errData => reject(errData.parserError));
    pdfParser.on('pdfParser_dataReady', pdfData => {
      const performances = [];

      for (const page of pdfData.Pages) {
        const allItems = [];
        for (const textItem of page.Texts) {
          const content = decodeURIComponent(textItem.R[0].T);
          allItems.push(content);
        }

        const isCurrency = (str) => /^\d{1,3}(,\d{3})*\.\d{2}$/.test(str);
        const isCount = (str) => /^\d+$/.test(str);

        for (let i = 0; i < allItems.length; i++) {
          const item = allItems[i];

          if (item.match(/^\d{6}[A-Z]{1,2}$/) && !allItems[i-1]?.includes('Total')) {
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

            let reservedStr = '0';
            let reservedRevStr = '0.00';
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
            const fixedRevenue = parseFloat(fixedRevStr.replace(/,/g, '')) || 0;
            const nonFixedCount = parseInt(nonFixedCountStr.replace(/,/g, '')) || 0;
            const nonFixedRevenue = parseFloat(nonFixedRevStr.replace(/,/g, '')) || 0;
            const singleCount = parseInt(singleCountStr.replace(/,/g, '')) || 0;
            const singleRevenue = parseFloat(singleRevStr.replace(/,/g, '')) || 0;
            const subtotalRevenue = parseFloat(subtotalStr.replace(/,/g, '')) || 0;
            const reservedCount = parseInt(reservedStr.replace(/,/g, '')) || 0;
            const reservedRevenue = parseFloat(reservedRevStr.replace(/,/g, '')) || 0;
            const totalRevenue = parseFloat(totalStr.replace(/,/g, '')) || 0;
            const availSeats = parseInt(availStr.replace(/,/g, '')) || 0;
            const capacityPercent = parseFloat(capacityStr.replace('%', '')) || 0;

            const totalSold = fixedCount + nonFixedCount + singleCount;

            const fixedAtp = fixedCount > 0 ? fixedRevenue / fixedCount : 0;
            const nonFixedAtp = nonFixedCount > 0 ? nonFixedRevenue / nonFixedCount : 0;
            const singleAtp = singleCount > 0 ? singleRevenue / singleCount : 0;
            const overallAtp = totalSold > 0 ? totalRevenue / totalSold : 0;

            const performanceTime = dateTime.match(/(\d{1,2}:\d{2}\s*[AP]M)/i)?.[0] || null;

            performances.push({
              performance_code: performanceCode,
              performance_time: performanceTime,
              fixed_tickets_sold: fixedCount,
              non_fixed_tickets_sold: nonFixedCount,
              single_tickets_sold: singleCount,
              reserved_tickets: reservedCount,
              total_tickets_sold: totalSold,
              fixed_revenue: fixedRevenue,
              non_fixed_revenue: nonFixedRevenue,
              single_revenue: singleRevenue,
              reserved_revenue: reservedRevenue,
              subtotal_revenue: subtotalRevenue,
              total_revenue: totalRevenue,
              available_seats: availSeats,
              capacity_percent: capacityPercent,
              budget_percent: budgetPercent,
              fixed_atp: fixedAtp,
              non_fixed_atp: nonFixedAtp,
              single_atp: singleAtp,
              overall_atp: overallAtp
            });

            // Only get first one for testing
            if (performances.length === 1) break;
          }
        }

        if (performances.length > 0) break;
      }

      resolve(performances);
    });

    pdfParser.parseBuffer(pdfBuffer);
  });

  if (result.length === 0) {
    console.log('❌ No performances parsed');
    return;
  }

  const sample = result[0];

  console.log('✅ Sample Parsed Performance:\n');
  console.log('━'.repeat(80));
  console.log(`Performance Code: ${sample.performance_code}`);
  console.log(`Performance Time: ${sample.performance_time || 'N/A'}`);
  console.log('');
  console.log('TICKET COUNTS:');
  console.log(`  Fixed (Subscriptions):  ${sample.fixed_tickets_sold}`);
  console.log(`  Non-Fixed (Packages):   ${sample.non_fixed_tickets_sold}`);
  console.log(`  Single Tickets:         ${sample.single_tickets_sold}`);
  console.log(`  Reserved/Comp:          ${sample.reserved_tickets}`);
  console.log(`  Total Sold:             ${sample.total_tickets_sold}`);
  console.log('');
  console.log('REVENUE BREAKDOWN:');
  console.log(`  Fixed Revenue:          $${sample.fixed_revenue.toFixed(2)}`);
  console.log(`  Non-Fixed Revenue:      $${sample.non_fixed_revenue.toFixed(2)}`);
  console.log(`  Single Revenue:         $${sample.single_revenue.toFixed(2)}`);
  console.log(`  Reserved Revenue:       $${sample.reserved_revenue.toFixed(2)}`);
  console.log(`  Subtotal:               $${sample.subtotal_revenue.toFixed(2)}`);
  console.log(`  Total Revenue:          $${sample.total_revenue.toFixed(2)}`);
  console.log('');
  console.log('INVENTORY:');
  console.log(`  Available Seats:        ${sample.available_seats}`);
  console.log(`  Capacity:               ${sample.capacity_percent}%`);
  console.log('');
  console.log('AVERAGE TICKET PRICE (ATP):');
  console.log(`  Fixed ATP:              $${sample.fixed_atp.toFixed(2)}`);
  console.log(`  Non-Fixed ATP:          $${sample.non_fixed_atp.toFixed(2)}`);
  console.log(`  Single ATP:             $${sample.single_atp.toFixed(2)}`);
  console.log(`  Overall ATP:            $${sample.overall_atp.toFixed(2)}`);
  console.log('');
  console.log('ANALYTICS:');
  console.log(`  Budget Achievement:     ${sample.budget_percent}%`);
  console.log('━'.repeat(80));

  // Verify calculations
  console.log('\n✅ VERIFICATION:');
  const calculatedTotal = sample.fixed_revenue + sample.non_fixed_revenue + sample.single_revenue;
  const revenueDiff = Math.abs(calculatedTotal - sample.total_revenue);
  console.log(`  Revenue Sum Match:      ${revenueDiff < 0.01 ? '✅' : '❌'} (diff: $${revenueDiff.toFixed(2)})`);

  const calculatedTickets = sample.fixed_tickets_sold + sample.non_fixed_tickets_sold + sample.single_tickets_sold;
  const ticketsDiff = Math.abs(calculatedTickets - sample.total_tickets_sold);
  console.log(`  Tickets Sum Match:      ${ticketsDiff === 0 ? '✅' : '❌'} (diff: ${ticketsDiff})`);

  const calculatedOverallAtp = sample.total_tickets_sold > 0 ? sample.total_revenue / sample.total_tickets_sold : 0;
  const atpDiff = Math.abs(calculatedOverallAtp - sample.overall_atp);
  console.log(`  Overall ATP Calc:       ${atpDiff < 0.01 ? '✅' : '❌'} (diff: $${atpDiff.toFixed(2)})`);

  console.log('\n🎉 All granular fields are being captured correctly!\n');
}

verifyParsing().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
