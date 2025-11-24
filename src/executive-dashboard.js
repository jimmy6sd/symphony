/**
 * Executive Dashboard - Board Presentation View
 * High-impact visualizations and KPIs for executive presentations
 */

class ExecutiveDashboard {
    constructor() {
        this.data = null;
        this.kpiAnimationDuration = 1000;
    }

    async init(data) {
        this.data = data;

        // Render all components
        this.renderKPIs();
        this.renderRevenueTrend();
        this.renderSeriesComparison();
        this.renderTopPerformers();
        this.renderAttentionNeeded();
        this.setupTableToggle();
    }

    // ===== KPI Cards =====
    renderKPIs() {
        if (!this.data || !this.data.performances) return;

        const performances = this.data.performances;
        const weekOverWeek = this.data.weekOverWeek || {};

        // Calculate metrics - using correct BigQuery field names
        const totalRevenue = d3.sum(performances, d => (d.totalRevenue || d.total_revenue || d.revenue || 0));
        const totalTickets = d3.sum(performances, d => {
            // Try multiple field names for total tickets
            return d.totalTicketsSold || d.total_tickets_sold || d.tickets_sold ||
                   (d.singleTicketsSold || 0) + (d.subscriptionTicketsSold || 0) + (d.nonFixedTicketsSold || 0);
        });
        const totalCapacity = d3.sum(performances, d => d.capacity || 0);
        const avgCapacity = totalCapacity > 0 ? (totalTickets / totalCapacity) * 100 : 0;
        const totalPerformances = performances.length;

        // Calculate week-over-week changes
        const revenueChange = this.calculateWoWChange(performances, 'revenue');
        const ticketsChange = this.calculateWoWChange(performances, 'tickets_sold');
        const capacityChange = this.calculateWoWChange(performances, 'capacity_percent');

        // Animate KPI values
        this.animateValue('kpi-revenue', 0, totalRevenue, this.kpiAnimationDuration, val =>
            `$${this.formatNumber(val, 0)}`
        );
        this.animateValue('kpi-tickets', 0, totalTickets, this.kpiAnimationDuration, val =>
            this.formatNumber(val, 0)
        );
        this.animateValue('kpi-capacity', 0, avgCapacity, this.kpiAnimationDuration, val =>
            `${val.toFixed(1)}%`
        );
        this.animateValue('kpi-performances', 0, totalPerformances, this.kpiAnimationDuration, val =>
            Math.round(val).toString()
        );

        // Set change indicators
        this.setChangeIndicator('kpi-revenue-change', revenueChange);
        this.setChangeIndicator('kpi-tickets-change', ticketsChange);
        this.setChangeIndicator('kpi-capacity-change', capacityChange);
        this.setChangeIndicator('kpi-performances-change', 0); // Static for now
    }

    calculateWoWChange(performances, field) {
        // Simple week-over-week calculation based on data
        // This is a placeholder - adjust based on your actual data structure
        const recentPerfs = performances.slice(-7);
        const previousPerfs = performances.slice(-14, -7);

        if (previousPerfs.length === 0) return 0;

        const recentSum = d3.sum(recentPerfs, d => d[field] || 0);
        const previousSum = d3.sum(previousPerfs, d => d[field] || 0);

        if (previousSum === 0) return 0;

        return ((recentSum - previousSum) / previousSum) * 100;
    }

    setChangeIndicator(elementId, changePercent) {
        const element = document.getElementById(elementId);
        if (!element) return;

        if (changePercent === 0) {
            element.textContent = 'No change';
            element.className = 'kpi-change';
        } else {
            const isPositive = changePercent > 0;
            element.textContent = `${Math.abs(changePercent).toFixed(1)}% vs last week`;
            element.className = `kpi-change ${isPositive ? '' : 'negative'}`;
        }
    }

    animateValue(elementId, start, end, duration, formatter) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out cubic
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const current = start + (end - start) * easeProgress;

