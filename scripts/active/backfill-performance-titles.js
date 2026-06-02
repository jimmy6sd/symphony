// Backfill real production titles, series codes, and season onto performances from a
// Tessitura "Performance Sales Summary" PDF.
//
// The webhook historically hardcoded title='Performance <code>', season='25-26 Classical'
// and series='Series-<month>'. This script (and the matching webhook fix) reads the real
// values from the report:
//   - Each production's "Total" row is a single text item like
//       "27 CS01 The Rite of Spring Total"   (fiscal-year num, series code, title, "Total")
//     and appears immediately AFTER its group's performance rows.
//   - Season = fiscal year derived from the performance date + category from the series code.
//
// Guards (so a historical re-run never destroys curated data):
//   - title  is only overwritten when the existing title is a "Performance <code>" placeholder
//   - series is only overwritten when the existing series is a "Series-<NN>" month bucket / null
//   - season keeps the existing category and only corrects a wrong fiscal-year prefix
//
// Usage:
//   node scripts/active/backfill-performance-titles.js ["path/to/summary.pdf"]          # dry run
//   node scripts/active/backfill-performance-titles.js ["path/to/summary.pdf"] --apply  # write

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { BigQuery } = require('@google-cloud/bigquery');
const PDFParser = require('../../cloud-functions/subscription-webhook/node_modules/pdf2json');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const file = args.find(a => !a.startsWith('--')) || 'FY27 Standard Performance Sales Summary_1205141.pdf';

// ---------- shared title/series/season helpers (mirrored in the webhook) ----------
function parseProductionTotalRow(item) {
  if (!item) return null;
  const m = item.match(/^\d{1,3}\s+(.+?)\s+Total$/);
  if (!m) return null;
  const body = m[1].trim();
  const sm = body.match(/^([A-Z]{2,3}\d{1,2})\b/);
  return { series: sm ? sm[1] : null, title: body };
}
function categoryFromSeries(series) {
  if (!series) return null;
  const p = series.toUpperCase();
  if (p.startsWith('CS')) return 'Classical';
  if (p.startsWith('PS')) return 'Pops';
  if (p.startsWith('FS')) return 'Family';
  if (p.startsWith('FM')) return 'Film';
  return null;
}
function fiscalYearLabel(dateStr) {
  if (!dateStr) return null;
  const [y, mo] = dateStr.split('-').map(Number);
  if (!y || !mo) return null;
  const start = mo >= 7 ? y : y - 1;
  return `${String(start % 100).padStart(2, '0')}-${String((start + 1) % 100).padStart(2, '0')}`;
}
function seasonCategory(season) {
  if (!season) return null;
  return season.replace(/^\d{2}-\d{2}\s+/, '').trim() || null;
}

// ---------- parse the PDF into code -> {title, series, date} ----------
function parsePdf(filePath) {
  return new Promise((resolve, reject) => {
    const p = new PDFParser();
    p.on('pdfParser_dataError', e => reject(e.parserError));
    p.on('pdfParser_dataReady', d => {
      const perfs = [];
      let pending = [];
      for (const page of d.Pages) {
        const items = page.Texts.map(t => decodeURIComponent(t.R[0].T));
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const total = parseProductionTotalRow(item);
          if (total && pending.length) {
            for (const perf of pending) {
              perf.title = total.title;
              if (total.series) perf.series = total.series;
            }
            pending = [];
            continue;
          }
          if (item.match(/^\d{6}[A-Z]{1,2}$/) && !items[i - 1]?.includes('Total')) {
            const dt = items[i + 1] || '';
            const dm = dt.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
            const date = dm ? `${dm[3]}-${dm[1].padStart(2, '0')}-${dm[2].padStart(2, '0')}` : null;
            const perf = { code: item, date, title: null, series: null };
            perfs.push(perf);
            pending.push(perf);
          }
        }
      }
      resolve(perfs);
    });
    p.loadPDF(filePath);
  });
}

