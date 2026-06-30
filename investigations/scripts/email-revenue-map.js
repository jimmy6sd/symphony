// Prototype v2: map Constant Contact campaigns -> GA4 utm_campaign slugs, attach
// GA4-attributed email revenue, flag each with Green/Yellow/Red confidence.
// Read-only; writes an artifact JSON + prints a review table.
//
// Granularity: GA4 carries revenue at the utm_campaign (flight/theme) level while
// CC tracks individual sends. Revenue is reported PER GROUP (canonical slug); the
// CC sends composing a group are listed for context. Confidence = how cleanly the
// CC send(s) map to the slug.
//
// v2 adds: (1) auto-merge of case/separator-duplicate GA4 slugs, (2) a manual
// OVERRIDES alias table (cross-form merges + ccPattern attach for slugs that share
// no literal words with CC names, e.g. season/subscription), (3) tighter scoring
// (strong single tokens => green; short common tokens never attach), (4) an
// AUTOMATION bucket for generic site/automation slugs that aren't CC campaigns.

const fs = require('fs');
const path = require('path');
const REPO_ROOT = path.join(__dirname, '..', '..');
for (const line of fs.readFileSync(path.join(REPO_ROOT, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const { getGA4Client, runReport } = require(path.join(REPO_ROOT, 'netlify/functions/lib/ga4'));
const { getBQClient } = require(path.join(REPO_ROOT, 'netlify/functions/lib/bq-email'));

const WINDOW = { start: '2025-07-01', end: '2026-06-28' }; // ~FY26

// --- manual config --------------------------------------------------------
// Generic site/automation utm_campaigns that are NOT discrete CC sends. Real
// revenue, but not attributable to a campaign — bucketed out of the review queue.
const AUTOMATION = new Set([
  'abandoncart','single-tickets','tickets','plan-your-visit','contact-us',
  'get-ready','app','openhouse','spring','musicians','upcoming-events',
]);

// Override table. key = canonical label shown in the report.
//  variants  : extra raw slugs to merge into this group (cross-form dupes GA4 split)
//  ccPattern : regex on CC campaign_name to attach sends when token-matching fails
//  fuzzy     : true => cap at YELLOW even if attached (attribution inherently soft)
//  note      : reviewer hint
const OVERRIDES = {
  '26/27 Subscriptions': { variants: ['26/27Subs','2026/27-subscriptions','subscriptions'],
    ccPattern: /season (announcement|launch)|subscri|renewal opt-in|lapsed subscriber|new subscriber/i, fuzzy: true,
    note: 'Season/subscription revenue; shares sends with 26/27 Concerts — split is approximate.' },
  '26/27 Concerts': { variants: ['26/27_ concerts','26/27_concerts','26/27_concerts '],
    ccPattern: /season (announcement|launch)/i, fuzzy: true,
    note: 'New-season concert revenue; shares season-announcement sends with Subscriptions.' },
  'Billy Joel / Elton John': { variants: ['BillyJoelEltonJohn','eltonjohn-billyjoel','billyjoel-eltonjohn'] },
  'Dolly Parton': { variants: ['DollyParton','dollyparton'] },
  'Harry Potter (HP2)': { variants: ['HP2'], ccPattern: /harry potter/i },
  'Taylor Swift (Symphony Era)': { variants: ['taylor-swift-symphony-era'], ccPattern: /taylor swift/i },
  'Leslie Odom Jr': { variants: ['LeslieOdomJr'], ccPattern: /leslie odom/i },
  'EU Tour': { variants: ['EUTour','EUR-Tour-Kickoff','european-send-off'], ccPattern: /eu tour|european|send-?off/i },
  'New Music Venue': { variants: ['new-music-venue'], ccPattern: /\bnmv\b|new music venue/i },
};

// --- tokenization ---------------------------------------------------------
const STOP = new Set([
  'fy26','fy27','fy25','kbyg','kybg','follow','followup','up','reminder','email','emails',
  'teaser','early','access','launch','final','promo','mobile','music','box','radio','contest',
  'friday','saturday','sunday','monday','tuesday','wednesday','thursday','thurs','fri','sat','sun','wed',
  'no','parking','pass','vip','message','notice','update','opt','in','renewal','contract','donor',
  'db','resend','the','for','with','new','reserved','tickets','ticket','only','dinner','invite',
  'showhouse','acquisition','subscriber','series','standalone','weekly','concert','catch','sale',
  'announcement','correction','correct','corrected','combo','control','group','main','audience',
]);
const MONTHS = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/gi;

function tokens(str) {
  return (str || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[#/]/g, ' ')
    .replace(MONTHS, ' ')
    .replace(/\b\d{1,4}\b/g, ' ')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t && t.length > 1 && !STOP.has(t));
}
const seriesCode = str => { const m = (str || '').match(/\bCS\d+\b/i); return m ? m[0].toUpperCase() : null; };

// Canonical key to auto-merge case/separator-dup slugs (Elf/ELF, "26/27_ concerts"/"26/27_concerts").
function canonicalKey(slug) {
  return (slug || '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
    .split(/[^a-z0-9]+/).filter(Boolean).sort().join('-');
}

// --- scoring --------------------------------------------------------------
// score 3 => GREEN-eligible, 2 => YELLOW, 0 => no attach.
function matchScore(ccName, slug) {
  const ccS = seriesCode(ccName), slugS = seriesCode(slug);
  if (ccS && slugS) return ccS === slugS ? { score: 3, reason: `series ${ccS}` } : { score: 0, reason: 'series mismatch' };

  const ccT = new Set(tokens(ccName));
  const slugT = tokens(slug);
  if (!slugT.length) return { score: 0, reason: 'empty slug' };
  const matched = slugT.filter(t => ccT.has(t));
  const longMatched = matched.filter(t => t.length >= 3); // >=3 keeps "elf"/"cats", drops "on"
  const frac = matched.length / slugT.length;

  if (longMatched.length >= 2) return { score: 3, reason: matched.join('+') };
  if (longMatched.length === 1 && (frac === 1 || matched[0].length >= 5)) return { score: 3, reason: matched.join('+') };
  if (longMatched.length === 1) return { score: 2, reason: matched.join('+') };
  return { score: 0, reason: matched.length ? `weak(${matched.join('+')})` : 'no overlap' };
}

(async () => {
  // 1) GA4 email revenue by slug, then merge variants -> canonical groups
  const ga = getGA4Client();
  const gaRows = await runReport(ga, {
    dateRanges: [{ startDate: WINDOW.start, endDate: WINDOW.end }],
    dimensions: ['sessionCampaignName'],
    metrics: ['sessions', 'ecommercePurchases', 'purchaseRevenue'],
    dimensionFilter: { filter: { fieldName: 'sessionDefaultChannelGroup', stringFilter: { matchType: 'EXACT', value: 'Email' } } },
    limit: 500,
  });

  // variant slug -> canonical override label (if any)
  const variantToOverride = {};
  for (const [label, cfg] of Object.entries(OVERRIDES))
    for (const v of (cfg.variants || [])) variantToOverride[v] = label;

  // Build groups keyed by: override label > canonicalKey
  const groups = {}; // key -> {label, revenue, purchases, sessions, rawSlugs:Set, override}
  for (const r of gaRows) {
    const slug = r.sessionCampaignName;
    if (!slug || /^\(.*\)$/.test(slug)) continue;
    const ovLabel = variantToOverride[slug];
    const key = ovLabel || canonicalKey(slug);
    if (!groups[key]) groups[key] = { key, label: ovLabel || slug, revenue: 0, purchases: 0, sessions: 0, rawSlugs: new Set(), override: ovLabel ? OVERRIDES[ovLabel] : null };
    const g = groups[key];
    g.revenue += r.purchaseRevenue || 0; g.purchases += r.ecommercePurchases || 0; g.sessions += r.sessions || 0;
    g.rawSlugs.add(slug);
    // representative label for auto-merged groups = highest-rev raw slug
    if (!ovLabel && (r.purchaseRevenue || 0) >= 0) {
      if (!g._maxRev || (r.purchaseRevenue || 0) > g._maxRev) { g._maxRev = r.purchaseRevenue || 0; g.label = slug; }
    }
  }

  // 2) CC campaigns in window
  const bq = getBQClient();
  const [ccRows] = await bq.query({ query: `
    SELECT campaign_name, last_sent_date, sends, opens, clicks
    FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY campaign_id ORDER BY snapshot_date DESC) rn
          FROM \`kcsymphony.symphony_dashboard.email_campaign_snapshots\`)
    WHERE rn = 1 AND last_sent_date >= '${WINDOW.start}' AND last_sent_date <= '${WINDOW.end}T23:59:59'
  ` });
  const cc = ccRows.map(r => ({
    name: r.campaign_name,
    sent: (r.last_sent_date && r.last_sent_date.value ? r.last_sent_date.value : r.last_sent_date || '').slice(0, 10),
    sends: Number(r.sends) || 0, opens: Number(r.opens) || 0, clicks: Number(r.clicks) || 0,
  }));

  // 3) Attach each CC campaign to its best group (override ccPattern first, then token match)
  const groupList = Object.values(groups);
  for (const c of cc) {
    let best = { score: 0, group: null, reason: 'unmatched' };
    // override pattern attach
    for (const g of groupList) {
      if (g.override && g.override.ccPattern && g.override.ccPattern.test(c.name)) {
        best = { score: g.override.fuzzy ? 2 : 3, group: g, reason: 'override' }; break;
      }
    }
    if (!best.group) for (const g of groupList) {
      for (const slug of g.rawSlugs) {
        const m = matchScore(c.name, slug);
        if (m.score > best.score) best = { score: m.score, group: g, reason: m.reason };
      }
    }
    c.group = best.group; c.matchScore = best.score; c.matchReason = best.reason;
    if (best.group) { (best.group.sends ||= []).push(c); }
  }
  groupList.forEach(g => { g.sends ||= []; });

  // 4) Confidence per group
  const classify = g => {
    if (AUTOMATION.has(g.label) || [...g.rawSlugs].some(s => AUTOMATION.has(s))) return 'AUTO';
    if (g.override && g.override.fuzzy) return 'YELLOW'; // acknowledged manual attribution
    if (g.sends.length === 0) return 'RED';
    const strong = g.sends.filter(s => s.matchScore >= 3).length;
    return strong >= 1 ? 'GREEN' : 'YELLOW';
  };
  const out = groupList.map(g => ({
    label: g.label, revenue: g.revenue, purchases: g.purchases, sessions: g.sessions,
    rawSlugs: [...g.rawSlugs], mappedSends: g.sends.length,
    note: g.override && g.override.note || null,
    confidence: classify(g),
    sends: g.sends
      .sort((a, b) => (b.matchScore - a.matchScore) || a.sent.localeCompare(b.sent))
      .map(s => ({ name: s.name, sent: s.sent, sends: s.sends, opens: s.opens, clicks: s.clicks, matchScore: s.matchScore, matchReason: s.matchReason })),
  })).sort((a, b) => b.revenue - a.revenue);

  const unmatchedCC = cc.filter(c => !c.group);

  // --- print ---
  const dot = c => ({ GREEN: '🟢', YELLOW: '🟡', RED: '🔴', AUTO: '⚪' }[c]);
  const tally = { GREEN: 0, YELLOW: 0, RED: 0, AUTO: 0 }, cnt = { GREEN: 0, YELLOW: 0, RED: 0, AUTO: 0 };
  let total = 0;
  out.forEach(g => { tally[g.confidence] += g.revenue; cnt[g.confidence]++; total += g.revenue; });

  console.log(`\nWindow ${WINDOW.start} → ${WINDOW.end}`);
  console.log(`GA4 email revenue total: $${Math.round(total)}  |  ${out.length} canonical groups  |  CC sends: ${cc.length} (mapped ${cc.length - unmatchedCC.length}, unmatched ${unmatchedCC.length})`);
  const pct = v => (100 * v / total).toFixed(1) + '%';
  for (const k of ['GREEN', 'YELLOW', 'RED', 'AUTO'])
    console.log(`  ${dot(k)} ${k.padEnd(6)} $${String(Math.round(tally[k])).padStart(7)} (${pct(tally[k]).padStart(6)})  ${cnt[k]} groups`);

  console.log('\nconf revenue  purch sends  group');
  for (const g of out) {
    if (g.revenue < 1 && g.mappedSends === 0) continue;
    console.log(`${dot(g.confidence)} $${String(Math.round(g.revenue)).padStart(7)} ${String(g.purchases).padStart(5)} ${String(g.mappedSends).padStart(5)}  ${g.label}${g.rawSlugs.length > 1 ? '  ['+g.rawSlugs.join(', ')+']' : ''}${g.note ? '  // '+g.note : ''}`);
  }
  console.log('\n🔴 RED — revenue, no CC match (review queue):');
  out.filter(g => g.confidence === 'RED' && g.revenue > 50).forEach(g => console.log(`   $${Math.round(g.revenue)}  ${g.label}`));

  const artifact = path.join(__dirname, '..', 'reports', 'email-revenue-map.json');
  fs.writeFileSync(artifact, JSON.stringify({ window: WINDOW, summary: { total, tally, cnt }, groups: out, unmatchedCC }, null, 2));
  console.log(`\nartifact: ${artifact}`);
})().catch(e => { console.error(e); process.exit(1); });
