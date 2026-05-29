const { BigQuery } = require('@google-cloud/bigquery');

let bqClient = null;

function getBQClient() {
  if (!bqClient) {
    const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credentialsEnv) throw new Error('GOOGLE_APPLICATION_CREDENTIALS not set');

    let credentials;
    if (credentialsEnv.startsWith('{')) {
      credentials = JSON.parse(credentialsEnv);
    } else {
      const fs = require('fs');
      const path = require('path');
      credentials = JSON.parse(fs.readFileSync(path.resolve(credentialsEnv), 'utf8'));
    }

    if (credentials.private_key && credentials.private_key.includes('\\n')) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }

    bqClient = new BigQuery({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || credentials.project_id,
      credentials: { client_email: credentials.client_email, private_key: credentials.private_key },
      location: 'US',
    });
  }
  return bqClient;
}

function computeDates({ days, startDate, endDate }) {
  const fmt = d => d.toISOString().split('T')[0];
  const fmtBQ = d => fmt(d).replace(/-/g, '');
  const label = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  let currentStart, currentEnd;
  if (startDate && endDate) {
    currentStart = new Date(startDate + 'T00:00:00');
    currentEnd = new Date(endDate + 'T00:00:00');
  } else {
    currentEnd = new Date();
    currentEnd.setDate(currentEnd.getDate() - 1);
    currentStart = new Date(currentEnd);
    currentStart.setDate(currentStart.getDate() - ((days || 30) - 1));
  }

  const periodDays = Math.round((currentEnd - currentStart) / (1000 * 60 * 60 * 24)) + 1;
  const prevEnd = new Date(currentStart);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (periodDays - 1));

  return {
    currentStart: fmtBQ(currentStart),
    currentEnd: fmtBQ(currentEnd),
    prevStart: fmtBQ(prevStart),
    prevEnd: fmtBQ(prevEnd),
    tableSuffix: fmtBQ(prevStart),
    periodLabel: `${label(currentStart)} – ${label(currentEnd)}`,
    comparisonLabel: `${label(prevStart)} – ${label(prevEnd)}`,
  };
}

async function queryPerformances(bq) {
  const [rows] = await bq.query({ query: `
    SELECT performance_id, title, series, performance_date, venue, season
    FROM \`kcsymphony.symphony_dashboard.performances\`
    WHERE cancelled = false
    ORDER BY performance_date DESC
  ` });
  const map = {};
  rows.forEach(r => { map[String(r.performance_id)] = r; });
  return map;
}

function extractPerfId(path) {
  const m = path.match(/\/([^/]+)\/(\d{4,6})(?:\/|$)/);
  return m ? m[2] : null;
}

