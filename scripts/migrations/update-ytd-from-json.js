// Update YTD Weekly Totals table from validated JSON data
// Run with: node scripts/migrations/update-ytd-from-json.js
// This replaces existing data with validated Excel-extracted data

require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');

const JSON_FILE = path.join(__dirname, '../../data/ytd-validated-data.json');

function initializeBigQuery() {
  const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsEnv) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable not set');
  }

  let credentials;
  if (credentialsEnv.startsWith('{')) {
    credentials = JSON.parse(credentialsEnv);
  } else {
    const credentialsFile = path.resolve(credentialsEnv);
    const credentialsJson = fs.readFileSync(credentialsFile, 'utf8');
    credentials = JSON.parse(credentialsJson);
  }

  if (credentials.private_key && credentials.private_key.includes('\\n')) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  }

  return new BigQuery({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || credentials.project_id,
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
    location: 'US'
  });
}

// Calculate fiscal week (FY starts July 1)
function getFiscalWeek(dateStr, fy) {
  const date = new Date(dateStr + 'T12:00:00Z');
  const fyStartYear = parseInt(fy.replace('FY', '')) + 1999; // FY23 = 2022, FY24 = 2023
  const fyStart = new Date(Date.UTC(fyStartYear, 6, 1)); // July 1
  const diffDays = Math.floor((date - fyStart) / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7) + 1;
}

// Calculate ISO week
function getISOWeek(dateStr) {
  const date = new Date(dateStr + 'T12:00:00Z');
  const jan1 = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const days = Math.floor((date - jan1) / (1000 * 60 * 60 * 24));
  return Math.ceil((days + jan1.getUTCDay() + 1) / 7);
}

// Get week end date (Saturday)
function getWeekEndDate(dateStr) {
  const date = new Date(dateStr + 'T12:00:00Z');
  const day = date.getUTCDay();
  const daysUntilSat = (6 - day + 7) % 7;
  date.setUTCDate(date.getUTCDate() + daysUntilSat);
  return date.toISOString().split('T')[0];
}

async function updateYTDTable() {
  const bigquery = initializeBigQuery();
  const datasetId = process.env.BIGQUERY_DATASET || 'symphony_dashboard';
  const tableId = 'ytd_weekly_totals';

  // Load validated JSON
  const jsonData = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
  console.log('Loaded validated JSON data');
  console.log('Fiscal years:', Object.keys(jsonData.fiscal_years));

  // Build rows from JSON
  const rows = [];
  const seenWeeks = new Set(); // Track unique FY+week combinations

  for (const [fy, records] of Object.entries(jsonData.fiscal_years)) {
    const validRecords = records.filter(r =>
      r.single_revenue && !r.extraction_failed && !r.error
    );

    console.log(`\n${fy}: ${validRecords.length} valid records`);

    for (const record of validRecords) {
      const fiscalWeek = getFiscalWeek(record.date, fy);
      const weekKey = `${fy}-${fiscalWeek}`;

      // Skip if we already have this week (keep latest by date)
      if (seenWeeks.has(weekKey)) {
        continue;
      }
      seenWeeks.add(weekKey);

      const row = {
        record_id: `${fy}-W${fiscalWeek}-excel`,
        fiscal_year: fy,
        fiscal_week: fiscalWeek,
        iso_week: getISOWeek(record.date),
        week_end_date: getWeekEndDate(record.date),
        ytd_tickets_sold: record.single_tickets || 0,
        ytd_single_tickets: record.single_tickets || null,
        ytd_subscription_tickets: null,
        ytd_revenue: record.single_revenue || null,
        performance_count: null,
        source: 'excel-validated-json',
        created_at: new Date().toISOString()
      };

      rows.push(row);
      console.log(`  Week ${fiscalWeek}: ${record.date} - ${record.single_tickets?.toLocaleString()} tickets, $${(record.single_revenue/1000000).toFixed(2)}M`);
    }
  }

  console.log(`\nTotal rows to insert: ${rows.length}`);

  // Delete existing data from excel source
  console.log('\nDeleting existing excel-sourced data...');
  const deleteQuery = `
    DELETE FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${datasetId}.${tableId}\`
    WHERE source = 'excel-validated-json' OR source IS NULL
  `;

  try {
    await bigquery.query({ query: deleteQuery, location: 'US' });
    console.log('Deleted existing data');
  } catch (e) {
    console.log('Delete warning:', e.message);
  }

  // Insert new rows in batches
  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await bigquery
      .dataset(datasetId)
      .table(tableId)
      .insert(batch);
    console.log(`Inserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(rows.length/batchSize)}`);
  }

  console.log('\n✅ YTD table updated successfully!');

  // Verify
  const [verifyRows] = await bigquery.query({
    query: `
      SELECT fiscal_year, COUNT(*) as weeks,
             MAX(ytd_revenue) as max_revenue,
             MAX(ytd_single_tickets) as max_tickets
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT_ID}.${datasetId}.${tableId}\`
      GROUP BY fiscal_year
      ORDER BY fiscal_year
    `,
    location: 'US'
  });

  console.log('\nVerification:');
  verifyRows.forEach(r => {
    console.log(`  ${r.fiscal_year}: ${r.weeks} weeks, $${(r.max_revenue/1000000).toFixed(2)}M max revenue, ${r.max_tickets?.toLocaleString()} max tickets`);
  });
}

updateYTDTable()
  .then(() => {
    console.log('\nDone.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  });
