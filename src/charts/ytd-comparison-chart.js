// YTD Comparison Chart - D3.js visualization for year-over-year ticket sales
// Displays overlapping lines for each fiscal year, with toggles for metric and week type

class YTDComparisonChart {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.data = {};  // { FY23: [...], FY24: [...], ... }
        this.metric = options.metric || 'revenue';
        this.weekType = options.weekType || 'fiscal';
        this.visibleYears = new Set(['FY24', 'FY25', 'FY26']);

        // Year colors (FY25 is target comp in orange, FY26 is current in blue)
        this.yearColors = {
            'FY23': '#8884d8',  // Purple
            'FY24': '#8884d8',  // Purple (was FY23's color)
            'FY25': '#ff7c43',  // Orange (target comp)
            'FY26': '#3498db',  // Blue (current year - merged Excel + live)
            'FY26 Projected': '#2ecc71'  // Green dashed (projection based on FY25)
        };

        // Responsive state
        this.updateResponsiveState();
        this.resizeTimeout = null;
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    // Get value from data point based on current metric
    getValue(d) {
        switch (this.metric) {
            case 'tickets': return d.tickets || 0;
            case 'revenue': return d.revenue || 0;
            case 'singleTickets': return d.singleTickets || 0;
            case 'singleRevenue': return d.singleRevenue || 0;
            case 'subscriptionTickets': return d.subscriptionTickets || 0;
            case 'subscriptionRevenue': return d.subscriptionRevenue || 0;
            default: return d.revenue || 0;
        }
    }

    // Check if current metric is a revenue metric
    isRevenueMetric() {
        return ['revenue', 'singleRevenue', 'subscriptionRevenue'].includes(this.metric);
    }

    // Get Y-axis label for current metric
    getYAxisLabel() {
        const labels = {
            tickets: 'Cumulative Total Tickets',
            revenue: 'Cumulative Total Revenue ($)',
            singleTickets: 'Cumulative Single Tickets',
            singleRevenue: 'Cumulative Single Ticket Revenue ($)',
            subscriptionTickets: 'Cumulative Subscription Tickets',
            subscriptionRevenue: 'Cumulative Subscription Revenue ($)'
        };
        return labels[this.metric] || 'Cumulative Value';
    }

