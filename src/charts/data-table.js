class DataTable {
    constructor() {
        this.container = null;
        this.data = [];
        this.sortColumn = 'date';
        this.sortDirection = 'asc';
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
                    // Parse date without timezone shift (value is YYYY-MM-DD)
                    const [year, month, day] = value.split('-');
                    const date = new Date(year, month - 1, day);
                    return `<div class="date-cell">${date.toLocaleDateString()}</div>`;
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

                    // Map series codes and names to CSS classes
                    const lowerValue = value.toLowerCase();
                    const seriesClass =
                        lowerValue.startsWith('cs') || lowerValue.includes('classical') ? 'series-classical' :
                        lowerValue.startsWith('ps') || lowerValue.includes('pops') ? 'series-pops' :
                        lowerValue.startsWith('fs') || lowerValue.includes('family') ? 'series-family' :
                        lowerValue.includes('special') || lowerValue.includes('morgan freeman') ? 'series-special' :
                        lowerValue.includes('christmas') || lowerValue.includes('messiah') || lowerValue.includes('holiday') ? 'series-holiday' :
                        lowerValue.includes('chamber') || lowerValue.includes('quartet') || lowerValue.includes('trio') ? 'series-chamber' :
                        lowerValue.includes('concert') || lowerValue.includes('top gun') || lowerValue.includes('harry potter') || lowerValue.includes('indiana jones') ? 'series-film' :
                        lowerValue.includes('education') || lowerValue.includes('student') ? 'series-education' :
                        lowerValue.includes('on stage') || lowerValue.includes('happy hour') ? 'series-outreach' :
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
                key: 'salesTarget',
                label: 'Status',
                sortable: true,
                align: 'center',
                formatter: (value, row) => {
                    const currentSales = (row.singleTicketsSold || 0) + (row.subscriptionTicketsSold || 0);
                    const capacity = row.capacity || 2000;
                    const occupancyGoal = row.occupancyGoal || 85; // Use actual occupancy goal from data
                    const targetSales = Math.floor(capacity * (occupancyGoal / 100));

                    // Calculate weeks to performance (like in sales curve chart)
                    const today = new Date();
                    const performanceDate = new Date(row.date);
                    const weeksToPerformance = Math.max(0, Math.ceil((performanceDate - today) / (7 * 24 * 60 * 60 * 1000)));

                    // Get expected sales at current week using same progression as chart
                    const expectedAtCurrentWeek = this.getExpectedSalesAtWeek(targetSales, weeksToPerformance);
                    const isOnTarget = currentSales >= expectedAtCurrentWeek;

                    const statusClass = isOnTarget ? 'on-target' : 'below-target';
                    const statusText = isOnTarget ? 'On Target' : 'Below Target';

                    return `<span class="status-badge status-${statusClass}">${statusText}</span>`;
                }
            }
        ];
    }

    getExpectedSalesAtWeek(targetSales, weeksToPerformance) {
        // Use the same historic progression as the sales curve chart
        const progression = [
            { week: 0, percentage: 100 },
            { week: 1, percentage: 59 },
            { week: 2, percentage: 46 },
            { week: 3, percentage: 39 },
            { week: 4, percentage: 33 },
            { week: 5, percentage: 30 },
            { week: 6, percentage: 27 }
        ];

        // Find the progression percentage for the current week
        const weekData = progression.find(p => p.week === weeksToPerformance);
        const percentage = weekData ? weekData.percentage : 27; // Default to week 6+ percentage

        return Math.floor(targetSales * (percentage / 100));
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
            { value: 'thisWeekAndBeyond', label: 'This Week & Beyond' },
            { value: 'thisMonth', label: 'This Month' },
            { value: 'next3Months', label: 'Next 3 Months' },
            { value: 'next6Months', label: 'Next 6 Months' },
            { value: 'thisYear', label: 'This Year' },
            { value: 'nextYear', label: 'Next Year' }
        ];

        dateRangeOptions.forEach(option => {
            const optionElement = select.append('option')
                .attr('value', option.value)
                .text(option.label);

            // Set default selection to match this.filters.dateRange
            if (option.value === this.filters.dateRange) {
                optionElement.attr('selected', true);
            }
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
            .style('max-width', '90vw')
            .style('max-height', '90vh')
            .style('overflow-y', 'auto')
            .style('overflow-x', 'hidden')
            .style('padding', '25px')
            .style('box-shadow', '0 4px 20px rgba(0, 0, 0, 0.3)');

        // Modal header
        const header = modal.append('div')
            .attr('class', 'modal-header')
            .style('display', 'flex')
            .style('justify-content', 'space-between')
            .style('align-items', 'center')
            .style('margin', '-25px -25px 20px -25px')
            .style('padding', '20px 25px')
            .style('background', '#2c3e50')
            .style('border-radius', '8px 8px 0 0');

        header.append('h2')
            .style('margin', '0')
            .style('color', 'white')
            .text(performance.title);

        header.append('button')
            .attr('class', 'close-modal')
            .style('background', 'none')
            .style('border', 'none')
            .style('font-size', '28px')
            .style('cursor', 'pointer')
            .style('color', 'white')
            .style('line-height', '1')
            .text('×')
            .on('click', () => modalOverlay.remove());

        // Sales curve chart section - now the main content
        modal.append('h3')
            .style('margin-bottom', '15px')
            .style('font-size', '1.1em')
            .style('color', '#333')
            .text('Sales Progression Analysis');

        const chartContainer = modal.append('div')
            .attr('id', 'modal-sales-chart')
            .style('width', '100%')
            .style('height', '450px')
            .style('margin-bottom', '25px');

        this.renderSalesChart(chartContainer, performance);

        // Performance details - now below the chart
        const detailsGrid = modal.append('div')
            .attr('class', 'performance-details')
            .style('display', 'grid')
            .style('grid-template-columns', '1fr 1fr')
            .style('gap', '30px')
            .style('margin-top', '30px')
            .style('padding', '20px')
            .style('background', '#f8f9fa')
            .style('border-radius', '8px');

        // Left column
        const leftDetails = detailsGrid.append('div');

        leftDetails.append('h3')
            .style('font-size', '1.1em')
            .style('margin-bottom', '15px')
            .style('color', '#2c3e50')
            .style('border-bottom', '2px solid #3498db')
            .style('padding-bottom', '8px')
            .text('Performance Information');

        // Parse date without timezone shift
        const [year, month, day] = performance.date.split('-');
        const perfDate = new Date(year, month - 1, day);

        const leftInfoItems = [
            { label: 'Code', value: performance.code || performance.id || 'N/A' },
            { label: 'Date', value: perfDate.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) },
            { label: 'Venue', value: performance.venue },
            { label: 'Series', value: performance.series },
            { label: 'Season', value: performance.season }
        ];

        leftInfoItems.forEach(item => {
            const row = leftDetails.append('div')
                .style('display', 'flex')
                .style('justify-content', 'space-between')
                .style('padding', '8px 0')
                .style('border-bottom', '1px solid #dee2e6');

            row.append('span')
                .style('font-weight', '600')
                .style('color', '#495057')
                .text(item.label + ':');

            row.append('span')
                .style('color', '#212529')
                .text(item.value);
        });

        // Right column - Calculate derived values
        const rightDetails = detailsGrid.append('div');

        const totalSold = (performance.singleTicketsSold || 0) + (performance.subscriptionTicketsSold || 0);
        const occupancyRate = performance.capacity ? (totalSold / performance.capacity * 100) : 0;

        // Determine status based on sales progress
        const today = new Date();
        const performanceDate = new Date(year, month - 1, day);
        const weeksToPerformance = Math.ceil((performanceDate - today) / (7 * 24 * 60 * 60 * 1000));
        let status = 'On Sale';
        let statusColor = '#28a745';
        if (performanceDate < today) {
            status = 'Past Event';
            statusColor = '#6c757d';
        } else if (weeksToPerformance <= 1) {
            status = 'Final Week';
            statusColor = '#ffc107';
        } else if (totalSold === 0) {
            status = 'Not Yet On Sale';
            statusColor = '#dc3545';
        }

        rightDetails.append('h3')
            .style('font-size', '1.1em')
            .style('margin-bottom', '15px')
            .style('color', '#2c3e50')
            .style('border-bottom', '2px solid #27ae60')
            .style('padding-bottom', '8px')
            .text('Sales Information');

        // Calculate single ticket targets
        const subscriptionSeats = performance.subscriptionTicketsSold || 0;
        const availableSingleTickets = performance.capacity - subscriptionSeats;
        const singleTicketTarget = Math.floor(availableSingleTickets * (performance.occupancyGoal || 85) / 100);
        const singleTicketsSold = performance.singleTicketsSold || 0;
        const singleTicketProgress = availableSingleTickets > 0 ? (singleTicketsSold / singleTicketTarget * 100) : 0;

        const rightInfoItems = [
            { label: 'Total Capacity', value: (performance.capacity?.toLocaleString() || 'N/A') },
            { label: 'Subscription Sold', value: subscriptionSeats.toLocaleString() },
            { label: 'Available for Single Sale', value: availableSingleTickets.toLocaleString(), isBold: true, spacing: 'bottom' },
            { label: 'Single Tickets Sold', value: singleTicketsSold.toLocaleString() },
            { label: 'Single Ticket Target (85%)', value: singleTicketTarget.toLocaleString() },
            { label: 'Single Sales Progress', value: singleTicketProgress.toFixed(1) + '%',
              color: singleTicketProgress >= 85 ? '#27ae60' : singleTicketProgress >= 60 ? '#f39c12' : '#e74c3c', spacing: 'bottom' },
            { label: 'Total Sold', value: totalSold.toLocaleString() },
            { label: 'Total Occupancy', value: occupancyRate.toFixed(1) + '%' },
            { label: 'Total Revenue', value: '$' + (performance.totalRevenue || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}), spacing: 'bottom' },
            { label: 'Status', value: status, color: statusColor }
        ];

        rightInfoItems.forEach(item => {
            const row = rightDetails.append('div')
                .style('display', 'flex')
                .style('justify-content', 'space-between')
                .style('padding', '8px 0')
                .style('margin-bottom', item.spacing === 'bottom' ? '12px' : '0')
                .style('border-bottom', '1px solid #dee2e6');

            row.append('span')
                .style('font-weight', item.isBold ? '700' : '600')
                .style('color', '#495057')
                .text(item.label + ':');

            row.append('span')
                .style('color', item.color || '#212529')
                .style('font-weight', item.color || item.isBold ? '600' : 'normal')
                .text(item.value);
        });

        // Close modal on overlay click
        modalOverlay.on('click', (event) => {
            if (event.target === modalOverlay.node()) {
                modalOverlay.remove();
            }
        });
    }

    renderSalesChart(container, performance) {
        // Use the proper SalesCurveChart class instead of duplicating code
        const chartId = 'modal-sales-chart-inner';
        container.attr('id', chartId);

        // Create a sales curve chart instance without the selector
        const salesChart = new SalesCurveChart(chartId, { showSelector: false });

        // Set up the performance data for the chart
        const chartData = [performance];
        salesChart.data = chartData;
        salesChart.selectedPerformance = performance.id;

        // Render the chart
        salesChart.render();

    }

    createTableHeader() {
        const header = this.container
            .append('div')
            .attr('class', 'table-header');

        header
            .append('h3')
            .text('2025 Season Performance Details');
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

        // Render sparklines after DOM elements are created (currently disabled)
        // setTimeout(() => {
        //     this.renderSparklines(filteredData);
        // }, 10);
    }

    renderSparklines(data) {
        data.forEach(performance => {
            const containerId = `sparkline-${performance.id}`;
            const container = d3.select(`#${containerId}`);

            if (container.empty()) return;

            // Clear any existing content
            container.selectAll('*').remove();

            // Generate simple sales progression data (similar to sales curve chart)
            const salesData = this.generateSparklineData(performance);

            if (!salesData || salesData.length === 0) {
                container.append('div')
                    .style('font-size', '10px')
                    .style('color', '#999')
                    .style('text-align', 'center')
                    .text('No data');
                return;
            }

            this.drawSparkline(container, salesData);
        });
    }

    generateSparklineData(performance) {
        // Create a simplified version of the sales progression
        const currentSales = (performance.singleTicketsSold || 0) + (performance.subscriptionTicketsSold || 0);
        const capacity = performance.capacity || 2000;
        const targetSales = capacity * 0.85; // 85% occupancy goal

        // Create 6 data points representing weeks leading up to performance
        const progressionPoints = [
            { week: 6, target: Math.floor(targetSales * 0.27), actual: null },
            { week: 5, target: Math.floor(targetSales * 0.30), actual: null },
            { week: 4, target: Math.floor(targetSales * 0.33), actual: null },
            { week: 3, target: Math.floor(targetSales * 0.39), actual: null },
            { week: 2, target: Math.floor(targetSales * 0.46), actual: null },
            { week: 1, target: Math.floor(targetSales * 0.59), actual: null },
            { week: 0, target: Math.floor(targetSales * 1.00), actual: currentSales }
        ];

        return progressionPoints;
    }

    drawSparkline(container, data) {
        const width = 80;
        const height = 25;
        const padding = 2;

        const svg = container.append('svg')
            .attr('width', width)
            .attr('height', height)
            .style('display', 'block');

        // Scales
        const xScale = d3.scaleLinear()
            .domain([0, 6])
            .range([padding, width - padding]);

        const maxValue = d3.max(data, d => Math.max(d.target, d.actual || 0));
        const yScale = d3.scaleLinear()
            .domain([0, maxValue])
            .range([height - padding, padding]);

        // Target line
        const targetLine = d3.line()
            .x(d => xScale(6 - d.week))
            .y(d => yScale(d.target))
            .curve(d3.curveMonotoneX);

        svg.append('path')
            .datum(data)
            .attr('d', targetLine)
            .attr('fill', 'none')
            .attr('stroke', '#2ca02c')
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', '2,2')
            .attr('opacity', 0.7);

        // Current sales point
        const currentData = data.find(d => d.actual !== null);
        if (currentData) {
            svg.append('circle')
                .attr('cx', xScale(6 - currentData.week))
                .attr('cy', yScale(currentData.actual))
                .attr('r', 2)
                .attr('fill', '#d62728')
                .attr('stroke', 'white')
                .attr('stroke-width', 1);
        }
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

        // Note: Parking performances are already filtered out in the data source

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
                    case 'thisWeekAndBeyond':
                        // Get the start of this week (Sunday)
                        const today = new Date();
                        const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
                        const startOfWeek = new Date(today);
                        startOfWeek.setDate(today.getDate() - currentDay);
                        startOfWeek.setHours(0, 0, 0, 0);
                        return performanceDate >= startOfWeek;
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

.sparkline-container {
    width: 80px;
    height: 25px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto;
}

.sparkline-container svg {
    display: block;
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

.status-on-target {
    background: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
}

.status-below-target {
    background: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
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
    max-width: 90vw;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.performance-modal > h3 {
    padding: 20px 20px 0 20px;
    margin-bottom: 15px;
    margin-top: 0;
    font-size: 1.1em;
    color: #333;
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0;
    border-bottom: 1px solid #eee;
    padding: 20px 20px 15px 20px;
    border-radius: 8px 8px 0 0;
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
    margin-bottom: 15px;
    padding: 0 20px 20px 20px;
}

.performance-details h3 {
    margin-top: 0;
    margin-bottom: 12px;
    color: #495057;
    border-bottom: 1px solid #dee2e6;
    padding-bottom: 6px;
    font-size: 1em;
}

.performance-details p {
    margin: 6px 0;
    line-height: 1.3;
    font-size: 0.9em;
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
    margin: 0 20px 20px 20px;
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