// BigQuery read layer for the marketing dashboard's Email tab.
//
// Reads email_campaign_snapshots (populated daily by email-sync-cron.js),
// takes the latest snapshot per campaign (opens/clicks accrue post-send, so the
// newest row has the most complete stats), then shapes current + previous period
// aggregates to match the EMAIL_SUMMARY / EMAIL_CAMPAIGNS structures the Email
// tab already consumes.

const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony';
const DATASET = process.env.BIGQUERY_DATASET || 'symphony_dashboard';
const TABLE = 'email_campaign_snapshots';

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
      projectId: PROJECT,
      credentials: { client_email: credentials.client_email, private_key: credentials.private_key },
      location: 'US',
    });
  }
  return bqClient;
}

const label = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function computeWindow({ days, startDate, endDate }) {
  let curStart, curEnd;
  if (startDate && endDate) {
    curStart = new Date(startDate + 'T00:00:00Z');
    curEnd = new Date(endDate + 'T23:59:59Z');
  } else {
    curEnd = new Date();
    curStart = new Date(curEnd);
    curStart.setUTCDate(curStart.getUTCDate() - ((days || 30) - 1));
    curStart.setUTCHours(0, 0, 0, 0);
  }
  const span = curEnd - curStart;
  const prevEnd = new Date(curStart.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - span);
  return {
    curStart, curEnd, prevStart, prevEnd,
    periodLabel: `${label(curStart)} – ${label(curEnd)}`,
    comparisonLabel: `${label(prevStart)} – ${label(prevEnd)}`,
  };
}

const tsValue = ts => (ts && ts.value !== undefined ? ts.value : ts);
const round1 = n => Math.round(n * 10) / 10;

// CC timestamps are UTC; format in Central time to match the venue's local context
// (the prior hardcoded export used local time). 'sv-SE' yields "YYYY-MM-DD HH:mm:ss".
function fmtCentral(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString('sv-SE', { timeZone: 'America/Chicago' }).slice(0, 16);
}

function aggregate(list) {
  return list.reduce((a, c) => {
    a.sends += c.sends; a.opens += c.opens; a.clicks += c.clicks;
    a.bounces += c.bounces; a.optouts += c.optouts;
    return a;
  }, { sends: 0, opens: 0, clicks: 0, bounces: 0, optouts: 0 });
}

async function queryEmailPerformance({ days, startDate, endDate }) {
  const bq = getBQClient();
  const w = computeWindow({ days, startDate, endDate });

  // Latest snapshot per campaign (most-accrued stats), sent campaigns only.
  const [rows] = await bq.query({
    query: `
      SELECT campaign_id, campaign_name, campaign_type, last_sent_date,
             sends, opens, clicks, forwards, optouts, abuse, bounces, not_opened
      FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY campaign_id ORDER BY snapshot_date DESC) AS rn
        FROM \`${PROJECT}.${DATASET}.${TABLE}\`
      )
      WHERE rn = 1 AND last_sent_date IS NOT NULL
    `,
  });

  const campaigns = rows.map(r => ({
    ...r,
    sends: Number(r.sends) || 0,
    opens: Number(r.opens) || 0,
    clicks: Number(r.clicks) || 0,
    bounces: Number(r.bounces) || 0,
    optouts: Number(r.optouts) || 0,
    sentAt: new Date(tsValue(r.last_sent_date)),
  }));

  const inWindow = (c, start, end) => c.sentAt >= start && c.sentAt <= end;
  const currentList = campaigns.filter(c => inWindow(c, w.curStart, w.curEnd));
  const prevList = campaigns.filter(c => inWindow(c, w.prevStart, w.prevEnd));

  const cur = aggregate(currentList);
  const prev = aggregate(prevList);
  const delivered = cur.sends - cur.bounces;
  const deliveredPrev = prev.sends - prev.bounces;

  const summary = {
    sent: cur.sends,
    delivered,
    opened: cur.opens,
    clicked: cur.clicks,
    openRate: delivered ? cur.opens / delivered : 0,
    clickRate: delivered ? cur.clicks / delivered : 0,
    clickToOpenRate: cur.opens ? cur.clicks / cur.opens : 0,
    bounced: cur.bounces,
    unsubscribed: cur.optouts,
    openRatePrev: deliveredPrev ? prev.opens / deliveredPrev : 0,
    clickRatePrev: deliveredPrev ? prev.clicks / deliveredPrev : 0,
    sentPrev: prev.sends,
    deliveredPrev,
    bouncedPrev: prev.bounces,
    unsubscribedPrev: prev.optouts,
    // Mobile/desktop split is not in the bulk endpoint (per-campaign calls only).
    mobileOpenPct: null,
    desktopOpenPct: null,
    mobileClickPct: null,
    desktopClickPct: null,
    periodLabel: w.periodLabel,
  };

  const campaignRows = currentList
    .sort((a, b) => b.sentAt - a.sentAt)
    .map(c => ({
      date: fmtCentral(tsValue(c.last_sent_date)),
      name: c.campaign_name,
      sends: c.sends,
      opens: c.opens,
      openRate: c.sends ? round1((c.opens / c.sends) * 100) : 0,
      clicks: c.clicks,
      clickRate: c.sends ? round1((c.clicks / c.sends) * 100) : 0,
      bounces: c.bounces,
      bounceRate: c.sends ? round1((c.bounces / c.sends) * 100) : 0,
      unsubs: c.optouts,
      unsubRate: c.sends ? round1((c.optouts / c.sends) * 100) : 0,
      // Not available from the bulk endpoint.
      mobileOpen: null,
      desktopOpen: null,
    }));

  return {
    summary,
    campaigns: campaignRows,
    period: w.periodLabel,
    comparison_period: w.comparisonLabel,
    data_source: 'constant_contact_bigquery',
  };
}

module.exports = { getBQClient, queryEmailPerformance };
