// Ordered funnel steps. `key` is the channel-data field used for per-channel cells.
// `optional` steps can be toggled off in the UI (and are bridged over in the conversion table).
const STEP_DEFS = [
  { label: 'Sessions',         key: 'sessions',  optional: false },
  { label: 'View Item',        key: 'view_item', optional: true,  isOn: function () { return _showViewItem; } },
  { label: 'Add to Cart',      key: 'atc',       optional: false },
  { label: 'Login Successful', key: 'login',     optional: true,  isOn: function () { return _showLogin; } },
  { label: 'Begin Checkout',   key: 'checkout',  optional: false },
  { label: 'Purchase',         key: 'purchase',  optional: false },
];

// DISPLAY-ONLY relabeling. Data-layer labels (used for matching/keys) stay as-is; this maps them
// to the user-facing strings. `view_item` event key and all mappings are untouched downstream.
function displayLabel(label) {
  return String(label).replace(/View Item/g, 'View Performance');
}

let _funnelData = null;
let _funnelMode = 'performance'; // 'performance' or 'page'
let _showViewItem = false; // View Performance step off by default — sparse historical data skews the math
let _showLogin = false;    // Login Successful step off by default — GA4 `login` event live since 2026-06-04, sparse until it accumulates
let _selectedKey = 'all';
let _funnelType = 'closed'; // 'closed' or 'open'

function funnelChart(container, steps, height) {
  const el = d3.select(container);
  const width = el.node().getBoundingClientRect().width;
  const h = height || 360;
  const svg = el.append('svg').attr('width', width).attr('height', h);
  const maxVal = steps[0].count;
  const stepH = (h - 40) / steps.length;
  const maxWidth = width * 0.7;
  const minWidth = width * 0.25;
  const colors = ['#667eea', '#7c6dd8', '#3b9cd4', '#22b8a5', '#10b981'];

  steps.forEach((step, i) => {
    const ratio = step.count / maxVal;
    const barW = minWidth + (maxWidth - minWidth) * ratio;
    const x = (width - barW) / 2;
    const y = 20 + i * stepH;
    const color = colors[Math.min(i, colors.length - 1)];

    svg.append('rect')
      .attr('x', x).attr('y', y).attr('width', barW).attr('height', stepH - 8)
      .attr('fill', color).attr('opacity', 0.85).attr('rx', 6);

    svg.append('text')
      .attr('x', width / 2).attr('y', y + (stepH - 8) / 2 - 8).attr('dy', '0.35em')
      .attr('text-anchor', 'middle').attr('fill', '#fff').attr('font-size', 14).attr('font-weight', 600)
      .text(displayLabel(step.label));

    svg.append('text')
      .attr('x', width / 2).attr('y', y + (stepH - 8) / 2 + 10).attr('dy', '0.35em')
      .attr('text-anchor', 'middle').attr('fill', 'rgba(255,255,255,0.9)').attr('font-size', 12)
      .text(`${fmt(step.count)}  (${pct(step.rate)})`);

    if (i > 0 && steps[i - 1].count > 0) {
      const rawConv = step.count / steps[i - 1].count;
      if (rawConv > 1) {
        svg.append('text')
          .attr('x', x - 8).attr('y', y + (stepH - 8) / 2).attr('dy', '0.35em')
          .attr('text-anchor', 'end').attr('fill', 'var(--text-muted)').attr('font-size', 11)
          .text('n/a');
      } else {
        const convPct = (rawConv * 100).toFixed(1);
        const dropoffPct = (100 - convPct).toFixed(1);
        svg.append('text')
          .attr('x', x - 8).attr('y', y + (stepH - 8) / 2 - 7).attr('dy', '0.35em')
          .attr('text-anchor', 'end').attr('fill', '#10b981').attr('font-size', 11)
          .text(`${convPct}%`);
        svg.append('text')
          .attr('x', x - 8).attr('y', y + (stepH - 8) / 2 + 7).attr('dy', '0.35em')
          .attr('text-anchor', 'end').attr('fill', '#e17055').attr('font-size', 11)
          .text(`-${dropoffPct}%`);
      }
    }
  });
}

