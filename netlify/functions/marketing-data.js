const { getGA4Client, runReport, isMetaSource } = require('./lib/ga4');
const { fetchMetaInsights } = require('./lib/meta');
const { fetchStackAdaptSpend } = require('./lib/stackadapt');
const { fetchTikTokInsights } = require('./lib/tiktok');
const { attributeSpend } = require('./lib/spend-mapping');
const { queryClosedFunnel } = require('./lib/bq-funnel');

const FUNNEL_POSITION = {
  'Organic Search': 'Bottom-funnel. User has existing awareness; searching for specifics.',
  'Paid Search': 'Bottom-funnel. Captures active demand via branded/program keywords.',
  'Direct': 'Bottom-funnel. Returning visitors with existing awareness.',
  'Email': 'Mid-funnel. Reaching existing subscribers/attendees.',
  'Display': 'Top-funnel. Awareness/prospecting; not expected to convert directly.',
  'Paid Social': 'Top-funnel. Awareness/interest building; creates demand that converts later via other channels.',
  'Cross-network': 'Mixed. Google PMax auto-allocates across search/display/YouTube.',
  'Organic Social': 'Top-funnel. Earned social reach.',
  'Unassigned (Meta)': 'Top-funnel. Meta Audience Network placements; very low direct conversion (<1%).',
  'Unassigned (Other)': 'Unknown. Traffic GA4 could not classify into a standard channel.',
};

const CHANNEL_METRICS = [
  'sessions', 'totalUsers', 'engagedSessions',
  'ecommercePurchases', 'purchaseRevenue',
  'averageSessionDuration', 'screenPageViewsPerSession',
  'newUsers', 'advertiserAdCost',
];

function computeDateRanges({ days, startDate, endDate }) {
  const fmt = d => d.toISOString().split('T')[0];
  const label = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  let currentStart, currentEnd;

  if (startDate && endDate) {
    currentStart = new Date(startDate + 'T00:00:00');
    currentEnd = new Date(endDate + 'T00:00:00');
  } else {
    const now = new Date();
    currentEnd = new Date(now);
    currentEnd.setDate(currentEnd.getDate() - 1);
    currentStart = new Date(currentEnd);
    currentStart.setDate(currentStart.getDate() - ((days || 30) - 1));
  }

  const periodDays = Math.round((currentEnd - currentStart) / (1000 * 60 * 60 * 24)) + 1;

  const prevEnd = new Date(currentStart);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (periodDays - 1));

  const dailyStart = new Date(currentEnd);
  dailyStart.setDate(dailyStart.getDate() - 59);

  return {
    currentStart: fmt(currentStart),
    currentEnd: fmt(currentEnd),
    prevStart: fmt(prevStart),
    prevEnd: fmt(prevEnd),
    dailyStart: fmt(dailyStart),
    periodLabel: `${label(currentStart)} – ${label(currentEnd)}`,
    comparisonLabel: `${label(prevStart)} – ${label(prevEnd)}`,
  };
}

function parseChannelRows(rows, periodName) {
  const channels = {};
  rows.forEach(row => {
    if (row.dateRange !== periodName) return;
    const ch = row.sessionDefaultChannelGroup;
    channels[ch] = {
      sessions: row.sessions || 0,
      users: row.totalUsers || 0,
      engagedSessions: row.engagedSessions || 0,
      purchases: row.ecommercePurchases || 0,
      revenue: row.purchaseRevenue || 0,
      avgDuration: row.averageSessionDuration || 0,
      pagesPerSession: row.screenPageViewsPerSession || 0,
      newUsers: row.newUsers || 0,
      adCost: row.advertiserAdCost || 0,
    };
  });
  return channels;
}

