async function fetchMetaInsights(startDate, endDate) {
  const token = process.env.META_ACCESS_TOKEN;
  const adAccount = process.env.META_AD_ACCOUNT_ID;

  if (!token || !adAccount) {
    return { spend: null, impressions: null, clicks: null, purchases: null, error: 'Meta credentials not configured' };
  }

  const timeRange = JSON.stringify({ since: startDate, until: endDate });
  const params = new URLSearchParams({
    access_token: token,
    time_range: timeRange,
    fields: 'spend,impressions,clicks,actions',
    level: 'account',
  });

  const url = `https://graph.facebook.com/v21.0/${adAccount}/insights?${params}`;

  try {
    const resp = await fetch(url);
    const body = await resp.json();

    if (body.error) {
      const msg = body.error.message || JSON.stringify(body.error);
      if (body.error.type === 'OAuthException') {
        return { spend: null, error: `Meta token expired. Regenerate META_ACCESS_TOKEN (Meta Business System User token recommended) and update it in Netlify env vars, then redeploy.` };
      }
      return { spend: null, error: `Meta API error: ${msg}` };
    }

    const data = (body.data || [])[0] || {};
    const actions = data.actions || [];
    const purchaseAction = actions.find(a => a.action_type === 'purchase') || {};

    return {
      spend: parseFloat(data.spend || 0),
      impressions: parseInt(data.impressions || 0, 10),
      clicks: parseInt(data.clicks || 0, 10),
      purchases: parseInt(purchaseAction.value || 0, 10),
      error: null,
    };
  } catch (err) {
    return { spend: null, error: `Meta connection failed: ${err.message}` };
  }
}

module.exports = { fetchMetaInsights };