function getFunnelDateState() {
  const params = new URLSearchParams(window.location.search);
  const start = params.get('start');
  const end = params.get('end');
  if (start && end) return { start, end };
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const defaultStart = new Date(yesterday);
  defaultStart.setDate(defaultStart.getDate() - 29);
  const fmtD = d => d.toISOString().split('T')[0];
  return { start: fmtD(defaultStart), end: fmtD(yesterday) };
}

function setFunnelDateRange(start, end) {
  const url = new URL(window.location);
  url.searchParams.set('start', start);
  url.searchParams.set('end', end);
  window.history.replaceState({}, '', url);
  loadWebFunnel();
}

function setFunnelQuickRange(days) {
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  const fmtD = d => d.toISOString().split('T')[0];
  setFunnelDateRange(fmtD(start), fmtD(end));
}

function applyFunnelDateInputs() {
  const start = document.getElementById('funnel-date-start').value;
  const end = document.getElementById('funnel-date-end').value;
  if (start && end && start <= end) setFunnelDateRange(start, end);
}

function prettifyPage(path) {
  return path.replace(/^\//, '').replace(/\/$/, '').replace(/\?.*/, '') || 'Homepage';
}

function prettifyPerf(pf) {
  var title = pf.title || '';
  // Strip series prefix like "CS13 " or "PP05 "
  title = title.replace(/^[A-Z]{2,3}\d+\s+/, '');
  if (pf.date) {
    var d = new Date(pf.date + 'T00:00:00');
    var dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return title + ' (' + dateStr + ')';
  }
  return title;
}

function toggleFunnelType() {
  _funnelType = _funnelType === 'closed' ? 'open' : 'closed';
  var btn = document.getElementById('funnel-type-toggle');
  if (btn) {
    btn.textContent = _funnelType === 'closed' ? 'Closed Funnel' : 'Open Funnel';
    btn.classList.toggle('active', _funnelType === 'open');
  }
  renderFunnelView(_selectedKey);
}

function toggleViewItem() {
  _showViewItem = !_showViewItem;
  var btn = document.getElementById('view-item-toggle');
  if (btn) {
    btn.classList.toggle('active', _showViewItem);
    btn.textContent = _showViewItem ? 'View Performance: ON' : 'View Performance: OFF';
  }
  renderFunnelView(_selectedKey);
}

function toggleLogin() {
  _showLogin = !_showLogin;
  var btn = document.getElementById('login-toggle');
  if (btn) {
    btn.classList.toggle('active', _showLogin);
    btn.textContent = _showLogin ? 'Login Step: ON' : 'Login Step: OFF';
  }
  renderFunnelView(_selectedKey);
}

function selectFunnelItem(key, btn) {
  document.querySelectorAll('.funnel-prog-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _selectedKey = key;
  renderFunnelView(key);
}

function switchFunnelMode(mode) {
  _funnelMode = mode;
  document.querySelectorAll('.funnel-mode-btn').forEach(b => b.classList.remove('active'));
  var btn = document.querySelector('.funnel-mode-btn[data-mode="' + mode + '"]');
  if (btn) btn.classList.add('active');
  rebuildSelector();
  renderFunnelView('all');
}

function rebuildSelector() {
  var data = _funnelData;
  if (!data) return;
  var container = document.getElementById('funnel-selector');
  if (!container) return;

  var btns = '<button class="funnel-prog-btn active" onclick="selectFunnelItem(\'all\', this)">All</button>';

  if (_funnelMode === 'performance') {
    var perfEntries = Object.entries(data.performance_funnels || {})
      .sort(function(a, b) { return b[1].atc - a[1].atc; });
    perfEntries.forEach(function(entry) {
      var id = entry[0], pf = entry[1];
      var label = prettifyPerf(pf);
      btns += '<button class="funnel-prog-btn" onclick="selectFunnelItem(\'perf:' + escapeHtml(id) + '\', this)">' +
        escapeHtml(label) + ' <span class="funnel-btn-count">' + fmt(pf.sessions) + ' sess</span></button>';
    });
  } else {
    var pageEntries = Object.entries(data.page_funnels || {})
      .sort(function(a, b) { return b[1].atc - a[1].atc; });
    pageEntries.forEach(function(entry) {
      var page = entry[0], pf = entry[1];
      btns += '<button class="funnel-prog-btn" onclick="selectFunnelItem(\'' + escapeHtml(page).replace(/'/g, "\\'") + '\', this)">' +
        escapeHtml(prettifyPage(page)) + ' <span class="funnel-btn-count">' + fmt(pf.sessions) + ' sess</span></button>';
    });
  }

  container.innerHTML = btns;
}

// Given the full funnel array (all steps from the API), return the visible funnel bars plus a
// step-to-step conversion table that bridges across any steps toggled off. Optional steps that
// are off (or absent from the data) are dropped and their neighbours connected directly.
function buildFilteredFunnel(viewFunnel) {
  var byLabel = {};
  viewFunnel.forEach(function(s) { byLabel[s.label] = s; });

  var visibleDefs = STEP_DEFS.filter(function(d) {
    if (!byLabel[d.label]) return false;            // step not present in this dataset
    if (d.optional && !d.isOn()) return false;       // toggled off
    return true;
  });

  var top = visibleDefs.length ? byLabel[visibleDefs[0].label].count : 0;
  var funnel = visibleDefs.map(function(d) {
    var s = byLabel[d.label];
    return { label: s.label, count: s.count, count_prev: s.count_prev, rate: top ? s.count / top : 0 };
  });

  var steps = [];
  var keys = [];
  for (var i = 1; i < visibleDefs.length; i++) {
    var fromDef = visibleDefs[i - 1], toDef = visibleDefs[i];
    var fromBar = byLabel[fromDef.label], toBar = byLabel[toDef.label];
    var rate = fromBar.count ? toBar.count / fromBar.count : 0;
    var ratePrev = fromBar.count_prev ? toBar.count_prev / fromBar.count_prev : 0;
    steps.push({
      from: displayLabel(fromDef.label) + ' → ' + displayLabel(toDef.label),
      rate: rate, rate_prev: ratePrev, dropoff: 1 - rate,
    });
    keys.push({ from: fromDef.key, to: toDef.key });
  }
  return { funnel: funnel, steps: steps, keys: keys };
}

function renderFunnelView(selectedKey) {
  var data = _funnelData;
  if (!data) return;

  var viewFunnel, viewChannels, title;

  var isOpen = _funnelType === 'open';
  var fKey = isOpen ? 'open_funnel' : 'funnel';
  var typeLabel = isOpen ? 'Open' : 'Closed';

  if (selectedKey === 'all') {
    viewFunnel = data[fKey] || data.funnel;
    viewChannels = data.channels;
    title = typeLabel + ' Funnel (All)';
  } else if (selectedKey.startsWith('perf:')) {
    var perfId = selectedKey.slice(5);
    var pf = data.performance_funnels[perfId];
    if (!pf) return;
    viewFunnel = pf[fKey] || pf.funnel;
    viewChannels = pf.channels;
    title = typeLabel + ' Funnel — ' + (pf.title || perfId);
  } else {
    var pageFunnel = data.page_funnels[selectedKey];
    if (!pageFunnel) return;
    viewFunnel = pageFunnel[fKey] || pageFunnel.funnel;
    viewChannels = pageFunnel.channels;
    title = typeLabel + ' Funnel — ' + prettifyPage(selectedKey);
  }

  // Hide channels with no funnel conversions at any step
  viewChannels = viewChannels.filter(function(ch) { return ch.atc > 0 || ch.checkout > 0 || ch.purchase > 0; });

  document.getElementById('funnel-title').textContent = title;

  // Show only the steps whose toggle is on, bridging the conversion table across hidden steps.
  var filtered = buildFilteredFunnel(viewFunnel);
  var filteredFunnel = filtered.funnel;
  var filteredSteps = filtered.steps;
  var filteredStepKeys = filtered.keys;

  var funnelEl = document.getElementById('funnel-chart');
  funnelEl.innerHTML = '';
  funnelChart('#funnel-chart', filteredFunnel, 360);

  // Channel headers
  var headerRow = document.getElementById('funnel-channel-headers');
  headerRow.innerHTML = '<th>Step</th><th class="num">Overall</th><th class="num">Drop-off</th>';
  viewChannels.forEach(function(ch) {
    headerRow.innerHTML += '<th class="num"><span class="channel-dot" style="background:' + channelColor(ch.channel) + '"></span>' + escapeHtml(ch.channel) + '</th>';
  });

  // Step-to-step conversion table
  var stepTbody = document.getElementById('funnel-step-tbody');
  stepTbody.innerHTML = '';
  filteredSteps.forEach(function(s, si) {
    var sp = filteredStepKeys[si];
    var inverted = s.rate > 1;
    var chCells = '';
    viewChannels.forEach(function(ch) {
      var fromVal = ch[sp.from] || 0;
      var toVal = ch[sp.to] || 0;
      var r = fromVal > 0 ? toVal / fromVal : 0;
      if (r > 1) {
        chCells += '<td class="num na-cell">n/a</td>';
      } else {
        chCells += '<td class="num">' + (r > 0 ? pct(r) : '<span class="na-cell">&mdash;</span>') + '</td>';
      }
    });
    var overallCell = inverted ? '<td class="num na-cell">n/a</td>' : '<td class="num" style="font-weight: 600;">' + pct(s.rate) + '</td>';
    var dropoffCell = inverted ? '<td class="num na-cell">n/a</td>' : '<td class="num funnel-dropoff">-' + (s.dropoff * 100).toFixed(1) + '%</td>';
    stepTbody.innerHTML += '<tr>' +
      '<td>' + escapeHtml(s.from) + '</td>' +
      overallCell + dropoffCell +
      chCells +
    '</tr>';
  });

  // Insight box — only consider steps where rate <= 1 (not inverted due to sparse data)
  var validSteps = filteredSteps.filter(function(s) { return s.rate <= 1; });
  if (validSteps.length === 0) validSteps = filteredSteps;
  var biggestDropoff = validSteps.reduce(function(max, s) { return s.dropoff > max.dropoff ? s : max; }, validSteps[0]);
  var bestStep = validSteps.reduce(function(max, s) { return s.rate > max.rate ? s : max; }, validSteps[0]);
  document.getElementById('funnel-insight-box').innerHTML =
    '<div class="funnel-insight">' +
      '<strong>Key insight:</strong> The biggest drop-off is ' + escapeHtml(biggestDropoff.from) + ' (-' + (biggestDropoff.dropoff * 100).toFixed(0) + '%). ' +
      escapeHtml(bestStep.from) + ' has the strongest conversion at ' + pct(bestStep.rate) + '.' +
    '</div>';

  // Performance funnel table
  var perfTbody = document.getElementById('funnel-perf-tbody');
  if (perfTbody && data) {
    var perfFunnels = data.performance_funnels || {};
    var perfEntries = Object.entries(perfFunnels)
      .sort(function(a, b) { return b[1].sessions - a[1].sessions; });
    perfTbody.innerHTML = '';
    perfEntries.forEach(function(entry) {
      var pf = entry[1];
      var f = pf[fKey] || pf.funnel;
      var sessCount = f[0].count;
      var atcStep = f.find(function(s) { return s.label === 'Add to Cart'; });
      var chkStep = f.find(function(s) { return s.label === 'Begin Checkout'; });
      var purStep = f.find(function(s) { return s.label === 'Purchase'; });
      var atcCount = atcStep ? atcStep.count : 0;
      var chkCount = chkStep ? chkStep.count : 0;
      var purCount = purStep ? purStep.count : 0;
      var atcRate = sessCount ? atcCount / sessCount : 0;
      var chkRate = atcCount ? chkCount / atcCount : 0;
      var purRate = chkCount ? purCount / chkCount : 0;
      var rev = isOpen
        ? pf.channels.reduce(function(s, c) { return s + (c.open_revenue || 0); }, 0)
        : pf.channels.reduce(function(s, c) { return s + (c.revenue || 0); }, 0);
      var atcCls = atcRate >= 0.10 ? 'cr-good' : atcRate < 0.02 ? 'cr-poor' : '';
      var purCls = purRate >= 0.60 ? 'cr-good' : purRate < 0.30 ? 'cr-poor' : '';
      perfTbody.innerHTML += '<tr>' +
        '<td>' + escapeHtml(prettifyPerf(pf)) + '</td>' +
        '<td class="num">' + fmt(sessCount) + '</td>' +
        '<td class="num">' + fmt(atcCount) + '</td>' +
        '<td class="num ' + atcCls + '">' + pct(atcRate) + '</td>' +
        '<td class="num">' + fmt(chkCount) + '</td>' +
        '<td class="num">' + pct(chkRate) + '</td>' +
        '<td class="num">' + fmt(purCount) + '</td>' +
        '<td class="num ' + purCls + '">' + pct(purRate) + '</td>' +
        '<td class="num">' + currency(rev) + '</td>' +
      '</tr>';
    });
    if (perfEntries.length === 0) {
      perfTbody.innerHTML = '<tr><td colspan="9" class="na-cell" style="text-align: center; padding: 20px;">No performances matched in this date range</td></tr>';
    }
  }
}

function renderFunnel(data) {
  _funnelData = data;
  var ds = getFunnelDateState();
  var start = ds.start, end = ds.end;
  var content = document.getElementById('dashboard-content');
  var periodDays = Math.round((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24)) + 1;
  var isQuick = function(n) { return periodDays === n ? ' active' : ''; };

  var gapNotice = data.tracking_gaps && data.tracking_gaps.length
    ? '<div class="funnel-mock-notice">' + escapeHtml(data.tracking_gaps[0]) + '</div>'
    : '';

  var hasPerfs = data.performance_funnels && Object.keys(data.performance_funnels).length > 0;
  if (!hasPerfs && _funnelMode === 'performance') _funnelMode = 'page';
  if (hasPerfs && _funnelMode === 'page') _funnelMode = 'performance';
  var perfActive = _funnelMode === 'performance' ? ' active' : '';
  var pageActive = _funnelMode === 'page' ? ' active' : '';

  content.innerHTML =
    gapNotice +

    '<div class="date-controls">' +
      '<label>Period</label>' +
      '<button class="date-preset' + isQuick(7) + '" onclick="setFunnelQuickRange(7)">7d</button>' +
      '<button class="date-preset' + isQuick(14) + '" onclick="setFunnelQuickRange(14)">14d</button>' +
      '<button class="date-preset' + isQuick(30) + '" onclick="setFunnelQuickRange(30)">30d</button>' +
      '<button class="date-preset' + isQuick(60) + '" onclick="setFunnelQuickRange(60)">60d</button>' +
      '<button class="date-preset' + isQuick(90) + '" onclick="setFunnelQuickRange(90)">90d</button>' +
      '<span class="date-sep"></span>' +
      '<input type="date" id="funnel-date-start" class="date-custom" value="' + start + '">' +
      '<span class="date-range-to">to</span>' +
      '<input type="date" id="funnel-date-end" class="date-custom" value="' + end + '">' +
      '<button class="date-apply" onclick="applyFunnelDateInputs()">Apply</button>' +
      '<span class="period-label">' + escapeHtml(data.period) + '</span>' +
    '</div>' +

    '<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">' +
      '<label style="font-size: 12px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Filter by</label>' +
      '<button class="funnel-mode-btn date-preset' + perfActive + '" data-mode="performance" onclick="switchFunnelMode(\'performance\')"' + (hasPerfs ? '' : ' disabled title="No performances matched in this date range"') + '>Performance</button>' +
      '<button class="funnel-mode-btn date-preset' + pageActive + '" data-mode="page" onclick="switchFunnelMode(\'page\')">Landing Page</button>' +
    '</div>' +

    '<div class="funnel-prog-selector" id="funnel-selector"></div>' +

    '<div class="card">' +
      '<div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; margin-bottom: 16px;">' +
        '<h3 id="funnel-title" style="margin: 0; border: none; padding: 0;">Conversion Funnel (All)</h3>' +
        '<div style="display: flex; gap: 6px;">' +
          '<button id="funnel-type-toggle" class="date-preset' + (_funnelType === 'open' ? ' active' : '') + '" onclick="toggleFunnelType()" style="font-size: 11px;">' + (_funnelType === 'closed' ? 'Closed Funnel' : 'Open Funnel') + '</button>' +
          '<button id="view-item-toggle" class="date-preset' + (_showViewItem ? ' active' : '') + '" onclick="toggleViewItem()" style="font-size: 11px;">' + (_showViewItem ? 'View Performance: ON' : 'View Performance: OFF') + '</button>' +
          '<button id="login-toggle" class="date-preset' + (_showLogin ? ' active' : '') + '" onclick="toggleLogin()" style="font-size: 11px;" title="GA4 login event live since 2026-06-04 — counts fill in as data accumulates (daily export lags ~1 day)">' + (_showLogin ? 'Login Step: ON' : 'Login Step: OFF') + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="chart-container" id="funnel-chart" style="max-width: 700px; margin: 0 auto;"></div>' +
    '</div>' +

    '<div class="card">' +
      '<h3>Step-to-Step Conversion by Channel</h3>' +
      '<p class="card-subtitle">' +
        'Each column shows the conversion rate between consecutive funnel steps for that channel. ' +
        'Top-funnel channels bring awareness traffic &mdash; low rates are expected.' +
      '</p>' +
      '<div style="overflow-x: auto;">' +
        '<table>' +
          '<thead><tr id="funnel-channel-headers"></tr></thead>' +
          '<tbody id="funnel-step-tbody"></tbody>' +
        '</table>' +
      '</div>' +
      '<div id="funnel-insight-box"></div>' +
    '</div>' +

    '<div class="card">' +
      '<h3>Funnel by Performance</h3>' +
      '<p class="card-subtitle">Conversion funnel for each performance. Sorted by sessions.</p>' +
      '<div style="overflow-x: auto;">' +
        '<table>' +
          '<thead><tr>' +
            '<th>Performance</th>' +
            '<th class="num">Sessions</th>' +
            '<th class="num">Add to Cart</th>' +
            '<th class="num">ATC Rate</th>' +
            '<th class="num">Checkout</th>' +
            '<th class="num">Chk Rate</th>' +
            '<th class="num">Purchase</th>' +
            '<th class="num">Purch Rate</th>' +
            '<th class="num">Revenue</th>' +
          '</tr></thead>' +
          '<tbody id="funnel-perf-tbody"></tbody>' +
        '</table>' +
      '</div>' +
    '</div>' +

    '<div class="card">' +
      '<h3>Landing Page Performance</h3>' +
      '<p class="card-subtitle">Top landing pages by sessions. Pages with fewer than 50 sessions excluded.</p>' +
      '<table>' +
        '<thead><tr>' +
          '<th>Landing Page</th>' +
          '<th class="num">Sessions</th>' +
          '<th class="num">Add to Cart</th>' +
          '<th class="num">ATC Rate</th>' +
          '<th class="num">Purchases</th>' +
          '<th class="num">Purchase Rate</th>' +
          '<th class="num">Revenue</th>' +
        '</tr></thead>' +
        '<tbody id="funnel-landing-tbody"></tbody>' +
      '</table>' +
    '</div>' +

    '<div class="attribution-bar">' +
      '<span class="attribution-label">Attribution: GA4 last-click (session-scoped)</span>' +
      '<button class="attribution-learn-more" onclick="document.getElementById(\'funnel-attribution-detail\').classList.toggle(\'open\')">How to read this report</button>' +
      '<div id="funnel-attribution-detail" class="attribution-detail">' +
        'Each session\'s conversion is attributed to the channel that brought the user to the site in that session. ' +
        '<strong>Limitations:</strong> Cross-device journeys are not connected; view-through conversions from display/social ads are not counted; ' +
        'users who see a Meta ad then Google the Symphony are attributed to Organic Search.' +
        '<br><br>' +
        '<strong>Reading tip:</strong> Top-of-funnel channels (Display, Paid Social, Organic Social) will show ' +
        'low direct conversion rates. This does not mean they are ineffective &mdash; they generate awareness and demand that ' +
        'converts later via bottom-of-funnel channels (Organic Search, Direct, Paid Search).' +
      '</div>' +
    '</div>' +

    '<div class="footer-note">' +
      'Data: BigQuery closed funnel &middot; Generated ' + new Date().toLocaleString() + ' &middot; Kansas City Symphony Marketing Analytics' +
    '</div>';

  // Build selector buttons and render overall funnel
  rebuildSelector();
  renderFunnelView('all');

  // Landing pages table
  var landingTbody = document.getElementById('funnel-landing-tbody');
  (data.landing_pages || []).forEach(function(p) {
    var atcCls = p.atc_cr >= 0.15 ? 'cr-good' : p.atc_cr < 0.03 ? 'cr-poor' : '';
    var purchCls = p.purchase_cr >= 0.05 ? 'cr-good' : p.purchase_cr < 0.01 ? 'cr-poor' : '';
    landingTbody.innerHTML += '<tr>' +
      '<td>' + escapeHtml(p.page) + '</td>' +
      '<td class="num">' + fmt(p.sessions) + '</td>' +
      '<td class="num">' + fmt(p.atc) + '</td>' +
      '<td class="num ' + atcCls + '">' + pct(p.atc_cr) + '</td>' +
      '<td class="num">' + fmt(p.purchases) + '</td>' +
      '<td class="num ' + purchCls + '">' + pct(p.purchase_cr) + '</td>' +
      '<td class="num">' + currency(p.revenue) + '</td>' +
    '</tr>';
  });
}

async function loadWebFunnel() {
  var content = document.getElementById('dashboard-content');
  content.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading funnel data...</p></div>';

  var ds = getFunnelDateState();

  try {
    var token = sessionStorage.getItem('authToken');
    var fetchOpts = token ? { headers: { Authorization: 'Bearer ' + token } } : {};
    var resp = await fetch('/api/marketing-data?view=funnel&startDate=' + ds.start + '&endDate=' + ds.end, fetchOpts);
    if (!resp.ok) throw new Error('API error: ' + resp.status + ' ' + resp.statusText);
    var data = await resp.json();
    renderFunnel(data);
  } catch (err) {
    content.innerHTML = '<div class="error-state"><h3>Failed to load funnel data</h3><p>' + escapeHtml(err.message) + '</p><button onclick="loadWebFunnel()">Retry</button></div>';
  }
}