async function fetchChannelMetrics(client, dates) {
  const rows = await runReport(client, {
    dateRanges: [
      { startDate: dates.currentStart, endDate: dates.currentEnd, name: 'current' },
      { startDate: dates.prevStart, endDate: dates.prevEnd, name: 'previous' },
    ],
    dimensions: ['sessionDefaultChannelGroup'],
    metrics: CHANNEL_METRICS,
  });

  const current = parseChannelRows(rows, 'current');
  const previous = parseChannelRows(rows, 'previous');
  return { current, previous };
}

async function fetchUnassignedBreakdown(client, dates) {
  const rows = await runReport(client, {
    dateRanges: [
      { startDate: dates.currentStart, endDate: dates.currentEnd, name: 'current' },
      { startDate: dates.prevStart, endDate: dates.prevEnd, name: 'previous' },
    ],
    dimensions: ['sessionDefaultChannelGroup', 'sessionSource'],
    metrics: CHANNEL_METRICS,
    dimensionFilter: {
      filter: {
        fieldName: 'sessionDefaultChannelGroup',
        stringFilter: { matchType: 'EXACT', value: 'Unassigned' },
      },
    },
  });

  const result = { current: {}, previous: {} };

  for (const periodName of ['current', 'previous']) {
    const key = periodName;
    const meta = { sessions: 0, users: 0, engagedSessions: 0, purchases: 0, revenue: 0, avgDuration: 0, pagesPerSession: 0, newUsers: 0, adCost: 0 };
    const other = { ...meta };
    let metaCount = 0, otherCount = 0;

    rows.filter(r => r.dateRange === periodName).forEach(row => {
      const target = isMetaSource(row.sessionSource) ? meta : other;
      const counter = isMetaSource(row.sessionSource) ? 'meta' : 'other';
      target.sessions += row.sessions || 0;
      target.users += row.totalUsers || 0;
      target.engagedSessions += row.engagedSessions || 0;
      target.purchases += row.ecommercePurchases || 0;
      target.revenue += row.purchaseRevenue || 0;
      target.newUsers += row.newUsers || 0;
      target.adCost += row.advertiserAdCost || 0;
      if (counter === 'meta') metaCount++; else otherCount++;
    });

    // Weighted averages for duration and pages/session
    const periodRows = rows.filter(r => r.dateRange === periodName);
    const metaRows = periodRows.filter(r => isMetaSource(r.sessionSource));
    const otherRows = periodRows.filter(r => !isMetaSource(r.sessionSource));

    const weightedAvg = (items, field) => {
      const totalSess = items.reduce((s, r) => s + (r.sessions || 0), 0);
      if (!totalSess) return 0;
      return items.reduce((s, r) => s + (r[field] || 0) * (r.sessions || 0), 0) / totalSess;
    };

    meta.avgDuration = weightedAvg(metaRows, 'averageSessionDuration');
    meta.pagesPerSession = weightedAvg(metaRows, 'screenPageViewsPerSession');
    other.avgDuration = weightedAvg(otherRows, 'averageSessionDuration');
    other.pagesPerSession = weightedAvg(otherRows, 'screenPageViewsPerSession');

    result[key]['Unassigned (Meta)'] = meta;
    result[key]['Unassigned (Other)'] = other;
  }

  return result;
}

async function fetchTopPages(client, dates) {
  const rows = await runReport(client, {
    dateRanges: [{ startDate: dates.currentStart, endDate: dates.currentEnd }],
    dimensions: ['sessionDefaultChannelGroup', 'landingPagePlusQueryString'],
    metrics: ['sessions', 'ecommercePurchases'],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 300,
  });

  const byChannel = {};
  rows.forEach(row => {
    const ch = row.sessionDefaultChannelGroup;
    if (!byChannel[ch]) byChannel[ch] = [];
    byChannel[ch].push({
      page: row.landingPagePlusQueryString,
      sessions: row.sessions,
      cr: row.sessions ? row.ecommercePurchases / row.sessions : 0,
    });
  });

  Object.keys(byChannel).forEach(ch => {
    byChannel[ch] = byChannel[ch].slice(0, 5);
  });

  return byChannel;
}

