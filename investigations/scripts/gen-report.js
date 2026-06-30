// Generate a one-off, self-contained HTML report from email-revenue-map.json.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'reports');
const data = JSON.parse(fs.readFileSync(`${DIR}/email-revenue-map.json`, 'utf8'));

const usd = n => '$' + Math.round(n).toLocaleString('en-US');
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const { total } = data.summary;
const T = data.summary.tally, C = data.summary.cnt;
const pct = v => (100 * v / total).toFixed(1) + '%';

const CONF = {
  GREEN:  { dot: '#2ca02c', label: 'High',      desc: 'Clean match (series code or distinctive name)' },
  YELLOW: { dot: '#e0a800', label: 'Review',    desc: 'Partial match, broad flight, or approximate split' },
  RED:    { dot: '#d62728', label: 'Unmatched', desc: 'GA4 revenue with no matching Constant Contact send' },
  AUTO:   { dot: '#9aa0a6', label: 'Automation', desc: 'Site/automation traffic — not a discrete campaign' },
};

// Order groups: by confidence priority then revenue. Drop empty zero-revenue groups.
const order = { GREEN: 0, YELLOW: 1, RED: 2, AUTO: 3 };
const groups = data.groups
  .filter(g => g.revenue >= 1 || g.mappedSends > 0)
  .sort((a, b) => b.revenue - a.revenue);

const mappedPct = pct(T.GREEN + T.YELLOW);