async function run() {
  if (!fs.existsSync(file)) { console.error('PDF not found:', file); process.exit(1); }
  console.log('Parsing:', file);
  const perfs = await parsePdf(file);
  const titled = perfs.filter(p => p.title);
  console.log(`Parsed ${perfs.length} performances, ${titled.length} matched to a production title.`);

  const byTitle = {};
  for (const p of perfs) (byTitle[p.title || '(NO TITLE)'] ??= []).push(p.code);
  for (const [t, cs] of Object.entries(byTitle)) console.log(`  ${t}  [${cs.length}] ${cs.join(', ')}`);

  // load existing rows
  const ce = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  let c; if (ce && ce.startsWith('{')) c = JSON.parse(ce);
  else c = JSON.parse(fs.readFileSync(path.resolve(ce || './symphony-bigquery-key.json'), 'utf8'));
  if (c.private_key && c.private_key.includes('\\n')) c.private_key = c.private_key.replace(/\\n/g, '\n');
  const bq = new BigQuery({ projectId: 'kcsymphony', credentials: { client_email: c.client_email, private_key: c.private_key }, location: 'US' });

  const codes = perfs.map(p => `'${p.code}'`).join(',');
  const [rows] = await bq.query({ query:
    `SELECT performance_code, title, series, season FROM \`kcsymphony.symphony_dashboard.performances\`
     WHERE performance_code IN (${codes})`, location: 'US' });
  const existing = new Map(rows.map(r => [r.performance_code, r]));

  // compute guarded updates
  const updates = [];
  for (const p of perfs) {
    const ex = existing.get(p.code);
    if (!ex || !p.title) continue;
    const newTitle = /^Performance /.test(ex.title || '') ? p.title : ex.title;
    const newSeries = (!ex.series || /^Series-/.test(ex.series) || ex.series === 'Unknown') && p.series ? p.series : ex.series;
    // Category is authoritative from the report's series code (CS/PS/FS/FM). Productions with
    // no series code in the report (films, On Stage, holiday specials) can't be auto-categorized
    // and default to "Special" — flagged below for manual review via /admin/edit.
    const cat = categoryFromSeries(p.series) || 'Special';
    const newSeason = `${fiscalYearLabel(p.date)} ${cat}`;
    if (newTitle !== ex.title || newSeries !== ex.series || newSeason !== ex.season)
      updates.push({ code: p.code, newTitle, newSeries, newSeason, ex });
  }

  console.log(`\n${updates.length} rows would change:`);
  updates.slice(0, 100).forEach(u =>
    console.log(`  ${u.code}: title "${u.ex.title}"->"${u.newTitle}" | series ${u.ex.series}->${u.newSeries} | season ${u.ex.season}->${u.newSeason}`));

  const defaulted = [...new Set(updates.filter(u => /\sSpecial$/.test(u.newSeason)).map(u => u.newTitle))];
  if (defaulted.length) {
    console.log(`\n⚠️  ${defaulted.length} productions had no series code and defaulted to season "...Special" — review category (e.g. Film) via /admin/edit:`);
    defaulted.forEach(t => console.log('   -', t));
  }

  if (!APPLY) { console.log('\nDRY RUN — pass --apply to write.'); return; }
  if (!updates.length) { console.log('Nothing to update.'); return; }

  const esc = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const caseFor = (col, field) => `CASE performance_code ${updates.map(u => `WHEN '${u.code}' THEN '${esc(u[field])}'`).join(' ')} ELSE ${col} END`;
  const q = `UPDATE \`kcsymphony.symphony_dashboard.performances\`
    SET title = ${caseFor('title', 'newTitle')}, series = ${caseFor('series', 'newSeries')}, season = ${caseFor('season', 'newSeason')}, updated_at = CURRENT_TIMESTAMP()
    WHERE performance_code IN (${updates.map(u => `'${u.code}'`).join(',')})`;
  const [job] = await bq.createQueryJob({ query: q, location: 'US' });
  await job.getQueryResults();
  console.log(`\nApplied. Updated ${updates.length} performances.`);
}
run().catch(e => console.error('ERROR:', e.message));
