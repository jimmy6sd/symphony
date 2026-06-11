// Prorates manually-maintained monthly totals across a query date range.
// Used for ad platforms without a live API connection — the env var holds a
// JSON array of {month: 'YYYY-MM', spend, impressions, clicks}.
function prorateMonthlySpend(raw, startDate, endDate, envVarName) {
  if (!raw) {
    return { spend: null, impressions: null, clicks: null, error: `${envVarName} not configured` };
  }

  let entries;
  try {
    entries = JSON.parse(raw);
  } catch (e) {
    return { spend: null, error: `Invalid ${envVarName} JSON` };
  }

  if (!Array.isArray(entries) || !entries.length) {
    return { spend: null, error: `${envVarName} is empty` };
  }

  // All boundaries at 00:00 of their day so day counts come out exact
  const qStart = new Date(startDate + 'T00:00:00');
  const qEnd = new Date(endDate + 'T00:00:00');

  let totalSpend = 0;
  let totalImpressions = 0;
  let totalClicks = 0;

  for (const entry of entries) {
    const monthStart = new Date(entry.month + '-01T00:00:00');
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);

    const overlapStart = qStart > monthStart ? qStart : monthStart;
    const overlapEnd = qEnd < monthEnd ? qEnd : monthEnd;

    if (overlapStart > overlapEnd) continue;

    const daysInMonth = Math.round((monthEnd - monthStart) / (1000 * 60 * 60 * 24)) + 1;
    const overlapDays = Math.round((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1;
    const fraction = overlapDays / daysInMonth;

    totalSpend += (entry.spend || 0) * fraction;
    totalImpressions += Math.round((entry.impressions || 0) * fraction);
    totalClicks += Math.round((entry.clicks || 0) * fraction);
  }

  return {
    spend: Math.round(totalSpend * 100) / 100,
    impressions: totalImpressions,
    clicks: totalClicks,
    error: null,
  };
}

const GRAPHQL_URL = 'https://api.stackadapt.com/graphql';

const DELIVERY_QUERY = `query($from: ISO8601Date, $to: ISO8601Date) {
  advertiserDelivery(dataType: TABLE, granularity: TOTAL, date: { from: $from, to: $to }) {
    ... on AdvertiserDeliveryOutcome {
      totalStats { cost impressionsBigint clicksBigint conversionsBigint }
    }
    ... on Progress { __typename }
  }
}`;

async function fetchStackAdaptSpend(startDate, endDate) {
  const token = process.env.STACKADAPT_API_TOKEN;
  if (!token) {
    return prorateMonthlySpend(process.env.STACKADAPT_SPEND_DATA, startDate, endDate, 'STACKADAPT_SPEND_DATA');
  }

  try {
    // advertiserDelivery returns Progress while the stats job is computing — retry briefly
    for (let attempt = 0; attempt < 3; attempt++) {
      const resp = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: DELIVERY_QUERY,
          variables: { from: startDate, to: endDate },
        }),
      });

      if (resp.status === 401 || resp.status === 403) {
        return { spend: null, error: 'StackAdapt token invalid or expired — request a new key from StackAdapt' };
      }

      const body = await resp.json();

      if (body.errors?.length) {
        return { spend: null, error: `StackAdapt API error: ${body.errors[0].message}` };
      }

      const stats = body.data?.advertiserDelivery?.totalStats;
      if (stats) {
        return {
          spend: parseFloat(stats.cost || 0),
          impressions: parseInt(stats.impressionsBigint || 0, 10),
          clicks: parseInt(stats.clicksBigint || 0, 10),
          purchases: parseInt(stats.conversionsBigint || 0, 10),
          error: null,
        };
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    return { spend: null, error: 'StackAdapt stats job did not complete in time' };
  } catch (err) {
    return { spend: null, error: `StackAdapt connection failed: ${err.message}` };
  }
}

module.exports = { fetchStackAdaptSpend, prorateMonthlySpend };
