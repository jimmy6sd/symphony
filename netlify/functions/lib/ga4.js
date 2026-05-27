const { BetaAnalyticsDataClient } = require('@google-analytics/data');

const GA4_PROPERTY = process.env.GA4_MARKETING_PROPERTY || 'properties/445499663';

let ga4Client = null;

function getGA4Client() {
  if (!ga4Client) {
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

    ga4Client = new BetaAnalyticsDataClient({
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
      projectId: credentials.project_id,
    });
  }
  return ga4Client;
}

async function runReport(client, config) {
  const request = {
    property: GA4_PROPERTY,
    dateRanges: config.dateRanges,
    dimensions: (config.dimensions || []).map(d => ({ name: d })),
    metrics: (config.metrics || []).map(m => ({ name: m })),
  };

  if (config.dimensionFilter) request.dimensionFilter = config.dimensionFilter;
  if (config.orderBys) request.orderBys = config.orderBys;
  if (config.limit) request.limit = config.limit;

  const [response] = await client.runReport(request);

  return (response.rows || []).map(row => {
    const obj = {};
    (response.dimensionHeaders || []).forEach((h, i) => {
      obj[h.name] = row.dimensionValues[i].value;
    });
    (response.metricHeaders || []).forEach((h, i) => {
      const val = row.metricValues[i].value;
      obj[h.name] = val.includes('.') ? parseFloat(val) : parseInt(val, 10);
    });
    return obj;
  });
}

const META_SOURCES = new Set([
  'facebook', 'fb', 'ig', 'instagram', 'meta', 'an',
  'l.facebook.com', 'm.facebook.com', 'lm.facebook.com',
]);

function isMetaSource(source) {
  return META_SOURCES.has((source || '').toLowerCase());
}

module.exports = { getGA4Client, runReport, GA4_PROPERTY, isMetaSource };
