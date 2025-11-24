/**
 * Executive Dashboard - Board Presentation (Budget-Focused)
 * Designed to match the board's familiar spreadsheet format with enhanced visuals
 */

class ExecutiveDashboard {
    constructor() {
        this.data = null;
        this.kpiAnimationDuration = 1000;
    }

    async init(data) {
        this.data = data;

        // Render all components
        this.renderBudgetKPIs();
        this.renderBudgetVarianceChart();
        this.renderSinglesVsSubsChart();
        this.renderSeriesSummaryCards();
        this.renderCapacityOverview();
        this.setupTableToggle();
    }

    // ===== Budget-Focused KPI Cards =====
    renderBudgetKPIs() {
        if (!this.data || !this.data.performances) return;

        const performances = this.data.performances;

        // Calculate totals
        const budgetTotal = d3.sum(performances, d => d.budgetGoal || d.budget_goal || 0);
        const actualTotal = d3.sum(performances, d => d.totalRevenue || d.total_revenue || d.revenue || 0);
        const varianceTotal = actualTotal - budgetTotal;

        // Singles
        const budgetSingles = d3.sum(performances, d => d.singleTicketsBudget || d.single_tickets_budget || 0);
        const actualSingles = d3.sum(performances, d => d.singleTicketsRevenue || d.single_tickets_revenue || 0);
        const varianceSingles = actualSingles - budgetSingles;

        // Subscriptions
        const budgetSubs = d3.sum(performances, d => d.subscriptionTicketsBudget || d.subscription_tickets_budget || 0);
        const actualSubs = d3.sum(performances, d => d.subscriptionTicketsRevenue || d.subscription_tickets_revenue || 0);
        const varianceSubs = actualSubs - budgetSubs;

        // Capacity and ATP
        const totalTickets = d3.sum(performances, d => {
            return d.totalTicketsSold || d.total_tickets_sold || d.tickets_sold ||
                   (d.singleTicketsSold || 0) + (d.subscriptionTicketsSold || 0) + (d.nonFixedTicketsSold || 0);
        });
        const totalCapacity = d3.sum(performances, d => d.capacity || 0);
        const avgCapacity = totalCapacity > 0 ? (totalTickets / totalCapacity) * 100 : 0;
        const atp = totalTickets > 0 ? actualTotal / totalTickets : 0;

        // Animate values
        this.animateValue('kpi-budget-total', 0, budgetTotal, this.kpiAnimationDuration, val => `$${this.formatMoney(val)}`);
        this.animateValue('kpi-actual-total', 0, actualTotal, this.kpiAnimationDuration, val => `$${this.formatMoney(val)}`);

        this.animateValue('kpi-budget-singles', 0, budgetSingles, this.kpiAnimationDuration, val => `$${this.formatMoney(val)}`);
        this.animateValue('kpi-actual-singles', 0, actualSingles, this.kpiAnimationDuration, val => `$${this.formatMoney(val)}`);

        this.animateValue('kpi-budget-subs', 0, budgetSubs, this.kpiAnimationDuration, val => `$${this.formatMoney(val)}`);
        this.animateValue('kpi-actual-subs', 0, actualSubs, this.kpiAnimationDuration, val => `$${this.formatMoney(val)}`);

        this.animateValue('kpi-capacity', 0, avgCapacity, this.kpiAnimationDuration, val => `${val.toFixed(1)}%`);
        this.animateValue('kpi-atp', 0, atp, this.kpiAnimationDuration, val => `$${val.toFixed(0)}`);

        // Set variance indicators
        this.setVarianceIndicator('kpi-variance-total', varianceTotal);
        this.setVarianceIndicator('kpi-variance-singles', varianceSingles);
        this.setVarianceIndicator('kpi-variance-subs', varianceSubs);
    }

