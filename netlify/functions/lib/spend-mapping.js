const PLATFORM_CHANNELS = {
  meta: ['Paid Social', 'Unassigned (Meta)'],
  stackadapt: ['Display'],
  tiktok: ['Paid Social'],
};

function attributeSpend(platformKey, totalSpend, ga4SessionsByChannel) {
  const channels = PLATFORM_CHANNELS[platformKey] || [];
  if (!channels.length || totalSpend == null) return {};

  const totalSessions = channels.reduce((sum, ch) => sum + (ga4SessionsByChannel[ch] || 0), 0);
  if (totalSessions === 0) {
    const even = totalSpend / channels.length;
    return Object.fromEntries(channels.map(ch => [ch, even]));
  }

  const result = {};
  channels.forEach(ch => {
    const sessions = ga4SessionsByChannel[ch] || 0;
    result[ch] = totalSpend * (sessions / totalSessions);
  });
  return result;
}

module.exports = { attributeSpend, PLATFORM_CHANNELS };
