// src/dashboard.js

// --- Data Loading ---
async function loadBigQueryData() {
    const endpoint = '/.netlify/functions/bigquery-data?action=get-performances';
    try {
        const response = await fetch(endpoint);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Could not load BigQuery data:", error);
        const loadingContainer = document.querySelector('.loading-container');
        loadingContainer.innerHTML = '<p style="color: red;">Error loading data from BigQuery. Please check the console for details.</p>';
        return null;
    }
}

// --- UI Control ---
function showDashboard() {
    document.querySelector('.loading-container').style.display = 'none';
    document.querySelector('.dashboard-grid').style.display = 'grid';
}

// --- KPI Scorecards ---
function renderKpiScorecards(performances) {
    const container = d3.select('#kpi-scorecards');
    if (!performances || performances.length === 0) {
        container.html('<p>Could not load KPI data.</p>');
        return;
    }

    // 1. Calculate KPIs
    const totalRevenue = d3.sum(performances, d => d.total_revenue);
    const totalTicketsSold = d3.sum(performances, d => d.total_tickets_sold);
    const totalCapacity = d3.sum(performances, d => d.capacity);
    const avgCapacityPercent = totalCapacity > 0 ? (d3.sum(performances, d => d.total_tickets_sold) / totalCapacity) * 100 : 0;
    const totalPerformances = performances.length;

    const kpiData = [
        { label: 'Total Revenue', value: totalRevenue, format: 'currency' },
        { label: 'Total Tickets Sold', value: totalTicketsSold, format: 'number' },
        { label: 'Avg. Capacity', value: avgCapacityPercent, format: 'percent' },
        { label: 'Total Performances', value: totalPerformances, format: 'number' }
    ];

    // 2. Format numbers
    const formatCurrency = d3.format('$,.0f');
    const formatNumber = d3.format(',.0f');
    const formatPercent = d3.format('.1f')

    // 3. Render Scorecards
    container.selectAll('.scorecard')
        .data(kpiData)
        .join('div')
        .attr('class', 'scorecard')
        .html(d => `
            <p class="value">
                ${d.format === 'currency' ? formatCurrency(d.value) : ''}
                ${d.format === 'number' ? formatNumber(d.value) : ''}
                ${d.format === 'percent' ? `${formatPercent(d.value)}%` : ''}
            </p>
            <p class="label">${d.label}</p>
        `);
}

// --- Revenue Analysis Charts ---
function renderRevenueCharts(performances) {
    if (!performances) {
        d3.select('#revenue-by-type-chart').html('<p>Could not load revenue chart data.</p>');
        d3.select('#top-10-revenue-chart').html('<p>Could not load revenue chart data.</p>');
        return;
    }

    // 1. Data Aggregation for Revenue by Type
    const revenueByType = d3.rollup(
        performances,
        v => d3.sum(v, d => d.total_revenue),
        d => d.season || 'Uncategorized'
    );
    const revenueByTypeData = Array.from(revenueByType, ([key, value]) => ({ type: key.replace('25-26 ', ''), value })).sort((a,b) => b.value - a.value);

    // 2. Data for Top 10 Productions
    const revenueByProduction = d3.rollup(
        performances,
        v => d3.sum(v, d => d.total_revenue),
        d => d.title
    );
    const top10ProductionsData = Array.from(revenueByProduction, ([key, value]) => ({ title: key, total_revenue: value }))
        .sort((a, b) => b.total_revenue - a.total_revenue)
        .slice(0, 10);


    // 3. Render charts
    createBarChart('#revenue-by-type-chart', revenueByTypeData, 'type', 'value', 'Revenue by Type', d3.format('$,.0s'));
    createHorizontalBarChart('#top-10-revenue-chart', top10ProductionsData, 'title', 'total_revenue', 'Top 10 Productions by Revenue', d3.format('$,.0s'));
}

