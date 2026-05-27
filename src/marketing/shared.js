const CHANNEL_COLORS = {
  'Direct': '#475569',
  'Organic Search': '#0d9488',
  'Paid Search': '#2563eb',
  'Display': '#d97706',
  'Paid Social': '#7c3aed',
  'Organic Social': '#059669',
  'Email': '#dc2626',
  'Cross-network': '#ea580c',
  'Unassigned (Meta)': '#a855f7',
  'Unassigned (Other)': '#94a3b8',
  'Referral': '#0891b2',
  'Organic Shopping': '#65a30d',
  'Audio': '#be185d',
  'Organic Video': '#4f46e5',
};

const FUNNEL_POSITION = {
  'Organic Search': 'Bottom-funnel. User has existing awareness; searching for specifics.',
  'Paid Search': 'Bottom-funnel. Captures active demand via branded/program keywords.',
  'Direct': 'Bottom-funnel. Returning visitors with existing awareness.',
  'Email': 'Mid-funnel. Reaching existing subscribers/attendees.',
  'Display': 'Top-funnel. Awareness/prospecting; not expected to convert directly.',
  'Paid Social': 'Top-funnel. Meta + TikTok ads. Awareness/interest building; creates demand that converts later via other channels. Includes Meta Audience Network traffic.',
  'Cross-network': 'Mixed. Google PMax auto-allocates across search/display/YouTube.',
  'Organic Social': 'Top-funnel. Earned social reach.',
  'Unassigned (Other)': 'Unknown. Traffic GA4 could not classify into a standard channel.',
};

function tip(text) {
  return `<span class="th-tip" onmouseenter="showTip(this)" onmouseleave="hideTip(this)">?<span class="th-tip-text">${text}</span></span>`;
}

function showTip(el) {
  const tt = el.querySelector('.th-tip-text');
  const rect = el.getBoundingClientRect();
  tt.style.display = 'block';
  let left = rect.left + rect.width / 2 - 110;
  if (left + 220 > window.innerWidth - 8) left = window.innerWidth - 228;
  if (left < 8) left = 8;
  tt.style.left = left + 'px';
  tt.style.top = (rect.top - tt.offsetHeight - 6) + 'px';
}

function hideTip(el) {
  el.querySelector('.th-tip-text').style.display = 'none';
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmt(n) {
  if (n == null) return '—';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function pct(n) {
  if (n == null) return '—';
  return (n * 100).toFixed(1) + '%';
}

function currency(n) {
  if (n == null) return '—';
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K';
  return '$' + n.toFixed(0);
}

function changePct(curr, prev) {
  if (!prev || !curr) return '';
  const delta = ((curr - prev) / prev) * 100;
  const cls = delta >= 0 ? 'up' : 'down';
  const arrow = delta >= 0 ? '▲' : '▼';
  return `<span class="change ${cls}">${arrow} ${Math.abs(delta).toFixed(1)}%</span>`;
}

function changeBadge(curr, prev) {
  if (!prev || !curr) return '';
  const delta = ((curr - prev) / prev) * 100;
  const abs = Math.abs(delta).toFixed(1);
  if (delta >= 0.05) {
    return `<span class="kpi-badge up"><svg viewBox="0 0 10 10"><path d="M5 2L9 7H1Z" fill="currentColor"/></svg>${abs}%</span>`;
  } else if (delta <= -0.05) {
    return `<span class="kpi-badge down"><svg viewBox="0 0 10 10"><path d="M5 8L1 3H9Z" fill="currentColor"/></svg>${abs}%</span>`;
  }
  return `<span class="kpi-badge flat">${abs}%</span>`;
}

function channelColor(ch) {
  return CHANNEL_COLORS[ch] || '#8b949e';
}

function sparkline(container, values, height, color) {
  const el = d3.select(container);
  const width = el.node().getBoundingClientRect().width;
  const svg = el.append('svg').attr('width', width).attr('height', height);
  const x = d3.scaleLinear().domain([0, values.length - 1]).range([4, width - 4]);
  const y = d3.scaleLinear().domain([0, d3.max(values) * 1.1 || 1]).range([height - 4, 4]);
  const line = d3.line().x((d, i) => x(i)).y(d => y(d)).curve(d3.curveMonotoneX);
  const area = d3.area().x((d, i) => x(i)).y0(height).y1(d => y(d)).curve(d3.curveMonotoneX);
  svg.append('path').datum(values).attr('d', area).attr('fill', color).attr('opacity', 0.15);
  svg.append('path').datum(values).attr('d', line).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 1.5);
}

function barChart(container, items, labelKey, valueKey, colorFn, chartHeight) {
  const el = d3.select(container);
  const width = el.node().getBoundingClientRect().width;
  const margin = { top: 8, right: 60, bottom: 8, left: 120 };
  const h = chartHeight || Math.max(180, items.length * 32);
  const svg = el.append('svg').attr('width', width).attr('height', h);
  const maxVal = d3.max(items, d => d[valueKey]) || 1;
  const x = d3.scaleLinear().domain([0, maxVal]).range([0, width - margin.left - margin.right]);
  const y = d3.scaleBand().domain(items.map(d => d[labelKey])).range([margin.top, h - margin.bottom]).padding(0.3);
  const g = svg.append('g').attr('transform', `translate(${margin.left},0)`);
  g.selectAll('rect').data(items).enter().append('rect')
    .attr('x', 0).attr('y', d => y(d[labelKey]))
    .attr('width', d => Math.max(x(d[valueKey]), 2))
    .attr('height', y.bandwidth())
    .attr('fill', typeof colorFn === 'function' ? (d => colorFn(d[labelKey])) : colorFn)
    .attr('rx', 3);
  g.selectAll('.label').data(items).enter().append('text')
    .attr('x', -8).attr('y', d => y(d[labelKey]) + y.bandwidth() / 2).attr('dy', '0.35em')
    .attr('text-anchor', 'end').attr('fill', '#111').attr('font-size', 12).attr('font-weight', 500).text(d => d[labelKey]);
  g.selectAll('.val').data(items).enter().append('text')
    .attr('x', d => Math.max(x(d[valueKey]), 2) + 6)
    .attr('y', d => y(d[labelKey]) + y.bandwidth() / 2).attr('dy', '0.35em')
    .attr('fill', '#111').attr('font-size', 11).attr('font-weight', 500).text(d => fmt(d[valueKey]));
}

function stackedArea(container, dailyData, channels, height) {
  const el = d3.select(container);
  const width = el.node().getBoundingClientRect().width;
  const margin = { top: 12, right: 16, bottom: 32, left: 50 };
  const w = width - margin.left - margin.right;
  const h = (height || 260) - margin.top - margin.bottom;
  const svg = el.append('svg').attr('width', width).attr('height', height || 260);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const parseDate = d3.timeParse('%Y-%m-%d');
  const data = dailyData.map(d => ({ ...d, _date: parseDate(d.date) }));
  data.sort((a, b) => a._date - b._date);

  const stack = d3.stack().keys(channels).value((d, key) => d[key] || 0);
  const series = stack(data);

  const x = d3.scaleTime().domain(d3.extent(data, d => d._date)).range([0, w]);
  const y = d3.scaleLinear().domain([0, d3.max(series, s => d3.max(s, d => d[1])) || 1]).range([h, 0]);

  const areaGen = d3.area()
    .x(d => x(d.data._date))
    .y0(d => y(d[0]))
    .y1(d => y(d[1]))
    .curve(d3.curveMonotoneX);

  g.selectAll('.layer').data(series).enter().append('path')
    .attr('class', 'layer')
    .attr('d', areaGen)
    .attr('fill', d => channelColor(d.key))
    .attr('opacity', 0.7);

  g.append('g').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(d3.timeFormat('%b %d')))
    .selectAll('text').attr('fill', '#636e72').attr('font-size', 10);
  g.append('g')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => fmt(d)))
    .selectAll('text').attr('fill', '#636e72').attr('font-size', 10);
  g.selectAll('.domain, .tick line').attr('stroke', '#e9ecef');
}