async function fetchSourceMedium(client, dates) {
  const rows = await runReport(client, {
    dateRanges: [{ startDate: dates.currentStart, endDate: dates.currentEnd }],
    dimensions: ['sessionDefaultChannelGroup', 'sessionSource', 'sessionMedium'],
    metrics: ['sessions', 'engagedSessions', 'ecommercePurchases', 'purchaseRevenue'],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 10000,
  });

  const byChannel = {};
  rows.forEach(row => {
    // Mirror the channel renaming in assembleChannelData: Unassigned Meta
    // traffic rolls into Paid Social, the rest becomes Unassigned (Other)
    let ch = row.sessionDefaultChannelGroup;
    if (ch === 'Unassigned') {
      ch = isMetaSource(row.sessionSource) ? 'Paid Social' : 'Unassigned (Other)';
    }
    if (!byChannel[ch]) byChannel[ch] = [];
    byChannel[ch].push({
      source: row.sessionSource,
      medium: row.sessionMedium,
      sessions: row.sessions || 0,
      eng_rate: row.sessions ? (row.engagedSessions || 0) / row.sessions : 0,
      purchases: row.ecommercePurchases || 0,
      revenue: row.purchaseRevenue || 0,
    });
  });

  Object.keys(byChannel).forEach(ch => {
    byChannel[ch].sort((a, b) => b.sessions - a.sessions);
  });

  return byChannel;
}

