// Daily sync of Constant Contact campaign stats into email_campaign_snapshots.
//
// Schedule set in netlify.toml (13:00 UTC). Pulls every campaign's latest stats
// from CC and appends one snapshot row per campaign. Append-only by design:
// opens/clicks accrue for a while after send, so re-snapshotting daily lets the
// read layer (lib/bq-email.js) pick the most-accrued figures per campaign and
// preserves the accrual history for MMM.
//
// Requires CC_CLIENT_ID, CC_CLIENT_SECRET, CC_REFRESH_TOKEN.

const { fetchEmailCampaignData } = require('./lib/constant-contact');
const { getBQClient } = require('./lib/bq-email');

const DATASET = process.env.BIGQUERY_DATASET || 'symphony_dashboard';
const TABLE = 'email_campaign_snapshots';

exports.handler = async () => {
  if (!process.env.CC_REFRESH_TOKEN) {
    console.error('CC_REFRESH_TOKEN not set; skipping email sync');
    return { statusCode: 500 };
  }

  try {
    const campaigns = await fetchEmailCampaignData();
    if (!campaigns.length) {
      console.warn('Constant Contact returned no campaigns; nothing to insert');
      return { statusCode: 200 };
    }

    const snapshotDate = new Date().toISOString().split('T')[0];
    const createdAt = new Date().toISOString();
    const rows = campaigns.map(c => ({
      snapshot_date: snapshotDate,
      campaign_id: c.campaign_id,
      campaign_name: c.campaign_name,
      campaign_type: c.campaign_type,
      last_sent_date: c.last_sent_date,
      sends: c.sends,
      opens: c.opens,
      clicks: c.clicks,
      forwards: c.forwards,
      optouts: c.optouts,
      abuse: c.abuse,
      bounces: c.bounces,
      not_opened: c.not_opened,
      created_at: createdAt,
    }));

    const bq = getBQClient();
    const table = bq.dataset(DATASET).table(TABLE);
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      await table.insert(rows.slice(i, i + CHUNK));
    }

    console.log(`Email sync: inserted ${rows.length} campaign snapshots for ${snapshotDate}`);
    return { statusCode: 200 };
  } catch (err) {
    console.error('Email sync failed:', err.message);
    return { statusCode: 500 };
  }
};
