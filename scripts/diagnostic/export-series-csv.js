require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs'), path = require('path');
const ce = process.env.GOOGLE_APPLICATION_CREDENTIALS;
let cr;
if (ce.startsWith('{')) cr = JSON.parse(ce);
else cr = JSON.parse(fs.readFileSync(path.resolve(ce), 'utf8'));
if (cr.private_key && cr.private_key.includes('\\n')) cr.private_key = cr.private_key.replace(/\\n/g, '\n');
const bq = new BigQuery({ projectId: 'kcsymphony', credentials: { client_email: cr.client_email, private_key: cr.private_key }, location: 'US' });

const SERIES_MAP = `
  CASE
    WHEN series IN ('Classical','Piazza','Special','CS01','CS02','CS03','CS04','CS05','CS06','CS07','CS08','CS09','CS10','CS11','CS12','CS13','CS14','Chamber Music','Series-01','Series-03','Series-04','Series-05','Series-10','Series-12') THEN 'Classical'
    WHEN series IN ('Pops','PS1','PS2','PS3','PS4','PS5','Happy Hour') THEN 'Pops'
    WHEN series IN ('Family','FS1','FS2','FS3','FS4','Christmas Festival','Education') THEN 'Family'
    WHEN series IN ('Film','FM1','FM2','FM3') THEN 'Film'
    WHEN series IN ('Special Event','On Stage') THEN 'Specials'
    ELSE 'Specials'
  END`;

async function run() {
  const [snap] = await bq.query({ query: `
    SELECT DISTINCT fiscal_year, title, series, ${SERIES_MAP} as category
    FROM kcsymphony.symphony_dashboard.ytd_performance_snapshots
    ORDER BY fiscal_year, category, title
  `, location: 'US' });

  const [fy26] = await bq.query({ query: `
    SELECT 'FY26' as fiscal_year, title, series, ${SERIES_MAP} as category
    FROM kcsymphony.symphony_dashboard.performances
    WHERE season LIKE '25-26%' AND (cancelled IS NULL OR cancelled = false)
    ORDER BY category, title
  `, location: 'US' });

  const rows = [...snap, ...fy26];
  let csv = 'Fiscal Year,Performance,Extracted Series,Category\n';
  rows.forEach(r => {
    const title = (r.title || '').replace(/"/g, '""');
    const series = (r.series || 'NULL').replace(/"/g, '""');
    csv += `"${r.fiscal_year || ''}","${title}","${series}","${r.category}"\n`;
  });
  fs.writeFileSync('series-mapping.csv', csv);
  console.log(`Wrote ${rows.length} rows to series-mapping.csv`);
}
run().catch(e => console.error(e.message));
