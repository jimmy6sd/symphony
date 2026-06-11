// One-time exchange of a TikTok Marketing API auth code for a long-term
// access token, for the marketing dashboard's TikTok spend integration
// (netlify/functions/lib/tiktok.js).
//
// Prerequisites:
//   1. Developer app created at https://business-api.tiktok.com/portal
//      with Reporting (read) scope, approved by TikTok.
//   2. Someone with access to the KC Symphony TikTok Ads account opens the
//      app's Authorization URL and approves it. The redirect URL will contain
//      an `auth_code` query param — copy it quickly, auth codes are
//      short-lived.
//
// Usage: node scripts/active/auth-tiktok.js <app_id> <secret> <auth_code>
//
// On success, prints the access token and advertiser ID(s). Set them as
// TIKTOK_ACCESS_TOKEN and TIKTOK_ADVERTISER_ID in .env and the Netlify
// dashboard. Marketing API tokens do not expire unless revoked.

const [appId, secret, authCode] = process.argv.slice(2);

if (!appId || !secret || !authCode) {
  console.error('Usage: node scripts/active/auth-tiktok.js <app_id> <secret> <auth_code>');
  process.exit(1);
}

async function main() {
  const resp = await fetch('https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, secret, auth_code: authCode }),
  });
  const body = await resp.json();

  if (body.code !== 0) {
    console.error(`TikTok token exchange failed (code ${body.code}): ${body.message}`);
    if (body.code === 40110 || /auth_code/i.test(body.message || '')) {
      console.error('Auth codes expire quickly — re-open the authorization URL and try again with a fresh code.');
    }
    process.exit(1);
  }

  const { access_token, advertiser_ids = [], scope } = body.data || {};

  console.log('\nSuccess! Add these to .env and the Netlify environment variables:\n');
  console.log(`TIKTOK_ACCESS_TOKEN=${access_token}`);
  if (advertiser_ids.length === 1) {
    console.log(`TIKTOK_ADVERTISER_ID=${advertiser_ids[0]}`);
  } else {
    console.log(`TIKTOK_ADVERTISER_ID=<pick one of: ${advertiser_ids.join(', ') || 'none returned'}>`);
  }
  if (scope) console.log(`\nGranted scopes: ${JSON.stringify(scope)}`);
}

main().catch(err => {
  console.error(`Request failed: ${err.message}`);
  process.exit(1);
});