    setVarianceIndicator(elementId, variance) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const isPositive = variance >= 0;
        const sign = variance >= 0 ? '+' : '';
        element.textContent = `${sign}$${this.formatMoney(Math.abs(variance))}`;
        element.className = `kpi-variance ${isPositive ? 'positive' : 'negative'}`;
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

    // ===== Budget Variance Chart (Budget vs Actual by Series) =====
    renderBudgetVarianceChart() {
        if (!this.data || !this.data.performances) return;

        const container = d3.select('#budget-variance-chart');
        container.html('');

        // Group by series
        const seriesData = d3.rollup(
            this.data.performances,
            v => ({
                budget: d3.sum(v, d => d.budgetGoal || d.budget_goal || 0),
                actual: d3.sum(v, d => d.totalRevenue || d.total_revenue || d.revenue || 0),
                count: v.length
            }),
            d => d.series || d.season || 'Other'
        );

        const data = Array.from(seriesData, ([series, metrics]) => ({
            series: series.replace(/25-26\s+/, '').replace(/^\d{2}-\d{2}\s+/, ''),
            budget: metrics.budget,
            actual: metrics.actual,
            variance: metrics.actual - metrics.budget,
            count: metrics.count
        }))
        .filter(d => d.count > 0)
        .sort((a, b) => b.budget - a.budget)
        .slice(0, 10);

        if (data.length === 0) {
            container.html('<p style="text-align: center; color: var(--text-muted);">No budget data available</p>');
            return;
        }

        // Chart dimensions
        const margin = { top: 20, right: 80, bottom: 120, left: 80 };
        const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
        const height = 350 - margin.top - margin.bottom;

        const svg = container.append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Scales
        const x0 = d3.scaleBand()
            .domain(data.map(d => d.series))
            .range([0, width])
            .padding(0.2);

        const x1 = d3.scaleBand()
            .domain(['budget', 'actual'])
            .range([0, x0.bandwidth()])
            .padding(0.05);

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => Math.max(d.budget, d.actual))])
            .nice()
            .range([height, 0]);

        // Color scale
        const color = d3.scaleOrdinal()
            .domain(['budget', 'actual'])
            .range(['#95a5a6', '#667eea']);

        // Grouped bars
        const seriesGroups = svg.selectAll('.series-group')
            .data(data)
            .enter()
            .append('g')
            .attr('class', 'series-group')
            .attr('transform', d => `translate(${x0(d.series)},0)`);

        seriesGroups.selectAll('rect')
            .data(d => ['budget', 'actual'].map(key => ({ key, value: d[key], series: d.series })))
            .enter()
            .append('rect')
            .attr('x', d => x1(d.key))
            .attr('width', x1.bandwidth())
            .attr('y', height)
            .attr('height', 0)
            .attr('fill', d => color(d.key))
            .attr('rx', 3)
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
            .attr('y', d => y(d.value))
            .attr('height', d => height - y(d.value));

        // X axis
        svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x0))
            .selectAll('text')
            .attr('transform', 'rotate(-45)')
            .style('text-anchor', 'end')
            .style('font-size', '11px');

        // Y axis
        svg.append('g')
            .call(d3.axisLeft(y).ticks(6).tickFormat(d => `$${(d / 1000).toFixed(0)}k`))
            .style('font-size', '11px');

        // Legend
        const legend = svg.append('g')
            .attr('transform', `translate(${width - 100}, -10)`);

        ['budget', 'actual'].forEach((key, i) => {
            const legendRow = legend.append('g')
                .attr('transform', `translate(0, ${i * 20})`);

            legendRow.append('rect')
                .attr('width', 15)
                .attr('height', 15)
                .attr('fill', color(key))
                .attr('rx', 2);

            legendRow.append('text')
                .attr('x', 20)
                .attr('y', 12)
                .text(key.charAt(0).toUpperCase() + key.slice(1))
                .style('font-size', '12px')
                .attr('fill', 'var(--text-primary)');
        });

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
                ${d.key.charAt(0).toUpperCase() + d.key.slice(1)}: ${d3.format('$,.0f')(d.value)}
            `)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 28) + 'px');
        }

        function hideTooltip() {
            tooltip.transition().duration(500).style('opacity', 0);
        }
    }

    // ===== Singles vs Subscriptions Chart =====
    renderSinglesVsSubsChart() {
        if (!this.data || !this.data.performances) return;

        const container = d3.select('#singles-subs-chart');
        container.html('');

        const performances = this.data.performances;

        // Calculate totals
        const singlesRevenue = d3.sum(performances, d => d.singleTicketsRevenue || d.single_tickets_revenue || 0);
        const subsRevenue = d3.sum(performances, d => d.subscriptionTicketsRevenue || d.subscription_tickets_revenue || 0);

        const data = [
            { category: 'Single Tickets', value: singlesRevenue },
            { category: 'Subscriptions', value: subsRevenue }
        ];

        if (singlesRevenue === 0 && subsRevenue === 0) {
            container.html('<p style="text-align: center; color: var(--text-muted);">No ticket data available</p>');
            return;
        }

        // Create donut chart
        const margin = { top: 20, right: 20, bottom: 20, left: 20 };
        const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
        const height = 300 - margin.top - margin.bottom;
        const radius = Math.min(width, height) / 2;

        const svg = container.append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${width / 2 + margin.left},${height / 2 + margin.top})`);

        const color = d3.scaleOrdinal()
            .domain(data.map(d => d.category))
            .range(['#667eea', '#46bc96']);

        const pie = d3.pie()
            .value(d => d.value)
            .sort(null);

        const arc = d3.arc()
            .innerRadius(radius * 0.6)
            .outerRadius(radius);

        const arcs = svg.selectAll('.arc')
            .data(pie(data))
            .enter()
            .append('g')
            .attr('class', 'arc');

        arcs.append('path')
            .attr('d', arc)
            .attr('fill', d => color(d.data.category))
            .attr('stroke', 'white')
            .attr('stroke-width', 2)
            .style('cursor', 'pointer')
            .on('mouseover', function(event, d) {
                d3.select(this).transition().duration(200)
                    .attr('d', d3.arc().innerRadius(radius * 0.55).outerRadius(radius * 1.05));
                showTooltip(event, d);
            })
            .on('mouseout', function() {
                d3.select(this).transition().duration(200)
                    .attr('d', arc);
                hideTooltip();
            })
            .transition()
            .duration(800)
            .attrTween('d', function(d) {
                const interpolate = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
                return function(t) {
                    return arc(interpolate(t));
                };
            });

        // Center text
        svg.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', '-0.5em')
            .style('font-size', '14px')
            .style('fill', 'var(--text-secondary)')
            .text('Total Revenue');

        svg.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', '1em')
            .style('font-size', '24px')
            .style('font-weight', 'bold')
            .style('fill', 'var(--text-primary)')
            .text(`$${this.formatMoney(singlesRevenue + subsRevenue)}`);

        // Legend
        const legendContainer = container.append('div')
            .style('text-align', 'center')
            .style('margin-top', '10px');

        data.forEach((d, i) => {
            const percent = ((d.value / (singlesRevenue + subsRevenue)) * 100).toFixed(1);
            const legendItem = legendContainer.append('div')
                .style('display', 'inline-block')
                .style('margin', '0 15px')
                .style('font-size', '12px');

            legendItem.append('span')
                .style('display', 'inline-block')
                .style('width', '12px')
                .style('height', '12px')
                .style('background-color', color(d.category))
                .style('margin-right', '6px')
                .style('border-radius', '2px');

            legendItem.append('span')
                .text(`${d.category}: ${percent}%`);
        });

        // Tooltip
        const tooltip = d3.select('body').append('div')
            .attr('class', 'chart-tooltip')
            .style('opacity', 0)
            .style('position', 'absolute')
            .style('pointer-events', 'none');

        function showTooltip(event, d) {
            tooltip.transition().duration(200).style('opacity', 1);
            const percent = ((d.value / (singlesRevenue + subsRevenue)) * 100).toFixed(1);
            tooltip.html(`
                <strong>${d.data.category}</strong><br/>
                Revenue: ${d3.format('$,.0f')(d.data.value)}<br/>
                ${percent}% of total
            `)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 28) + 'px');
        }

        function hideTooltip() {
            tooltip.transition().duration(500).style('opacity', 0);
        }
    }

    // ===== Series Summary Cards =====
    renderSeriesSummaryCards() {
        if (!this.data || !this.data.performances) return;

        const container = d3.select('#series-summary-cards');
        container.html('');

        // Group by series
        const seriesData = d3.rollup(
            this.data.performances,
            v => ({
                budget: d3.sum(v, d => d.budgetGoal || d.budget_goal || 0),
                actual: d3.sum(v, d => d.totalRevenue || d.total_revenue || d.revenue || 0),
                tickets: d3.sum(v, d => {
                    return d.totalTicketsSold || d.total_tickets_sold || d.tickets_sold ||
                           (d.singleTicketsSold || 0) + (d.subscriptionTicketsSold || 0) + (d.nonFixedTicketsSold || 0);
                }),
                capacity: d3.sum(v, d => d.capacity || 0),
                count: v.length
            }),
            d => d.series || d.season || 'Other'
        );

        const data = Array.from(seriesData, ([series, metrics]) => ({
            series: series.replace(/25-26\s+/, '').replace(/^\d{2}-\d{2}\s+/, ''),
            ...metrics,
            variance: metrics.actual - metrics.budget,
            capacityPercent: metrics.capacity > 0 ? (metrics.tickets / metrics.capacity) * 100 : 0
        }))
        .filter(d => d.count > 0)
        .sort((a, b) => b.budget - a.budget);

        if (data.length === 0) {
            container.html('<p style="text-align: center; color: var(--text-muted);">No series data available</p>');
            return;
        }

        const grid = container.append('div')
            .attr('class', 'series-summary-grid');

        grid.selectAll('.series-card')
            .data(data)
            .enter()
            .append('div')
            .attr('class', d => `series-card ${d.variance >= 0 ? 'over-budget' : 'under-budget'}`)
            .html(d => {
                const variancePercent = d.budget > 0 ? ((d.variance / d.budget) * 100).toFixed(1) : 0;
                const sign = d.variance >= 0 ? '+' : '';
                return `
                    <div class="series-card-header">
                        <div class="series-card-title">${d.series}</div>
                        <div class="series-card-badge ${d.variance >= 0 ? 'positive' : 'negative'}">
                            ${sign}${variancePercent}%
                        </div>
                    </div>
                    <div class="series-card-stats">
                        <div class="series-stat">
                            <div class="series-stat-label">Budget</div>
                            <div class="series-stat-value">$${this.formatMoney(d.budget)}</div>
                        </div>
                        <div class="series-stat">
                            <div class="series-stat-label">Actual</div>
                            <div class="series-stat-value">$${this.formatMoney(d.actual)}</div>
                        </div>
                        <div class="series-stat">
                            <div class="series-stat-label">Capacity</div>
                            <div class="series-stat-value">${d.capacityPercent.toFixed(1)}%</div>
                        </div>
                        <div class="series-stat">
                            <div class="series-stat-label">Performances</div>
                            <div class="series-stat-value">${d.count}</div>
                        </div>
                    </div>
                `;
            })
            .style('opacity', 0)
            .transition()
            .duration(500)
            .delay((d, i) => i * 100)
            .style('opacity', 1);
    }

    // ===== Capacity Overview =====
    renderCapacityOverview() {
        if (!this.data || !this.data.performances) return;

        const container = d3.select('#capacity-overview-chart');
        container.html('');

        // Group by capacity buckets
        const performances = this.data.performances.map(d => {
            const tickets = d.totalTicketsSold || d.total_tickets_sold || d.tickets_sold ||
                           (d.singleTicketsSold || 0) + (d.subscriptionTicketsSold || 0) + (d.nonFixedTicketsSold || 0);
            const capacity = d.capacity || 1;
            const capacityPercent = (tickets / capacity) * 100;

            let bucket = '';
            if (capacityPercent >= 80) bucket = '80-100%';
            else if (capacityPercent >= 60) bucket = '60-79%';
            else if (capacityPercent >= 40) bucket = '40-59%';
            else bucket = '0-39%';

            return { bucket, capacityPercent };
        });

        const bucketCounts = d3.rollup(
            performances,
            v => v.length,
            d => d.bucket
        );

        const data = [
            { bucket: '80-100%', count: bucketCounts.get('80-100%') || 0, color: '#00b894' },
            { bucket: '60-79%', count: bucketCounts.get('60-79%') || 0, color: '#46bc96' },
            { bucket: '40-59%', count: bucketCounts.get('40-59%') || 0, color: '#fdcb6e' },
            { bucket: '0-39%', count: bucketCounts.get('0-39%') || 0, color: '#e17055' }
        ];

        // Chart dimensions
        const margin = { top: 20, right: 20, bottom: 50, left: 50 };
        const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
        const height = 300 - margin.top - margin.bottom;

        const svg = container.append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Scales
        const x = d3.scaleBand()
            .domain(data.map(d => d.bucket))
            .range([0, width])
            .padding(0.3);

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.count)])
            .nice()
            .range([height, 0]);

        // Bars
        svg.selectAll('.bar')
            .data(data)
            .enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('x', d => x(d.bucket))
            .attr('width', x.bandwidth())
            .attr('y', height)
            .attr('height', 0)
            .attr('fill', d => d.color)
            .attr('rx', 4)
            .transition()
            .duration(800)
            .delay((d, i) => i * 100)
            .attr('y', d => y(d.count))
            .attr('height', d => height - y(d.count));

        // Value labels on bars
        svg.selectAll('.label')
            .data(data)
            .enter()
            .append('text')
            .attr('class', 'label')
            .attr('x', d => x(d.bucket) + x.bandwidth() / 2)
            .attr('y', d => y(d.count) - 5)
            .attr('text-anchor', 'middle')
            .style('font-size', '14px')
            .style('font-weight', 'bold')
            .style('fill', 'var(--text-primary)')
            .text(d => d.count)
            .style('opacity', 0)
            .transition()
            .duration(800)
            .delay((d, i) => i * 100 + 400)
            .style('opacity', 1);

        // X axis
        svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x))
            .style('font-size', '12px');

        // Y axis
        svg.append('g')
            .call(d3.axisLeft(y).ticks(5))
            .style('font-size', '12px');

        // Axis labels
        svg.append('text')
            .attr('text-anchor', 'middle')
            .attr('x', width / 2)
            .attr('y', height + 40)
            .style('font-size', '12px')
            .style('fill', 'var(--text-secondary)')
            .text('Capacity Range');

        svg.append('text')
            .attr('text-anchor', 'middle')
            .attr('transform', 'rotate(-90)')
            .attr('y', -35)
            .attr('x', -height / 2)
            .style('font-size', '12px')
            .style('fill', 'var(--text-secondary)')
            .text('Number of Performances');
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
                toggleText.textContent = 'Show Detailed Table';
                toggleBtn.classList.remove('active');
            } else {
                tableView.style.display = 'block';
                toggleText.textContent = 'Hide Detailed Table';
                toggleBtn.classList.add('active');
            }
        });
    }

    // ===== Utility Functions =====
    formatMoney(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(0) + 'K';
        }
        return num.toFixed(0);
    }
}

// Make globally available
window.ExecutiveDashboard = ExecutiveDashboard;