async function queryClosedFunnel({ days, startDate, endDate }) {
  const bq = getBQClient();
  const d = computeDates({ days, startDate, endDate });

  const query = `
    WITH session_funnel AS (
      SELECT
        user_pseudo_id,
        COALESCE(
          (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id'), 0
        ) AS session_id,
        ANY_VALUE(
          session_traffic_source_last_click.cross_channel_campaign.default_channel_group
        ) AS channel,
        ANY_VALUE(
          REGEXP_EXTRACT(
            (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location'),
            r'https?://[^/]+(/[^?#]*)'
          )
        ) AS landing_path,
        MIN(event_date) AS session_date,
        MAX(IF(event_name = 'session_start', 1, 0)) AS had_session,
        MAX(IF(event_name = 'view_item', 1, 0)) AS had_view_item,
        MAX(IF(event_name = 'add_to_cart', 1, 0)) AS had_atc,
        MAX(IF(event_name = 'begin_checkout', 1, 0)) AS had_checkout,
        MAX(IF(event_name = 'purchase', 1, 0)) AS had_purchase,
        MAX(IF(event_name = 'purchase',
          COALESCE(
            (SELECT value.double_value FROM UNNEST(event_params) WHERE key = 'value'),
            CAST((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'value') AS FLOAT64),
            0
          ), 0
        )) AS purchase_value
      FROM \`kcsymphony.analytics_445499663.events_*\`
      WHERE _TABLE_SUFFIX BETWEEN '${d.tableSuffix}' AND '${d.currentEnd}'
        AND event_name IN ('session_start', 'view_item', 'add_to_cart', 'begin_checkout', 'purchase')
      GROUP BY user_pseudo_id, session_id
    ),
    with_period AS (
      SELECT *,
        CASE
          WHEN session_date BETWEEN '${d.currentStart}' AND '${d.currentEnd}' THEN 'current'
          WHEN session_date BETWEEN '${d.prevStart}' AND '${d.prevEnd}' THEN 'previous'
        END AS period
      FROM session_funnel
    )
    SELECT
      period,
      COALESCE(channel, '(not set)') AS channel,
      landing_path,
      COUNT(*) AS sessions,
      COUNTIF(had_view_item = 1) AS users_view_item,
      COUNTIF(had_atc = 1) AS users_atc,
      COUNTIF(had_atc = 1 AND had_checkout = 1) AS users_checkout,
      COUNTIF(had_atc = 1 AND had_checkout = 1 AND had_purchase = 1) AS users_purchase,
      ROUND(SUM(IF(had_atc = 1 AND had_checkout = 1 AND had_purchase = 1, purchase_value, 0)), 2) AS revenue,
      COUNTIF(had_checkout = 1) AS open_checkout,
      COUNTIF(had_purchase = 1) AS open_purchase,
      ROUND(SUM(IF(had_purchase = 1, purchase_value, 0)), 2) AS open_revenue
    FROM with_period
    WHERE period IS NOT NULL
    GROUP BY period, channel, landing_path
  `;

  const [rows, perfMap] = await Promise.all([
    bq.query({ query }).then(r => r[0]),
    queryPerformances(bq),
  ]);
  return assembleFunnelData(rows, d, perfMap);
}

const ZERO_CH = { sessions: 0, view_item: 0, atc: 0, checkout: 0, purchase: 0, revenue: 0, open_checkout: 0, open_purchase: 0, open_revenue: 0 };

function buildFunnelSteps(channels, mode) {
  const sum = (key) => channels.reduce((s, c) => s + c[key], 0);
  const tS = sum('sessions'), tSp = sum('sessions_prev');
  const tV = sum('view_item'), tVp = sum('view_item_prev');
  const tA = sum('atc'), tAp = sum('atc_prev');
  const co = mode === 'open' ? 'open_checkout' : 'checkout';
  const cop = mode === 'open' ? 'open_checkout_prev' : 'checkout_prev';
  const pu = mode === 'open' ? 'open_purchase' : 'purchase';
  const pup = mode === 'open' ? 'open_purchase_prev' : 'purchase_prev';
  const tC = sum(co), tCp = sum(cop);
  const tP = sum(pu), tPp = sum(pup);

  const funnel = [
    { label: 'Sessions', count: tS, count_prev: tSp, rate: 1.0 },
    { label: 'View Item', count: tV, count_prev: tVp, rate: tS ? tV / tS : 0 },
    { label: 'Add to Cart', count: tA, count_prev: tAp, rate: tS ? tA / tS : 0 },
    { label: 'Begin Checkout', count: tC, count_prev: tCp, rate: tS ? tC / tS : 0 },
    { label: 'Purchase', count: tP, count_prev: tPp, rate: tS ? tP / tS : 0 },
  ];

  const step_conversion = [
    { from: 'Sessions → View Item', rate: tS ? tV / tS : 0, rate_prev: tSp ? tVp / tSp : 0 },
    { from: 'View Item → Add to Cart', rate: tV ? tA / tV : 0, rate_prev: tVp ? tAp / tVp : 0 },
    { from: 'ATC → Checkout', rate: tA ? tC / tA : 0, rate_prev: tAp ? tCp / tAp : 0 },
    { from: 'Checkout → Purchase', rate: tC ? tP / tC : 0, rate_prev: tCp ? tPp / tCp : 0 },
  ];
  step_conversion.forEach(s => { s.dropoff = 1 - s.rate; });

  return { funnel, step_conversion };
}

