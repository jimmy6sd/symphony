/**
 * Historical Timeline Chart
 * Displays longitudinal sales progression from daily snapshots
 */

export function renderHistoricalTimelineChart(container, performance, historicalData) {
    console.log('📈 Rendering historical timeline chart with', historicalData.length, 'snapshots');

    // Clear container
    container.html('');

    // Set up dimensions
    const margin = { top: 20, right: 120, bottom: 60, left: 70 };
    const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    // Create SVG
    const svg = container
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Parse dates and prepare data
    const parseDate = d3.timeParse('%Y-%m-%d');
    const data = historicalData.map(d => ({
        date: parseDate(d.snapshot_date),
        tickets: d.total_tickets_sold || 0,
        revenue: d.total_revenue || 0,
        capacity: d.capacity_percent || 0,
        singleTickets: d.single_tickets_sold || 0,
        subscriptionTickets: d.subscription_tickets_sold || 0
    })).sort((a, b) => a.date - b.date);

    // Set up scales
    const xScale = d3.scaleTime()
        .domain(d3.extent(data, d => d.date))
        .range([0, width]);

    const yScaleTickets = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.tickets) * 1.1])
        .range([height, 0]);

    const yScaleRevenue = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.revenue) * 1.1])
        .range([height, 0]);

    // Create axes
    const xAxis = d3.axisBottom(xScale)
        .ticks(Math.min(data.length, 8))
        .tickFormat(d3.timeFormat('%b %d'));

    const yAxisLeft = d3.axisLeft(yScaleTickets)
        .ticks(6)
        .tickFormat(d => d.toLocaleString());

    const yAxisRight = d3.axisRight(yScaleRevenue)
        .ticks(6)
        .tickFormat(d => '$' + (d / 1000).toFixed(0) + 'K');

    // Add axes
    svg.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${height})`)
        .call(xAxis)
        .selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-45)');

    svg.append('g')
        .attr('class', 'y-axis-left')
        .call(yAxisLeft);

    svg.append('g')
        .attr('class', 'y-axis-right')
        .attr('transform', `translate(${width},0)`)
        .call(yAxisRight);

    // Add axis labels
    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -margin.left + 15)
        .attr('x', -height / 2)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('fill', '#2E86AB')
        .text('Tickets Sold');

    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', width + margin.right - 15)
        .attr('x', -height / 2)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('fill', '#A23B72')
        .text('Revenue');

    // Create line generators
    const lineTickets = d3.line()
        .x(d => xScale(d.date))
        .y(d => yScaleTickets(d.tickets))
        .curve(d3.curveMonotoneX);

    const lineRevenue = d3.line()
        .x(d => xScale(d.date))
        .y(d => yScaleRevenue(d.revenue))
        .curve(d3.curveMonotoneX);

    // Add area for tickets
    const areaTickets = d3.area()
        .x(d => xScale(d.date))
        .y0(height)
        .y1(d => yScaleTickets(d.tickets))
        .curve(d3.curveMonotoneX);

    svg.append('path')
        .datum(data)
        .attr('class', 'area-tickets')
        .attr('fill', '#2E86AB')
        .attr('fill-opacity', 0.1)
        .attr('d', areaTickets);

    // Add ticket line
    svg.append('path')
        .datum(data)
        .attr('class', 'line-tickets')
        .attr('fill', 'none')
        .attr('stroke', '#2E86AB')
        .attr('stroke-width', 3)
        .attr('d', lineTickets);

    // Add revenue line
    svg.append('path')
        .datum(data)
        .attr('class', 'line-revenue')
        .attr('fill', 'none')
        .attr('stroke', '#A23B72')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5')
        .attr('d', lineRevenue);

    // Add data points
    svg.selectAll('.dot-tickets')
        .data(data)
        .enter()
        .append('circle')
        .attr('class', 'dot-tickets')
        .attr('cx', d => xScale(d.date))
        .attr('cy', d => yScaleTickets(d.tickets))
        .attr('r', 2)
        .attr('fill', '#2E86AB')
        .attr('stroke', 'white')
        .attr('stroke-width', 1.5)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
            const tooltip = container.append('div')
                .attr('class', 'chart-tooltip')
                .style('position', 'absolute')
                .style('background', 'rgba(0, 0, 0, 0.8)')
                .style('color', 'white')
                .style('padding', '10px')
                .style('border-radius', '4px')
                .style('font-size', '12px')
                .style('pointer-events', 'none')
                .style('z-index', '1000')
                .html(`
                    <strong>${d3.timeFormat('%b %d, %Y')(d.date)}</strong><br/>
                    <span style="color: #2E86AB;">●</span> Tickets: ${d.tickets.toLocaleString()}<br/>
                    <span style="color: #A23B72;">●</span> Revenue: $${d.revenue.toLocaleString()}<br/>
                    <span style="color: #ccc;">●</span> Capacity: ${d.capacity.toFixed(1)}%<br/>
                    <small>Single: ${d.singleTickets} | Subs: ${d.subscriptionTickets}</small>
                `);

            const bbox = container.node().getBoundingClientRect();
            tooltip
                .style('left', (event.pageX - bbox.left + 10) + 'px')
                .style('top', (event.pageY - bbox.top - 10) + 'px');

            d3.select(this)
                .attr('r', 5)
                .attr('fill', '#F18F01');
        })
        .on('mouseout', function() {
            container.selectAll('.chart-tooltip').remove();
            d3.select(this)
                .attr('r', 2)
                .attr('fill', '#2E86AB');
        });

    // Add legend
    const legend = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${width - 100}, 10)`);

    legend.append('line')
        .attr('x1', 0)
        .attr('x2', 20)
        .attr('y1', 0)
        .attr('y2', 0)
        .attr('stroke', '#2E86AB')
        .attr('stroke-width', 3);

    legend.append('text')
        .attr('x', 25)
        .attr('y', 4)
        .style('font-size', '12px')
        .text('Tickets');

    legend.append('line')
        .attr('x1', 0)
        .attr('x2', 20)
        .attr('y1', 20)
        .attr('y2', 20)
        .attr('stroke', '#A23B72')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5');

    legend.append('text')
        .attr('x', 25)
        .attr('y', 24)
        .style('font-size', '12px')
        .text('Revenue');

    // Add summary stats below chart
    const stats = container.append('div')
        .style('margin-top', '20px')
        .style('padding', '15px')
        .style('background', '#f8f9fa')
        .style('border-radius', '4px')
        .style('display', 'grid')
        .style('grid-template-columns', 'repeat(auto-fit, minmax(200px, 1fr))')
        .style('gap', '15px');

    const firstSnapshot = data[0];
    const lastSnapshot = data[data.length - 1];
    const ticketGrowth = lastSnapshot.tickets - firstSnapshot.tickets;
    const revenueGrowth = lastSnapshot.revenue - firstSnapshot.revenue;
    const days = Math.round((lastSnapshot.date - firstSnapshot.date) / (1000 * 60 * 60 * 24));
    const ticketsPerDay = days > 0 ? (ticketGrowth / days).toFixed(1) : 0;

    stats.append('div')
        .html(`<strong>Total Growth</strong><br/>${ticketGrowth > 0 ? '+' : ''}${ticketGrowth} tickets<br/>${revenueGrowth > 0 ? '+' : ''}$${Math.round(revenueGrowth).toLocaleString()}`);

    stats.append('div')
        .html(`<strong>Tracking Period</strong><br/>${days} days<br/>${data.length} snapshots`);

    stats.append('div')
        .html(`<strong>Sales Velocity</strong><br/>${ticketsPerDay} tickets/day<br/>$${Math.round(revenueGrowth / days).toLocaleString()}/day`);

    stats.append('div')
        .html(`<strong>Current Status</strong><br/>${lastSnapshot.tickets.toLocaleString()} tickets<br/>${lastSnapshot.capacity.toFixed(1)}% capacity`);

    console.log('✅ Historical timeline chart rendered');
}
