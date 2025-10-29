// Compare PDF data with current dashboard data
const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const initializeBigQuery = () => {
  const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  let credentials;

  if (credentialsEnv.startsWith('{')) {
    credentials = JSON.parse(credentialsEnv);
  } else {
    const credentialsFile = path.resolve(credentialsEnv);
    credentials = JSON.parse(fs.readFileSync(credentialsFile, 'utf8'));
  }

  if (credentials.private_key?.includes('\\\\n')) {
    credentials.private_key = credentials.private_key.replace(/\\\\n/g, '\n');
  }

  return new BigQuery({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || credentials.project_id,
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
    location: 'US'
  });
};

async function comparePdfWithDashboard() {
  // Load PDF data
  const pdfData = JSON.parse(fs.readFileSync('parsed-pdf-data.json', 'utf8'));

  console.log(`📄 PDF Data: ${pdfData.length} performances\n`);

  // Get dashboard data
  const bigquery = initializeBigQuery();
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const datasetId = process.env.BIGQUERY_DATASET || 'symphony_dashboard';

  // Get the same performances from dashboard
  const codes = pdfData.map(p => `'${p.performance_code}'`).join(',');
  const query = `
    SELECT
      performance_code,
      title,
      single_tickets_sold,
      subscription_tickets_sold,
      total_tickets_sold,
      total_revenue,
      capacity_percent,
      budget_percent,
      last_pdf_import_date,
      updated_at
    FROM \`${projectId}.${datasetId}.performances\`
    WHERE performance_code IN (${codes})
    ORDER BY performance_code
  `;

  const [dashboardData] = await bigquery.query({ query, location: 'US' });

  console.log(`📊 Dashboard Data: ${dashboardData.length} performances found\n`);
  console.log('=' .repeat(100));
  console.log('Comparison (showing first 10):');
  console.log('=' .repeat(100));

  let matches = 0;
  let mismatches = 0;
  let missing = 0;

  // Compare each performance
  pdfData.slice(0, 10).forEach((pdfPerf, i) => {
    const dashPerf = dashboardData.find(d => d.performance_code === pdfPerf.performance_code);

    console.log(`\n${i+1}. ${pdfPerf.performance_code}`);

    if (!dashPerf) {
      console.log('   ❌ NOT FOUND in dashboard');
      missing++;
      return;
    }

    const lastUpdate = typeof dashPerf.last_pdf_import_date === 'object'
      ? dashPerf.last_pdf_import_date.value
      : dashPerf.last_pdf_import_date;

    console.log(`   📅 Last updated: ${lastUpdate || 'Never'}`);
    console.log('');

    // Compare tickets
    const ticketsMatch =
      dashPerf.single_tickets_sold === pdfPerf.single_tickets &&
      dashPerf.subscription_tickets_sold === pdfPerf.subscription_tickets;

    const ticketIcon = ticketsMatch ? '✅' : '❌';
    console.log(`   ${ticketIcon} Tickets:`);
    console.log(`      PDF:       Single: ${pdfPerf.single_tickets}, Sub: ${pdfPerf.subscription_tickets}, Total: ${pdfPerf.total_tickets}`);
    console.log(`      Dashboard: Single: ${dashPerf.single_tickets_sold}, Sub: ${dashPerf.subscription_tickets_sold}, Total: ${dashPerf.total_tickets_sold}`);

    // Compare revenue
    const revenueDiff = Math.abs(dashPerf.total_revenue - pdfPerf.total_revenue);
    const revenueMatch = revenueDiff < 1;
    const revenueIcon = revenueMatch ? '✅' : '❌';

    console.log(`   ${revenueIcon} Revenue:`);
    console.log(`      PDF:       $${Math.round(pdfPerf.total_revenue).toLocaleString()}`);
    console.log(`      Dashboard: $${Math.round(dashPerf.total_revenue).toLocaleString()}`);
    if (!revenueMatch) {
      console.log(`      Difference: $${Math.round(revenueDiff).toLocaleString()}`);
    }

    // Compare capacity
    const capacityDiff = Math.abs(dashPerf.capacity_percent - pdfPerf.capacity_percent);
    const capacityMatch = capacityDiff < 0.1;
    const capacityIcon = capacityMatch ? '✅' : '❌';

    console.log(`   ${capacityIcon} Capacity:`);
    console.log(`      PDF:       ${pdfPerf.capacity_percent}%`);
    console.log(`      Dashboard: ${dashPerf.capacity_percent}%`);

    if (ticketsMatch && revenueMatch && capacityMatch) {
      matches++;
    } else {
      mismatches++;
    }
  });

  console.log('\n');
  console.log('=' .repeat(100));
  console.log('📊 Summary:');
  console.log('=' .repeat(100));
  console.log(`   ✅ Matches: ${matches}`);
  console.log(`   ❌ Mismatches: ${mismatches}`);
  console.log(`   ⚠️  Missing: ${missing}`);
  console.log('');

  if (mismatches > 0 || missing > 0) {
    console.log('💡 Conclusion: Dashboard data does NOT match PDF');
    console.log('   The webhook may not be processing PDFs correctly');
  } else {
    console.log('✅ Conclusion: Dashboard data matches PDF perfectly!');
  }
}

comparePdfWithDashboard()
  .then(() => console.log('\n✅ Comparison complete'))
  .catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
