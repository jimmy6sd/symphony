const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');
const creds = JSON.parse(fs.readFileSync(path.resolve('./symphony-bigquery-key.json'), 'utf8'));
if (creds.private_key && creds.private_key.includes('\\n')) creds.private_key = creds.private_key.replace(/\\n/g, '\n');
const bq = new BigQuery({ projectId: creds.project_id, credentials: { client_email: creds.client_email, private_key: creds.private_key }, location: 'US' });

const queries = {
  performances: `
    SELECT performance_id, performance_code, performance_date, title, series, season, capacity, budget_goal
    FROM \`kcsymphony.symphony_dashboard.performances\`
    WHERE LOWER(title) LIKE '%taylor swift%' OR LOWER(title) LIKE '%rachmaninoff%'
    ORDER BY performance_date`,
  latestSnapshots: `
    SELECT s.*
    FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\` s
    JOIN (
      SELECT performance_code, MAX(snapshot_date) AS max_date
      FROM \`kcsymphony.symphony_dashboard.performance_sales_snapshots\`
      WHERE performance_code IN (
        SELECT performance_code FROM \`kcsymphony.symphony_dashboard.performances\`
        WHERE LOWER(title) LIKE '%taylor swift%' OR LOWER(title) LIKE '%rachmaninoff%'
      )
      GROUP BY performance_code
    ) m ON s.performance_code = m.performance_code AND s.snapshot_date = m.max_date
    ORDER BY s.performance_code`,
};

(async () => {
  for (const [name, query] of Object.entries(queries)) {
    const [rows] = await bq.query({ query });
    console.log(`\n=== ${name} (${rows.length} rows) ===`);
    rows.forEach(r => console.log(JSON.stringify(r)));
  }
})().catch(e => { console.error(e.message); process.exit(1); });