function row(g, i) {
  const c = CONF[g.confidence];
  const slugs = g.rawSlugs.length > 1 ? `<span class="slugs">${g.rawSlugs.map(esc).join(', ')}</span>` : '';
  const sends = g.sends.length
    ? `<table class="sends"><thead><tr><th>Sent</th><th>Constant Contact campaign</th><th class="num">Sends</th><th class="num">Opens</th><th class="num">Clicks</th></tr></thead><tbody>${
        g.sends.map(s => `<tr><td class="dt">${esc(s.sent)}</td><td>${esc(s.name)}</td><td class="num">${s.sends.toLocaleString()}</td><td class="num">${s.opens.toLocaleString()}</td><td class="num">${s.clicks.toLocaleString()}</td></tr>`).join('')
      }</tbody></table>`
    : `<p class="empty">No Constant Contact send mapped to this campaign.</p>`;
  const note = g.note ? `<p class="note">⚠ ${esc(g.note)}</p>` : '';
  return `<tr class="grp" data-i="${i}">
      <td><span class="dot" style="background:${c.dot}"></span></td>
      <td class="name"><button class="exp" aria-expanded="false">▸</button>${esc(g.label)}${slugs}</td>
      <td class="num rev">${usd(g.revenue)}</td>
      <td class="num">${g.purchases.toLocaleString()}</td>
      <td class="num">${g.sessions.toLocaleString()}</td>
      <td class="num">${g.mappedSends || '—'}</td>
    </tr>
    <tr class="detail" data-i="${i}" hidden><td></td><td colspan="5">${note}${sends}</td></tr>`;
}

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>KC Symphony — Email Revenue Attribution (FY26)</title>
<meta name="description" content="GA4-attributed revenue mapped to Constant Contact email campaigns, with confidence flags.">
<style>
  :root { --ink:#1a1d21; --muted:#5f6671; --line:#e6e8eb; --bg:#f6f7f9; --card:#fff; }
  * { box-sizing:border-box; }
  body { margin:0; font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; color:var(--ink); background:var(--bg); }
  .wrap { max-width:1040px; margin:0 auto; padding:32px 24px 80px; }
  header h1 { font-size:24px; margin:0 0 4px; letter-spacing:-.01em; }
  header .sub { color:var(--muted); margin:0 0 24px; }
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin:0 0 8px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:16px; }
  .card .k { font-size:12px; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); margin:0 0 6px; display:flex; align-items:center; gap:6px; }
  .card .v { font-size:22px; font-weight:650; }
  .card .p { font-size:13px; color:var(--muted); }
  .dot { display:inline-block; width:10px; height:10px; border-radius:50%; vertical-align:middle; }
  .legend { display:flex; flex-wrap:wrap; gap:18px; margin:18px 0 24px; font-size:13px; color:var(--muted); }
  .legend span b { color:var(--ink); font-weight:600; }
  .callout { background:#fff8e6; border:1px solid #f0e0a8; border-radius:10px; padding:14px 16px; margin:0 0 24px; font-size:14px; }
  .callout b { display:block; margin-bottom:4px; }
  table.main { width:100%; border-collapse:collapse; background:var(--card); border:1px solid var(--line); border-radius:10px; overflow:hidden; }
  table.main thead th { text-align:left; font-size:12px; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); padding:11px 12px; border-bottom:1px solid var(--line); background:#fafbfc; }
  table.main th.num, table.main td.num { text-align:right; }
  table.main td { padding:10px 12px; border-bottom:1px solid var(--line); vertical-align:top; }
  tr.grp:hover { background:#fafbfc; }
  tr.grp .name { font-weight:550; }
  .rev { font-variant-numeric:tabular-nums; font-weight:600; }
  .num { font-variant-numeric:tabular-nums; }
  .slugs { display:block; font-weight:400; font-size:12px; color:var(--muted); margin-top:2px; }
  .exp { border:none; background:none; cursor:pointer; color:var(--muted); font-size:13px; margin-right:6px; padding:0; width:14px; }
  tr.detail td { background:#fbfcfd; padding:6px 12px 16px 38px; }
  .note { color:#8a6d00; font-size:13px; margin:8px 0; }
  .empty { color:var(--muted); font-style:italic; font-size:13px; margin:8px 0; }
  table.sends { width:100%; border-collapse:collapse; margin-top:6px; font-size:13px; }
  table.sends th { text-align:left; color:var(--muted); font-weight:500; padding:5px 10px; border-bottom:1px solid var(--line); }
  table.sends td { padding:5px 10px; border-bottom:1px solid #eef0f2; }
  table.sends .dt { color:var(--muted); white-space:nowrap; }
  table.sends .num { text-align:right; }
  footer { margin-top:28px; color:var(--muted); font-size:12px; line-height:1.6; }
  footer code { background:#eceef0; padding:1px 5px; border-radius:4px; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Email Revenue Attribution — FY26</h1>
    <p class="sub">GA4-attributed purchase revenue mapped to Constant Contact campaigns · ${esc(data.window.start)} → ${esc(data.window.end)}</p>
  </header>

  <div class="cards">
    <div class="card"><p class="k">Total email revenue</p><div class="v">${usd(total)}</div><p class="p">GA4 Email channel</p></div>
    <div class="card"><p class="k"><span class="dot" style="background:${CONF.GREEN.dot}"></span>High confidence</p><div class="v">${usd(T.GREEN)}</div><p class="p">${pct(T.GREEN)} · ${C.GREEN} campaigns</p></div>
    <div class="card"><p class="k"><span class="dot" style="background:${CONF.YELLOW.dot}"></span>Review</p><div class="v">${usd(T.YELLOW)}</div><p class="p">${pct(T.YELLOW)} · ${C.YELLOW} campaigns</p></div>
    <div class="card"><p class="k"><span class="dot" style="background:${CONF.RED.dot}"></span>Unmatched</p><div class="v">${usd(T.RED)}</div><p class="p">${pct(T.RED)} · ${C.RED} campaigns</p></div>
    <div class="card"><p class="k"><span class="dot" style="background:${CONF.AUTO.dot}"></span>Automation</p><div class="v">${usd(T.AUTO)}</div><p class="p">${pct(T.AUTO)} · ${C.AUTO} sources</p></div>
  </div>
  <div class="legend">
    ${Object.values(CONF).map(c => `<span><span class="dot" style="background:${c.dot}"></span> <b>${c.label}</b> — ${c.desc}</span>`).join('')}
  </div>

  <div class="callout">
    <b>How to read this — ${mappedPct} of revenue is mapped or acknowledged.</b>
    Google Analytics attributes purchase revenue to the email <em>campaign theme</em> (the <code>utm_campaign</code> tag), which usually spans a whole flight of sends — so revenue is shown <strong>per campaign group</strong>, not per individual email. Expand any row to see the Constant Contact sends behind it. Attribution is last-click/session-based, so it credits the visit that converted and will not tie out exactly to Tessitura ticket revenue.
  </div>

  <table class="main">
    <thead><tr><th></th><th>Campaign</th><th class="num">Revenue</th><th class="num">Purchases</th><th class="num">Sessions</th><th class="num">CC sends</th></tr></thead>
    <tbody>${groups.map(row).join('')}</tbody>
  </table>

  <footer>
    Source: GA4 property 445499663 (Email channel, <code>sessionCampaignName</code>) joined to <code>email_campaign_snapshots</code> (Constant Contact).
    Confidence is the reliability of the campaign↔revenue mapping, not of the underlying GA4 attribution.
    Generated ${esc(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }))} Central. One-off snapshot.
  </footer>
</div>
<script>
  document.querySelectorAll('tr.grp').forEach(function (r) {
    r.addEventListener('click', function () {
      var i = r.getAttribute('data-i');
      var d = document.querySelector('tr.detail[data-i="' + i + '"]');
      var btn = r.querySelector('.exp');
      var open = d.hasAttribute('hidden');
      if (open) { d.removeAttribute('hidden'); btn.textContent = '▾'; btn.setAttribute('aria-expanded','true'); }
      else { d.setAttribute('hidden',''); btn.textContent = '▸'; btn.setAttribute('aria-expanded','false'); }
    });
  });
</script>
</body>
</html>`;

const out = `${DIR}/email-revenue-report.html`;
fs.writeFileSync(out, html);
console.log('wrote ' + out + ' (' + (html.length / 1024).toFixed(1) + ' KB, ' + groups.length + ' groups)');
