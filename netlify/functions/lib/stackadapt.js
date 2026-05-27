function fetchStackAdaptSpend(startDate, endDate) {
  const raw = process.env.STACKADAPT_SPEND_DATA;
  if (!raw) {
    return { spend: null, impressions: null, clicks: null, error: 'StackAdapt spend data not configured' };
  }

  let entries;
  try {
    entries = JSON.parse(raw);
  } catch (e) {
    return { spend: null, error: 'Invalid STACKADAPT_SPEND_DATA JSON' };
  }

  if (!Array.isArray(entries) || !entries.length) {
    return { spend: null, error: 'STACKADAPT_SPEND_DATA is empty' };
  }

  const qStart = new Date(startDate + 'T00:00:00');
  const qEnd = new Date(endDate + 'T23:59:59');

  let totalSpend = 0;
  let totalImpressions = 0;
  let totalClicks = 0;

  for (const entry of entries) {
    const monthStart = new Date(entry.month + '-01T00:00:00');
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setDate(monthEnd.getDate() - 1);
    monthEnd.setHours(23, 59, 59);

    const overlapStart = qStart > monthStart ? qStart : monthStart;
    const overlapEnd = qEnd < monthEnd ? qEnd : monthEnd;

    if (overlapStart > overlapEnd) continue;

    const daysInMonth = Math.round((monthEnd - monthStart) / (1000 * 60 * 60 * 24)) + 1;
    const overlapDays = Math.round((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1;
    const fraction = overlapDays / daysInMonth;

    totalSpend += (entry.spend || 0) * fraction;
    totalImpressions += Math.round((entry.impressions || 0) * fraction);
    totalClicks += Math.round((entry.clicks || 0) * fraction);
  }

  return {
    spend: Math.round(totalSpend * 100) / 100,
    impressions: totalImpressions,
    clicks: totalClicks,
    error: null,
  };
}

module.exports = { fetchStackAdaptSpend };
