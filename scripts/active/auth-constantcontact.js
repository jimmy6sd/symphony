// One-time OAuth2 consent flow to mint a long-lived Constant Contact refresh
// token for the marketing dashboard's Email tab integration.
//
// Prerequisites (in the CC developer portal, https://app.constantcontact.com/pages/dma/portal/):
//   1. Create an app key (client_id) and generate a client secret.
//   2. Add a Redirect URI that EXACTLY matches REDIRECT_URI below.
//   3. Enable "long-lived refresh tokens" on the key so the refresh token can
//      live in an env var (without it, refresh tokens rotate on every use and
//      would need mutable storage).
//
// Usage — two steps:
//   Step 1 (get the consent URL):
//     node scripts/active/auth-constantcontact.js <client_id> <client_secret>
//   Open the printed URL, log in, approve. You'll be redirected to
//   REDIRECT_URI?code=XXX&state=... — copy the `code` value (it's short-lived).
//
//   Step 2 (exchange the code for tokens):
//     node scripts/active/auth-constantcontact.js <client_id> <client_secret> <code>
//
// On success it prints CC_CLIENT_ID / CC_CLIENT_SECRET / CC_REFRESH_TOKEN to add
// to .env and the Netlify environment.

// Must match a Redirect URI registered on the app key. The page itself doesn't
// need to load — we only read the `code` query param from the redirected URL.
const REDIRECT_URI = 'https://localhost:8888/';
const SCOPES = 'campaign_data offline_access';
const AUTHORIZE_URL = 'https://authz.constantcontact.com/oauth2/default/v1/authorize';
const TOKEN_URL = 'https://authz.constantcontact.com/oauth2/default/v1/token';

const [clientId, clientSecret, authCode] = process.argv.slice(2);

if (!clientId) {
  console.error('Usage: node scripts/active/auth-constantcontact.js <client_id> [client_secret] [auth_code]');
  console.error('  Step 1 needs only <client_id>; step 2 needs <client_id> <client_secret> <auth_code>.');
  process.exit(1);
}

if (!authCode) {
  // Step 1: print the consent URL for the user to open.
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    state: 'symphony-cc',
  });
  console.log('\nStep 1 — open this URL in a browser, log in, and approve:\n');
  console.log(`${AUTHORIZE_URL}?${params}\n`);
  console.log(`After approving you'll land on ${REDIRECT_URI}?code=...&state=symphony-cc`);
  console.log('(the page may show a connection error — that is fine; copy the `code` value from the address bar)\n');
  console.log('Then run step 2:');
  console.log(`  node scripts/active/auth-constantcontact.js ${clientId} <client_secret> <code>\n`);
  process.exit(0);
}

async function main() {
  if (!clientSecret) {
    console.error('Step 2 requires the client secret: node scripts/active/auth-constantcontact.js <client_id> <client_secret> <auth_code>');
    process.exit(1);
  }
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const body = new URLSearchParams({
    code: authCode,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  });

  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const data = await resp.json();

  if (!resp.ok || !data.refresh_token) {
    console.error(`\nToken exchange failed (HTTP ${resp.status}): ${JSON.stringify(data)}`);
    if (/expired|invalid_grant/i.test(JSON.stringify(data))) {
      console.error('Auth codes expire quickly — re-run step 1 and try again with a fresh code.');
    }
    process.exit(1);
  }

  console.log('\nSuccess! Add these to .env and the Netlify environment variables:\n');
  console.log(`CC_CLIENT_ID=${clientId}`);
  console.log(`CC_CLIENT_SECRET=${clientSecret}`);
  console.log(`CC_REFRESH_TOKEN=${data.refresh_token}`);
  if (data.scope) console.log(`\nGranted scopes: ${data.scope}`);
  console.log('\nNote: confirm "long-lived refresh tokens" is enabled on the app key, or this');
  console.log('refresh token will rotate on first use and break the scheduled sync.');
}

main().catch(err => {
  console.error(`Request failed: ${err.message}`);
  process.exit(1);
});