async function fetchDailySessions(client, dates) {
  const rows = await runReport(client, {
    dateRanges: [{ startDate: dates.dailyStart, endDate: dates.currentEnd }],
    dimensions: ['date', 'sessionDefaultChannelGroup'],
    metrics: ['sessions'],
    orderBys: [{ dimension: { dimensionName: 'date' } }],
    limit: 10000,
  });

  const dailyMap = {};
  rows.forEach(row => {
    const date = row.date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
    if (!dailyMap[date]) dailyMap[date] = { date };
    dailyMap[date][row.sessionDefaultChannelGroup] = row.sessions;
  });

  return Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchDailyUnassignedSplit(client, dates) {
  const rows = await runReport(client, {
    dateRanges: [{ startDate: dates.dailyStart, endDate: dates.currentEnd }],
    dimensions: ['date', 'sessionSource'],
    metrics: ['sessions'],
    dimensionFilter: {
      filter: {
        fieldName: 'sessionDefaultChannelGroup',
        stringFilter: { matchType: 'EXACT', value: 'Unassigned' },
      },
    },
    limit: 10000,
  });

  const dailyMap = {};
  rows.forEach(row => {
    const date = row.date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
    if (!dailyMap[date]) dailyMap[date] = { meta: 0, other: 0 };
    if (isMetaSource(row.sessionSource)) {
      dailyMap[date].meta += row.sessions;
    } else {
      dailyMap[date].other += row.sessions;
    }
  });

  return dailyMap;
}

function assembleChannelData(ga4Current, ga4Previous, unassigned, metaSpend, stackadaptSpend, tiktokSpend, topPages, sourceMedium, daily, dailyUnassigned, dates) {
  const sessionsByChannel = {};
  const channels = [];

  // Build channel list from GA4, replacing raw Unassigned with split
  const allChannelNames = new Set([...Object.keys(ga4Current), ...Object.keys(ga4Previous)]);
  allChannelNames.delete('Unassigned');

  if (unassigned.current['Unassigned (Meta)']?.sessions > 0) allChannelNames.add('Unassigned (Meta)');
  if (unassigned.current['Unassigned (Other)']?.sessions > 0) allChannelNames.add('Unassigned (Other)');

  for (const ch of allChannelNames) {
    let curr, prev;

    if (ch === 'Unassigned (Meta)' || ch === 'Unassigned (Other)') {
      curr = unassigned.current[ch] || {};
      prev = unassigned.previous[ch] || {};
    } else {
      curr = ga4Current[ch] || {};
      prev = ga4Previous[ch] || {};
    }

    const sessions = curr.sessions || 0;
    const sessionsPrev = prev.sessions || 0;

    sessionsByChannel[ch] = sessions;

    channels.push({
      channel: ch,
      funnel_pos: FUNNEL_POSITION[ch] || '',
      sessions,
      sessions_prev: sessionsPrev,
      users: curr.users || 0,
      users_prev: prev.users || 0,
      eng_rate: sessions ? (curr.engagedSessions || 0) / sessions : 0,
      eng_rate_prev: sessionsPrev ? (prev.engagedSessions || 0) / sessionsPrev : 0,
      purchases: curr.purchases || 0,
      purchases_prev: prev.purchases || 0,
      revenue: curr.revenue || 0,
      revenue_prev: prev.revenue || 0,
      spend: null,
      avg_duration: curr.avgDuration || 0,
      avg_duration_prev: prev.avgDuration || 0,
      pages_per_session: curr.pagesPerSession || 0,
      pages_per_session_prev: prev.pagesPerSession || 0,
      new_user_pct: curr.users ? (curr.newUsers || 0) / curr.users : 0,
      new_user_pct_prev: prev.users ? (prev.newUsers || 0) / prev.users : 0,
      top_pages: topPages[ch] || topPages['Unassigned'] || [],
      sources: sourceMedium[ch] || [],
    });
  }

  // Attribute ad platform spend
  const platformSpends = [
    { key: 'meta', data: metaSpend },
    { key: 'stackadapt', data: stackadaptSpend },
    { key: 'tiktok', data: tiktokSpend },
  ];

  for (const { key, data } of platformSpends) {
    if (data && data.spend != null) {
      const attribution = attributeSpend(key, data.spend, sessionsByChannel);
      channels.forEach(ch => {
        if (attribution[ch.channel] != null) {
          if (ch.spend == null) {
            ch.spend = attribution[ch.channel];
          } else {
            ch.spend += attribution[ch.channel];
          }
        }
      });
    }
  }

  // Add GA4-reported ad cost (Google Ads / PMax) on top of platform spend
  channels.forEach(ch => {
    const curr = ch.channel === 'Unassigned (Meta)' || ch.channel === 'Unassigned (Other)'
      ? unassigned.current[ch.channel]
      : ga4Current[ch.channel];
    const adCost = curr?.adCost || 0;
    if (adCost > 0) {
      ch.spend = (ch.spend || 0) + adCost;
    }
  });

  // Merge Unassigned (Meta) into Paid Social
  const metaIdx = channels.findIndex(c => c.channel === 'Unassigned (Meta)');
  const paidSocialIdx = channels.findIndex(c => c.channel === 'Paid Social');
  if (metaIdx !== -1 && paidSocialIdx !== -1) {
    const ps = channels[paidSocialIdx];
    const um = channels[metaIdx];
    ps.sessions += um.sessions;
    ps.sessions_prev += um.sessions_prev;
    ps.users += um.users;
    ps.users_prev += um.users_prev;
    ps.purchases += um.purchases;
    ps.purchases_prev += um.purchases_prev;
    ps.revenue += um.revenue;
    ps.revenue_prev += um.revenue_prev;
    ps.new_user_pct = ps.users ? ((ps.new_user_pct * (ps.users - um.users)) + (um.new_user_pct * um.users)) / ps.users : 0;
    if (um.spend != null) ps.spend = (ps.spend || 0) + um.spend;
    const totalSess = ps.sessions;
    const psSess = ps.sessions - um.sessions;
    if (totalSess > 0) {
      ps.eng_rate = ((ps.eng_rate * psSess) + (um.eng_rate * um.sessions)) / totalSess;
      ps.avg_duration = ((ps.avg_duration * psSess) + (um.avg_duration * um.sessions)) / totalSess;
      ps.pages_per_session = ((ps.pages_per_session * psSess) + (um.pages_per_session * um.sessions)) / totalSess;
    }
    const totalSessPrev = ps.sessions_prev;
    const psSessPrev = ps.sessions_prev - um.sessions_prev;
    if (totalSessPrev > 0) {
      ps.eng_rate_prev = ((ps.eng_rate_prev * psSessPrev) + (um.eng_rate_prev * um.sessions_prev)) / totalSessPrev;
      ps.avg_duration_prev = ((ps.avg_duration_prev * psSessPrev) + (um.avg_duration_prev * um.sessions_prev)) / totalSessPrev;
      ps.pages_per_session_prev = ((ps.pages_per_session_prev * psSessPrev) + (um.pages_per_session_prev * um.sessions_prev)) / totalSessPrev;
    }
    ps.top_pages = [...ps.top_pages, ...um.top_pages].sort((a, b) => b.sessions - a.sessions).slice(0, 5);
    channels.splice(metaIdx, 1);
  }

  // Sort by sessions descending
  channels.sort((a, b) => b.sessions - a.sessions);

  // Build daily with Unassigned split
  const channelsList = channels.map(c => c.channel);
  const dailyData = daily.map(day => {
    const row = { date: day.date };
    channelsList.forEach(ch => {
      if (ch === 'Paid Social') {
        row[ch] = (day[ch] || 0) + (dailyUnassigned[day.date]?.meta || 0);
      } else if (ch === 'Unassigned (Other)') {
        row[ch] = dailyUnassigned[day.date]?.other || 0;
      } else {
        row[ch] = day[ch] || 0;
      }
    });
    return row;
  });

  return {
    generated: new Date().toISOString(),
    period: dates.periodLabel,
    comparison_period: dates.comparisonLabel,
    channels,
    daily: dailyData,
    channels_list: channelsList,
    meta_status: metaSpend?.error || null,
    stackadapt_status: stackadaptSpend?.error || null,
    tiktok_status: tiktokSpend?.error || null,
  };
}

async function getFunnelData({ days, startDate, endDate }) {
  return queryClosedFunnel({ days, startDate, endDate });
}

async function getChannelPerformance({ days, startDate, endDate }) {
  const client = getGA4Client();
  const dates = computeDateRanges({ days, startDate, endDate });

  const [channelData, unassigned, topPages, sourceMedium, daily, dailyUnassigned, metaSpend, stackadaptSpend, tiktokSpend] = await Promise.all([
    fetchChannelMetrics(client, dates),
    fetchUnassignedBreakdown(client, dates),
    fetchTopPages(client, dates),
    fetchSourceMedium(client, dates),
    fetchDailySessions(client, dates),
    fetchDailyUnassignedSplit(client, dates),
    fetchMetaInsights(dates.currentStart, dates.currentEnd),
    Promise.resolve(fetchStackAdaptSpend(dates.currentStart, dates.currentEnd)),
    fetchTikTokInsights(dates.currentStart, dates.currentEnd),
  ]);

  return assembleChannelData(
    channelData.current, channelData.previous,
    unassigned, metaSpend, stackadaptSpend, tiktokSpend, topPages, sourceMedium, daily, dailyUnassigned, dates
  );
}

function corsHeaders(event) {
  const origin = (event.headers || {}).origin || '';
  const allowed = origin.endsWith('.netlify.app') || origin.startsWith('http://localhost:');
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'https://kcsdashboard.netlify.app',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };
}

exports.handler = async (event) => {
  const headers = corsHeaders(event);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const { view = 'channels', days = '30', startDate, endDate } = event.queryStringParameters || {};

  try {
    let data;

    switch (view) {
      case 'channels':
        data = await getChannelPerformance(
          startDate && endDate
            ? { startDate, endDate }
            : { days: parseInt(days, 10) }
        );
        break;
      case 'funnel':
        data = await getFunnelData(
          startDate && endDate
            ? { startDate, endDate }
            : { days: parseInt(days, 10) }
        );
        break;
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Unknown view: ${view}. Available: channels, funnel` }),
        };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data),
    };
  } catch (err) {
    console.error('Marketing data error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
