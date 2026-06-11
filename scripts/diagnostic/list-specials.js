require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs'), path = require('path');
const ce = process.env.GOOGLE_APPLICATION_CREDENTIALS;
let cr;
if (ce.startsWith('{')) cr = JSON.parse(ce);
else cr = JSON.parse(fs.readFileSync(path.resolve(ce), 'utf8'));
if (cr.private_key && cr.private_key.includes('\\n')) cr.private_key = cr.private_key.replace(/\\n/g, '\n');
const bq = new BigQuery({ projectId: 'kcsymphony', credentials: { client_email: cr.client_email, private_key: cr.private_key }, location: 'US' });

async function run() {
  const [q1] = await bq.query({ query: `
    SELECT DISTINCT series, COUNT(DISTINCT performance_code) as perfs
    FROM kcsymphony.symphony_dashboard.ytd_performance_snapshots
    WHERE series NOT IN ('Classical','Piazza','Special','Pops','Family','Film')
    GROUP BY series ORDER BY series
  `, location: 'US' });
  console.log('FY24/FY25 snapshot table (maps to Specials):');
  q1.forEach(r => console.log('  ' + (r.series || 'NULL') + ' (' + r.perfs + ' performances)'));

  const [q2] = await bq.query({ query: `
    SELECT series, COUNT(*) as perfs, STRING_AGG(DISTINCT title, ', ' ORDER BY title LIMIT 5) as examples
    FROM kcsymphony.symphony_dashboard.performances
    WHERE season LIKE '25-26%' AND (cancelled IS NULL OR cancelled = false)
      AND (series IS NULL OR series NOT IN (
        'Classical','Piazza','Special','CS01','CS02','CS03','CS04','CS05','CS06','CS07','CS08','CS09','CS10','CS11','CS12','CS13','CS14',
        'Chamber Music','Series-01','Series-03','Series-04','Series-05','Series-10','Series-12',
        'Pops','PS1','PS2','PS3','PS4','PS5','Happy Hour',
        'Family','FS1','FS2','FS3','FS4','Christmas Festival','Education',
        'Film','FM1','FM2','FM3'))
    GROUP BY series ORDER BY series
  `, location: 'US' });
  console.log('\nFY26 performances table (maps to Specials):');
  q2.forEach(r => console.log('  ' + (r.series || 'NULL') + ' (' + r.perfs + ' performances) e.g. ' + (r.examples || '')));

  // Also list the actual performance titles in "Other" from the snapshot table
  const [q3] = await bq.query({ query: `
    SELECT DISTINCT performance_code, title, series
    FROM kcsymphony.symphony_dashboard.ytd_performance_snapshots
    WHERE series = 'Other'
    ORDER BY title
  `, location: 'US' });
  console.log('\nFY24/FY25 "Other" series performance titles:');
  q3.forEach(r => console.log('  ' + r.title));
}
run().catch(e => console.error(e.message));