    handleResize() {
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            this.updateResponsiveState();
            if (Object.keys(this.data).length > 0) {
                this.render();
            }
        }, 150);
    }

    updateResponsiveState() {
        const width = window.innerWidth;
        this.isMobile = width <= 768;
        this.isTablet = width > 768 && width <= 1024;
    }

    getCurrentWeek() {
        const today = new Date();

        if (this.weekType === 'iso') {
            // ISO week calculation
            const jan1 = new Date(today.getFullYear(), 0, 1);
            const days = Math.floor((today - jan1) / (24 * 60 * 60 * 1000));
            return Math.ceil((days + jan1.getDay() + 1) / 7);
        } else {
            // Fiscal week = ISO week offset by 26 (so ISO week 27 = fiscal week 1)
            const jan1 = new Date(today.getFullYear(), 0, 1);
            const days = Math.floor((today - jan1) / (24 * 60 * 60 * 1000));
            const isoWeek = Math.ceil((days + jan1.getDay() + 1) / 7);

            // Offset: ISO 27+ becomes fiscal 1-26, ISO 1-26 becomes fiscal 27-52
            return isoWeek >= 27 ? isoWeek - 26 : isoWeek + 26;
        }
    }

    getResponsiveMargins() {
        if (this.isMobile) {
            return { top: 30, right: 20, bottom: 60, left: 50 };
        } else if (this.isTablet) {
            return { top: 40, right: 120, bottom: 70, left: 70 };
        } else {
            return { top: 50, right: 180, bottom: 80, left: 80 };
        }
    }

    setData(data) {
        this.data = data;
        this.render();
    }

    setMetric(metric) {
        this.metric = metric;
        this.render();
    }

    setWeekType(weekType) {
        this.weekType = weekType;
        this.render();
    }

    toggleYear(year) {
        if (this.visibleYears.has(year)) {
            this.visibleYears.delete(year);
        } else {
            this.visibleYears.add(year);
        }
        this.render();
    }

    setVisibleYears(years) {
        this.visibleYears = new Set(years);
        this.render();
    }

    render() {
        const container = d3.select(`#${this.containerId}`);
        container.select('svg').remove();
        d3.select('.ytd-tooltip').remove();

        const margin = this.getResponsiveMargins();
        const containerRect = container.node().getBoundingClientRect();

        const width = Math.max(this.isMobile ? 300 : 600, containerRect.width - 20);
        const height = this.isMobile ? 350 : 450;
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        const svg = container.append('svg')
            .attr('width', width)
            .attr('height', height);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Get visible data
        const visibleData = {};
        let maxWeek = 0;
        let maxValue = 0;

        Object.entries(this.data).forEach(([year, weeks]) => {
            if (this.visibleYears.has(year)) {
                visibleData[year] = weeks;
                weeks.forEach(w => {
                    const weekNum = this.weekType === 'iso' ? w.isoWeek : w.fiscalWeek;
                    const value = this.getValue(w);
                    if (weekNum > maxWeek) maxWeek = weekNum;
                    if (value > maxValue) maxValue = value;
                });
            }
        });

        // Calculate projected max value to include in Y scale
        const projectedMax = this.calculateProjectedMax(visibleData);
        if (projectedMax > maxValue) {
            maxValue = projectedMax;
        }

        if (Object.keys(visibleData).length === 0) {
            g.append('text')
                .attr('x', innerWidth / 2)
                .attr('y', innerHeight / 2)
                .attr('text-anchor', 'middle')
                .style('font-size', '14px')
                .style('fill', '#888')
                .text('Select at least one fiscal year to display');
            return;
        }

        // Scales
        const xScale = d3.scaleLinear()
            .domain([1, Math.max(52, maxWeek)])
            .range([0, innerWidth]);

        const yScale = d3.scaleLinear()
            .domain([0, maxValue * 1.1])
            .range([innerHeight, 0]);

        // Grid lines
        g.append('g')
            .attr('class', 'grid')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(d3.axisBottom(xScale)
                .tickSize(-innerHeight)
                .tickFormat('')
            )
            .selectAll('line')
            .style('stroke', '#f0f0f0')
            .style('stroke-width', 0.5);

        g.append('g')
            .attr('class', 'grid')
            .call(d3.axisLeft(yScale)
                .tickSize(-innerWidth)
                .tickFormat('')
            )
            .selectAll('line')
            .style('stroke', '#f0f0f0')
            .style('stroke-width', 0.5);

        // Axes
        const xAxis = g.append('g')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(d3.axisBottom(xScale)
                .ticks(this.isMobile ? 6 : 12)
                .tickFormat(d => `W${d}`)
            );

        xAxis.selectAll('text')
            .style('font-size', this.isMobile ? '10px' : '11px')
            .style('fill', '#666');

        // Add month labels below week axis (fiscal year starts July 1)
        const fiscalMonths = [
            { week: 1, label: 'Jul' },
            { week: 5, label: 'Aug' },
            { week: 9, label: 'Sep' },
            { week: 14, label: 'Oct' },
            { week: 18, label: 'Nov' },
            { week: 22, label: 'Dec' },
            { week: 27, label: 'Jan' },
            { week: 31, label: 'Feb' },
            { week: 36, label: 'Mar' },
            { week: 40, label: 'Apr' },
            { week: 44, label: 'May' },
            { week: 49, label: 'Jun' }
        ];

        const monthLabelY = innerHeight + (this.isMobile ? 32 : 38);
        fiscalMonths.forEach(m => {
            g.append('text')
                .attr('x', xScale(m.week))
                .attr('y', monthLabelY)
                .attr('text-anchor', 'start')
                .style('font-size', this.isMobile ? '9px' : '10px')
                .style('fill', '#999')
                .style('font-weight', '500')
                .text(m.label);
        });

        const yAxis = g.append('g')
            .call(d3.axisLeft(yScale)
                .ticks(6)
                .tickFormat(d => {
                    if (this.isRevenueMetric()) {
                        return d >= 1000000 ? `$${(d / 1000000).toFixed(1)}M` : `$${(d / 1000).toFixed(0)}K`;
                    }
                    return d >= 1000 ? `${(d / 1000).toFixed(0)}K` : d;
                })
            );

        yAxis.selectAll('text')
            .style('font-size', this.isMobile ? '10px' : '11px')
            .style('fill', '#666');

        // Axis labels
        g.append('text')
            .attr('transform', `translate(${innerWidth / 2}, ${innerHeight + margin.bottom - 15})`)
            .style('text-anchor', 'middle')
            .style('font-size', this.isMobile ? '11px' : '12px')
            .style('fill', '#666')
            .text(this.weekType === 'iso' ? 'ISO Week' : 'Fiscal Week (from July 1)');

        if (!this.isMobile) {
            g.append('text')
                .attr('transform', 'rotate(-90)')
                .attr('y', -margin.left + 20)
                .attr('x', -innerHeight / 2)
                .attr('dy', '1em')
                .style('text-anchor', 'middle')
                .style('font-size', '12px')
                .style('fill', '#666')
                .text(this.getYAxisLabel());
        }

        // Current week indicator line
        const currentWeek = this.getCurrentWeek();
        if (currentWeek >= 1 && currentWeek <= 52) {
            const currentWeekX = xScale(currentWeek);

            // Vertical line
            g.append('line')
                .attr('x1', currentWeekX)
                .attr('x2', currentWeekX)
                .attr('y1', 0)
                .attr('y2', innerHeight)
                .attr('stroke', '#999')
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', '4,4')
                .attr('opacity', 0.6);

            // Label at top
            g.append('text')
                .attr('x', currentWeekX)
                .attr('y', -8)
                .attr('text-anchor', 'middle')
                .style('font-size', '10px')
                .style('fill', '#888')
                .text('Today');
        }

        // Line generator
        const line = d3.line()
            .x(d => xScale(this.weekType === 'iso' ? d.isoWeek : d.fiscalWeek))
            .y(d => yScale(this.getValue(d)))
            .curve(d3.curveMonotoneX);

        // Draw lines for each year
        const sortedYears = Object.keys(visibleData).sort().reverse();

        sortedYears.forEach(year => {
            const yearData = visibleData[year]
                .filter(d => (this.weekType === 'iso' ? d.isoWeek : d.fiscalWeek) > 0)
                .sort((a, b) => {
                    const weekA = this.weekType === 'iso' ? a.isoWeek : a.fiscalWeek;
                    const weekB = this.weekType === 'iso' ? b.isoWeek : b.fiscalWeek;
                    return weekA - weekB;
                });

            // Draw line
            g.append('path')
                .datum(yearData)
                .attr('class', `year-line year-${year}`)
                .attr('d', line)
                .attr('fill', 'none')
                .attr('stroke', this.yearColors[year])
                .attr('stroke-width', year === 'FY26' ? 3 : 2.5)
                .attr('stroke-linecap', 'round')
                .attr('stroke-linejoin', 'round')
                .attr('opacity', year === 'FY26' ? 1 : 0.8);

            // Draw points
            g.selectAll(`.point-${year}`)
                .data(yearData)
                .enter()
                .append('circle')
                .attr('class', `year-point point-${year}`)
                .attr('cx', d => xScale(this.weekType === 'iso' ? d.isoWeek : d.fiscalWeek))
                .attr('cy', d => yScale(this.getValue(d)))
                .attr('r', this.isMobile ? 5 : 4)
                .attr('fill', this.yearColors[year])
                .attr('stroke', 'white')
                .attr('stroke-width', 1.5)
                .attr('opacity', 0.8)
                .style('cursor', 'pointer');
        });

        // Add FY26 projection based on FY25 (target comp)
        this.renderProjection(g, xScale, yScale, visibleData, line);

        // Add legend (desktop only)
        if (!this.isMobile) {
            this.renderLegend(g, innerWidth, sortedYears);
        }

        // Add tooltip interactivity
        this.setupTooltip(g, xScale, yScale, visibleData, innerHeight);
    }

    calculateProjectedMax(visibleData) {
        // Calculate the max projected value so Y scale can accommodate it
        const fy25Data = visibleData['FY25'];
        const fy26CurrentData = visibleData['FY26'];

        if (!fy25Data || !fy26CurrentData || fy26CurrentData.length === 0) {
            return 0;
        }

        // Find the last FY26 data point
        const sortedFY26 = [...fy26CurrentData].sort((a, b) => {
            const weekA = this.weekType === 'iso' ? a.isoWeek : a.fiscalWeek;
            const weekB = this.weekType === 'iso' ? b.isoWeek : b.fiscalWeek;
            return weekB - weekA;
        });
        const lastFY26Point = sortedFY26[0];
        const lastFY26Week = this.weekType === 'iso' ? lastFY26Point.isoWeek : lastFY26Point.fiscalWeek;
        const lastFY26Value = this.getValue(lastFY26Point);

        // Find FY25 value at the same week
        const fy25AtSameWeek = fy25Data.find(d => {
            const week = this.weekType === 'iso' ? d.isoWeek : d.fiscalWeek;
            return week === lastFY26Week;
        });

        if (!fy25AtSameWeek) {
            return 0;
        }

        const fy25ValueAtWeek = this.getValue(fy25AtSameWeek);
        const variance = lastFY26Value - fy25ValueAtWeek;

        // Find max FY25 value and add variance
        const fy25Max = Math.max(...fy25Data.map(d => this.getValue(d)));
        return fy25Max + variance;
    }

    renderProjection(g, xScale, yScale, visibleData, line) {
        // Clear previous projection data
        this.projectionData = [];

        // Only render if we have both FY25 (target) and FY26 data
        const fy25Data = visibleData['FY25'];
        const fy26CurrentData = visibleData['FY26'];

        if (!fy25Data || !fy26CurrentData || fy26CurrentData.length === 0) {
            return;
        }

        // Find the last FY26 data point
        const sortedFY26 = [...fy26CurrentData].sort((a, b) => {
            const weekA = this.weekType === 'iso' ? a.isoWeek : a.fiscalWeek;
            const weekB = this.weekType === 'iso' ? b.isoWeek : b.fiscalWeek;
            return weekB - weekA;
        });
        const lastFY26Point = sortedFY26[0];
        const lastFY26Week = this.weekType === 'iso' ? lastFY26Point.isoWeek : lastFY26Point.fiscalWeek;
        const lastFY26Value = this.getValue(lastFY26Point);

        // Find FY25 value at the same week
        const fy25AtSameWeek = fy25Data.find(d => {
            const week = this.weekType === 'iso' ? d.isoWeek : d.fiscalWeek;
            return week === lastFY26Week;
        });

        if (!fy25AtSameWeek) {
            return; // Can't calculate variance without matching week
        }

        const fy25ValueAtWeek = this.getValue(fy25AtSameWeek);
        const variance = lastFY26Value - fy25ValueAtWeek;

        // Get FY25 data points AFTER the current FY26 week
        const fy25FutureWeeks = fy25Data
            .filter(d => {
                const week = this.weekType === 'iso' ? d.isoWeek : d.fiscalWeek;
                return week > lastFY26Week;
            })
            .sort((a, b) => {
                const weekA = this.weekType === 'iso' ? a.isoWeek : a.fiscalWeek;
                const weekB = this.weekType === 'iso' ? b.isoWeek : b.fiscalWeek;
                return weekA - weekB;
            });

        if (fy25FutureWeeks.length === 0) {
            return; // No future weeks to project
        }

        // Build projection data: FY25 future values + variance (applied to current metric)
        // Calculate variance for each metric type
        const varianceByMetric = {
            tickets: lastFY26Point.tickets - (fy25AtSameWeek.tickets || 0),
            revenue: lastFY26Point.revenue - (fy25AtSameWeek.revenue || 0),
            singleTickets: (lastFY26Point.singleTickets || 0) - (fy25AtSameWeek.singleTickets || 0),
            singleRevenue: (lastFY26Point.singleRevenue || 0) - (fy25AtSameWeek.singleRevenue || 0),
            subscriptionTickets: (lastFY26Point.subscriptionTickets || 0) - (fy25AtSameWeek.subscriptionTickets || 0),
            subscriptionRevenue: (lastFY26Point.subscriptionRevenue || 0) - (fy25AtSameWeek.subscriptionRevenue || 0)
        };

        const projectionData = [
            // Start from last actual FY26 point
            {
                fiscalWeek: lastFY26Point.fiscalWeek,
                isoWeek: lastFY26Point.isoWeek,
                tickets: lastFY26Point.tickets,
                revenue: lastFY26Point.revenue,
                singleTickets: lastFY26Point.singleTickets,
                singleRevenue: lastFY26Point.singleRevenue,
                subscriptionTickets: lastFY26Point.subscriptionTickets,
                subscriptionRevenue: lastFY26Point.subscriptionRevenue,
                isActual: true
            },
            // Project future weeks - add variance to each metric
            ...fy25FutureWeeks.map(d => ({
                fiscalWeek: d.fiscalWeek,
                isoWeek: d.isoWeek,
                tickets: (d.tickets || 0) + varianceByMetric.tickets,
                revenue: (d.revenue || 0) + varianceByMetric.revenue,
                singleTickets: (d.singleTickets || 0) + varianceByMetric.singleTickets,
                singleRevenue: (d.singleRevenue || 0) + varianceByMetric.singleRevenue,
                subscriptionTickets: (d.subscriptionTickets || 0) + varianceByMetric.subscriptionTickets,
                subscriptionRevenue: (d.subscriptionRevenue || 0) + varianceByMetric.subscriptionRevenue,
                isProjected: true
            }))
        ];

        // Store projection data for tooltip access
        this.projectionData = projectionData;

        // Draw projection line (dashed green)
        g.append('path')
            .datum(projectionData)
            .attr('class', 'projection-line')
            .attr('d', line)
            .attr('fill', 'none')
            .attr('stroke', this.yearColors['FY26 Projected'])
            .attr('stroke-width', 2.5)
            .attr('stroke-dasharray', '8,4')
            .attr('opacity', 0.8);

        // Draw projection points
        g.selectAll('.projection-point')
            .data(projectionData.filter(d => d.isProjected))
            .enter()
            .append('circle')
            .attr('class', 'year-point projection-point')
            .attr('cx', d => xScale(this.weekType === 'iso' ? d.isoWeek : d.fiscalWeek))
            .attr('cy', d => yScale(this.getValue(d)))
            .attr('r', this.isMobile ? 4 : 3)
            .attr('fill', this.yearColors['FY26 Projected'])
            .attr('stroke', 'white')
            .attr('stroke-width', 1)
            .attr('opacity', 0.7)
            .style('cursor', 'pointer');
    }

    renderLegend(g, innerWidth, years) {
        const legend = g.append('g')
            .attr('class', 'chart-legend')
            .attr('transform', `translate(${innerWidth + 20}, 10)`);

        // Add regular year entries
        years.forEach((year, i) => {
            const row = legend.append('g')
                .attr('transform', `translate(0, ${i * 24})`);

            const isCurrent = year === 'FY26';
            const isTarget = year === 'FY25';

            row.append('line')
                .attr('x1', 0)
                .attr('x2', 24)
                .attr('y1', 8)
                .attr('y2', 8)
                .attr('stroke', this.yearColors[year])
                .attr('stroke-width', isCurrent ? 3 : 2.5);

            row.append('circle')
                .attr('cx', 12)
                .attr('cy', 8)
                .attr('r', 4)
                .attr('fill', this.yearColors[year]);

            let label = year;
            if (isTarget) label += ' (Target)';

            row.append('text')
                .attr('x', 32)
                .attr('y', 12)
                .style('font-size', '12px')
                .style('font-weight', isCurrent || isTarget ? '600' : '400')
                .text(label);
        });

        // Add projection legend entry if FY25 and FY26 are visible
        if (this.visibleYears.has('FY25') && this.visibleYears.has('FY26')) {
            const projRow = legend.append('g')
                .attr('transform', `translate(0, ${years.length * 24})`);

            projRow.append('line')
                .attr('x1', 0)
                .attr('x2', 24)
                .attr('y1', 8)
                .attr('y2', 8)
                .attr('stroke', this.yearColors['FY26 Projected'])
                .attr('stroke-width', 2.5)
                .attr('stroke-dasharray', '4,2');

            projRow.append('circle')
                .attr('cx', 12)
                .attr('cy', 8)
                .attr('r', 3)
                .attr('fill', this.yearColors['FY26 Projected']);

            projRow.append('text')
                .attr('x', 32)
                .attr('y', 12)
                .style('font-size', '12px')
                .style('font-weight', '400')
                .style('font-style', 'italic')
                .text('FY26 Projected');
        }
    }

    setupTooltip(g, xScale, yScale, visibleData, innerHeight) {
        const self = this;

        // Create tooltip with inline styles (consistent with other charts)
        const tooltip = d3.select('body')
            .append('div')
            .attr('class', 'ytd-tooltip')
            .style('position', 'absolute')
            .style('visibility', 'hidden')
            .style('background', 'rgba(0, 0, 0, 0.9)')
            .style('color', 'white')
            .style('padding', this.isMobile ? '10px 12px' : '12px 16px')
            .style('border-radius', '8px')
            .style('font-size', this.isMobile ? '11px' : '12px')
            .style('z-index', '1001')
            .style('pointer-events', 'none')
            .style('max-width', this.isMobile ? '220px' : '300px')
            .style('box-shadow', '0 4px 12px rgba(0, 0, 0, 0.3)');

        // Add hover effects to points
        g.selectAll('.year-point')
            .on('mouseover', function(event, d) {
                d3.select(this)
                    .transition()
                    .duration(150)
                    .attr('r', self.isMobile ? 7 : 6)
                    .attr('opacity', 1);

                const week = self.weekType === 'iso' ? d.isoWeek : d.fiscalWeek;
                const weekLabel = self.weekType === 'iso' ? `ISO Week ${week}` : `Fiscal Week ${week}`;

                // Find all values for this week across all visible years
                const weekValues = [];
                Object.entries(visibleData).forEach(([year, data]) => {
                    const match = data.find(w =>
                        (self.weekType === 'iso' ? w.isoWeek : w.fiscalWeek) === week
                    );
                    if (match) {
                        weekValues.push({
                            year,
                            value: self.getValue(match),
                            date: match.date
                        });
                    }
                });

                // Check for projected FY26 value at this week
                if (self.projectionData && self.projectionData.length > 0) {
                    const projMatch = self.projectionData.find(w =>
                        (self.weekType === 'iso' ? w.isoWeek : w.fiscalWeek) === week && w.isProjected
                    );
                    if (projMatch) {
                        weekValues.push({
                            year: 'FY26 Projected',
                            value: self.getValue(projMatch),
                            date: null,
                            isProjected: true
                        });
                    }
                }

                weekValues.sort((a, b) => b.value - a.value);

                let html = `<strong style="border-bottom: 1px solid rgba(255,255,255,0.3); padding-bottom: 6px; margin-bottom: 8px; display: block;">${weekLabel}</strong>`;
                weekValues.forEach(v => {
                    const formattedValue = self.isRevenueMetric()
                        ? '$' + Math.round(v.value).toLocaleString()
                        : v.value.toLocaleString() + ' tickets';
                    const dateStr = v.date ? new Date(v.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
                    const italicStyle = v.isProjected ? 'font-style: italic;' : '';
                    const labelStyle = v.isProjected ? 'font-weight: 400; font-style: italic;' : 'font-weight: 500;';
                    html += `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 3px 0; ${italicStyle}">
                            <span>
                                <span style="width: 10px; height: 10px; border-radius: 50%; background: ${self.yearColors[v.year]}; display: inline-block; margin-right: 6px;"></span>
                                <span style="${labelStyle}">${v.year}</span>
                            </span>
                            <span style="font-weight: 600; margin-left: 12px;">${formattedValue}</span>
                        </div>
                    `;
                });

                tooltip.html(html).style('visibility', 'visible');

                // Position tooltip
                const tooltipNode = tooltip.node();
                const tooltipRect = tooltipNode.getBoundingClientRect();
                let left = event.pageX + 15;
                let top = event.pageY - 10;

                if (left + tooltipRect.width > window.innerWidth - 10) {
                    left = event.pageX - tooltipRect.width - 15;
                }
                if (top + tooltipRect.height > window.innerHeight - 10) {
                    top = event.pageY - tooltipRect.height - 15;
                }

                tooltip.style('left', left + 'px').style('top', top + 'px');
            })
            .on('mousemove', function(event) {
                const tooltipNode = tooltip.node();
                const tooltipRect = tooltipNode.getBoundingClientRect();
                let left = event.pageX + 15;
                let top = event.pageY - 10;

                if (left + tooltipRect.width > window.innerWidth - 10) {
                    left = event.pageX - tooltipRect.width - 15;
                }
                if (top + tooltipRect.height > window.innerHeight - 10) {
                    top = event.pageY - tooltipRect.height - 15;
                }

                tooltip.style('left', left + 'px').style('top', top + 'px');
            })
            .on('mouseout', function() {
                d3.select(this)
                    .transition()
                    .duration(150)
                    .attr('r', self.isMobile ? 5 : 4)
                    .attr('opacity', 0.8);

                tooltip.style('visibility', 'hidden');
            });
    }

    destroy() {
        clearTimeout(this.resizeTimeout);
        window.removeEventListener('resize', this.handleResize.bind(this));
        d3.select('.ytd-tooltip').remove();
    }
}

// Export for module use
export default YTDComparisonChart;
