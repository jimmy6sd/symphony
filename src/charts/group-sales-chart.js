class GroupSalesChart {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.performances = options.performances || [];
        this.groupTitle = options.groupTitle || '';
        this.svg = null;
        this.annotations = [];
        this.activeTagFilter = null; // null = show all

        // Responsive state
        this.updateResponsiveState();
        this.margin = this.getResponsiveMargins();

        this.resizeTimeout = null;
        this.boundResizeHandler = this.handleResize.bind(this);
        window.addEventListener('resize', this.boundResizeHandler);
    }

    handleResize() {
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            this.updateResponsiveState();
            if (this.chartData) {
                this.render();
            }
        }, 150);
    }

    destroy() {
        clearTimeout(this.resizeTimeout);
        window.removeEventListener('resize', this.boundResizeHandler);
        d3.select('.group-chart-tooltip').remove();
    }

    updateResponsiveState() {
        const width = window.innerWidth;
        this.isMobile = width <= 768;
        this.isTablet = width > 768 && width <= 1024;
        this.isDesktop = width > 1024;
    }

    getResponsiveMargins() {
        if (this.isMobile) {
            return { top: 30, right: 15, bottom: 80, left: 50 };
        } else if (this.isTablet) {
            return { top: 40, right: 30, bottom: 90, left: 60 };
        } else {
            return { top: 40, right: 40, bottom: 95, left: 70 };
        }
    }

    async fetchAllHistory() {
        const snapshotCache = window.dataTable ? window.dataTable.snapshotCache : new Map();
        const histories = {};

        const fetchPromises = this.performances.map(async (perf) => {
            const code = perf.performanceCode || perf.performance_code || perf.code || perf.id;

            if (snapshotCache.has(code)) {
                histories[code] = snapshotCache.get(code);
                return;
            }

            try {
                const response = await fetch(
                    `${window.location.origin}/.netlify/functions/bigquery-snapshots?action=get-performance-history&performanceCode=${code}`
                );
                if (response.ok) {
                    const apiResponse = await response.json();
                    let snapshots = apiResponse.snapshots || [];

                    // Deduplicate by date
                    const uniqueByDate = {};
                    for (const snapshot of snapshots) {
                        const date = snapshot.snapshot_date;
                        if (!uniqueByDate[date] || new Date(snapshot.created_at) > new Date(uniqueByDate[date].created_at)) {
                            uniqueByDate[date] = snapshot;
                        }
                    }
                    histories[code] = Object.values(uniqueByDate);
                    snapshotCache.set(code, histories[code]);
                }
            } catch (error) {
                console.warn(`Error fetching history for ${code}:`, error.message);
                histories[code] = [];
            }
        });

        await Promise.all(fetchPromises);
        return histories;
    }

    processData(histories) {
        // Find earliest performance date (for x-axis reference)
        const perfDates = this.performances.map(p => {
            const [y, m, d] = p.date.split('-');
            return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        });
        this.earliestPerfDate = new Date(Math.min(...perfDates));
        this.totalCapacity = this.performances.reduce((sum, p) => sum + (p.capacity || 0), 0);

        const parseDate = d3.timeParse('%Y-%m-%d');
        const individualLines = [];

        // Process each performance
        this.performances.forEach(perf => {
            const code = perf.performanceCode || perf.performance_code || perf.code || perf.id;
            const snapshots = histories[code] || [];
            const [py, pm, pd] = perf.date.split('-');
            const perfDate = new Date(parseInt(py), parseInt(pm) - 1, parseInt(pd));

            const points = snapshots.map(snapshot => {
                const snapshotDate = parseDate(snapshot.snapshot_date);
                const daysOut = (this.earliestPerfDate - snapshotDate) / (24 * 60 * 60 * 1000);
                const weeksOut = daysOut / 7;
                return {
                    week: Math.max(0, weeksOut),
                    tickets: snapshot.single_tickets_sold || 0,
                    date: snapshotDate,
                    snapshot_date: snapshot.snapshot_date,
                    perfCode: code,
                    perfTitle: perf.title
                };
            }).filter(d => d.week >= 0)
              .sort((a, b) => b.week - a.week);

            individualLines.push({
                code,
                title: perf.title,
                capacity: perf.capacity || 0,
                points
            });
        });

        // Build aggregated line: for each unique snapshot_date, sum tickets across performances
        const dateMap = {};
        individualLines.forEach(line => {
            line.points.forEach(pt => {
                if (!dateMap[pt.snapshot_date]) {
                    dateMap[pt.snapshot_date] = { week: pt.week, date: pt.date, snapshot_date: pt.snapshot_date, tickets: 0 };
                }
                dateMap[pt.snapshot_date].tickets += pt.tickets;
            });
        });

        const aggregatedPoints = Object.values(dateMap)
            .sort((a, b) => b.week - a.week);

        // Determine max weeks
        const allWeeks = aggregatedPoints.map(p => p.week);
        const maxWeeks = allWeeks.length > 0 ? Math.max(10, Math.ceil(Math.max(...allWeeks))) : 10;

        return { individualLines, aggregatedPoints, maxWeeks };
    }

    async render() {
        const container = d3.select(`#${this.containerId}`);
        container.selectAll('*').remove();

        // Show loading
        container.append('div')
            .attr('class', 'chart-loading')
            .style('text-align', 'center')
            .style('padding', '40px')
            .style('color', '#666')
            .text('Loading group sales data...');

        // Fetch all history
        const histories = await this.fetchAllHistory();

        // Process data
        this.chartData = this.processData(histories);
        const { individualLines, aggregatedPoints, maxWeeks } = this.chartData;

        // Clear loading
        container.selectAll('*').remove();

        if (aggregatedPoints.length === 0) {
            container.append('div')
                .style('text-align', 'center')
                .style('padding', '40px')
                .style('color', '#999')
                .text('No historical sales data available for this group.');
            return;
        }

        this.margin = this.getResponsiveMargins();
        const containerEl = container.node();
        const containerRect = containerEl.getBoundingClientRect();

        const width = Math.max(600, containerRect.width - 16);
        const height = Math.max(350, Math.min(500, containerRect.height || 450));
        const innerWidth = width - this.margin.left - this.margin.right;
        const innerHeight = height - this.margin.top - this.margin.bottom;

        this.svg = container.append('svg')
            .attr('width', width)
            .attr('height', height);

        const g = this.svg.append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

        // Determine y max
        const allTickets = aggregatedPoints.map(p => p.tickets);
        const maxTickets = Math.max(this.totalCapacity, Math.max(...allTickets), 100);

        // Scales
        const xScale = d3.scaleLinear()
            .domain([maxWeeks, 0])
            .range([0, innerWidth]);

        const yScale = d3.scaleLinear()
            .domain([0, maxTickets])
            .range([innerHeight, 0]);

        this.xScale = xScale;
        this.yScale = yScale;
        this.innerWidth = innerWidth;
        this.innerHeight = innerHeight;
        this.g = g;

        // Grid lines
        g.append('g')
            .attr('class', 'grid')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(d3.axisBottom(xScale).tickSize(-innerHeight).tickFormat(''))
            .selectAll('line').style('stroke', '#e9ecef');

        g.append('g')
            .attr('class', 'grid')
            .call(d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat(''))
            .selectAll('line').style('stroke', '#e9ecef');

        // Remove grid domain lines
        g.selectAll('.grid .domain').remove();

        // X-axis (weeks before)
        const xAxis = g.append('g')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(d3.axisBottom(xScale).ticks(Math.min(maxWeeks, 12)).tickFormat(d => `${Math.round(d)}w`));

        xAxis.append('text')
            .attr('x', innerWidth / 2)
            .attr('y', 35)
            .attr('fill', '#666')
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .text('Weeks Before Earliest Performance');

        // Secondary x-axis: calendar dates
        const dateScale = d3.scaleTime()
            .domain([
                new Date(this.earliestPerfDate.getTime() - maxWeeks * 7 * 24 * 60 * 60 * 1000),
                this.earliestPerfDate
            ])
            .range([0, innerWidth]);

        g.append('g')
            .attr('class', 'date-axis')
            .attr('transform', `translate(0,${innerHeight + 52})`)
            .call(d3.axisBottom(dateScale).ticks(6).tickFormat(d3.timeFormat('%b %d')))
            .selectAll('text')
                .style('font-size', '10px')
                .style('fill', '#999');

        g.select('.date-axis .domain').style('stroke', '#ddd');
        g.selectAll('.date-axis .tick line').style('stroke', '#ddd');

        // Y-axis
        g.append('g')
            .call(d3.axisLeft(yScale).ticks(6).tickFormat(d => d >= 1000 ? `${(d/1000).toFixed(1)}k` : d))
            .append('text')
            .attr('transform', 'rotate(-90)')
            .attr('y', -50)
            .attr('x', -innerHeight / 2)
            .attr('fill', '#666')
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .text('Single Tickets Sold');

        // Capacity line
        if (this.totalCapacity > 0) {
            g.append('line')
                .attr('x1', 0)
                .attr('x2', innerWidth)
                .attr('y1', yScale(this.totalCapacity))
                .attr('y2', yScale(this.totalCapacity))
                .attr('stroke', '#e74c3c')
                .attr('stroke-width', 1.5)
                .attr('stroke-dasharray', '6,4')
                .attr('opacity', 0.6);

            g.append('text')
                .attr('x', innerWidth - 4)
                .attr('y', yScale(this.totalCapacity) - 6)
                .attr('text-anchor', 'end')
                .style('font-size', '10px')
                .style('fill', '#e74c3c')
                .text(`Capacity: ${this.totalCapacity.toLocaleString()}`);
        }

        // Individual performance lines (thin, low opacity)
        const colors = d3.schemeTableau10;
        individualLines.forEach((line, i) => {
            if (line.points.length < 2) return;

            const lineGen = d3.line()
                .x(d => xScale(d.week))
                .y(d => yScale(d.tickets))
                .curve(d3.curveMonotoneX);

            g.append('path')
                .datum(line.points)
                .attr('class', 'individual-line')
                .attr('d', lineGen)
                .attr('fill', 'none')
                .attr('stroke', colors[i % colors.length])
                .attr('stroke-width', 1.5)
                .attr('opacity', 0.25);
        });

        // Aggregated total line (thick, bold)
        if (aggregatedPoints.length >= 2) {
            const aggLine = d3.line()
                .x(d => xScale(d.week))
                .y(d => yScale(d.tickets))
                .curve(d3.curveMonotoneX);

            g.append('path')
                .datum(aggregatedPoints)
                .attr('class', 'aggregated-line')
                .attr('d', aggLine)
                .attr('fill', 'none')
                .attr('stroke', '#3498db')
                .attr('stroke-width', 3)
                .attr('stroke-linecap', 'round')
                .style('filter', 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))');

            // Data points on aggregated line
            g.selectAll('.agg-point')
                .data(aggregatedPoints)
                .enter()
                .append('circle')
                .attr('class', 'agg-point')
                .attr('cx', d => xScale(d.week))
                .attr('cy', d => yScale(d.tickets))
                .attr('r', 2.5)
                .attr('fill', '#3498db')
                .attr('stroke', 'white')
                .attr('stroke-width', 1);
        }

        // Aggregated target comp line
        const targetCompResult = await this.fetchAndAggregateTargetComps(maxWeeks);
        const targetCompData = targetCompResult ? targetCompResult.points : null;
        const targetCompName = targetCompResult ? targetCompResult.compName : null;
        if (targetCompData && targetCompData.length >= 2) {
            const compLine = d3.line()
                .x(d => xScale(d.week))
                .y(d => yScale(d.tickets))
                .curve(d3.curveMonotoneX);

            g.append('path')
                .datum(targetCompData)
                .attr('class', 'group-target-comp-line')
                .attr('d', compLine)
                .attr('fill', 'none')
                .attr('stroke', '#f59e0b')
                .attr('stroke-width', 2.5)
                .attr('stroke-dasharray', '8,4')
                .attr('stroke-linecap', 'round')
                .attr('opacity', 0.85)
                .style('filter', 'drop-shadow(0 1px 2px rgba(245,158,11,0.3))');

            // Data points on target comp line
            g.selectAll('.target-comp-point')
                .data(targetCompData)
                .enter()
                .append('circle')
                .attr('class', 'target-comp-point')
                .attr('cx', d => xScale(d.week))
                .attr('cy', d => yScale(d.tickets))
                .attr('r', 2)
                .attr('fill', '#f59e0b')
                .attr('stroke', 'white')
                .attr('stroke-width', 1);
        }

        // Legend
        const legendData = [
            { label: `Total (${this.performances.length} perfs)`, color: '#3498db', thick: true, dash: false },
            ...(targetCompData && targetCompData.length >= 2
                ? [{ label: targetCompName ? `Target Comp: ${targetCompName}` : 'Target Comp', color: '#f59e0b', thick: true, dash: true }]
                : []),
            ...individualLines.map((line, i) => ({
                label: line.code,
                color: colors[i % colors.length],
                thick: false,
                dash: false
            }))
        ];

        const legend = g.append('g')
            .attr('class', 'chart-legend')
            .attr('transform', `translate(10, -10)`);

        let legendX = 0;
        const legendGap = this.isMobile ? 12 : 18;
        legendData.forEach((item) => {
            const row = legend.append('g')
                .attr('transform', `translate(${legendX}, 0)`);

            row.append('line')
                .attr('x1', 0).attr('x2', 16)
                .attr('y1', 0).attr('y2', 0)
                .attr('stroke', item.color)
                .attr('stroke-width', item.thick ? 2.5 : 1.5)
                .attr('stroke-dasharray', item.dash ? '4,3' : 'none')
                .attr('opacity', item.thick ? 1 : 0.4);

            const textEl = row.append('text')
                .attr('x', 20).attr('y', 4)
                .style('font-size', '10px')
                .style('fill', '#666')
                .text(item.label);

            // Advance by actual text width + line + gap
            const textWidth = textEl.node().getComputedTextLength();
            legendX += 20 + textWidth + legendGap;
        });

        // Tooltip
        this.addTooltip(g, aggregatedPoints, individualLines, xScale, yScale, innerWidth, innerHeight, targetCompData);

        // Render annotations
        this.renderAnnotations();
    }

    async fetchAndAggregateTargetComps(maxWeeks) {
        try {
            // Get performance codes for batch fetch
            const perfCodes = this.performances.map(p =>
                p.performanceCode || p.performance_code || p.code || p.id
            );

            // Batch fetch all comparisons
            const batchComps = await window.dataService.getBatchPerformanceComparisons(perfCodes);

            // For each performance, find its target comp and compute week-shifted data
            // relative to the group's earliest performance date
            const weekBuckets = {}; // week -> total tickets
            const compNames = new Set();

            this.performances.forEach(p => {
                const code = p.performanceCode || p.performance_code || p.code || p.id;
                const comps = batchComps[code] || [];
                const targetComp = comps.find(c => c.is_target === true);
                if (!targetComp || !targetComp.weeksArray || targetComp.weeksArray.length === 0) return;

                if (targetComp.comparison_name) compNames.add(targetComp.comparison_name);

                // Calculate this performance's date offset from earliest perf date
                const [py, pm, pd] = p.date.split('-');
                const perfDate = new Date(parseInt(py), parseInt(pm) - 1, parseInt(pd));
                const offsetWeeks = (perfDate - this.earliestPerfDate) / (7 * 24 * 60 * 60 * 1000);

                // weeksArray: index 0 = farthest week, index N-1 = week 0 (perf day)
                const numWeeks = targetComp.weeksArray.length;
                for (let i = 0; i < numWeeks; i++) {
                    const weekBeforePerf = numWeeks - 1 - i; // weeks before THIS performance
                    const weekBeforeEarliest = weekBeforePerf + offsetWeeks; // shift to group timeline
                    const roundedWeek = Math.round(weekBeforeEarliest); // round to nearest integer week

                    if (roundedWeek < 0 || roundedWeek > maxWeeks) continue;

                    if (!weekBuckets[roundedWeek]) weekBuckets[roundedWeek] = 0;
                    weekBuckets[roundedWeek] += targetComp.weeksArray[i];
                }
            });

            // Convert to sorted array
            const points = Object.entries(weekBuckets)
                .map(([week, tickets]) => ({ week: parseFloat(week), tickets }))
                .sort((a, b) => b.week - a.week);

            if (points.length < 2) return null;
            const compName = compNames.size === 1
                ? [...compNames][0]
                : [...compNames].join(', ');
            return { points, compName };
        } catch (error) {
            console.warn('Could not fetch target comps for group:', error.message);
            return null;
        }
    }

    addTooltip(g, aggregatedPoints, individualLines, xScale, yScale, innerWidth, innerHeight, targetCompData) {
        let tooltip = d3.select('.group-chart-tooltip');
        if (tooltip.empty()) {
            tooltip = d3.select('body').append('div')
                .attr('class', 'group-chart-tooltip')
                .style('position', 'absolute')
                .style('background', 'white')
                .style('border', '1px solid #ddd')
                .style('border-radius', '6px')
                .style('padding', '10px 12px')
                .style('font-size', '12px')
                .style('box-shadow', '0 2px 8px rgba(0,0,0,0.15)')
                .style('pointer-events', 'none')
                .style('z-index', '10001')
                .style('display', 'none');
        }

        // Invisible overlay for mouse tracking
        g.append('rect')
            .attr('width', innerWidth)
            .attr('height', innerHeight)
            .attr('fill', 'transparent')
            .on('mousemove', (event) => {
                const [mx] = d3.pointer(event);
                const weekAtMouse = xScale.invert(mx);

                // Find closest aggregated point
                let closest = null;
                let closestDist = Infinity;
                aggregatedPoints.forEach(pt => {
                    const dist = Math.abs(pt.week - weekAtMouse);
                    if (dist < closestDist) {
                        closestDist = dist;
                        closest = pt;
                    }
                });

                if (!closest || closestDist > 1) {
                    tooltip.style('display', 'none');
                    return;
                }

                // Build tooltip content
                let html = `<div style="font-weight:600;margin-bottom:4px;">${closest.snapshot_date}</div>`;
                html += `<div style="margin-bottom:4px;">Week ${closest.week.toFixed(1)} before</div>`;
                html += `<div style="font-weight:600;color:#3498db;">Total: ${closest.tickets.toLocaleString()}</div>`;

                // Target comp value at this week (interpolated)
                if (targetCompData && targetCompData.length >= 2) {
                    const w = closest.week;
                    // Find bracketing points
                    const sorted = [...targetCompData].sort((a, b) => a.week - b.week);
                    let compVal = null;
                    for (let ci = 0; ci < sorted.length - 1; ci++) {
                        if (w >= sorted[ci].week && w <= sorted[ci + 1].week) {
                            const frac = (w - sorted[ci].week) / (sorted[ci + 1].week - sorted[ci].week);
                            compVal = sorted[ci].tickets + frac * (sorted[ci + 1].tickets - sorted[ci].tickets);
                            break;
                        }
                    }
                    if (compVal === null && sorted.length > 0) {
                        // Clamp to nearest endpoint
                        compVal = w <= sorted[0].week ? sorted[0].tickets : sorted[sorted.length - 1].tickets;
                    }
                    if (compVal !== null) {
                        const variance = closest.tickets - compVal;
                        const varColor = variance >= 0 ? '#10b981' : '#ef4444';
                        const varSign = variance >= 0 ? '+' : '';
                        html += `<div style="color:#f59e0b;font-size:11px;margin-top:2px;">Target: ${Math.round(compVal).toLocaleString()} <span style="color:${varColor};font-weight:600;">(${varSign}${Math.round(variance).toLocaleString()})</span></div>`;
                    }
                }

                // Per-performance breakdown
                individualLines.forEach((line, i) => {
                    const matchPt = line.points.find(p => p.snapshot_date === closest.snapshot_date);
                    if (matchPt) {
                        html += `<div style="color:${d3.schemeTableau10[i % 10]};font-size:11px;">${line.code}: ${matchPt.tickets.toLocaleString()}</div>`;
                    }
                });

                tooltip.html(html).style('display', 'block');

                // Position tooltip
                const tooltipNode = tooltip.node();
                const tooltipRect = tooltipNode.getBoundingClientRect();
                let left = event.pageX + 15;
                let top = event.pageY - 10;
                if (left + tooltipRect.width > window.innerWidth - 10) left = event.pageX - tooltipRect.width - 15;
                if (top + tooltipRect.height > window.innerHeight - 10) top = event.pageY - tooltipRect.height - 15;
                tooltip.style('left', left + 'px').style('top', top + 'px');
            })
            .on('mouseleave', () => {
                tooltip.style('display', 'none');
            });
    }

    convertDateToWeek(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        return (this.earliestPerfDate - d) / (7 * 24 * 60 * 60 * 1000);
    }

    updateAnnotations(annotations) {
        // Preprocess global annotations: convert calendar dates to week numbers
        this.annotations = annotations.map(ann => {
            if ((ann.scope === 'global') && ann.annotation_date && this.earliestPerfDate) {
                const processed = { ...ann, _isGlobal: true };
                if (ann.annotation_type === 'point') {
                    processed.week_number = this.convertDateToWeek(ann.annotation_date);
                } else if (ann.annotation_type === 'interval') {
                    processed.start_week = this.convertDateToWeek(ann.annotation_date);
                    processed.end_week = ann.annotation_end_date
                        ? this.convertDateToWeek(ann.annotation_end_date)
                        : processed.start_week;
                }
                return processed;
            }
            return ann;
        });
        this.renderAnnotations();
    }

    renderAnnotations() {
        if (!this.g || !this.xScale) return;

        // Remove existing annotations
        this.g.selectAll('.annotation-overlay').remove();

        const annotationsToShow = this.activeTagFilter
            ? this.annotations.filter(a => {
                const tags = Array.isArray(a.tags) ? a.tags : [];
                return tags.some(t => this.activeTagFilter.includes(t));
            })
            : this.annotations;

        const annoGroup = this.g.append('g').attr('class', 'annotation-overlay');

        annotationsToShow.forEach(ann => {
            if (ann.annotation_type === 'point') {
                this.renderPointAnnotation(annoGroup, ann);
            } else if (ann.annotation_type === 'interval') {
                this.renderIntervalAnnotation(annoGroup, ann);
            }
        });
    }

    renderPointAnnotation(group, ann) {
        const x = this.xScale(ann.week_number);
        if (x < 0 || x > this.innerWidth) return;

        const isGlobal = ann._isGlobal;

        // Vertical dashed line
        group.append('line')
            .attr('x1', x).attr('x2', x)
            .attr('y1', 0).attr('y2', this.innerHeight)
            .attr('stroke', ann.color || '#e74c3c')
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', '4,3')
            .attr('opacity', 0.7);

        // Label
        const labelG = group.append('g')
            .attr('transform', `translate(${x}, -4)`);

        labelG.append('text')
            .attr('text-anchor', 'middle')
            .attr('y', -8)
            .style('font-size', '10px')
            .style('font-weight', '600')
            .style('font-style', isGlobal ? 'italic' : 'normal')
            .style('fill', ann.color || '#e74c3c')
            .text(ann.label);

        // Tag pills
        const tags = Array.isArray(ann.tags) ? ann.tags : [];
        if (tags.length > 0) {
            const tagText = tags.slice(0, 2).join(', ');
            labelG.append('text')
                .attr('text-anchor', 'middle')
                .attr('y', -20)
                .style('font-size', '8px')
                .style('fill', '#999')
                .text(tagText);
        }
    }

    renderIntervalAnnotation(group, ann) {
        const x1 = this.xScale(ann.start_week);
        const x2 = this.xScale(ann.end_week);
        const left = Math.min(x1, x2);
        const rectWidth = Math.abs(x2 - x1);

        if (left + rectWidth < 0 || left > this.innerWidth) return;

        const isGlobal = ann._isGlobal;

        // Shaded rectangle
        group.append('rect')
            .attr('x', left)
            .attr('y', 0)
            .attr('width', rectWidth)
            .attr('height', this.innerHeight)
            .attr('fill', ann.color || '#e74c3c')
            .attr('opacity', 0.08);

        // Border lines
        [left, left + rectWidth].forEach(bx => {
            group.append('line')
                .attr('x1', bx).attr('x2', bx)
                .attr('y1', 0).attr('y2', this.innerHeight)
                .attr('stroke', ann.color || '#e74c3c')
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', '3,3')
                .attr('opacity', 0.4);
        });

        // Centered label
        group.append('text')
            .attr('x', left + rectWidth / 2)
            .attr('y', 14)
            .attr('text-anchor', 'middle')
            .style('font-size', '10px')
            .style('font-weight', '600')
            .style('font-style', isGlobal ? 'italic' : 'normal')
            .style('fill', ann.color || '#e74c3c')
            .text(ann.label);

        // Tags
        const tags = Array.isArray(ann.tags) ? ann.tags : [];
        if (tags.length > 0) {
            group.append('text')
                .attr('x', left + rectWidth / 2)
                .attr('y', 26)
                .attr('text-anchor', 'middle')
                .style('font-size', '8px')
                .style('fill', '#999')
                .text(tags.slice(0, 2).join(', '));
        }
    }

    setTagFilter(tags) {
        this.activeTagFilter = tags;
        this.renderAnnotations();
    }
}

// Export to global scope
if (typeof window !== 'undefined') {
    window.GroupSalesChart = GroupSalesChart;
}
