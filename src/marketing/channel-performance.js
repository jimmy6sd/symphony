let _channelData = null;
let _channelSortCol = null;
let _channelSortDir = 'desc';
let _channelFilter = '';

const FUNNEL_GROUPS = [
  {
    key: 'bottom',
    label: 'Bottom Funnel',
    desc: 'Captures existing demand — users already aware of the Symphony',
    channels: new Set(['Direct', 'Organic Search', 'Paid Search']),
  },
  {
    key: 'mid',
    label: 'Mid Funnel',
    desc: 'Nurtures and re-engages known audiences',
    channels: new Set(['Email', 'Cross-network']),
  },
  {
    key: 'top',
    label: 'Top Funnel',
    desc: 'Builds awareness — low direct conversion is expected',
    channels: new Set(['Paid Social', 'Display', 'Organic Social', 'Unassigned (Other)', 'Referral', 'Organic Shopping', 'Audio', 'Organic Video']),
  },
];

function funnelGroup(channelName) {
  for (const g of FUNNEL_GROUPS) {
    if (g.channels.has(channelName)) return g;
  }
  return FUNNEL_GROUPS[2];
}

function assessHealth(ch) {
  const sessDelta = ch.sessions_prev ? (ch.sessions - ch.sessions_prev) / ch.sessions_prev : 0;
  const purchDelta = ch.purchases_prev ? (ch.purchases - ch.purchases_prev) / ch.purchases_prev : 0;
  const engDelta = ch.eng_rate_prev ? (ch.eng_rate - ch.eng_rate_prev) / ch.eng_rate_prev : 0;
  const revDelta = ch.revenue_prev ? (ch.revenue - ch.revenue_prev) / ch.revenue_prev : 0;

  const ups = [], downs = [];
  if (sessDelta > 0.05) ups.push('sessions growing');
  if (purchDelta > 0.10) ups.push('purchases up');
  if (engDelta > 0.03) ups.push('engagement improving');
  if (revDelta > 0.10) ups.push('revenue up');
  if (ch.roas && ch.roas > 3) ups.push(`strong ROAS (${ch.roas.toFixed(1)}x)`);
  if (sessDelta < -0.05) downs.push('sessions declining');
  if (purchDelta < -0.10) downs.push('purchases down');
  if (engDelta < -0.03) downs.push('engagement dropping');
  if (revDelta < -0.10) downs.push('revenue down');
  if (ch.cpa && ch.cpa > 200) downs.push(`high CPA ($${ch.cpa.toFixed(0)})`);

  if (downs.length >= 2) return { status: 'declining', color: '#e17055', summary: 'Declining: ' + downs.slice(0, 2).join(', ') };
  if (downs.length === 1 && ups.length <= 1) {
    let s = 'Watch: ' + downs[0];
    if (ups.length) s += ` (but ${ups[0]})`;
    return { status: 'watch', color: '#fdcb6e', summary: s };
  }
  if (ups.length >= 2) return { status: 'healthy', color: '#00b894', summary: 'Healthy: ' + ups.slice(0, 2).join(', ') };
  if (ups.length === 1) return { status: 'stable', color: '#00b894', summary: 'Stable: ' + ups[0] };
  return { status: 'stable', color: '#b2bec3', summary: 'Stable: no significant changes' };
}

