// Constant Contact v3 API client for the marketing dashboard's Email tab.
//
// Auth: OAuth2 refresh-token grant. The app key is configured for long-lived
// (non-rotating) refresh tokens, so CC_REFRESH_TOKEN can live in env. Mint it
// once with scripts/active/auth-constantcontact.js.
//
// Env: CC_CLIENT_ID, CC_CLIENT_SECRET, CC_REFRESH_TOKEN.

const TOKEN_URL = 'https://authz.constantcontact.com/oauth2/default/v1/token';
const API_BASE = 'https://api.cc.email/v3';

async function getAccessToken() {
  const clientId = process.env.CC_CLIENT_ID;
  const clientSecret = process.env.CC_CLIENT_SECRET;
  const refreshToken = process.env.CC_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Constant Contact env not set (need CC_CLIENT_ID, CC_CLIENT_SECRET, CC_REFRESH_TOKEN)');
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  });
  const data = await resp.json();
  if (!resp.ok || !data.access_token) {
    throw new Error(`CC token refresh failed (HTTP ${resp.status}): ${JSON.stringify(data)}`);
  }
  // Safety net: the app is set to long-lived tokens (no rotation). If CC ever
  // returns a changed refresh token, the stored one is now stale — surface it loudly.
  if (data.refresh_token && data.refresh_token !== refreshToken) {
    console.warn('CC returned a rotated refresh token; CC_REFRESH_TOKEN must be updated in env or future syncs will fail.');
  }
  return data.access_token;
}

async function ccGet(apiPath, accessToken) {
  const resp = await fetch(`${API_BASE}${apiPath}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`CC GET ${apiPath} failed (HTTP ${resp.status}): ${body.slice(0, 300)}`);
  }
  return resp.json();
}

// Walk a paginated v3 collection via _links.next.href until exhausted.
async function ccGetAll(firstPath, accessToken, listKey) {
  const out = [];
  let apiPath = firstPath;
  let guard = 0;
  while (apiPath && guard < 500) {
    const page = await ccGet(apiPath, accessToken);
    out.push(...(page[listKey] || []));

    let next = page._links && page._links.next && page._links.next.href;
    if (next) {
      // href may be absolute or "/v3/..."; normalize to a path relative to API_BASE.
      if (next.startsWith('http')) {
        const u = new URL(next);
        next = u.pathname.replace(/^\/v3/, '') + u.search;
      } else {
        next = next.replace(/^\/v3/, '');
      }
    }
    apiPath = next || null;
    guard++;
  }
  return out;
}

// Returns one record per campaign: stats (from summary report) joined with the
// campaign name (from /emails). Mobile/desktop open split is not available in
// the bulk endpoint, so it is omitted (the read layer returns null for it).
async function fetchEmailCampaignData() {
  const token = await getAccessToken();

  const summaries = await ccGetAll(
    '/reports/summary_reports/email_campaign_summaries?limit=500',
    token,
    'bulk_email_campaign_summaries'
  );

  const emails = await ccGetAll('/emails?limit=500', token, 'campaigns');
  const nameById = {};
  emails.forEach(e => { nameById[e.campaign_id] = e.name || e.campaign_name || null; });

  return summaries.map(s => {
    const c = s.unique_counts || {};
    return {
      campaign_id: s.campaign_id,
      campaign_name: nameById[s.campaign_id] || null,
      campaign_type: s.campaign_type || null,
      last_sent_date: s.last_sent_date || null,
      sends: c.sends || 0,
      opens: c.opens || 0,
      clicks: c.clicks || 0,
      forwards: c.forwards || 0,
      optouts: c.optouts || 0,
      abuse: c.abuse || 0,
      bounces: c.bounces || 0,
      not_opened: c.not_opened || 0,
    };
  });
}

module.exports = { fetchEmailCampaignData, getAccessToken };