function scatterPlot(container, points, xKey, yKey, labelKey, height) {
  const el = d3.select(container);
  const width = el.node().getBoundingClientRect().width;
  const margin = { top: 16, right: 24, bottom: 40, left: 60 };
  const h = (height || 300) - margin.top - margin.bottom;
  const w = width - margin.left - margin.right;
  const svg = el.append('svg').attr('width', width).attr('height', height || 300);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain([0, d3.max(points, d => d[xKey]) * 1.1 || 1]).range([0, w]);
  const y = d3.scaleLinear().domain([0, d3.max(points, d => d[yKey]) * 1.1 || 1]).range([h, 0]);

  g.append('g').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d => currency(d)))
    .selectAll('text').attr('fill', '#636e72').attr('font-size', 10);
  g.append('g')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => fmt(d)))
    .selectAll('text').attr('fill', '#636e72').attr('font-size', 10);
  g.selectAll('.domain, .tick line').attr('stroke', '#e9ecef');

  svg.append('text').attr('x', margin.left + w / 2).attr('y', (height || 300) - 4)
    .attr('text-anchor', 'middle').attr('fill', '#636e72').attr('font-size', 11).text('Spend');
  svg.append('text').attr('transform', 'rotate(-90)').attr('x', -(margin.top + h / 2)).attr('y', 14)
    .attr('text-anchor', 'middle').attr('fill', '#636e72').attr('font-size', 11).text('Purchases');

  g.selectAll('circle').data(points).enter().append('circle')
    .attr('cx', d => x(d[xKey])).attr('cy', d => y(d[yKey])).attr('r', 7)
    .attr('fill', d => channelColor(d[labelKey])).attr('opacity', 0.85).attr('stroke', '#fff').attr('stroke-width', 1.5);

  g.selectAll('.label').data(points).enter().append('text')
    .attr('x', d => x(d[xKey]) + 10).attr('y', d => y(d[yKey])).attr('dy', '0.35em')
    .attr('fill', '#111').attr('font-size', 10).attr('font-weight', 500).text(d => d[labelKey]);
}

function legend(container, items) {
  const el = d3.select(container);
  const div = el.append('div').style('display', 'flex').style('flex-wrap', 'wrap').style('gap', '12px').style('margin-top', '8px');
  items.forEach(item => {
    const span = div.append('span').style('display', 'flex').style('align-items', 'center').style('gap', '4px').style('font-size', '11px').style('color', '#636e72');
    span.append('span').style('width', '10px').style('height', '10px').style('border-radius', '50%').style('background', item.color).style('display', 'inline-block');
    span.append('span').text(item.label);
  });
}