function getDateState() {
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

function setDateRange(start, end) {
  const url = new URL(window.location);
  url.searchParams.set('start', start);
  url.searchParams.set('end', end);
  url.searchParams.delete('days');
  window.history.replaceState({}, '', url);
  loadChannelPerformance();
}

function setQuickRange(days) {
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  const fmtD = d => d.toISOString().split('T')[0];
  setDateRange(fmtD(start), fmtD(end));
}

function applyDateInputs() {
  const start = document.getElementById('date-start').value;
  const end = document.getElementById('date-end').value;
  if (start && end && start <= end) {
    setDateRange(start, end);
  }
}

function filterChannels(val) {
  _channelFilter = val.toLowerCase();
  renderChannelTable();
}

function resetChannelSort() {
  _channelSortCol = null;
  _channelSortDir = 'desc';
  _channelFilter = '';
  var input = document.getElementById('channel-filter');
  if (input) input.value = '';
  renderChannelTable();
}

function sortValue(c, col) {
  switch (col) {
    case 'channel': return c.channel.toLowerCase();
    case 'sessions': return c.sessions;
    case 'eng_rate': return c.eng_rate;
    case 'purchases': return c.purchases;
    case 'cr': return c.cr;
    case 'revenue': return c.revenue;
    case 'aov': return c.aov;
    case 'spend': return c.spend != null ? c.spend : -1;
    case 'cpa': return c.cpa != null ? c.cpa : -1;
    case 'roas': return c.roas != null ? c.roas : -1;
    default: return c.sessions;
  }
}

function renderChannelTable() {
  var data = _channelData;
  if (!data) return;
  var tbody = document.getElementById('channel-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  var totalSessions = data.channels.reduce(function(s, c) { return s + c.sessions; }, 0);
  var totalPurchases = data.channels.reduce(function(s, c) { return s + c.purchases; }, 0);
  var blendedCR = totalSessions ? totalPurchases / totalSessions : 0;

  var channels = data.channels.filter(function(c) {
    return !_channelFilter || c.channel.toLowerCase().indexOf(_channelFilter) !== -1;
  });

  var isSorted = _channelSortCol != null;
  var rowIdx = 0;

  function appendChannelRow(c) {
    var idx = rowIdx++;
    var color = channelColor(c.channel);
    var cr = c.cr;
    var crClass = cr > blendedCR ? 'cr-good' : cr < blendedCR * 0.5 ? 'cr-poor' : '';
    var aovVal = c.aov;
    var detailId = 'detail-' + idx;
    var sparkId = 'spark-' + idx;

    var tr = document.createElement('tr');
    tr.className = 'ch-row';
    tr.onclick = function () {
      var detail = document.getElementById(detailId);
      var arrow = this.querySelector('.ch-expand-arrow');
      var isOpen = detail.style.display !== 'none';
      detail.style.display = isOpen ? 'none' : 'table-row';
      arrow.classList.toggle('open', !isOpen);
      if (!isOpen && !detail.dataset.rendered) {
        var vals = data.daily.map(function(d) { return d[c.channel] || 0; });
        sparkline('#' + sparkId, vals, 64, color);
        detail.dataset.rendered = '1';
      }
    };

    tr.innerHTML =
      '<td><span class="ch-expand-arrow">&#9654;</span><span class="channel-dot" style="background:' + color + '"></span>' + c.channel + '</td>' +
      '<td class="num">' + fmt(c.sessions) + ' ' + changePct(c.sessions, c.sessions_prev) + '</td>' +
      '<td class="num">' + pct(c.eng_rate) + '</td>' +
      '<td class="num">' + fmt(c.purchases) + ' ' + changePct(c.purchases, c.purchases_prev) + '</td>' +
      '<td class="num ' + crClass + '">' + pct(cr) + '</td>' +
      '<td class="num">' + currency(c.revenue) + '</td>' +
      '<td class="num">' + (c.purchases ? '$' + aovVal.toFixed(0) : '—') + '</td>' +
      '<td class="num">' + (c.spend != null ? currency(c.spend) : '<span class="na-cell">n/a</span>') + '</td>' +
      '<td class="num">' + (c.spend != null && c.purchases ? '$' + (c.spend / c.purchases).toFixed(0) : '<span class="na-cell">n/a</span>') + '</td>' +
      '<td class="num">' + (c.spend != null && c.spend > 0 ? (c.revenue / c.spend).toFixed(1) + 'x' : '<span class="na-cell">n/a</span>') + '</td>';
    tbody.appendChild(tr);

    var detailTr = document.createElement('tr');
    detailTr.id = detailId;
    detailTr.className = 'ch-detail-row';
    detailTr.style.display = 'none';

    var sessShare = (c.session_share * 100).toFixed(1);
    var purchShare = (c.purchase_share * 100).toFixed(1);

    var spendMetrics = '';
    if (c.spend != null) {
      spendMetrics =
        '<div class="ch-dm"><div class="v">' + currency(c.spend) + '</div><div class="l">Spend</div></div>' +
        '<div class="ch-dm"><div class="v">' + (c.cpa != null ? '$' + c.cpa.toFixed(0) : '—') + '</div><div class="l">CPA</div></div>' +
        '<div class="ch-dm"><div class="v">' + (c.roas != null ? c.roas.toFixed(1) + 'x' : '—') + '</div><div class="l">ROAS</div></div>';
    }

    detailTr.innerHTML = '<td colspan="10" class="ch-detail-td">' +
      '<div class="ch-detail-inner">' +
        '<div class="ch-detail-grid">' +
          '<div class="ch-detail-section">' +
            '<h4>60-Day Trend</h4>' +
            '<div class="ch-sparkline-wrap" id="' + sparkId + '"></div>' +
            '<h4>Engagement & Quality</h4>' +
            '<div class="ch-detail-metrics">' +
              '<div class="ch-dm"><div class="v">' + fmt(c.users) + '</div><div class="l">Users</div><div class="c">' + changePct(c.users, c.users_prev) + '</div></div>' +
              '<div class="ch-dm"><div class="v">' + pct(c.eng_rate) + '</div><div class="l">Eng Rate</div><div class="c">' + changePct(c.eng_rate, c.eng_rate_prev) + '</div></div>' +
              '<div class="ch-dm"><div class="v">' + Math.round(c.avg_duration) + 's</div><div class="l">Avg Duration</div><div class="c">' + changePct(c.avg_duration, c.avg_duration_prev) + '</div></div>' +
              '<div class="ch-dm"><div class="v">' + c.pages_per_session.toFixed(1) + '</div><div class="l">Pages/Session</div><div class="c">' + changePct(c.pages_per_session, c.pages_per_session_prev) + '</div></div>' +
              '<div class="ch-dm"><div class="v">' + pct(c.new_user_pct) + '</div><div class="l">New Users</div><div class="c"></div></div>' +
            '</div>' +
            '<h4>Share</h4>' +
            '<div class="ch-detail-metrics">' +
              '<div class="ch-dm"><div class="v">' + sessShare + '%</div><div class="l">of Sessions</div></div>' +
              '<div class="ch-dm"><div class="v">' + purchShare + '%</div><div class="l">of Purchases</div></div>' +
              spendMetrics +
            '</div>' +
          '</div>' +
          '<div class="ch-detail-section">' +
            '<h4>What to Expect</h4>' +
            '<div class="ch-context-box" style="border-color: ' + color + ';">' +
              (FUNNEL_POSITION[c.channel] || c.funnel_pos) +
            '</div>' +
            '<h4>Top Landing Pages</h4>' +
            '<table class="ch-page-tbl">' +
              '<thead><tr><th>Page</th><th class="num">Sessions</th><th class="num">Conv Rate</th></tr></thead>' +
              '<tbody>' +
                c.top_pages.map(function(p) {
                  return '<tr><td>' + escapeHtml(p.page) + '</td><td class="num">' + fmt(p.sessions) + '</td><td class="num">' + pct(p.cr) + '</td></tr>';
                }).join('') +
              '</tbody>' +
            '</table>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</td>';
    tbody.appendChild(detailTr);
  }

  // Update sort indicators on headers
  document.querySelectorAll('.ch-sortable').forEach(function(th) {
    var existing = th.querySelector('.sort-arrow');
    if (existing) existing.remove();
    if (th.dataset.sort === _channelSortCol) {
      var arrow = document.createElement('span');
      arrow.className = 'sort-arrow';
      arrow.style.cssText = 'margin-left: 4px; font-size: 10px;';
      arrow.textContent = _channelSortDir === 'asc' ? '▲' : '▼';
      th.appendChild(arrow);
    }
  });

  var sorted = channels.slice().sort(function(a, b) {
    if (_channelSortCol) {
      var va = sortValue(a, _channelSortCol);
      var vb = sortValue(b, _channelSortCol);
      if (typeof va === 'string') {
        return _channelSortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return _channelSortDir === 'asc' ? va - vb : vb - va;
    }
    return b.sessions - a.sessions;
  });
  sorted.forEach(appendChannelRow);
}

async function loadChannelPerformance() {
  const content = document.getElementById('dashboard-content');
  content.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading channel data from GA4 and Meta...</p></div>';

  const { start, end } = getDateState();

  try {
    const token = sessionStorage.getItem('authToken');
    const fetchOpts = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    const resp = await fetch(`/api/marketing-data?view=channels&startDate=${start}&endDate=${end}`, fetchOpts);
    if (!resp.ok) throw new Error(`API error: ${resp.status} ${resp.statusText}`);
    const data = await resp.json();
    renderChannelPerformance(data);
  } catch (err) {
    content.innerHTML = `<div class="error-state"><h3>Failed to load data</h3><p>${escapeHtml(err.message)}</p><button onclick="loadChannelPerformance()">Retry</button></div>`;
  }
}

function renderChannelPerformance(data) {
  const { start, end } = getDateState();
  const content = document.getElementById('dashboard-content');

  const totalSessions = data.channels.reduce((s, c) => s + c.sessions, 0);
  const totalSessionsPrev = data.channels.reduce((s, c) => s + c.sessions_prev, 0);
  const totalPurchases = data.channels.reduce((s, c) => s + c.purchases, 0);
  const totalPurchasesPrev = data.channels.reduce((s, c) => s + c.purchases_prev, 0);
  const totalRevenue = data.channels.reduce((s, c) => s + c.revenue, 0);
  const totalRevenuePrev = data.channels.reduce((s, c) => s + c.revenue_prev, 0);
  const crAll = totalSessions ? totalPurchases / totalSessions : 0;
  const crAllPrev = totalSessionsPrev ? totalPurchasesPrev / totalSessionsPrev : 0;
  const aovAll = totalPurchases ? totalRevenue / totalPurchases : 0;
  const aovAllPrev = totalPurchasesPrev ? totalRevenuePrev / totalPurchasesPrev : 0;

  data.channels.forEach(ch => {
    ch.cr = ch.sessions ? ch.purchases / ch.sessions : 0;
    ch.cr_prev = ch.sessions_prev ? ch.purchases_prev / ch.sessions_prev : 0;
    ch.aov = ch.purchases ? ch.revenue / ch.purchases : 0;
    ch.session_share = totalSessions ? ch.sessions / totalSessions : 0;
    ch.purchase_share = totalPurchases ? ch.purchases / totalPurchases : 0;
    ch.cpa = ch.spend != null && ch.purchases ? ch.spend / ch.purchases : null;
    ch.roas = ch.spend != null && ch.spend > 0 ? ch.revenue / ch.spend : null;
    ch.health = assessHealth(ch);
  });

  const warnings = [
    data.meta_status ? `<strong>Meta:</strong> ${data.meta_status}` : null,
    data.stackadapt_status ? `<strong>StackAdapt:</strong> ${data.stackadapt_status}` : null,
    data.tiktok_status ? `<strong>TikTok:</strong> ${data.tiktok_status}` : null,
  ].filter(Boolean);
  const metaWarning = warnings.length
    ? `<div class="meta-warning">${warnings.join(' · ')}. Spend data may be incomplete.</div>`
    : '';

  const periodDays = Math.round((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24)) + 1;
  const isQuick = n => periodDays === n ? ' active' : '';

  content.innerHTML = `
    ${metaWarning}
    <div class="date-controls">
      <label>Period</label>
      <button class="date-preset${isQuick(7)}" onclick="setQuickRange(7)">7d</button>
      <button class="date-preset${isQuick(14)}" onclick="setQuickRange(14)">14d</button>
      <button class="date-preset${isQuick(30)}" onclick="setQuickRange(30)">30d</button>
      <button class="date-preset${isQuick(60)}" onclick="setQuickRange(60)">60d</button>
      <button class="date-preset${isQuick(90)}" onclick="setQuickRange(90)">90d</button>
      <span class="date-sep"></span>
      <input type="date" id="date-start" class="date-custom" value="${start}">
      <span class="date-range-to">to</span>
      <input type="date" id="date-end" class="date-custom" value="${end}">
      <button class="date-apply" onclick="applyDateInputs()">Apply</button>
      <span class="period-label">${data.period} vs ${data.comparison_period}</span>
    </div>

    <div class="kpi-row">
      <div class="kpi-card">
        <div class="kpi-label">Total Sessions</div>
        <div class="kpi-bottom"><span class="kpi-value">${fmt(totalSessions)}</span>${changeBadge(totalSessions, totalSessionsPrev)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Purchases</div>
        <div class="kpi-bottom"><span class="kpi-value">${fmt(totalPurchases)}</span>${changeBadge(totalPurchases, totalPurchasesPrev)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Revenue</div>
        <div class="kpi-bottom"><span class="kpi-value">${currency(totalRevenue)}</span>${changeBadge(totalRevenue, totalRevenuePrev)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Blended AOV</div>
        <div class="kpi-bottom"><span class="kpi-value">$${aovAll.toFixed(0)}</span>${changeBadge(aovAll, aovAllPrev)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Conversion Rate</div>
        <div class="kpi-bottom"><span class="kpi-value">${pct(crAll)}</span>${changeBadge(crAll, crAllPrev)}</div>
      </div>
    </div>

    <div class="card">
      <h3>Channel Performance</h3>
      <p class="card-subtitle">Click a column header to sort. Click a channel row to expand details.</p>
      <div style="margin-bottom: 10px;">
        <input type="text" id="channel-filter" placeholder="Filter channels..." oninput="filterChannels(this.value)"
          style="padding: 6px 10px; font-size: 12px; border: 1px solid var(--border-color); border-radius: 6px; width: 200px; background: var(--surface-color); color: var(--text-primary);">
        <button class="date-preset" onclick="resetChannelSort()" style="margin-left: 8px; font-size: 11px;">Reset Sort</button>
      </div>
      <div class="channel-table-wrap">
        <table id="channel-table">
          <thead>
            <tr id="channel-thead-row">
              <th class="ch-sortable" data-sort="channel">Channel ${tip('GA4 default channel grouping — how users found the site')}</th>
              <th class="num ch-sortable" data-sort="sessions">Sessions ${tip('Total visits from this channel in the selected period')}</th>
              <th class="num ch-sortable" data-sort="eng_rate">Eng Rate ${tip('Percent of sessions that were engaged (10+ seconds, 2+ pages, or a conversion)')}</th>
              <th class="num ch-sortable" data-sort="purchases">Purchases ${tip('Number of completed ticket purchases attributed to this channel (GA4 last-click)')}</th>
              <th class="num ch-sortable" data-sort="cr">Conv Rate ${tip('Purchases ÷ Sessions — the percentage of visits that resulted in a purchase')}</th>
              <th class="num ch-sortable" data-sort="revenue">Revenue ${tip('Total purchase revenue attributed to this channel (GA4 last-click)')}</th>
              <th class="num ch-sortable" data-sort="aov">AOV ${tip('Average Order Value — Revenue ÷ Purchases')}</th>
              <th class="num ch-sortable" data-sort="spend">Spend ${tip('Ad spend from platform APIs (Meta, StackAdapt, TikTok) and GA4-reported Google Ads cost')}</th>
              <th class="num ch-sortable" data-sort="cpa">CPA ${tip('Cost Per Acquisition — Spend ÷ Purchases')}</th>
              <th class="num ch-sortable" data-sort="roas">ROAS ${tip('Return on Ad Spend — Revenue ÷ Spend. Higher is better; 1.0x means break-even')}</th>
            </tr>
          </thead>
          <tbody id="channel-tbody"></tbody>
        </table>
      </div>
    </div>

    <div class="chart-row">
      <div class="card">
        <h3>Sessions by Channel</h3>
        <div class="chart-container" id="sessions-bar"></div>
      </div>
      <div class="card">
        <h3>Purchases by Channel</h3>
        <div class="chart-container" id="purchases-bar"></div>
      </div>
    </div>

    <div class="card">
      <h3>Daily Sessions by Channel (60 days)</h3>
      <div class="chart-container" id="daily-stacked"></div>
      <div id="daily-legend"></div>
    </div>

    <div class="chart-row">
      <div class="card">
        <h3>Spend vs. Purchases</h3>
        <div class="chart-container" id="spend-scatter"></div>
        <p class="card-footnote">
          Ad spend from platform exports (Meta Ads Manager, Google Ads). Purchases from GA4 last-click attribution.
          Platform-reported conversions may differ due to attribution window differences.
        </p>
      </div>
      <div class="card">
        <h3>Spend Efficiency</h3>
        <table>
          <thead>
            <tr>
              <th>Channel</th>
              <th class="num">Spend</th>
              <th class="num">Purchases</th>
              <th class="num">CPA</th>
              <th class="num">Revenue</th>
              <th class="num">ROAS</th>
            </tr>
          </thead>
          <tbody id="spend-tbody"></tbody>
        </table>
      </div>
    </div>

    <div class="attribution-bar">
      <span class="attribution-label">Attribution: GA4 last-click (session-scoped)</span>
      <button class="attribution-learn-more" onclick="document.getElementById('attribution-detail').classList.toggle('open')">Learn more</button>
      <div id="attribution-detail" class="attribution-detail">
        Each session's conversion is attributed to the channel that brought the user in that session.
        <strong>Limitations:</strong> cross-device journeys not connected; view-through conversions not counted;
        Meta ad viewers who later Google the Symphony are credited to Organic Search.
        <strong>Reading tip:</strong> Top-funnel channels show low conversion rates by design — they create demand
        that converts via bottom-funnel channels.
      </div>
    </div>

    <div class="footer-note">
      Data: GA4 (live) · Meta (live) · StackAdapt (manual) · TikTok (live) · Generated ${new Date().toLocaleString()} · Kansas City Symphony Marketing Analytics
    </div>
  `;

  // Render charts
  const channelsSorted = [...data.channels].sort((a, b) => b.sessions - a.sessions);
  barChart('#sessions-bar', channelsSorted, 'channel', 'sessions', channelColor);
  barChart('#purchases-bar', [...data.channels].sort((a, b) => b.purchases - a.purchases), 'channel', 'purchases', channelColor);

  stackedArea('#daily-stacked', data.daily, data.channels_list, 300);
  legend('#daily-legend', data.channels_list.map(ch => ({ label: ch, color: channelColor(ch) })));

  // Wire up sort headers
  document.querySelectorAll('.ch-sortable').forEach(th => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', function() {
      const col = this.dataset.sort;
      if (_channelSortCol === col) {
        _channelSortDir = _channelSortDir === 'desc' ? 'asc' : 'desc';
      } else {
        _channelSortCol = col;
        _channelSortDir = col === 'channel' ? 'asc' : 'desc';
      }
      renderChannelTable();
    });
  });

  _channelData = data;
  renderChannelTable();

  // Spend scatter
  const spendChannels = data.channels.filter(c => c.spend != null);
  if (spendChannels.length) {
    scatterPlot('#spend-scatter', spendChannels, 'spend', 'purchases', 'channel', 280);
  }

  // Spend table
  const spendTbody = document.getElementById('spend-tbody');
  spendChannels.sort((a, b) => (b.spend || 0) - (a.spend || 0)).forEach(c => {
    spendTbody.innerHTML += `<tr>
      <td><span class="channel-dot" style="background:${channelColor(c.channel)}"></span>${c.channel}</td>
      <td class="num">${currency(c.spend)}</td>
      <td class="num">${fmt(c.purchases)}</td>
      <td class="num">${c.purchases ? '$' + (c.spend / c.purchases).toFixed(0) : '—'}</td>
      <td class="num">${currency(c.revenue)}</td>
      <td class="num">${c.spend ? (c.revenue / c.spend).toFixed(1) + 'x' : '—'}</td>
    </tr>`;
  });
}

// Initial load is triggered by the tab-switching code in marketing.html.
