const { prorateMonthlySpend } = require('./stackadapt');

async function fetchTikTokInsights(startDate, endDate) {
  const token = process.env.TIKTOK_ACCESS_TOKEN;
  const advertiserId = process.env.TIKTOK_ADVERTISER_ID;

  if (!token || !advertiserId) {
    // No API credentials yet (app verification pending) — fall back to
    // manual monthly totals exported from TikTok Ads Manager.
    return prorateMonthlySpend(process.env.TIKTOK_SPEND_DATA, startDate, endDate, 'TIKTOK_SPEND_DATA');
  }

  const params = new URLSearchParams({
    advertiser_id: advertiserId,
    report_type: 'BASIC',
    data_level: 'AUCTION_ADVERTISER',
    dimensions: JSON.stringify(['advertiser_id']),
    metrics: JSON.stringify(['spend', 'impressions', 'clicks', 'complete_payment']),
    start_date: startDate,
    end_date: endDate,
    page_size: 1,
  });

  const url = `https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/?${params}`;

  try {
    const resp = await fetch(url, {
      headers: { 'Access-Token': token },
    });
    const body = await resp.json();

    if (body.code !== 0) {
      const msg = body.message || JSON.stringify(body);
      if (body.code === 40105) {
        return { spend: null, error: 'TikTok token expired — generate a new one in TikTok Business Center' };
      }
      return { spend: null, error: `TikTok API error: ${msg}` };
    }

    const row = (body.data?.list || [])[0]?.metrics || {};

    return {
      spend: parseFloat(row.spend || 0),
      impressions: parseInt(row.impressions || 0, 10),
      clicks: parseInt(row.clicks || 0, 10),
      purchases: parseInt(row.complete_payment || 0, 10),
      error: null,
    };
  } catch (err) {
    return { spend: null, error: `TikTok connection failed: ${err.message}` };
  }
}

module.exports = { fetchTikTokInsights };
