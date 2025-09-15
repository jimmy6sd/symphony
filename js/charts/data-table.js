class DataTable {
    constructor() {
        this.container = null;
        this.data = [];
        this.sortColumn = 'date';
        this.sortDirection = 'desc';
        this.filterText = '';
        this.filters = {
            series: 'all',
            venue: 'all',
            season: 'all',
            dateRange: 'all'
        };

        // Define columns and their properties
        this.columns = [
            {
                key: 'title',
                label: 'Performance',
                sortable: true,
                formatter: (value, row) => `
                    <div class="performance-cell">
                        <div class="performance-title">${value}</div>
                        <div class="performance-code">${row.code || ''}</div>
                    </div>
                `
            },
            {
                key: 'date',
                label: 'Date',
                sortable: true,
                formatter: (value) => {
                    const date = new Date(value);
                    return `
                        <div class="date-cell">
                            <div class="date-main">${date.toLocaleDateString()}</div>
                            <div class="date-time">${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                        </div>
                    `;
                }
            },
            {
                key: 'venue',
                label: 'Venue',
                sortable: true,
                formatter: (value) => `<span class="venue-cell">${value}</span>`
            },
            {
                key: 'series',
                label: 'Series',
                sortable: true,
                formatter: (value) => {
                    if (!value || value === 'N/A') return '<span class="series-cell series-other">N/A</span>';

                    // Map series names to CSS classes
                    const seriesClass = value.toLowerCase().includes('classical') ? 'series-classical' :
                                      value.toLowerCase().includes('pops') ? 'series-pops' :
                                      value.toLowerCase().includes('family') ? 'series-family' :
                                      value.toLowerCase().includes('special') ? 'series-special' :
                                      value.toLowerCase().includes('film') ? 'series-film' :
                                      value.toLowerCase().includes('holiday') ? 'series-holiday' :
                                      value.toLowerCase().includes('chamber') ? 'series-chamber' :
                                      value.toLowerCase().includes('guest') ? 'series-guest' :
                                      'series-other';

                    return `<span class="series-cell ${seriesClass}">${value}</span>`;
                }
            },
            {
                key: 'season',
                label: 'Season',
                sortable: true,
                formatter: (value) => `<span class="season-cell">${value || 'N/A'}</span>`
            },
            {
                key: 'capacity',
                label: 'Capacity',
                sortable: true,
                align: 'center',
                formatter: (value) => value ? value.toLocaleString() : 'N/A'
            },
            {
                key: 'totalSold',
                label: 'Tickets Sold',
                sortable: true,
                align: 'center',
                formatter: (value, row) => {
                    const total = (row.singleTicketsSold || 0) + (row.subscriptionTicketsSold || 0);
                    const capacity = row.capacity || 0;
                    const percentage = capacity > 0 ? (total / capacity * 100).toFixed(1) : 0;
                    return `
                        <div class="tickets-cell">
                            <div class="tickets-total">${total.toLocaleString()}</div>
                            <div class="tickets-percentage">${percentage}%</div>
                        </div>
                    `;
                }
            },
            {
                key: 'singleTicketsSold',
                label: 'Single',
                sortable: true,
                align: 'center',
                formatter: (value) => (value || 0).toLocaleString()
            },
            {
                key: 'subscriptionTicketsSold',
                label: 'Subscription',
                sortable: true,
                align: 'center',
                formatter: (value) => (value || 0).toLocaleString()
            },
            {
                key: 'totalRevenue',
                label: 'Revenue',
                sortable: true,
                align: 'right',
                formatter: (value) => {
                    if (!value || value === 0) return '$0';
                    return `$${value.toLocaleString()}`;
                }
            },
            {
                key: 'budgetPerformance',
                label: 'Budget Goal',
                sortable: true,
                align: 'right',
                formatter: (value, row) => {
                    const revenue = row.totalRevenue || 0;
                    const goal = row.budgetGoal || 0;
                    if (goal === 0) return 'No Goal';

                    const percentage = (revenue / goal * 100);
                    const status = percentage >= 100 ? 'good' : percentage >= 80 ? 'warning' : 'poor';

                    return `
                        <div class="budget-cell">
                            <div class="budget-goal">$${goal.toLocaleString()}</div>
                            <div class="budget-performance budget-${status}">${percentage.toFixed(1)}%</div>
                        </div>
                    `;
                }
            },
            {
                key: 'occupancyRate',
                label: 'Occupancy',
                sortable: true,
                align: 'center',
                formatter: (value, row) => {
                    const total = (row.singleTicketsSold || 0) + (row.subscriptionTicketsSold || 0);
                    const capacity = row.capacity || 0;
                    if (capacity === 0) return 'N/A';

                    const rate = (total / capacity * 100);
                    const goal = row.occupancyGoal || 85;
                    const status = rate >= goal ? 'good' : rate >= goal * 0.8 ? 'warning' : 'poor';

                    return `
                        <div class="occupancy-cell">
                            <div class="occupancy-bar">
                                <div class="occupancy-fill occupancy-${status}" style="width: ${Math.min(rate, 100)}%"></div>
                                <div class="occupancy-goal" style="left: ${Math.min(goal, 100)}%"></div>
                            </div>
                            <div class="occupancy-text">${rate.toFixed(1)}%</div>
                        </div>
                    `;
                }
            },
            {
                key: 'status',
                label: 'Status',
                sortable: true,
                align: 'center',
                formatter: (value, row) => {
                    const statusClass = value ? value.toLowerCase().replace(/\s+/g, '-') : 'unknown';
                    return `<span class="status-badge status-${statusClass}">${value || 'Unknown'}</span>`;
                }
            }
        ];
    }

    create(containerId) {
        this.container = d3.select(`#${containerId}`);
        this.render();
        return this;
    }

    async init() {
        // Set up container first
        this.container = d3.select('#data-table');

        // Get performance data using the global data service
        try {
            if (window.dataService) {
                this.data = await window.dataService.getPerformances();
            } else {
                // Fallback - create a temporary data service instance
                const dataService = new window.DataService();
                this.data = await dataService.getPerformances();
            }
        } catch (error) {
            this.data = [];
        }

        // Render the table
        this.render();

        return this;
    }

    updateData(data) {
        this.data = data || [];
        this.render();
        return this;
    }

    render() {
        if (!this.container) return;

        // Clear existing content
        this.container.selectAll('*').remove();

        // Create table structure
        this.createTableHeader();
        this.createFilterBar();
        this.createTable();
    }

    createFilterBar() {
        const filterBar = this.container
            .append('div')
            .attr('class', 'table-filter-bar');

        // Search input
        const searchContainer = filterBar
            .append('div')
            .attr('class', 'search-container');

        searchContainer
            .append('input')
            .attr('type', 'text')
            .attr('placeholder', 'Search performances...')
            .attr('class', 'search-input')
            .on('input', (event) => {
                this.filterText = event.target.value.toLowerCase();
                this.renderTableRows();
            });

        // Filter dropdowns container
        const filtersContainer = filterBar
            .append('div')
            .attr('class', 'filters-container');

        // Series filter
        this.createFilterDropdown(filtersContainer, 'series', 'Series', this.getUniqueValues('series'));

        // Venue filter
        this.createFilterDropdown(filtersContainer, 'venue', 'Venue', this.getUniqueValues('venue'));

        // Season filter
        this.createFilterDropdown(filtersContainer, 'season', 'Season', this.getUniqueValues('season'));

        // Date range filter
        this.createDateRangeFilter(filtersContainer);

        // Clear filters button
        filtersContainer
            .append('button')
            .attr('class', 'clear-filters-btn')
            .text('Clear Filters')
            .on('click', () => this.clearAllFilters());

        // Info display
        filterBar
            .append('div')
            .attr('class', 'table-info')
            .text(`${this.getFilteredData().length} performances`);
    }

    createFilterDropdown(container, filterKey, label, options) {
        const filterGroup = container
            .append('div')
            .attr('class', 'filter-group');

        filterGroup
            .append('label')
            .text(label + ':')
            .attr('class', 'filter-label');

        const select = filterGroup
            .append('select')
            .attr('class', 'filter-select')
            .on('change', (event) => {
                this.filters[filterKey] = event.target.value;
                this.renderTableRows();
            });

        // Add "All" option
        select.append('option')
            .attr('value', 'all')
            .text('All');

        // Add unique options
        options.forEach(option => {
            select.append('option')
                .attr('value', option)
                .text(option);
        });
    }

    createDateRangeFilter(container) {
        const filterGroup = container
            .append('div')
            .attr('class', 'filter-group');

        filterGroup
            .append('label')
            .text('Date Range:')
            .attr('class', 'filter-label');

        const select = filterGroup
            .append('select')
            .attr('class', 'filter-select')
            .on('change', (event) => {
                this.filters.dateRange = event.target.value;
                this.renderTableRows();
            });

        const dateRangeOptions = [
            { value: 'all', label: 'All Dates' },
            { value: 'thisMonth', label: 'This Month' },
            { value: 'next3Months', label: 'Next 3 Months' },
            { value: 'next6Months', label: 'Next 6 Months' },
            { value: 'thisYear', label: 'This Year' },
            { value: 'nextYear', label: 'Next Year' }
        ];

        dateRangeOptions.forEach(option => {
            select.append('option')
                .attr('value', option.value)
                .text(option.label);
        });
    }

    getUniqueValues(key) {
        const values = [...new Set(this.data.map(item => item[key]).filter(Boolean))];
        return values.sort();
    }

    clearAllFilters() {
        this.filters = {
            series: 'all',
            venue: 'all',
            season: 'all',
            dateRange: 'all'
        };
        this.filterText = '';

        // Reset UI elements
        this.container.select('.search-input').property('value', '');
        this.container.selectAll('.filter-select').property('value', 'all');

        this.renderTableRows();
    }

    showPerformanceDetails(performance) {
        // Create modal overlay
        const modalOverlay = d3.select('body')
            .append('div')
            .attr('class', 'modal-overlay')
            .style('position', 'fixed')
            .style('top', '0')
            .style('left', '0')
            .style('width', '100%')
            .style('height', '100%')
            .style('background', 'rgba(0, 0, 0, 0.5)')
            .style('z-index', '1000')
            .style('display', 'flex')
            .style('align-items', 'center')
            .style('justify-content', 'center');

        // Create modal content
        const modal = modalOverlay
            .append('div')
            .attr('class', 'performance-modal')
            .style('background', 'white')
            .style('border-radius', '8px')
            .style('padding', '20px')
            .style('max-width', '90vw')
            .style('max-height', '90vh')
            .style('overflow-y', 'auto')
            .style('box-shadow', '0 4px 20px rgba(0, 0, 0, 0.3)');

        // Modal header
        const header = modal.append('div')
            .attr('class', 'modal-header')
            .style('display', 'flex')
            .style('justify-content', 'space-between')
            .style('align-items', 'center')
            .style('margin-bottom', '20px')
            .style('border-bottom', '1px solid #eee')
            .style('padding-bottom', '15px');

        header.append('h2')
            .style('margin', '0')
            .style('color', '#333')
            .text(performance.title);

        header.append('button')
            .attr('class', 'close-modal')
            .style('background', 'none')
            .style('border', 'none')
            .style('font-size', '24px')
            .style('cursor', 'pointer')
            .style('color', '#999')
            .text('×')
            .on('click', () => modalOverlay.remove());

        // Performance details
        const detailsGrid = modal.append('div')
            .attr('class', 'performance-details')
            .style('display', 'grid')
            .style('grid-template-columns', '1fr 1fr')
            .style('gap', '20px')
            .style('margin-bottom', '30px');

        // Left column
        const leftDetails = detailsGrid.append('div');

        leftDetails.append('h3').text('Performance Information');
        leftDetails.append('p').html(`<strong>Code:</strong> ${performance.code}`);
        leftDetails.append('p').html(`<strong>Date:</strong> ${new Date(performance.date).toLocaleDateString()}`);
        leftDetails.append('p').html(`<strong>Venue:</strong> ${performance.venue}`);
        leftDetails.append('p').html(`<strong>Series:</strong> ${performance.series}`);
        leftDetails.append('p').html(`<strong>Season:</strong> ${performance.season}`);

        // Right column
        const rightDetails = detailsGrid.append('div');

        rightDetails.append('h3').text('Sales Information');
        rightDetails.append('p').html(`<strong>Capacity:</strong> ${performance.capacity?.toLocaleString() || 'N/A'}`);
        rightDetails.append('p').html(`<strong>Total Sold:</strong> ${performance.totalSold?.toLocaleString() || 'N/A'}`);
        rightDetails.append('p').html(`<strong>Single Tickets:</strong> ${performance.singleTicketsSold?.toLocaleString() || 'N/A'}`);
        rightDetails.append('p').html(`<strong>Subscription Tickets:</strong> ${performance.subscriptionTicketsSold?.toLocaleString() || 'N/A'}`);
        rightDetails.append('p').html(`<strong>Occupancy Rate:</strong> ${performance.occupancyRate?.toFixed(1) || 'N/A'}%`);
        rightDetails.append('p').html(`<strong>Total Revenue:</strong> $${performance.totalRevenue?.toLocaleString() || 'N/A'}`);
        rightDetails.append('p').html(`<strong>Status:</strong> ${performance.status || 'Unknown'}`);

        // Sales curve chart section
        if (performance.weeklySales && performance.weeklySales.length > 0) {
            modal.append('h3')
                .style('margin-top', '30px')
                .style('margin-bottom', '15px')
                .text('Sales Progression Over Time');

            const chartContainer = modal.append('div')
                .attr('id', 'modal-sales-chart')
                .style('width', '100%')
                .style('height', '400px');

            this.renderSalesChart(chartContainer, performance);
        }

        // Close modal on overlay click
        modalOverlay.on('click', (event) => {
            if (event.target === modalOverlay.node()) {
                modalOverlay.remove();
            }
        });
    }

    renderSalesChart(container, performance) {
        const margin = { top: 20, right: 180, bottom: 40, left: 60 };
        const width = 800 - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

        const svg = container
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const weeklySales = performance.weeklySales;
        const maxWeeks = Math.max(10, weeklySales.length);
        const maxSales = Math.max(
            d3.max(weeklySales, d => d.actualCumulative),
            d3.max(weeklySales, d => d.expectedCumulative),
            performance.capacity || 0
        );

        // Scales (flip x-axis so week 10 is on left, week 1 on right)
        const xScale = d3.scaleLinear()
            .domain([maxWeeks, 1])
            .range([0, width]);

        const yScale = d3.scaleLinear()
            .domain([0, maxSales])
            .range([height, 0]);

        // Line generators
        const actualLine = d3.line()
            .x(d => xScale(d.week))
            .y(d => yScale(d.actualCumulative))
            .curve(d3.curveMonotoneX);

        const expectedLine = d3.line()
            .x(d => xScale(d.week))
            .y(d => yScale(d.expectedCumulative))
            .curve(d3.curveMonotoneX);

        // Add capacity line
        if (performance.capacity) {
            g.append('line')
                .attr('x1', 0)
                .attr('x2', width)
                .attr('y1', yScale(performance.capacity))
                .attr('y2', yScale(performance.capacity))
                .attr('stroke', '#ccc')
                .attr('stroke-width', 2)
                .attr('stroke-dasharray', '5,5');
        }

        // Add occupancy goal line
        if (performance.occupancyGoal && performance.capacity) {
            const goalTickets = performance.capacity * (performance.occupancyGoal / 100);
            g.append('line')
                .attr('x1', 0)
                .attr('x2', width)
                .attr('y1', yScale(goalTickets))
                .attr('y2', yScale(goalTickets))
                .attr('stroke', '#28a745')
                .attr('stroke-width', 2)
                .attr('stroke-dasharray', '3,3');
        }

        // Add expected sales line
        g.append('path')
            .datum(weeklySales)
            .attr('d', expectedLine)
            .attr('fill', 'none')
            .attr('stroke', '#ffc107')
            .attr('stroke-width', 3)
            .attr('stroke-dasharray', '8,4');

        // Add actual sales line
        g.append('path')
            .datum(weeklySales)
            .attr('d', actualLine)
            .attr('fill', 'none')
            .attr('stroke', '#007bff')
            .attr('stroke-width', 3);

        // Add data points
        g.selectAll('.actual-point')
            .data(weeklySales)
            .enter()
            .append('circle')
            .attr('class', 'actual-point')
            .attr('cx', d => xScale(d.week))
            .attr('cy', d => yScale(d.actualCumulative))
            .attr('r', 4)
            .attr('fill', '#007bff')
            .attr('stroke', 'white')
            .attr('stroke-width', 2);

        // Add axes
        g.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale).tickFormat(d => `${d} weeks before`));

        g.append('g')
            .call(d3.axisLeft(yScale));

        // Add axis labels
        g.append('text')
            .attr('transform', `translate(${width / 2}, ${height + margin.bottom})`)
            .style('text-anchor', 'middle')
            .text('Weeks Before Performance');

        g.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('y', 0 - margin.left)
            .attr('x', 0 - (height / 2))
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .text('Cumulative Tickets Sold');

        // Add legend
        const legend = g.append('g')
            .attr('transform', `translate(${width + 20}, 20)`);

        const legendItems = [
            { label: 'Actual Sales', color: '#007bff', style: 'solid' },
            { label: 'Expected Sales', color: '#ffc107', style: 'dashed' },
            { label: 'Capacity', color: '#ccc', style: 'dashed' },
            { label: 'Goal', color: '#28a745', style: 'dashed' }
        ];

        legendItems.forEach((item, i) => {
            const legendRow = legend.append('g')
                .attr('transform', `translate(0, ${i * 20})`);

            legendRow.append('line')
                .attr('x1', 0)
                .attr('x2', 20)
                .attr('y1', 10)
                .attr('y2', 10)
                .attr('stroke', item.color)
                .attr('stroke-width', 2)
                .attr('stroke-dasharray', item.style === 'dashed' ? '5,3' : 'none');

            legendRow.append('text')
                .attr('x', 25)
                .attr('y', 14)
                .style('font-size', '12px')
                .text(item.label);
        });
    }

    createTableHeader() {
        const header = this.container
            .append('div')
            .attr('class', 'table-header');

        header
            .append('h3')
            .text('2025 Season Performance Details');

        // Add view toggle switch
        const toggleContainer = header.append('div')
            .attr('class', 'view-toggle-container');

        toggleContainer.append('span')
            .attr('class', 'toggle-label')
            .text('View:');

        const toggleSwitch = toggleContainer.append('div')
            .attr('class', 'view-toggle-switch');

        const tableButton = toggleSwitch.append('button')
            .attr('class', 'toggle-option active')
            .attr('data-view', 'data-table')
            .text('Table')
            .on('click', () => this.switchToView('data-table'));

        const overviewButton = toggleSwitch.append('button')
            .attr('class', 'toggle-option')
            .attr('data-view', 'overview')
            .text('Charts')
            .on('click', () => this.switchToView('overview'));

        // Add refresh button
        const refreshButton = header.append('button')
            .attr('class', 'refresh-button')
            .attr('title', 'Refresh Data')
            .on('click', () => this.refreshData());

        refreshButton.append('span')
            .attr('class', 'refresh-icon')
            .text('🔄');

        refreshButton.append('span')
            .attr('class', 'refresh-text')
            .text('Refresh');

    }

    createTable() {
        const tableContainer = this.container
            .append('div')
            .attr('class', 'table-container');

        const table = tableContainer
            .append('table')
            .attr('class', 'data-table');

        // Create header
        const thead = table.append('thead');
        const headerRow = thead.append('tr');

        this.columns.forEach(column => {
            const th = headerRow
                .append('th')
                .attr('class', `header-${column.key}`)
                .style('text-align', column.align || 'left');

            if (column.sortable) {
                th.attr('class', `header-${column.key} sortable`)
                  .on('click', () => this.sortBy(column.key));

                const sortIndicator = this.sortColumn === column.key ?
                    (this.sortDirection === 'asc' ? ' ↑' : ' ↓') : '';

                th.html(`${column.label}${sortIndicator}`);
            } else {
                th.text(column.label);
            }
        });

        // Create body
        this.tbody = table.append('tbody');
        this.renderTableRows();
    }

    renderTableRows() {
        if (!this.tbody) return;

        const filteredData = this.getFilteredData();

        // Update info display
        this.container.select('.table-info')
            .text(`${filteredData.length} performances`);

        // Create rows
        const rows = this.tbody
            .selectAll('tr')
            .data(filteredData);

        rows.exit().remove();

        const newRows = rows.enter()
            .append('tr')
            .attr('class', 'table-row')
            .style('cursor', 'pointer')
            .on('click', (event, d) => {
                this.showPerformanceDetails(d);
            });

        const allRows = newRows.merge(rows);

        // Create cells
        this.columns.forEach(column => {
            const cells = allRows
                .selectAll(`td.cell-${column.key}`)
                .data(d => [d]);

            cells.exit().remove();

            const newCells = cells.enter()
                .append('td')
                .attr('class', `cell-${column.key}`)
                .style('text-align', column.align || 'left');

            newCells.merge(cells)
                .html(d => {
                    const value = this.getCellValue(d, column.key);
                    return column.formatter ? column.formatter(value, d) : value;
                });
        });
    }

    getCellValue(row, key) {
        if (key === 'totalSold') {
            return (row.singleTicketsSold || 0) + (row.subscriptionTicketsSold || 0);
        }
        if (key === 'occupancyRate') {
            const total = (row.singleTicketsSold || 0) + (row.subscriptionTicketsSold || 0);
            const capacity = row.capacity || 0;
            return capacity > 0 ? (total / capacity * 100) : 0;
        }
        return row[key] || '';
    }

    getFilteredData() {
        let filtered = [...this.data];

        // Filter out parking performances
        filtered = filtered.filter(row => {
            const title = (row.title || '').toLowerCase();
            const series = (row.series || '').toLowerCase();
            const season = (row.season || '').toLowerCase();

            return !title.includes('parking') &&
                   !series.includes('parking') &&
                   !season.includes('parking');
        });

        // Apply text filter
        if (this.filterText) {
            filtered = filtered.filter(row => {
                return Object.values(row).some(value =>
                    String(value).toLowerCase().includes(this.filterText)
                );
            });
        }

        // Apply dropdown filters
        if (this.filters.series !== 'all') {
            filtered = filtered.filter(row => row.series === this.filters.series);
        }

        if (this.filters.venue !== 'all') {
            filtered = filtered.filter(row => row.venue === this.filters.venue);
        }

        if (this.filters.season !== 'all') {
            filtered = filtered.filter(row => row.season === this.filters.season);
        }

        // Apply date range filter
        if (this.filters.dateRange !== 'all') {
            const now = new Date();
            filtered = filtered.filter(row => {
                const performanceDate = new Date(row.date);

                switch (this.filters.dateRange) {
                    case 'thisMonth':
                        return performanceDate.getMonth() === now.getMonth() &&
                               performanceDate.getFullYear() === now.getFullYear();
                    case 'next3Months':
                        const threeMonthsFromNow = new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000));
                        return performanceDate >= now && performanceDate <= threeMonthsFromNow;
                    case 'next6Months':
                        const sixMonthsFromNow = new Date(now.getTime() + (180 * 24 * 60 * 60 * 1000));
                        return performanceDate >= now && performanceDate <= sixMonthsFromNow;
                    case 'thisYear':
                        return performanceDate.getFullYear() === now.getFullYear();
                    case 'nextYear':
                        return performanceDate.getFullYear() === now.getFullYear() + 1;
                    default:
                        return true;
                }
            });
        }

        // Apply sorting
        filtered.sort((a, b) => {
            const aVal = this.getCellValue(a, this.sortColumn);
            const bVal = this.getCellValue(b, this.sortColumn);

            let comparison = 0;
            if (aVal < bVal) comparison = -1;
            else if (aVal > bVal) comparison = 1;

            return this.sortDirection === 'asc' ? comparison : -comparison;
        });

        return filtered;
    }

    sortBy(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }

        this.renderTableRows();
        this.updateSortHeaders();
    }

    updateSortHeaders() {
        this.container.selectAll('th.sortable')
            .html((d, i) => {
                const column = this.columns.filter(c => c.sortable)[i];
                if (!column) return '';

                const sortIndicator = this.sortColumn === column.key ?
                    (this.sortDirection === 'asc' ? ' ↑' : ' ↓') : '';

                return `${column.label}${sortIndicator}`;
            });
    }


    switchToView(viewName) {
        // Update toggle button states
        this.container.selectAll('.toggle-option').classed('active', false);
        this.container.select(`[data-view="${viewName}"]`).classed('active', true);

        // Switch view using dashboard UI
        if (window.dashboardUI) {
            window.dashboardUI.switchView(viewName);
        }
    }

    async refreshData() {
        try {
            // Show loading state
            const refreshButton = this.container.select('.refresh-button');
            refreshButton.classed('loading', true);

            // Refresh through dashboard UI
            if (window.dashboardUI) {
                await window.dashboardUI.refreshDashboard();
            }

            // Remove loading state
            refreshButton.classed('loading', false);
        } catch (error) {
            console.error('Failed to refresh data:', error);
            // Remove loading state even on error
            this.container.select('.refresh-button').classed('loading', false);
        }
    }

    // Method to refresh data
    refresh() {
        this.render();
        return this;
    }
}

