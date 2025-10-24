// Check Top Gun: Maverick performances and capacity calculations
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

async function checkTopGun() {
  const bigquery = initializeBigQuery();
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony';
  const datasetId = 'symphony_dashboard';

  console.log('🎬 Top Gun: Maverick Concert - Capacity Analysis\n');

  const query = `
    SELECT
      performance_code,
      title,
      performance_date,
      capacity,
      single_tickets_sold,
      subscription_tickets_sold,
      total_tickets_sold,
      total_revenue,
      capacity_percent,
      budget_goal,
      budget_percent,
      FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', updated_at) as metadata_updated
    FROM \`${projectId}.${datasetId}.performances\`
    WHERE title LIKE '%Top Gun%' OR title LIKE '%Maverick%'
    ORDER BY performance_date
  `;

  const [rows] = await bigquery.query({ query, location: 'US' });

  console.log('='.repeat(100));
  rows.forEach((row, i) => {
    console.log(`\n${i + 1}. Performance Code: ${row.performance_code}`);
    console.log(`   Title: ${row.title}`);
    console.log(`   Date: ${row.performance_date.value}`);
    console.log(`   Capacity: ${row.capacity.toLocaleString()}`);
    console.log(`   Tickets Sold: ${row.total_tickets_sold.toLocaleString()} (${row.single_tickets_sold} single + ${row.subscription_tickets_sold} subscription)`);
    console.log(`   Revenue: $${row.total_revenue.toLocaleString()}`);
    console.log(`   Occupancy: ${row.capacity_percent}%`);
    console.log(`   Budget Goal: $${row.budget_goal.toLocaleString()}`);
    console.log(`   Budget %: ${row.budget_percent}%`);
    console.log(`   Metadata Updated: ${row.metadata_updated}`);
  });

  // Now check the CSV to see what the source values were
  console.log('\n' + '='.repeat(100));
  console.log('\n📊 Checking Weekly Sales Report CSV for source data...\n');

  const csvPath = path.join(__dirname, '../data/source-files/KCS 25-26 Weekly Sales Report - Sep 17.xlsx - Performances by Week.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const lines = csvContent.split('\n');

  // Parse CSV line properly handling quoted fields
  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  console.log('Top Gun: Maverick entries in CSV:');
  console.log('-'.repeat(100));

  lines.forEach((line, lineNum) => {
    if (line.includes('Top Gun') || line.includes('Maverick')) {
      const cols = parseCSVLine(line);
      const perfName = cols[3]?.trim();
      const perfDate = cols[6]?.trim();
      const budget = cols[12]?.trim();
      const capacity = cols[27]?.trim();

      console.log(`\nLine ${lineNum + 1}:`);
      console.log(`  Performance: ${perfName}`);
      console.log(`  Date: ${perfDate}`);
      console.log(`  Budget (Col M, index 12): ${budget}`);
      console.log(`  Capacity (Col AB, index 27): ${capacity}`);
    }
  });
}

checkTopGun().catch(console.error);
