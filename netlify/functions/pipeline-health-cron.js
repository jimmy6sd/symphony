// Scheduled push of pipeline health to Make.com.
//
// The site's Netlify password protection blocks all external requests to
// /.netlify/functions/*, so Make cannot poll pipeline-health directly.
// Instead this runs on a cron inside Netlify (schedule set in netlify.toml,
// daily 12:30 UTC — 30 min after the noon ingest) and POSTs the health
// result to a Make custom webhook, where a filter on status != "ok"
// triggers the alert email.
//
// Requires env var MAKE_PIPELINE_ALERT_WEBHOOK (the Make webhook URL).

const { handler: healthHandler } = require('./pipeline-health');

exports.handler = async () => {
  const webhookUrl = process.env.MAKE_PIPELINE_ALERT_WEBHOOK;
  if (!webhookUrl) {
    console.error('MAKE_PIPELINE_ALERT_WEBHOOK not set; skipping health push');
    return { statusCode: 500 };
  }

  let health;
  try {
    const result = await healthHandler({ httpMethod: 'GET' });
    health = JSON.parse(result.body);
  } catch (error) {
    // pipeline-health catches its own errors, so this only fires if the
    // handler itself blew up before returning a response.
    health = {
      status: 'error',
      message: `Health check invocation failed: ${error.message}`,
      checkedAt: new Date().toISOString()
    };
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(health)
  });

  if (!response.ok) {
    console.error(`Make webhook responded ${response.status}`);
    return { statusCode: 502 };
  }

  console.log(`Pipeline health pushed to Make: ${health.status}`);
  return { statusCode: 200 };
};