function assembleFunnelData(rows, dates, perfMap) {
  const byPeriod = { current: {}, previous: {} };

  // Aggregate by period + channel
  rows.forEach(row => {
    const p = byPeriod[row.period];
    if (!p) return;
    const ch = row.channel;
    if (!p[ch]) p[ch] = { sessions: 0, view_item: 0, atc: 0, checkout: 0, purchase: 0, revenue: 0, open_checkout: 0, open_purchase: 0, open_revenue: 0 };
    p[ch].sessions += row.sessions;
    p[ch].view_item += row.users_view_item;
    p[ch].atc += row.users_atc;
    p[ch].checkout += row.users_checkout;
    p[ch].purchase += row.users_purchase;
    p[ch].revenue += Number(row.revenue) || 0;
    p[ch].open_checkout += row.open_checkout;
    p[ch].open_purchase += row.open_purchase;
    p[ch].open_revenue += Number(row.open_revenue) || 0;
  });

  // Build channel list
  const allChannels = new Set([...Object.keys(byPeriod.current), ...Object.keys(byPeriod.previous)]);
  const channels = [];
  for (const ch of allChannels) {
    const c = byPeriod.current[ch] || { ...ZERO_CH };
    const p = byPeriod.previous[ch] || { ...ZERO_CH };
    channels.push({
      channel: ch, ...c,
      sessions_prev: p.sessions, view_item_prev: p.view_item, atc_prev: p.atc, checkout_prev: p.checkout,
      purchase_prev: p.purchase, revenue_prev: p.revenue,
      open_checkout_prev: p.open_checkout, open_purchase_prev: p.open_purchase, open_revenue_prev: p.open_revenue,
    });
  }
  channels.sort((a, b) => b.sessions - a.sessions);

  // Overall funnel (both modes)
  const closed = buildFunnelSteps(channels, 'closed');
  const open = buildFunnelSteps(channels, 'open');
  const funnel = closed.funnel;
  const step_conversion = closed.step_conversion;

  // Landing pages (aggregate across channels and periods=current only)
  const pageTotals = {};
  rows.filter(r => r.period === 'current' && r.landing_path).forEach(row => {
    const pg = row.landing_path;
    if (!pageTotals[pg]) pageTotals[pg] = { sessions: 0, view_item: 0, atc: 0, purchase: 0, revenue: 0 };
    pageTotals[pg].sessions += row.sessions;
    pageTotals[pg].view_item += row.users_view_item;
    pageTotals[pg].atc += row.users_atc;
    pageTotals[pg].purchase += row.users_purchase;
    pageTotals[pg].revenue += Number(row.revenue) || 0;
  });

  const landing_pages = Object.entries(pageTotals)
    .filter(([, v]) => v.sessions >= 50)
    .sort((a, b) => b[1].sessions - a[1].sessions)
    .slice(0, 30)
    .map(([page, v]) => ({
      page, sessions: v.sessions, view_item: v.view_item, atc: v.atc, purchases: v.purchase, revenue: v.revenue,
      view_item_cr: v.sessions ? v.view_item / v.sessions : 0,
      atc_cr: v.sessions ? v.atc / v.sessions : 0,
      purchase_cr: v.sessions ? v.purchase / v.sessions : 0,
    }));

  // Page funnels (per-page channel breakdown for pages with 80+ ATCs)
  const pageChannelData = {};
  rows.filter(r => r.landing_path).forEach(row => {
    const pg = row.landing_path;
    if (!pageChannelData[pg]) pageChannelData[pg] = { current: {}, previous: {} };
    const target = pageChannelData[pg][row.period];
    if (!target) return;
    if (!target[row.channel]) target[row.channel] = { ...ZERO_CH };
    const t = target[row.channel];
    t.sessions += row.sessions;
    t.view_item += row.users_view_item;
    t.atc += row.users_atc;
    t.checkout += row.users_checkout;
    t.purchase += row.users_purchase;
    t.revenue += Number(row.revenue) || 0;
    t.open_checkout += row.open_checkout;
    t.open_purchase += row.open_purchase;
    t.open_revenue += Number(row.open_revenue) || 0;
  });

  const page_funnels = {};
  for (const [page, periods] of Object.entries(pageChannelData)) {
    const curr = periods.current || {};
    const totalAtcPage = Object.values(curr).reduce((s, c) => s + c.atc, 0);
    if (totalAtcPage < 80) continue;

    const prev = periods.previous || {};
    const chNames = new Set([...Object.keys(curr), ...Object.keys(prev)]);
    const chList = [];
    for (const ch of chNames) {
      const c = curr[ch] || { ...ZERO_CH };
      const p = prev[ch] || { ...ZERO_CH };
      chList.push({
        channel: ch, ...c,
        sessions_prev: p.sessions, view_item_prev: p.view_item, atc_prev: p.atc, checkout_prev: p.checkout,
        purchase_prev: p.purchase, revenue_prev: p.revenue,
        open_checkout_prev: p.open_checkout, open_purchase_prev: p.open_purchase, open_revenue_prev: p.open_revenue,
      });
    }
    chList.sort((a, b) => b.sessions - a.sessions);

    const sm = (key) => chList.reduce((s, c) => s + c[key], 0);
    const closedPg = buildFunnelSteps(chList, 'closed');
    const openPg = buildFunnelSteps(chList, 'open');

    page_funnels[page] = {
      sessions: sm('sessions'), atc: sm('atc'),
      funnel: closedPg.funnel, step_conversion: closedPg.step_conversion,
      open_funnel: openPg.funnel, open_step_conversion: openPg.step_conversion,
      channels: chList,
    };
  }

  // Performance funnels — aggregate all URL variants for the same performance_id
  const perfAgg = {};
  rows.filter(r => r.landing_path).forEach(row => {
    const perfId = extractPerfId(row.landing_path);
    if (!perfId || !perfMap[perfId]) return;
    if (!perfAgg[perfId]) perfAgg[perfId] = { current: {}, previous: {} };
    const target = perfAgg[perfId][row.period];
    if (!target) return;
    const ch = row.channel;
    if (!target[ch]) target[ch] = { ...ZERO_CH };
    target[ch].sessions += row.sessions;
    target[ch].view_item += row.users_view_item;
    target[ch].atc += row.users_atc;
    target[ch].checkout += row.users_checkout;
    target[ch].purchase += row.users_purchase;
    target[ch].revenue += Number(row.revenue) || 0;
    target[ch].open_checkout += row.open_checkout;
    target[ch].open_purchase += row.open_purchase;
    target[ch].open_revenue += Number(row.open_revenue) || 0;
  });

  const performance_funnels = {};
  for (const [perfId, periods] of Object.entries(perfAgg)) {
    const curr = periods.current || {};
    const totalAtcPerf = Object.values(curr).reduce((s, c) => s + c.atc, 0);
    if (totalAtcPerf < 3) continue;

    const prev = periods.previous || {};
    const chNames = new Set([...Object.keys(curr), ...Object.keys(prev)]);
    const chList = [];
    for (const ch of chNames) {
      const c = curr[ch] || { ...ZERO_CH };
      const p = prev[ch] || { ...ZERO_CH };
      chList.push({
        channel: ch, ...c,
        sessions_prev: p.sessions, view_item_prev: p.view_item, atc_prev: p.atc, checkout_prev: p.checkout,
        purchase_prev: p.purchase, revenue_prev: p.revenue,
        open_checkout_prev: p.open_checkout, open_purchase_prev: p.open_purchase, open_revenue_prev: p.open_revenue,
      });
    }
    chList.sort((a, b) => b.sessions - a.sessions);

    const sm = (key) => chList.reduce((s, c) => s + c[key], 0);
    const closedPerf = buildFunnelSteps(chList, 'closed');
    const openPerf = buildFunnelSteps(chList, 'open');

    const perf = perfMap[perfId];
    performance_funnels[perfId] = {
      performance_id: perfId,
      title: perf.title,
      series: perf.series,
      date: perf.performance_date ? perf.performance_date.value : null,
      venue: perf.venue,
      sessions: sm('sessions'), atc: sm('atc'),
      funnel: closedPerf.funnel, step_conversion: closedPerf.step_conversion,
      open_funnel: openPerf.funnel, open_step_conversion: openPerf.step_conversion,
      channels: chList,
    };
  }

  return {
    period: dates.periodLabel,
    comparison_period: dates.comparisonLabel,
    funnel, channels, step_conversion,
    open_funnel: open.funnel, open_step_conversion: open.step_conversion,
    landing_pages, page_funnels, performance_funnels,
    data_source: 'bigquery_closed_funnel',
    tracking_gaps: ['view_item tag recently deployed — historical data for this step will be sparse until it accumulates'],
  };
}

module.exports = { queryClosedFunnel };