// CSS styles for the data table
const tableStyles = `
.data-table-container {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    overflow: hidden;
}

.table-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    background: #f8f9fa;
    border-bottom: 1px solid #dee2e6;
    gap: 20px;
    flex-wrap: wrap;
}

.table-header h3 {
    margin: 0;
    color: #495057;
    flex: 1;
}

.view-toggle-container {
    display: flex;
    align-items: center;
    gap: 10px;
}

.toggle-label {
    font-size: 14px;
    color: #6c757d;
    font-weight: 500;
}

.view-toggle-switch {
    display: flex;
    background: #e9ecef;
    border-radius: 6px;
    padding: 3px;
    gap: 2px;
}

.toggle-option {
    padding: 8px 16px;
    border: none;
    background: transparent;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    color: #6c757d;
    transition: all 0.2s ease;
}

.toggle-option:hover {
    color: #495057;
    background: rgba(255, 255, 255, 0.5);
}

.toggle-option.active {
    background: #667eea;
    color: white;
    box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
}

.refresh-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: #28a745;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s ease;
}

.refresh-button:hover {
    background: #218838;
    transform: translateY(-1px);
}

.refresh-button.loading {
    opacity: 0.7;
    pointer-events: none;
}

.refresh-button.loading .refresh-icon {
    animation: spin 1s linear infinite;
}

.refresh-text {
    display: none;
}

@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

@media (min-width: 640px) {
    .refresh-text {
        display: block;
    }
}


.table-filter-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 20px;
    background: white;
    border-bottom: 1px solid #dee2e6;
}

.search-container {
    flex: 1;
    max-width: 300px;
}

.search-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
}

.search-input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
}

.table-info {
    color: #6c757d;
    font-size: 14px;
}

.table-container {
    max-height: 600px;
    overflow-y: auto;
}

.data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
}

.data-table th {
    background: #f8f9fa;
    padding: 12px 8px;
    border-bottom: 2px solid #dee2e6;
    font-weight: 600;
    color: #495057;
    white-space: nowrap;
    position: sticky;
    top: 0;
    z-index: 10;
}

.data-table th.sortable {
    cursor: pointer;
    user-select: none;
}

.data-table th.sortable:hover {
    background: #e9ecef;
}

.data-table td {
    padding: 12px 8px;
    border-bottom: 1px solid #dee2e6;
    vertical-align: middle;
}

.table-row:hover {
    background: #f8f9fa;
    cursor: pointer;
}

.table-row:hover td {
    background: #e7f3ff;
}

.performance-cell {
    min-width: 200px;
}

.performance-title {
    font-weight: 500;
    color: #212529;
}

.performance-code {
    font-size: 12px;
    color: #6c757d;
    margin-top: 2px;
}

.date-cell {
    min-width: 100px;
}

.date-main {
    font-weight: 500;
}

.date-time {
    font-size: 12px;
    color: #6c757d;
}

.venue-cell {
    min-width: 120px;
}

.tickets-cell {
    min-width: 80px;
}

.tickets-total {
    font-weight: 500;
}

.tickets-percentage {
    font-size: 12px;
    color: #6c757d;
}

.occupancy-cell {
    min-width: 100px;
}

.occupancy-bar {
    position: relative;
    height: 6px;
    background: #e9ecef;
    border-radius: 3px;
    margin-bottom: 4px;
}

.occupancy-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s ease;
}

.occupancy-fill.occupancy-good {
    background: #28a745;
}

.occupancy-fill.occupancy-warning {
    background: #ffc107;
}

.occupancy-fill.occupancy-poor {
    background: #dc3545;
}

.occupancy-goal {
    position: absolute;
    top: 0;
    width: 2px;
    height: 100%;
    background: #495057;
}

.occupancy-text {
    text-align: center;
    font-size: 12px;
    font-weight: 500;
}

.status-badge {
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
}

.status-on-sale {
    background: #d4edda;
    color: #155724;
}

.status-sold-out {
    background: #f8d7da;
    color: #721c24;
}

.status-cancelled {
    background: #f8d7da;
    color: #721c24;
}

.status-unknown {
    background: #e2e3e5;
    color: #383d41;
}

/* Modal Styles */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
}

.performance-modal {
    background: white;
    border-radius: 8px;
    padding: 20px;
    max-width: 90vw;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    border-bottom: 1px solid #eee;
    padding-bottom: 15px;
}

.modal-header h2 {
    margin: 0;
    color: #333;
}

.close-modal {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #999;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.close-modal:hover {
    color: #333;
}

.performance-details {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 30px;
}

.performance-details h3 {
    margin-top: 0;
    margin-bottom: 15px;
    color: #495057;
    border-bottom: 1px solid #dee2e6;
    padding-bottom: 8px;
}

.performance-details p {
    margin: 8px 0;
    line-height: 1.4;
}

.performance-details strong {
    color: #495057;
    min-width: 120px;
    display: inline-block;
}

#modal-sales-chart {
    background: #f8f9fa;
    border-radius: 4px;
    padding: 15px;
}

@media (max-width: 768px) {
    .table-container {
        overflow-x: auto;
    }

    .data-table {
        min-width: 800px;
    }

    .performance-modal {
        max-width: 95vw;
        margin: 10px;
    }

    .performance-details {
        grid-template-columns: 1fr;
        gap: 15px;
    }
}
`;

// Inject styles
if (!document.getElementById('data-table-styles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'data-table-styles';
    styleElement.textContent = tableStyles;
    document.head.appendChild(styleElement);
}

// Export to global scope
if (typeof window !== 'undefined') {
    window.DataTable = DataTable;
}

// Global instance
const dataTable = new DataTable();