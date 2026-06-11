// Diagnostic script: query 26-27 subscription totals for renewal report comparison
require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');
const fs = require('fs');

const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
let credentials;
if (credentialsEnv && credentialsEnv.startsWith('{')) {
  credentials = JSON.parse(credentialsEnv);
} else {
  const credFile = path.resolve(credentialsEnv || './symphony-bigquery-key.json');
  credentials = JSON.parse(fs.readFileSync(credFile, 'utf8'));
}
if (credentials.private_key && credentials.private_key.includes('\\n')) {
  credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
}

const bq = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony',
  credentials: { client_email: credentials.client_email, private_key: credentials.private_key },
  location: 'US'
});

const P = 'kcsymphony';
const D = 'symphony_dashboard';
const LATEST_DATE = '2026-03-05';

async function run() {
  // ---- Grand Total ----
  console.log('=== GRAND TOTAL (subscription_sales_snapshots, season=26-27, snapshot_date=2026-03-05) ===');
  const [totals] = await bq.query(`
    SELECT
      COUNT(DISTINCT package_name) AS num_packages,
      SUM(package_seats) AS total_package_seats,
      SUM(perf_seats) AS total_perf_seats,
      SUM(total_amount) AS total_amount,
      SUM(paid_amount) AS total_paid_amount,
      SUM(orders) AS total_orders
    FROM \`${P}.${D}.subscription_sales_snapshots\`
    WHERE season = '26-27'
      AND snapshot_date = '${LATEST_DATE}'
  `);
  const t = totals[0];
  console.log('Number of packages:  ', Number(t.num_packages));
  console.log('Total package seats: ', Number(t.total_package_seats));
  console.log('Total perf seats:    ', Number(t.total_perf_seats));
  console.log('Total amount:      $' + Number(t.total_amount).toLocaleString('en-US', {minimumFractionDigits: 2}));
  console.log('Total paid amount: $' + Number(t.total_paid_amount).toLocaleString('en-US', {minimumFractionDigits: 2}));
  console.log('Total orders:        ', Number(t.total_orders));

  // ---- By Category ----
  console.log('\n=== BY CATEGORY ===');
  const [byCat] = await bq.query(`
    SELECT
      category,
      SUM(package_seats) AS package_seats,
      SUM(total_amount) AS total_amount,
      SUM(orders) AS orders
    FROM \`${P}.${D}.subscription_sales_snapshots\`
    WHERE season = '26-27'
      AND snapshot_date = '${LATEST_DATE}'
    GROUP BY category
    ORDER BY package_seats DESC
  `);
  const maxCat = Math.max(...byCat.map(r => (r.category || '').length), 8);
  console.log('Category'.padEnd(maxCat + 2), 'Pkg Seats'.padStart(10), 'Amount'.padStart(14), 'Orders'.padStart(7));
  console.log('-'.repeat(maxCat + 2 + 10 + 14 + 7 + 3));
  let sumSeats = 0, sumAmt = 0, sumOrders = 0;
  for (const r of byCat) {
    const seats = Number(r.package_seats);
    const amt = Number(r.total_amount);
    const orders = Number(r.orders);
    sumSeats += seats;
    sumAmt += amt;
    sumOrders += orders;
    console.log(
      (r.category || 'NULL').padEnd(maxCat + 2),
      String(seats).padStart(10),
      ('$' + amt.toLocaleString('en-US', {minimumFractionDigits: 2})).padStart(14),
      String(orders).padStart(7)
    );
  }
  console.log('-'.repeat(maxCat + 2 + 10 + 14 + 7 + 3));
  console.log('TOTAL'.padEnd(maxCat + 2), String(sumSeats).padStart(10), ('$' + sumAmt.toLocaleString('en-US', {minimumFractionDigits: 2})).padStart(14), String(sumOrders).padStart(7));

  // ---- By Package Type ----
  console.log('\n=== BY PACKAGE TYPE ===');
  const [byType] = await bq.query(`
    SELECT
      package_type,
      SUM(package_seats) AS package_seats,
      SUM(total_amount) AS total_amount,
      SUM(orders) AS orders
    FROM \`${P}.${D}.subscription_sales_snapshots\`
    WHERE season = '26-27'
      AND snapshot_date = '${LATEST_DATE}'
    GROUP BY package_type
    ORDER BY package_seats DESC
  `);
  const maxType = Math.max(...byType.map(r => (r.package_type || '').length), 12);
  console.log('Package Type'.padEnd(maxType + 2), 'Pkg Seats'.padStart(10), 'Amount'.padStart(14), 'Orders'.padStart(7));
  console.log('-'.repeat(maxType + 2 + 10 + 14 + 7 + 3));
  for (const r of byType) {
    console.log(
      (r.package_type || 'NULL').padEnd(maxType + 2),
      String(Number(r.package_seats)).padStart(10),
      ('$' + Number(r.total_amount).toLocaleString('en-US', {minimumFractionDigits: 2})).padStart(14),
      String(Number(r.orders)).padStart(7)
    );
  }

  // ---- Comparison to Renewal Report ----
  console.log('\n=== COMPARISON TO RENEWAL REPORT ===');
  const bqSeats = Number(t.total_package_seats);
  const bqAmount = Number(t.total_amount);
  const renewalSeats = 1423;
  const renewalAmount = 781562;
  console.log('Metric            BigQuery    Renewal Rpt    Difference');
  console.log('Package seats:   ', String(bqSeats).padStart(8), String(renewalSeats).padStart(14), String(bqSeats - renewalSeats).padStart(14));
  console.log('Total amount:   $' + String(bqAmount.toFixed(2)).padStart(10), '$' + String(renewalAmount.toFixed(2)).padStart(12), '$' + String((bqAmount - renewalAmount).toFixed(2)).padStart(12));

  // ---- Check if paid_amount matches renewal better ----
  console.log('\nNote: renewal report may use paid_amount vs total_amount');
  const bqPaid = Number(t.total_paid_amount);
  console.log('Paid amount:    $' + String(bqPaid.toFixed(2)).padStart(10), '$' + String(renewalAmount.toFixed(2)).padStart(12), '$' + String((bqPaid - renewalAmount).toFixed(2)).padStart(12));
}

run().catch(err => console.error('Error:', err.message));