            element.textContent = formatter(current);

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    // ===== Revenue Trend Chart =====
    renderRevenueTrend() {
        if (!this.data || !this.data.performances) return;

        const container = d3.select('#revenue-trend-chart');
        container.html('');

        const performances = this.data.performances
            .filter(d => {
                const date = d.date || d.performanceDate || d.performance_date;
                const revenue = d.totalRevenue || d.total_revenue || d.revenue;
                return date && revenue;
            })
            .sort((a, b) => {
                const dateA = new Date(a.date || a.performanceDate || a.performance_date);
                const dateB = new Date(b.date || b.performanceDate || b.performance_date);
                return dateA - dateB;
            });

        if (performances.length === 0) {
            container.html('<p style="text-align: center; color: var(--text-muted);">No revenue data available</p>');
            return;
        }

        // Group by date and sum revenue
        const revenueByDate = d3.rollup(
            performances,
            v => d3.sum(v, d => d.totalRevenue || d.total_revenue || d.revenue || 0),
            d => d.date || d.performanceDate || d.performance_date
        );

        const data = Array.from(revenueByDate, ([date, revenue]) => ({
            date: new Date(date),
            revenue
        })).sort((a, b) => a.date - b.date);

        // Chart dimensions
        const margin = { top: 20, right: 30, bottom: 40, left: 70 };
        const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
        const height = 300 - margin.top - margin.bottom;

        const svg = container.append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Scales
        const x = d3.scaleTime()
            .domain(d3.extent(data, d => d.date))
            .range([0, width]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.revenue)])
            .nice()
            .range([height, 0]);

        // Area generator
        const area = d3.area()
            .x(d => x(d.date))
            .y0(height)
            .y1(d => y(d.revenue))
            .curve(d3.curveMonotoneX);

        // Line generator
        const line = d3.line()
            .x(d => x(d.date))
            .y(d => y(d.revenue))
            .curve(d3.curveMonotoneX);

        // Gradient
        const gradient = svg.append('defs')
            .append('linearGradient')
            .attr('id', 'revenue-gradient')
            .attr('x1', '0%')
            .attr('y1', '0%')
            .attr('x2', '0%')
            .attr('y2', '100%');

        gradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', '#667eea')
            .attr('stop-opacity', 0.4);

        gradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', '#667eea')
            .attr('stop-opacity', 0);

        // Draw area
        svg.append('path')
            .datum(data)
            .attr('fill', 'url(#revenue-gradient)')
            .attr('d', area);

        // Draw line
        svg.append('path')
            .datum(data)
            .attr('fill', 'none')
            .attr('stroke', '#667eea')
            .attr('stroke-width', 3)
            .attr('d', line);

        // Add dots
        svg.selectAll('.dot')
            .data(data)
            .enter()
            .append('circle')
            .attr('class', 'dot')
            .attr('cx', d => x(d.date))
            .attr('cy', d => y(d.revenue))
            .attr('r', 5)
            .attr('fill', '#667eea')
            .attr('stroke', 'white')
            .attr('stroke-width', 2)
            .style('cursor', 'pointer')
            .on('mouseover', function(event, d) {
                d3.select(this).attr('r', 7);
                showTooltip(event, d);
            })
            .on('mouseout', function() {
                d3.select(this).attr('r', 5);
                hideTooltip();
            });

        // X axis
        svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x).ticks(6))
            .selectAll('text')
            .attr('transform', 'rotate(-45)')
            .style('text-anchor', 'end');

        // Y axis
        svg.append('g')
            .call(d3.axisLeft(y).ticks(5).tickFormat(d => `$${(d / 1000).toFixed(0)}k`));

        // Tooltip functions
        const tooltip = d3.select('body').append('div')
            .attr('class', 'chart-tooltip')
            .style('opacity', 0)
            .style('position', 'absolute')
            .style('pointer-events', 'none');

        function showTooltip(event, d) {
            tooltip.transition().duration(200).style('opacity', 1);
            tooltip.html(`
                <strong>${d3.timeFormat('%B %d, %Y')(d.date)}</strong><br/>
                Revenue: ${d3.format('$,.0f')(d.revenue)}
            `)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 28) + 'px');
        }

        function hideTooltip() {
            tooltip.transition().duration(500).style('opacity', 0);
        }
    }

    // ===== Series Comparison Chart =====
    renderSeriesComparison() {
        if (!this.data || !this.data.performances) return;

        const container = d3.select('#series-comparison-chart');
        container.html('');

        const performances = this.data.performances;

        // Group by series
        const seriesData = d3.rollup(
            performances,
            v => ({
                revenue: d3.sum(v, d => d.totalRevenue || d.total_revenue || d.revenue || 0),
                tickets: d3.sum(v, d => {
                    return d.totalTicketsSold || d.total_tickets_sold || d.tickets_sold ||
                           (d.singleTicketsSold || 0) + (d.subscriptionTicketsSold || 0) + (d.nonFixedTicketsSold || 0);
                }),
                count: v.length
            }),
            d => d.series || d.season || 'Other'
        );

        const data = Array.from(seriesData, ([series, metrics]) => ({
            series,
            ...metrics
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 8); // Top 8 series

        if (data.length === 0) {
            container.html('<p style="text-align: center; color: var(--text-muted);">No series data available</p>');
            return;
        }

        // Chart dimensions
        const margin = { top: 20, right: 20, bottom: 100, left: 60 };
        const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
        const height = 300 - margin.top - margin.bottom;

        const svg = container.append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Scales
        const x = d3.scaleBand()
            .domain(data.map(d => d.series))
            .range([0, width])
            .padding(0.2);

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.revenue)])
            .nice()
            .range([height, 0]);

        // Color scale
        const colorScale = d3.scaleOrdinal()
            .domain(data.map(d => d.series))
            .range(['#667eea', '#764ba2', '#46bc96', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#fee140']);

        // Bars
        svg.selectAll('.bar')
            .data(data)
            .enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('x', d => x(d.series))
            .attr('y', height)
            .attr('width', x.bandwidth())
            .attr('height', 0)
            .attr('fill', d => colorScale(d.series))
            .attr('rx', 4)
            .style('cursor', 'pointer')
            .on('mouseover', function(event, d) {
                d3.select(this).attr('opacity', 0.8);
                showTooltip(event, d);
            })
            .on('mouseout', function() {
                d3.select(this).attr('opacity', 1);
                hideTooltip();
            })
            .transition()
            .duration(800)
            .delay((d, i) => i * 50)
            .attr('y', d => y(d.revenue))
            .attr('height', d => height - y(d.revenue));

        // X axis
        svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x))
            .selectAll('text')
            .attr('transform', 'rotate(-45)')
            .style('text-anchor', 'end');

        // Y axis
        svg.append('g')
            .call(d3.axisLeft(y).ticks(5).tickFormat(d => `$${(d / 1000).toFixed(0)}k`));

        // Tooltip
        const tooltip = d3.select('body').append('div')
            .attr('class', 'chart-tooltip')
            .style('opacity', 0)
            .style('position', 'absolute')
            .style('pointer-events', 'none');

        function showTooltip(event, d) {
            tooltip.transition().duration(200).style('opacity', 1);
            tooltip.html(`
                <strong>${d.series}</strong><br/>
                Revenue: ${d3.format('$,.0f')(d.revenue)}<br/>
                Tickets: ${d3.format(',.0f')(d.tickets)}<br/>
                Performances: ${d.count}
            `)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 28) + 'px');
        }

        function hideTooltip() {
            tooltip.transition().duration(500).style('opacity', 0);
        }
    }

    // ===== Top Performers List =====
    renderTopPerformers() {
        if (!this.data || !this.data.performances) return;

        const container = d3.select('#top-performers-list');
        container.html('');

        const topPerformers = [...this.data.performances]
            .sort((a, b) => {
                const revA = a.totalRevenue || a.total_revenue || a.revenue || 0;
                const revB = b.totalRevenue || b.total_revenue || b.revenue || 0;
                return revB - revA;
            })
            .slice(0, 5);

        if (topPerformers.length === 0) {
            container.html('<p style="text-align: center; color: var(--text-muted);">No data available</p>');
            return;
        }

        const list = container.append('ul')
            .attr('class', 'performance-list');

        list.selectAll('.performance-item')
            .data(topPerformers)
            .enter()
            .append('li')
            .attr('class', 'performance-item')
            .html(d => {
                const revenue = d.totalRevenue || d.total_revenue || d.revenue || 0;
                const tickets = d.totalTicketsSold || d.total_tickets_sold || d.tickets_sold ||
                               (d.singleTicketsSold || 0) + (d.subscriptionTicketsSold || 0) + (d.nonFixedTicketsSold || 0);
                const capacity = d.capacity || 1;
                const capacityPercent = capacity > 0 ? (tickets / capacity) * 100 : 0;

                return `
                    <div class="performance-item-title">${d.title || 'Untitled'}</div>
                    <div class="performance-item-stats">
                        <span>Revenue: <span class="performance-item-metric">${d3.format('$,.0f')(revenue)}</span></span>
                        <span>Capacity: <span class="performance-item-metric">${capacityPercent.toFixed(1)}%</span></span>
                    </div>
                `;
            })
            .style('opacity', 0)
            .transition()
            .duration(500)
            .delay((d, i) => i * 100)
            .style('opacity', 1);
    }

    // ===== Needs Attention List =====
    renderAttentionNeeded() {
        if (!this.data || !this.data.performances) return;

        const container = d3.select('#attention-needed-list');
        container.html('');

        // Filter upcoming performances with low capacity
        const needsAttention = this.data.performances
            .filter(d => {
                const date = d.date || d.performanceDate || d.performance_date;
                if (!date) return false;

                const perfDate = new Date(date);
                const now = new Date();

                const tickets = d.totalTicketsSold || d.total_tickets_sold || d.tickets_sold ||
                               (d.singleTicketsSold || 0) + (d.subscriptionTicketsSold || 0) + (d.nonFixedTicketsSold || 0);
                const capacity = d.capacity || 1;
                const capacityPercent = capacity > 0 ? (tickets / capacity) * 100 : 0;

                return perfDate > now && capacityPercent < 50;
            })
            .sort((a, b) => {
                const dateA = new Date(a.date || a.performanceDate || a.performance_date);
                const dateB = new Date(b.date || b.performanceDate || b.performance_date);
                return dateA - dateB;
            })
            .slice(0, 5);

        if (needsAttention.length === 0) {
            container.html('<p style="text-align: center; color: var(--text-muted);">All performances on track! 🎉</p>');
            return;
        }

        const list = container.append('ul')
            .attr('class', 'performance-list');

        list.selectAll('.performance-item')
            .data(needsAttention)
            .enter()
            .append('li')
            .attr('class', 'performance-item attention')
            .html(d => {
                const date = d.date || d.performanceDate || d.performance_date;
                const tickets = d.totalTicketsSold || d.total_tickets_sold || d.tickets_sold ||
                               (d.singleTicketsSold || 0) + (d.subscriptionTicketsSold || 0) + (d.nonFixedTicketsSold || 0);
                const capacity = d.capacity || 1;
                const capacityPercent = capacity > 0 ? (tickets / capacity) * 100 : 0;

                return `
                    <div class="performance-item-title">${d.title || 'Untitled'}</div>
                    <div class="performance-item-stats">
                        <span>Date: <span class="performance-item-metric">${new Date(date).toLocaleDateString()}</span></span>
                        <span>Capacity: <span class="performance-item-metric">${capacityPercent.toFixed(1)}%</span></span>
                    </div>
                `;
            })
            .style('opacity', 0)
            .transition()
            .duration(500)
            .delay((d, i) => i * 100)
            .style('opacity', 1);
    }

    // ===== Table Toggle =====
    setupTableToggle() {
        const toggleBtn = document.getElementById('toggle-table');
        const tableView = document.getElementById('data-table-view');
        const toggleText = document.getElementById('toggle-table-text');

        if (!toggleBtn || !tableView) return;

        toggleBtn.addEventListener('click', () => {
            const isVisible = tableView.style.display !== 'none';

            if (isVisible) {
                tableView.style.display = 'none';
                toggleText.textContent = 'Show Details';
                toggleBtn.classList.remove('active');
            } else {
                tableView.style.display = 'block';
                toggleText.textContent = 'Hide Details';
                toggleBtn.classList.add('active');
            }
        });
    }

    // ===== Utility Functions =====
    formatNumber(num, decimals = 0) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(decimals) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(decimals) + 'K';
        }
        return num.toFixed(decimals);
    }
}

// Make globally available
window.ExecutiveDashboard = ExecutiveDashboard;