function createBarChart(selector, data, xField, yField, title, tickFormat) {
    const container = d3.select(selector);
    container.html(''); // Clear existing content
    const svg = container.append('svg');
    const margin = { top: 20, right: 20, bottom: 100, left: 60 };
    const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const g = svg.attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand().rangeRound([0, width]).padding(0.1);
    const y = d3.scaleLinear().rangeRound([height, 0]);

    x.domain(data.map(d => d[xField]));
    y.domain([0, d3.max(data, d => d[yField])]);

    // X axis
    g.append('g')
        .attr('class', 'axis axis--x')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end');

    // Y axis
    g.append('g')
        .attr('class', 'axis axis--y')
        .call(d3.axisLeft(y).ticks(5).tickFormat(tickFormat));
        
    // Tooltip
    const tooltip = d3.select('body').append('div').attr('class', 'tooltip');

    // Bars
    g.selectAll('.bar')
        .data(data)
        .enter().append('rect')
        .attr('class', 'bar')
        .attr('x', d => x(d[xField]))
        .attr('y', d => y(d[yField]))
        .attr('width', x.bandwidth())
        .attr('height', d => height - y(d[yField]))
        .on('mouseover', (event, d) => {
            tooltip.transition().duration(200).style('opacity', .9);
            tooltip.html(`<strong>${d[xField]}</strong><br/>Revenue: ${d3.format('$,.0f')(d[yField])}`)
                .style('left', (event.pageX + 5) + 'px')
                .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', () => {
            tooltip.transition().duration(500).style('opacity', 0);
        });
}

function createHorizontalBarChart(selector, data, yField, xField, title, tickFormat) {
    const container = d3.select(selector);
    container.html(''); // Clear existing content
    const svg = container.append('svg');
    const margin = { top: 20, right: 20, bottom: 30, left: 250 }; // Increased left margin
    const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const g = svg.attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const y = d3.scaleBand().rangeRound([0, height]).padding(0.1);
    const x = d3.scaleLinear().rangeRound([0, width]);

    y.domain(data.map(d => d[yField]));
    x.domain([0, d3.max(data, d => d[xField])]);

    // Y axis
    g.append('g')
        .attr('class', 'axis axis--y')
        .call(d3.axisLeft(y));

    // X axis
    g.append('g')
        .attr('class', 'axis axis--x')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(4).tickFormat(tickFormat)); // Reduced number of ticks

    // Tooltip
    const tooltip = d3.select('body').append('div').attr('class', 'tooltip');
        
    // Bars
    g.selectAll('.bar')
        .data(data)
        .enter().append('rect')
        .attr('class', 'bar')
        .attr('y', d => y(d[yField]))
        .attr('x', 0)
        .attr('height', y.bandwidth())
        .attr('width', d => x(d[xField]))
        .on('mouseover', (event, d) => {
            tooltip.transition().duration(200).style('opacity', .9);
            tooltip.html(`<strong>${d[yField]}</strong><br/>Revenue: ${d3.format('$,.0f')(d[xField])}`)
                .style('left', (event.pageX + 5) + 'px')
                .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', () => {
            tooltip.transition().duration(500).style('opacity', 0);
        });
}

// --- Sales & Capacity Analysis Charts ---
function renderSalesAndCapacityCharts(performances) {
    if (!performances) {
        d3.select('#tickets-vs-capacity-chart').html('<p>Could not load sales and capacity chart data.</p>');
        return;
    }
    
    // Data: Top 15 performances by capacity %
    const capacityData = performances
        .map(p => ({...p, capacity_percent_val: p.capacity && p.capacity > 0 ? (p.total_tickets_sold / p.capacity) * 100 : 0}))
        .sort((a, b) => b.capacity_percent_val - a.capacity_percent_val)
        .slice(0, 15);

    createGroupedBarChart('#tickets-vs-capacity-chart', capacityData);

    // Data for scatter plot
    const budgetData = performances.filter(p => p.budget_goal > 0 && p.total_revenue > 0);
    createScatterPlot('#revenue-vs-budget-chart', budgetData);
}

function createGroupedBarChart(selector, data) {
    const container = d3.select(selector);
    container.html('');
    const svg = container.append('svg');
    const margin = { top: 20, right: 20, bottom: 160, left: 60 }; // Increased bottom margin
    const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const g = svg.attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const x0 = d3.scaleBand().rangeRound([0, width]).paddingInner(0.1);
    const x1 = d3.scaleBand().padding(0.05);
    const y = d3.scaleLinear().rangeRound([height, 0]);

    const keys = ['total_tickets_sold', 'capacity'];
    x0.domain(data.map(d => d.title));
    x1.domain(keys).rangeRound([0, x0.bandwidth()]);
    y.domain([0, d3.max(data, d => d.capacity)]).nice();

    // Axes
    g.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x0))
        .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end');

    g.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(y).ticks(5, 's'));

    // Tooltip
    const tooltip = d3.select('body').append('div').attr('class', 'tooltip');

    // Bars
    g.append('g')
        .selectAll('g')
        .data(data)
        .enter().append('g')
        .attr('transform', d => `translate(${x0(d.title)},0)`)
        .selectAll('rect')
        .data(d => keys.map(key => ({ key, value: d[key], title: d.title })))
        .enter().append('rect')
        .attr('x', d => x1(d.key))
        .attr('y', d => y(d.value))
        .attr('width', x1.bandwidth())
        .attr('height', d => height - y(d.value))
        .attr('fill', d => (d.key === 'capacity' ? '#aed6f1' : '#3498db'))
        .on('mouseover', (event, d) => {
            tooltip.transition().duration(200).style('opacity', .9);
            tooltip.html(`<strong>${d.title}</strong><br/>${d.key.replace(/_/g, ' ')}: ${d3.format(',.0f')(d.value)}`)
                .style('left', (event.pageX + 5) + 'px')
                .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', () => {
            tooltip.transition().duration(500).style('opacity', 0);
        });
}

