/**
 * Subscription Sales Curve Chart Component
 * Displays historical subscription sales data with comparisons across seasons
 * X-axis: Day of year (1-365) for daily granularity
 * Y-axis: Total subscription units
 */
class SubscriptionSalesCurve {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.series = options.series || 'Classical';
        this.data = null;
        this.svg = null;
        this.width = 0;
        this.height = 0;

        // Initialize responsive state
        this.updateResponsiveState();
        this.margin = this.getResponsiveMargins();

        // Season colors
        this.seasonColors = {
            '26-27': '#3498db',  // Blue - current season
            '25-26': '#ff7c43',  // Orange - target comp (matches sales dashboard)
            '24-25': '#9b59b6',  // Purple
            '23-24': '#95a5a6'   // Gray
        };

        // Debounced resize handler
        this.resizeTimeout = null;
        this.boundResizeHandler = this.handleResize.bind(this);
        window.addEventListener('resize', this.boundResizeHandler);
    }

    handleResize() {
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            const previousMobile = this.isMobile;
            this.updateResponsiveState();
            if (previousMobile !== this.isMobile || this.isMobile) {
                if (this.data) {
                    this.render();
                }
            }
        }, 150);
    }

    destroy() {
        clearTimeout(this.resizeTimeout);
        window.removeEventListener('resize', this.boundResizeHandler);
        d3.select(`.subscription-curve-tooltip-${this.series}`).remove();
    }

    updateResponsiveState() {
        const width = window.innerWidth;
        this.isMobile = width <= 768;
        this.isTablet = width > 768 && width <= 1024;
        this.isDesktop = width > 1024;
    }

    getResponsiveMargins() {
        if (this.isMobile) {
            return { top: 20, right: 15, bottom: 50, left: 50 };
        } else if (this.isTablet) {
            return { top: 30, right: 120, bottom: 60, left: 60 };
        } else {
            return { top: 30, right: 180, bottom: 60, left: 70 };
        }
    }

    // Convert a snapshot_date string or week_number to day-of-year
    toDayOfYear(snapshot) {
        // If we have a snapshot_date, compute actual day of year
        if (snapshot.snapshot_date) {
            // Parse as local date to avoid timezone shifts
            const parts = snapshot.snapshot_date.split('-');
            const d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
            const start = new Date(d.getFullYear(), 0, 0);
            const diff = d - start;
            return Math.floor(diff / 86400000);
        }
        // Fallback: approximate from week number (mid-week)
        return (snapshot.week_number || 1) * 7 - 3;
    }

    // Format a day-of-year as a date string for tooltip
    formatDayOfYear(day) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        // Approximate month and day from day-of-year
        const d = new Date(2026, 0, day); // year doesn't matter for month/day calc
        return `${monthNames[d.getMonth()]} ${d.getDate()}`;
    }

    async init() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.warn(`SubscriptionSalesCurve: Container #${this.containerId} not found`);
            return;
        }

        // Show loading state
        container.innerHTML = '<div class="chart-loading">Loading sales curve...</div>';

        try {
            // Fetch historical data for this series
            this.data = await window.dataService.getSubscriptionHistory(this.series);
            this.render();
        } catch (error) {
            console.error('SubscriptionSalesCurve init error:', error);
            container.innerHTML = `<div class="chart-error">Error loading chart: ${error.message}</div>`;
        }
    }

    render() {
        if (!this.data || !this.data.seasons) {
            return;
        }

        const container = d3.select(`#${this.containerId}`);
        container.html(''); // Clear previous content

        this.margin = this.getResponsiveMargins();

        // Get container dimensions
        const containerElement = container.node();
        const containerRect = containerElement.getBoundingClientRect();

        if (this.isMobile) {
            this.width = Math.max(300, containerRect.width - 16);
            this.height = 280;
        } else if (this.isTablet) {
            this.width = Math.max(500, containerRect.width - 16);
            this.height = 320;
        } else {
            this.width = Math.max(600, containerRect.width - 16);
            this.height = 350;
        }

        const innerWidth = this.width - this.margin.left - this.margin.right;
        const innerHeight = this.height - this.margin.top - this.margin.bottom;

        this.svg = container
            .append('svg')
            .attr('width', this.width)
            .attr('height', this.height);

        const g = this.svg
            .append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

        // Prepare data for plotting
        const seasonData = this.prepareSeasonData();

        if (seasonData.length === 0) {
            container.html('<div class="chart-empty">No historical data available</div>');
            return;
        }

        // Calculate scales - day of year (1-365)
        const maxDay = 365;
        const maxUnits = Math.max(...seasonData.flatMap(s => s.points.map(p => p.total_units)));

        const xScale = d3.scaleLinear()
            .domain([1, maxDay])
            .range([0, innerWidth]);

        const yScale = d3.scaleLinear()
            .domain([0, maxUnits * 1.1])
            .range([innerHeight, 0]);

        // Add grid lines
        this.addGridLines(g, xScale, yScale, innerWidth, innerHeight);

        // Add axes
        this.addAxes(g, xScale, yScale, innerWidth, innerHeight);

        // Draw season lines
        seasonData.forEach(season => {
            this.drawSeasonLine(g, season, xScale, yScale);
        });

        // Add projection line for current season
        this.drawProjectionLine(g, seasonData, xScale, yScale);

        // Add legend
        this.addLegend(g, seasonData, innerWidth);

        // Add tooltip
        this.addTooltip(seasonData);
    }

    prepareSeasonData() {
        const seasons = this.data.seasons;
        const result = [];

        // Sort seasons in order: current first, then by recency
        const seasonOrder = ['26-27', '25-26', '24-25', '23-24'];

        seasonOrder.forEach(seasonKey => {
            const season = seasons[seasonKey];
            if (season && season.snapshots && season.snapshots.length > 0) {
                result.push({
                    season: seasonKey,
                    color: this.seasonColors[seasonKey] || '#666',
                    isCurrent: seasonKey === '26-27',
                    isProjectionBase: seasonKey === '25-26',
                    points: season.snapshots.map(s => ({
                        day: this.toDayOfYear(s),
                        week: s.week_number,
                        total_units: s.total_units,
                        total_revenue: s.total_revenue,
                        new_units: s.new_units,
                        renewal_units: s.renewal_units,
                        snapshot_date: s.snapshot_date
                    })).sort((a, b) => a.day - b.day),
                    final: season.final
                });
            }
        });

        return result;
    }

    addGridLines(g, xScale, yScale, innerWidth, innerHeight) {
        // Vertical grid lines
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

        // Horizontal grid lines
        g.append('g')
            .attr('class', 'grid')
            .call(d3.axisLeft(yScale)
                .tickSize(-innerWidth)
                .tickFormat('')
            )
            .selectAll('line')
            .style('stroke', '#f0f0f0')
            .style('stroke-width', 0.5);
    }

    addAxes(g, xScale, yScale, innerWidth, innerHeight) {
        const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        // Day-of-year for the 1st of each month
        const monthStartDays = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];

        // X-axis with month labels
        const xAxisGenerator = d3.axisBottom(xScale);

        if (this.isMobile) {
            // Show every 3 months on mobile
            const tickValues = [1, 91, 182, 274, 365];
            const tickLabels = ['Jan', 'Apr', 'Jul', 'Oct', 'Dec'];
            xAxisGenerator
                .tickValues(tickValues)
                .tickFormat((d, i) => tickLabels[i] || '');
        } else {
            xAxisGenerator
                .tickValues(monthStartDays)
                .tickFormat((d, i) => monthLabels[i] || '');
        }

        const xAxis = g.append('g')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(xAxisGenerator);

        xAxis.selectAll('text')
            .style('font-size', this.isMobile ? '9px' : '11px')
            .style('fill', '#666');

        xAxis.select('.domain').style('stroke', '#e0e0e0');
        xAxis.selectAll('.tick line').style('stroke', '#e0e0e0');

        // Y-axis
        const yAxis = g.append('g')
            .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => d.toLocaleString()));

        yAxis.selectAll('text')
            .style('font-size', this.isMobile ? '9px' : '11px')
            .style('fill', '#666');

        yAxis.select('.domain').style('stroke', '#e0e0e0');
        yAxis.selectAll('.tick line').style('stroke', '#e0e0e0');

        // Y-axis label
        if (!this.isMobile) {
            g.append('text')
                .attr('transform', 'rotate(-90)')
                .attr('y', 0 - this.margin.left + 15)
                .attr('x', 0 - (innerHeight / 2))
                .attr('dy', '1em')
                .style('text-anchor', 'middle')
                .style('font-size', '12px')
                .style('fill', '#666')
                .text('Subscription Units');
        }
    }

    drawSeasonLine(g, season, xScale, yScale) {
        const line = d3.line()
            .x(d => xScale(d.day))
            .y(d => yScale(d.total_units))
            .curve(d3.curveMonotoneX);

        // Line styling based on season type
        const strokeWidth = season.isCurrent ? 3 : (season.isProjectionBase ? 3 : 2);
        const strokeDasharray = season.isCurrent ? 'none' : (season.isProjectionBase ? 'none' : '5,3');
        const opacity = season.isCurrent ? 1 : (season.isProjectionBase ? 0.9 : 0.6);

        // Draw the line
        g.append('path')
            .datum(season.points)
            .attr('class', `season-line season-${season.season}`)
            .attr('d', line)
            .attr('fill', 'none')
            .attr('stroke', season.color)
            .attr('stroke-width', strokeWidth)
            .attr('stroke-dasharray', strokeDasharray)
            .attr('opacity', opacity)
            .style('filter', `drop-shadow(0 1px 2px ${season.color}40)`);

        // Add data points
        const pointRadius = this.isMobile ? 4 : 3;

        g.selectAll(`.season-point-${season.season}`)
            .data(season.points)
            .enter()
            .append('circle')
            .attr('class', `season-point season-point-${season.season}`)
            .attr('cx', d => xScale(d.day))
            .attr('cy', d => yScale(d.total_units))
            .attr('r', pointRadius)
            .attr('fill', season.color)
            .attr('stroke', 'white')
            .attr('stroke-width', 1.5)
            .attr('opacity', opacity)
            .attr('data-season', season.season)
            .attr('data-day', d => d.day)
            .attr('data-units', d => d.total_units);
    }

    drawProjectionLine(g, seasonData, xScale, yScale) {
        const currentSeason = seasonData.find(s => s.isCurrent);
        const targetSeason = seasonData.find(s => s.isProjectionBase);

        if (!currentSeason || !targetSeason || currentSeason.points.length === 0 || targetSeason.points.length === 0) {
            return;
        }

        // Get last point of current season
        const lastCurrentPoint = currentSeason.points[currentSeason.points.length - 1];
        const currentDay = lastCurrentPoint.day;
        const currentUnits = lastCurrentPoint.total_units;

        // Find target season value at current day (interpolate if needed)
        const targetAtCurrentDay = this.interpolateAtDay(targetSeason.points, currentDay);

        if (targetAtCurrentDay === null) {
            return;
        }

        // Calculate variance
        const variance = currentUnits - targetAtCurrentDay;

        // Generate projection points from current day to day 365, weekly steps
        const projectionPoints = [];
        projectionPoints.push({ day: currentDay, units: currentUnits });

        for (let day = currentDay + 7; day <= 365; day += 7) {
            const targetAtDay = this.interpolateAtDay(targetSeason.points, day);
            if (targetAtDay !== null) {
                const projected = Math.max(currentUnits, targetAtDay + variance);
                projectionPoints.push({ day, units: projected });
            }
        }

        // Add final target if available
        if (targetSeason.final) {
            const projectedFinal = Math.max(currentUnits, targetSeason.final.total_units + variance);
            projectionPoints.push({ day: 365, units: projectedFinal });
        }

        if (projectionPoints.length < 2) {
            return;
        }

        // Draw projection line
        const line = d3.line()
            .x(d => xScale(d.day))
            .y(d => yScale(d.units))
            .curve(d3.curveMonotoneX);

        g.append('path')
            .datum(projectionPoints)
            .attr('class', 'projection-line')
            .attr('d', line)
            .attr('fill', 'none')
            .attr('stroke', '#2ecc71')
            .attr('stroke-width', 2.5)
            .attr('stroke-dasharray', '8,4')
            .attr('opacity', 0.8);

        // Store projection data for tooltip
        this.projectionData = {
            points: projectionPoints,
            variance,
            targetSeason: targetSeason.season
        };
    }

    interpolateAtDay(points, day) {
        // Find exact match
        const exact = points.find(p => p.day === day);
        if (exact) return exact.total_units;

        // Find surrounding points for interpolation
        const before = points.filter(p => p.day < day).pop();
        const after = points.find(p => p.day > day);

        if (!before && !after) return null;
        if (!before) return after.total_units;
        if (!after) return before.total_units;

        // Linear interpolation
        const ratio = (day - before.day) / (after.day - before.day);
        return before.total_units + ratio * (after.total_units - before.total_units);
    }

    addLegend(g, seasonData, innerWidth) {
        if (this.isMobile) {
            // Mobile: horizontal legend below chart
            return;
        }

        const legend = g.append('g')
            .attr('class', 'chart-legend')
            .attr('transform', `translate(${innerWidth + 15}, 0)`);

        const items = seasonData.map(s => ({
            label: s.season + (s.isCurrent ? ' (Current)' : s.isProjectionBase ? ' (Target)' : ''),
            color: s.color,
            dashed: !s.isCurrent && !s.isProjectionBase
        }));

        // Add projection to legend
        items.push({
            label: 'Projected',
            color: '#2ecc71',
            dashed: true
        });

        items.forEach((item, i) => {
            const row = legend.append('g')
                .attr('transform', `translate(0, ${i * 22})`);

            row.append('line')
                .attr('x1', 0)
                .attr('x2', 20)
                .attr('y1', 10)
                .attr('y2', 10)
                .attr('stroke', item.color)
                .attr('stroke-width', 2.5)
                .attr('stroke-dasharray', item.dashed ? '5,3' : 'none');

            row.append('text')
                .attr('x', 25)
                .attr('y', 14)
                .style('font-size', '11px')
                .style('fill', '#666')
                .text(item.label);
        });
    }

    addTooltip(seasonData) {
        const self = this;

        // Create tooltip unique to this chart instance
        const tooltipClass = `subscription-curve-tooltip-${this.series}`;
        d3.select(`.${tooltipClass}`).remove();
        const tooltip = d3.select('body')
            .append('div')
            .attr('class', `subscription-curve-tooltip ${tooltipClass}`)
            .style('position', 'absolute')
            .style('visibility', 'hidden')
            .style('background', 'rgba(0, 0, 0, 0.9)')
            .style('color', 'white')
            .style('padding', '10px')
            .style('border-radius', '8px')
            .style('font-size', '12px')
            .style('z-index', '1001')
            .style('pointer-events', 'none')
            .style('max-width', '250px');

        // Add hover interactions to all season points
        this.svg.selectAll('.season-point')
            .on('mouseover', function(event) {
                const circle = d3.select(this);
                const season = circle.attr('data-season');
                const day = +circle.attr('data-day');
                const units = +circle.attr('data-units');

                circle
                    .transition()
                    .duration(200)
                    .attr('r', self.isMobile ? 6 : 5);

                // Find full data for this point (closest match in case of rounding)
                const seasonObj = seasonData.find(s => s.season === season);
                const point = seasonObj?.points.reduce((closest, p) => {
                    if (!closest) return p;
                    return Math.abs(p.day - day) < Math.abs(closest.day - day) ? p : closest;
                }, null);

                const dateLabel = point?.snapshot_date || self.formatDayOfYear(day);

                let html = `
                    <strong style="color: ${self.seasonColors[season] || '#fff'}">${season} Season</strong><br/>
                    ${dateLabel}<br/>
                    Total Orders: ${units.toLocaleString()}<br/>
                `;

                if (point) {
                    html += `Revenue: $${(point.total_revenue || 0).toLocaleString()}`;
                    if (!seasonObj?.isCurrent && (point.new_units || point.renewal_units)) {
                        html += `<br/>New: ${point.new_units?.toLocaleString() || 0} | Renewal: ${point.renewal_units?.toLocaleString() || 0}`;
                    }
                }

                tooltip.html(html);
                tooltip.style('visibility', 'visible');
            })
            .on('mousemove', function(event) {
                tooltip
                    .style('left', (event.pageX + 15) + 'px')
                    .style('top', (event.pageY - 10) + 'px');
            })
            .on('mouseout', function() {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr('r', self.isMobile ? 4 : 3);

                tooltip.style('visibility', 'hidden');
            });
    }
}

// Export to global window object
if (typeof window !== 'undefined') {
    window.SubscriptionSalesCurve = SubscriptionSalesCurve;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SubscriptionSalesCurve;
}