function createScatterPlot(selector, data) {
    const container = d3.select(selector);
    container.html('');
    const svg = container.append('svg');
    const margin = { top: 20, right: 20, bottom: 60, left: 70 };
    const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const g = svg.attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().range([0, width]);
    const y = d3.scaleLinear().range([height, 0]);

    const maxDomain = d3.max(data, d => Math.max(d.budget_goal, d.total_revenue));
    x.domain([0, maxDomain]).nice();
    y.domain([0, maxDomain]).nice();

    // Axes
    g.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(5, 's'))
        .append('text')
        .attr('x', width)
        .attr('y', -6)
        .attr('fill', '#000')
        .attr('text-anchor', 'end')
        .text('Budget Goal');

    g.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(y).ticks(5, 's'))
        .append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 6)
        .attr('dy', '0.71em')
        .attr('fill', '#000')
        .attr('text-anchor', 'end')
        .text('Total Revenue');

    // Break-even line
    g.append('line')
        .attr('x1', x(0))
        .attr('y1', y(0))
        .attr('x2', x(maxDomain))
        .attr('y2', y(maxDomain))
        .attr('stroke', 'red')
        .attr('stroke-dasharray', '4');

    // Tooltip
    const tooltip = d3.select('body').append('div').attr('class', 'tooltip');

    // Points
    g.selectAll('.dot')
        .data(data)
        .enter().append('circle')
        .attr('class', 'dot')
        .attr('r', 5)
        .attr('cx', d => x(d.budget_goal))
        .attr('cy', d => y(d.total_revenue))
        .attr('fill', d => (d.total_revenue >= d.budget_goal ? 'green' : 'orange'))
        .style('opacity', 0.7)
        .on('mouseover', (event, d) => {
            tooltip.transition().duration(200).style('opacity', .9);
            tooltip.html(`<strong>${d.title}</strong><br/>Budget: ${d3.format('$,.0f')(d.budget_goal)}<br/>Revenue: ${d3.format('$,.0f')(d.total_revenue)}`)
                .style('left', (event.pageX + 5) + 'px')
                .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', () => {
            tooltip.transition().duration(500).style('opacity', 0);
        });
}


// --- Calendar Heatmap ---
function renderCalendarHeatmap(performances) {
    if (!performances) {
        d3.select('#calendar-heatmap-container').html('<p>Could not load calendar data.</p>');
        return;
    }

    // Filter out invalid dates first
    const validPerformances = performances.filter(p => p.date && !isNaN(new Date(p.date)));

    if (validPerformances.length === 0) {
        d3.select('#calendar-heatmap-container').html('<p>No performance data with valid dates to display.</p>');
        return;
    }

    // Aggregate data: sum of revenue per day
    const dataByDate = d3.rollup(validPerformances, 
        v => d3.sum(v, d => d.total_revenue), 
        d => d.date
    );
    
    const years = d3.group(Array.from(dataByDate.keys()), d => new Date(d).getFullYear());

    const container = d3.select('#calendar-heatmap-container');
    container.html(''); // Clear before drawing

    for (const year of Array.from(years.keys()).sort()) {
        if (!isNaN(year)) { // Ensure year is a valid number
            createCalendarHeatmap(container, year, dataByDate);
        }
    }
}

function createCalendarHeatmap(container, year, dataByDate) {
    const cellSize = 17;
    const width = 960;
    const height = cellSize * 7 + 30; // +30 for month labels

    const svg = container.append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('max-width', '100%')
        .append('g')
        .attr('transform', 'translate(30, 20)');

    svg.append('text')
        .attr('x', -5)
        .attr('y', -5)
        .attr('font-weight', 'bold')
        .attr('text-anchor', 'end')
        .text(year);

    const timeWeek = d3.timeWeek;
    const timeFormat = d3.utcFormat('%Y-%m-%d');
    const countDay = d => (d.getUTCDay() + 6) % 7;
    
    const dates = d3.timeDays(new Date(year, 0, 1), new Date(year + 1, 0, 1));

    const maxRevenue = d3.max(Array.from(dataByDate.values()));
    const color = d3.scaleSequential(d3.interpolateGreens).domain([0, maxRevenue]);

    svg.append('g')
        .selectAll('rect')
        .data(dates)
        .join('rect')
        .attr('width', cellSize - 1.5)
        .attr('height', cellSize - 1.5)
        .attr('x', d => timeWeek.count(d3.utcYear(d), d) * cellSize)
        .attr('y', d => countDay(d) * cellSize)
        .attr('fill', d => {
            const dateStr = timeFormat(d);
            return dataByDate.has(dateStr) ? color(dataByDate.get(dateStr)) : '#eee';
        })
        .append('title')
        .text(d => {
            const dateStr = timeFormat(d);
            const revenue = dataByDate.get(dateStr);
            return `${d3.timeFormat('%A, %B %d, %Y')(d)}\nRevenue: ${revenue ? d3.format('$,.0f')(revenue) : '$0'}`;
        });
        
    // Month labels
    svg.append("g")
      .selectAll("text")
      .data(d3.range(12).map(i => new Date(year, i, 1)))
      .join("text")
        .attr("x", d => timeWeek.count(d3.utcYear(d), d) * cellSize)
        .attr("y", -5)
        .text(d3.timeFormat("%b"));
}

// --- Full Data Table ---
function renderFullDataTable(performances) {
    const container = d3.select('#full-data-table');
    if (!performances) {
        container.html('<p>Could not load table data.</p>');
        return;
    }

    let sortState = { column: 'performance_date', ascending: true };
    let tableData = [...performances];

    // Add search input
    container.html(''); // Clear placeholder
    const searchInput = container.append('input')
        .attr('type', 'text')
        .attr('id', 'table-search')
        .attr('placeholder', 'Search performances...');

    const table = container.append('table');
    const thead = table.append('thead');
    const tbody = table.append('tbody');

    const columns = [
        { key: 'title', label: 'Title' },
        { key: 'performance_date', label: 'Date', format: d => new Date(d).toLocaleDateString() },
        { key: 'series', label: 'Series' },
        { key: 'total_revenue', label: 'Revenue', format: d3.format('$,.0f') },
        { key: 'total_tickets_sold', label: 'Tickets Sold', format: d3.format(',.0f') },
        { key: 'capacity_percent', label: 'Capacity %', format: d => `${d3.format('.1f')(d)}%` }
    ];

    // Render table head
    thead.append('tr')
        .selectAll('th')
        .data(columns)
        .join('th')
        .text(d => d.label)
        .on('click', (event, d) => {
            if (sortState.column === d.key) {
                sortState.ascending = !sortState.ascending;
            } else {
                sortState.column = d.key;
                sortState.ascending = true;
            }
            renderTableBody();
        });

    function renderTableBody() {
        // Sort data
        tableData.sort((a, b) => {
            const valA = a[sortState.column];
            const valB = b[sortState.column];
            if (valA < valB) return sortState.ascending ? -1 : 1;
            if (valA > valB) return sortState.ascending ? 1 : -1;
            return 0;
        });

        // Filter data
        const searchTerm = searchInput.node().value.toLowerCase();
        const filteredData = searchTerm ? tableData.filter(d => {
            return d.title.toLowerCase().includes(searchTerm) || 
                   (d.series && d.series.toLowerCase().includes(searchTerm));
        }) : tableData;
        
        // Render rows
        tbody.selectAll('tr')
            .data(filteredData, d => d.performance_id)
            .join('tr')
            .selectAll('td')
            .data(d => columns.map(col => ({ column: col, value: d[col.key] })))
            .join('td')
            .text(d => d.column.format ? d.column.format(d.value) : d.value);
    }

    searchInput.on('keyup', renderTableBody);

    renderTableBody();
}


// --- Main Initialization ---
async function initDashboard() {
    const performances = await loadBigQueryData();

    if (performances) {
        showDashboard();
        renderKpiScorecards(performances);
        renderRevenueCharts(performances);
        renderSalesAndCapacityCharts(performances);
        renderCalendarHeatmap(performances);
        renderFullDataTable(performances);
    }
}

// Initialize the dashboard once the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initDashboard);
