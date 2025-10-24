class DataTable {
    constructor() {
        this.container = null;
        this.data = [];
        this.sortColumn = 'date';
        this.sortDirection = 'asc';
        this.filterText = '';
        this.filters = {
            season: 'all',
            dateRange: 'all'
        };
        this.groupByProduction = true;
        this.expandedGroups = new Set();

        // Define columns and their properties
        this.columns = [
            {
                key: 'title',
                label: 'Performance',
                sortable: true,
                formatter: (value, row) => {
                    const isExpanded = this.expandedGroups.has(row.groupKey);
                    const chevron = row.isGroup ?
                        `<span class="chevron ${isExpanded ? 'expanded' : ''}">${isExpanded ? '▼' : '▶'}</span>` :
                        '';
                    const indent = row.isChild ? '<span class="child-indent">└─</span>' : '';

                    return `
                        <div class="performance-cell">
                            ${chevron}${indent}<div class="performance-title">${value}</div>
                            <div class="performance-code">${row.code || ''}</div>
                        </div>
                    `;
                }
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
                hidden: true,
                formatter: (value) => `<span class="venue-cell">${value}</span>`
            },
            {
                key: 'series',
                label: 'Production',
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
                formatter: (value) => {
                    if (!value) return '<span class="season-cell">N/A</span>';
                    // Remove leading "25-26 " or similar year prefix
                    const cleanValue = value.replace(/^\d{2}-\d{2}\s+/, '');
                    return `<span class="season-cell">${cleanValue}</span>`;
                }
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
                    return `<div class="tickets-sold">${total.toLocaleString()}</div>`;
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
                    return `${rate.toFixed(1)}%`;
                }
            },
            {
                key: 'singleTicketsSold',
                label: 'Single',
                sortable: true,
                align: 'center',
                hidden: true,
                formatter: (value) => (value || 0).toLocaleString()
            },
            {
                key: 'subscriptionTicketsSold',
                label: 'Subscription',
                sortable: true,
                align: 'center',
                hidden: true,
                formatter: (value) => (value || 0).toLocaleString()
            },
            {
                key: 'totalRevenue',
                label: 'Actual Revenue',
                sortable: true,
                align: 'right',
                formatter: (value, row) => {
                    const revenue = value || 0;
                    const budget = row.budgetGoal || 0;

                    if (budget === 0) {
                        return `
                            <div class="revenue-cell">
                                <div class="revenue-amount">$${revenue.toLocaleString()}</div>
                            </div>
                        `;
                    }

                    const variance = revenue - budget;
                    const isOver = variance >= 0;
                    const varClass = isOver ? 'over-budget' : 'under-budget';

                    return `
                        <div class="revenue-cell">
                            <div class="revenue-amount">$${revenue.toLocaleString()}</div>
                            <div class="revenue-variance ${varClass}">${isOver ? '+' : ''}$${variance.toLocaleString()}</div>
                        </div>
                    `;
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
                key: 'salesTarget',
                label: 'Status',
                sortable: true,
                align: 'center',
                hidden: true,
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

        // Left section - Search
        const leftSection = filterBar
            .append('div')
            .attr('class', 'filter-left');

        leftSection
            .append('input')
            .attr('type', 'text')
            .attr('placeholder', 'Search performances...')
            .attr('class', 'search-input')
            .on('input', (event) => {
                this.filterText = event.target.value.toLowerCase();
                this.renderTableRows();
            });

        // Center section - Filters and Toggle
        const centerSection = filterBar
            .append('div')
            .attr('class', 'filter-center');

        // Season filter (with cleaned values)
        const seasonValues = this.getUniqueValues('season').map(s => s.replace(/^\d{2}-\d{2}\s+/, ''));
        this.createFilterDropdown(centerSection, 'season', 'Season', seasonValues);

        // Date range filter
        this.createDateRangeFilter(centerSection);

        // View mode toggle switch
        const toggleContainer = centerSection
            .append('div')
            .attr('class', 'view-toggle-container');

        toggleContainer
            .append('span')
            .attr('class', 'toggle-text')
            .text('Grouped');

        const toggleLabel = toggleContainer
            .append('label')
            .attr('class', 'toggle-switch');

        const checkbox = toggleLabel
            .append('input')
            .attr('type', 'checkbox')
            .property('checked', !this.groupByProduction)
            .on('change', (event) => {
                this.groupByProduction = !event.target.checked;
                this.expandedGroups.clear();
                this.render();
            });

        toggleLabel
            .append('span')
            .attr('class', 'toggle-slider');

        toggleContainer
            .append('span')
            .attr('class', 'toggle-text')
            .text('List');

        // Right section - Clear button and info
        const rightSection = filterBar
            .append('div')
            .attr('class', 'filter-right');

        rightSection
            .append('button')
            .attr('class', 'clear-filters-btn')
            .text('Clear Filters')
            .on('click', () => this.clearAllFilters());

        rightSection
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
        const allOption = select.append('option')
            .attr('value', 'all')
            .text('All');

        if (this.filters[filterKey] === 'all') {
            allOption.attr('selected', true);
        }

        // Add unique options
        options.forEach(option => {
            const optionElement = select.append('option')
                .attr('value', option)
                .text(option);

            if (this.filters[filterKey] === option) {
                optionElement.attr('selected', true);
            }
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
            season: 'all',
            dateRange: 'all'
        };
        this.filterText = '';

        // Reset UI elements
        this.container.select('.search-input').property('value', '');
        this.container.selectAll('.filter-select').property('value', 'all');

        this.renderTableRows();
    }

    async showPerformanceDetails(performance) {
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

        // Modal header with navigation
        const header = modal.append('div')
            .attr('class', 'modal-header')
            .style('display', 'flex')
            .style('justify-content', 'space-between')
            .style('align-items', 'center')
            .style('margin', '-25px -25px 20px -25px')
            .style('padding', '20px 25px')
            .style('background', '#2c3e50')
            .style('border-radius', '8px 8px 0 0');

        // Get all performances for navigation
        const allPerformances = this.filteredData || this.data || [];
        const currentIndex = allPerformances.findIndex(p =>
            p.id === performance.id || p.performanceId === performance.performanceId
        );
        const hasPrevious = currentIndex > 0;
        const hasNext = currentIndex < allPerformances.length - 1;

        // Left side: Previous button
        const leftSection = header.append('div')
            .style('display', 'flex')
            .style('align-items', 'center')
            .style('gap', '15px');

        if (hasPrevious) {
            leftSection.append('button')
                .attr('class', 'nav-prev')
                .style('background', 'rgba(255, 255, 255, 0.2)')
                .style('border', 'none')
                .style('color', 'white')
                .style('padding', '8px 16px')
                .style('border-radius', '4px')
                .style('cursor', 'pointer')
                .style('font-size', '14px')
                .style('font-weight', '600')
                .style('transition', 'background 0.2s')
                .text('← Previous')
                .on('mouseover', function() {
                    d3.select(this).style('background', 'rgba(255, 255, 255, 0.3)');
                })
                .on('mouseout', function() {
                    d3.select(this).style('background', 'rgba(255, 255, 255, 0.2)');
                })
                .on('click', async () => {
                    const previousPerf = allPerformances[currentIndex - 1];
                    modalOverlay.remove();
                    await this.showPerformanceDetails(previousPerf);
                });
        }

        // Center: Title and counter
        const centerSection = header.append('div')
            .style('text-align', 'center')
            .style('flex', '1');

        centerSection.append('h2')
            .style('margin', '0 0 5px 0')
            .style('color', 'white')
            .text(performance.title);

        centerSection.append('div')
            .style('font-size', '12px')
            .style('color', 'rgba(255, 255, 255, 0.7)')
            .text(`Performance ${currentIndex + 1} of ${allPerformances.length}`);

        // Right side: Next button and close
        const rightSection = header.append('div')
            .style('display', 'flex')
            .style('align-items', 'center')
            .style('gap', '15px');

        if (hasNext) {
            rightSection.append('button')
                .attr('class', 'nav-next')
                .style('background', 'rgba(255, 255, 255, 0.2)')
                .style('border', 'none')
                .style('color', 'white')
                .style('padding', '8px 16px')
                .style('border-radius', '4px')
                .style('cursor', 'pointer')
                .style('font-size', '14px')
                .style('font-weight', '600')
                .style('transition', 'background 0.2s')
                .text('Next →')
                .on('mouseover', function() {
                    d3.select(this).style('background', 'rgba(255, 255, 255, 0.3)');
                })
                .on('mouseout', function() {
                    d3.select(this).style('background', 'rgba(255, 255, 255, 0.2)');
                })
                .on('click', async () => {
                    const nextPerf = allPerformances[currentIndex + 1];
                    modalOverlay.remove();
                    await this.showPerformanceDetails(nextPerf);
                });
        }

        rightSection.append('button')
            .attr('class', 'close-modal')
            .style('background', 'none')
            .style('border', 'none')
            .style('font-size', '28px')
            .style('cursor', 'pointer')
            .style('color', 'white')
            .style('line-height', '1')
            .text('×')
            .on('click', () => modalOverlay.remove());

        // Add keyboard navigation for arrow keys
        const handleKeyPress = async (event) => {
            if (event.key === 'ArrowLeft' && hasPrevious) {
                const previousPerf = allPerformances[currentIndex - 1];
                document.removeEventListener('keydown', handleKeyPress);
                modalOverlay.remove();
                await this.showPerformanceDetails(previousPerf);
            } else if (event.key === 'ArrowRight' && hasNext) {
                const nextPerf = allPerformances[currentIndex + 1];
                document.removeEventListener('keydown', handleKeyPress);
                modalOverlay.remove();
                await this.showPerformanceDetails(nextPerf);
            } else if (event.key === 'Escape') {
                document.removeEventListener('keydown', handleKeyPress);
                modalOverlay.remove();
            }
        };
        document.addEventListener('keydown', handleKeyPress);

        // Clean up event listener when modal closes
        modalOverlay.on('click', function(event) {
            if (event.target === this) {
                document.removeEventListener('keydown', handleKeyPress);
                modalOverlay.remove();
            }
        });

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

        await this.renderSalesChart(chartContainer, performance);

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

        // Calculate sales projections
        const projection = calculateProjectedSales(singleTicketsSold, performance.date);
        const projectionPerformance = projection.canProject ?
            calculateProjectionPerformance(projection.projected, singleTicketTarget) : null;

        const rightInfoItems = [
            { label: 'Total Capacity', value: (performance.capacity?.toLocaleString() || 'N/A') },
            { label: 'Subscription Sold', value: subscriptionSeats.toLocaleString() },
            { label: 'Available for Single Sale', value: availableSingleTickets.toLocaleString(), isBold: true, spacing: 'bottom' },
            { label: 'Single Tickets Sold', value: singleTicketsSold.toLocaleString() },
            { label: 'Single Ticket Target (85%)', value: singleTicketTarget.toLocaleString() },
            { label: 'Single Sales Progress', value: singleTicketProgress.toFixed(1) + '%',
              color: singleTicketProgress >= 85 ? '#27ae60' : singleTicketProgress >= 60 ? '#f39c12' : '#e74c3c' },
            // Add projection data if available
            ...(projection.canProject ? [
                { label: 'Projected Final Singles', value: projection.projected.toLocaleString(), isBold: true },
                { label: 'Projected vs Target', value: projectionPerformance.percentage.toFixed(1) + '%',
                  color: projectionPerformance.status === 'excellent' ? '#27ae60' :
                         projectionPerformance.status === 'good' ? '#27ae60' :
                         projectionPerformance.status === 'warning' ? '#f39c12' : '#e74c3c' },
                { label: 'Projection Basis', value: formatProjectionText(projection), isSmall: true, spacing: 'bottom' }
            ] : [
                { label: 'Projected Singles', value: formatProjectionText(projection), isSmall: true, spacing: 'bottom' }
            ]),
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
                .style('font-size', item.isSmall ? '12px' : '14px')
                .text(item.label + ':');

            row.append('span')
                .style('color', item.color || '#212529')
                .style('font-weight', item.color || item.isBold ? '600' : 'normal')
                .style('font-size', item.isSmall ? '12px' : '14px')
                .style('font-style', item.isSmall ? 'italic' : 'normal')
                .text(item.value);
        });

        // Add Comparisons Management section
        await this.renderComparisonsSection(modal, performance);

        // Close modal on overlay click
        modalOverlay.on('click', (event) => {
            if (event.target === modalOverlay.node()) {
                modalOverlay.remove();
            }
        });
    }

    async renderComparisonsSection(modal, performance) {
        // Add comparisons section header
        modal.append('h3')
            .style('margin-top', '30px')
            .style('margin-bottom', '15px')
            .style('font-size', '1.1em')
            .style('color', '#333')
            .text('Sales Progression Comparisons');

        const comparisonsContainer = modal.append('div')
            .attr('class', 'comparisons-container')
            .style('background', '#f8f9fa')
            .style('padding', '20px')
            .style('border-radius', '8px');

        // Add comparison button
        const addButton = comparisonsContainer.append('button')
            .attr('class', 'add-comparison-btn')
            .style('background', '#3498db')
            .style('color', 'white')
            .style('border', 'none')
            .style('padding', '10px 20px')
            .style('border-radius', '4px')
            .style('cursor', 'pointer')
            .style('font-weight', '600')
            .style('margin-bottom', '20px')
            .text('+ Add Comparison')
            .on('click', () => this.showComparisonForm(comparisonsContainer, performance));

        // Load and display existing comparisons
        const comparisons = await window.dataService.getPerformanceComparisons(performance.performanceId);

        const comparisonsList = comparisonsContainer.append('div')
            .attr('class', 'comparisons-list');

        if (comparisons && comparisons.length > 0) {
            comparisons.forEach(comp => {
                this.renderComparisonItem(comparisonsList, comp, performance);
            });
        } else {
            comparisonsList.append('p')
                .style('color', '#6c757d')
                .style('font-style', 'italic')
                .text('No comparisons added yet. Click "Add Comparison" to create one.');
        }
    }

    renderComparisonItem(container, comparison, performance) {
        // Capture 'this' context for async handlers
        const self = this;

        const item = container.append('div')
            .attr('class', 'comparison-item')
            .style('background', 'white')
            .style('padding', '15px')
            .style('margin-bottom', '10px')
            .style('border-radius', '6px')
            .style('border-left', `4px solid ${comparison.line_color}`)
            .style('display', 'flex')
            .style('justify-content', 'space-between')
            .style('align-items', 'center');

        const info = item.append('div')
            .style('flex', '1');

        info.append('div')
            .style('font-weight', '600')
            .style('margin-bottom', '5px')
            .text(comparison.comparison_name);

        const styleIndicator = this.getLineStyleChar(comparison.line_style);
        info.append('div')
            .style('font-size', '12px')
            .style('color', '#6c757d')
            .html(`<span style="color: ${comparison.line_color}; font-weight: bold;">${styleIndicator}</span> ${comparison.line_color}, ${comparison.weeksArray.length} weeks`);

        const actions = item.append('div')
            .style('display', 'flex')
            .style('gap', '10px');

        actions.append('button')
            .style('background', '#ffc107')
            .style('color', '#000')
            .style('border', 'none')
            .style('padding', '6px 12px')
            .style('border-radius', '4px')
            .style('cursor', 'pointer')
            .style('font-size', '12px')
            .text('Edit')
            .on('click', () => this.editComparison(container, comparison, performance));

        actions.append('button')
            .style('background', '#dc3545')
            .style('color', 'white')
            .style('border', 'none')
            .style('padding', '6px 12px')
            .style('border-radius', '4px')
            .style('cursor', 'pointer')
            .style('font-size', '12px')
            .text('Delete')
            .on('click', async function() {
                if (confirm(`Delete comparison "${comparison.comparison_name}"?`)) {
                    const button = d3.select(this);

                    // Show loading state
                    button
                        .property('disabled', true)
                        .style('cursor', 'not-allowed')
                        .style('opacity', '0.7')
                        .html('<span class="spinner-small"></span> Deleting...');

                    // Add spinner styles if not already present
                    if (!d3.select('style.delete-spinner-styles').node()) {
                        d3.select('head').append('style')
                            .attr('class', 'delete-spinner-styles')
                            .text(`
                                .spinner-small {
                                    display: inline-block;
                                    width: 10px;
                                    height: 10px;
                                    border: 2px solid rgba(255,255,255,0.3);
                                    border-top: 2px solid white;
                                    border-radius: 50%;
                                    animation: spin 0.6s linear infinite;
                                    margin-right: 4px;
                                }
                            `);
                    }

                    try {
                        await window.dataService.deleteComparison(comparison.comparison_id);

                        // Fade out and remove
                        item.transition()
                            .duration(300)
                            .style('opacity', '0')
                            .remove();

                        // Refresh the sales chart to remove the comparison line
                        await self.refreshModalChart(performance);
                    } catch (error) {
                        // Show error state
                        button
                            .property('disabled', false)
                            .style('cursor', 'pointer')
                            .style('opacity', '1')
                            .text('Error - Try Again');

                        alert(`Error deleting comparison: ${error.message}`);

                        // Reset button after 2 seconds
                        setTimeout(() => {
                            button.text('Delete');
                        }, 2000);
                    }
                }
            });
    }

    getLineStyleChar(style) {
        const styles = {
            'solid': '━━━',
            'dashed': '╌╌╌',
            'dotted': '···'
        };
        return styles[style] || '━━━';
    }

    showComparisonForm(container, performance, existingComparison = null) {
        // Remove any existing form
        container.selectAll('.comparison-form').remove();

        const form = container.insert('div', ':first-child')
            .attr('class', 'comparison-form')
            .style('background', 'white')
            .style('padding', '20px')
            .style('margin-bottom', '20px')
            .style('border-radius', '6px')
            .style('border', '2px solid #3498db');

        form.append('h4')
            .style('margin-top', '0')
            .style('margin-bottom', '15px')
            .text(existingComparison ? 'Edit Comparison' : 'Add New Comparison');

        // Name input
        form.append('label')
            .style('display', 'block')
            .style('margin-bottom', '5px')
            .style('font-weight', '600')
            .text('Name:');

        const nameInput = form.append('input')
            .attr('type', 'text')
            .attr('class', 'comp-name-input')
            .attr('placeholder', 'e.g., Optimistic Target, Conservative Estimate')
            .style('width', '100%')
            .style('padding', '8px')
            .style('margin-bottom', '15px')
            .style('border', '1px solid #ddd')
            .style('border-radius', '4px')
            .property('value', existingComparison?.comparison_name || '');

        // Weeks data input
        form.append('label')
            .style('display', 'block')
            .style('margin-bottom', '5px')
            .style('font-weight', '600')
            .html('Weekly Sales Data <span style="font-weight: normal; font-size: 12px; color: #6c757d;">(comma-separated, farthest week first)</span>:');

        const weeksInput = form.append('input')
            .attr('type', 'text')
            .attr('class', 'comp-weeks-input')
            .attr('placeholder', '1200,2400,3500,4800,6200,7500,8800')
            .style('width', '100%')
            .style('padding', '8px')
            .style('margin-bottom', '5px')
            .style('border', '1px solid #ddd')
            .style('border-radius', '4px')
            .property('value', existingComparison?.weeks_data || '');

        form.append('div')
            .style('font-size', '11px')
            .style('color', '#6c757d')
            .style('margin-bottom', '15px')
            .style('font-style', 'italic')
            .text('← Farthest week ... Closest to performance →');

        // Color picker
        form.append('label')
            .style('display', 'block')
            .style('margin-bottom', '5px')
            .style('font-weight', '600')
            .text('Line Color:');

        const colorInput = form.append('input')
            .attr('type', 'color')
            .attr('class', 'comp-color-input')
            .style('width', '60px')
            .style('height', '35px')
            .style('margin-bottom', '15px')
            .style('border', '1px solid #ddd')
            .style('border-radius', '4px')
            .style('cursor', 'pointer')
            .property('value', existingComparison?.line_color || '#4285f4');

        // Line style selector
        form.append('label')
            .style('display', 'block')
            .style('margin-bottom', '5px')
            .style('font-weight', '600')
            .text('Line Style:');

        const styleContainer = form.append('div')
            .style('margin-bottom', '20px');

        const styles = [
            { value: 'solid', label: 'Solid ━━━' },
            { value: 'dashed', label: 'Dashed ╌╌╌' },
            { value: 'dotted', label: 'Dotted ···' }
        ];

        styles.forEach(style => {
            const radio = styleContainer.append('label')
                .style('margin-right', '15px')
                .style('cursor', 'pointer');

            radio.append('input')
                .attr('type', 'radio')
                .attr('name', 'line-style')
                .attr('value', style.value)
                .property('checked', (!existingComparison && style.value === 'dashed') || (existingComparison?.line_style === style.value))
                .style('margin-right', '5px');

            radio.append('span')
                .text(style.label);
        });

        // Buttons
        const buttonContainer = form.append('div')
            .style('display', 'flex')
            .style('gap', '10px')
            .style('margin-top', '20px');

        // Capture 'this' context for the async handler
        const self = this;

        const saveButton = buttonContainer.append('button')
            .style('background', '#28a745')
            .style('color', 'white')
            .style('border', 'none')
            .style('padding', '10px 20px')
            .style('border-radius', '4px')
            .style('cursor', 'pointer')
            .style('font-weight', '600')
            .style('position', 'relative')
            .text(existingComparison ? 'Update' : 'Save')
            .on('click', async function() {
                const button = d3.select(this);
                const originalText = button.text();

                const name = nameInput.property('value');
                const weeksData = weeksInput.property('value');
                const color = colorInput.property('value');
                const lineStyle = form.select('input[name="line-style"]:checked').property('value');

                if (!name || !weeksData) {
                    alert('Please fill in all required fields');
                    return;
                }

                // Show loading state
                button
                    .property('disabled', true)
                    .style('cursor', 'not-allowed')
                    .style('opacity', '0.7')
                    .html('<span class="spinner"></span> Saving...');

                // Add spinner styles
                form.append('style')
                    .text(`
                        .spinner {
                            display: inline-block;
                            width: 12px;
                            height: 12px;
                            border: 2px solid rgba(255,255,255,0.3);
                            border-top: 2px solid white;
                            border-radius: 50%;
                            animation: spin 0.6s linear infinite;
                            margin-right: 5px;
                        }
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    `);

                try {
                    if (existingComparison) {
                        await window.dataService.updateComparison(existingComparison.comparison_id, {
                            comparisonName: name,
                            weeksData,
                            lineColor: color,
                            lineStyle
                        });
                    } else {
                        await window.dataService.createComparison(performance.performanceId, {
                            comparisonName: name,
                            weeksData,
                            lineColor: color,
                            lineStyle
                        });
                    }

                    // Show success state briefly
                    button
                        .style('background', '#218838')
                        .html('✓ Saved!');

                    await new Promise(resolve => setTimeout(resolve, 500));

                    // First refresh the chart to show updated comparison
                    await self.refreshModalChart(performance);

                    // Then reload the comparisons section
                    form.remove();
                    const modalElement = d3.select('.performance-modal');
                    modalElement.selectAll('.comparisons-container').remove();
                    await self.renderComparisonsSection(modalElement, performance);
                } catch (error) {
                    // Show error state
                    button
                        .property('disabled', false)
                        .style('cursor', 'pointer')
                        .style('opacity', '1')
                        .style('background', '#dc3545')
                        .text('Error - Try Again');

                    alert(`Error saving comparison: ${error.message}`);

                    // Reset button after 2 seconds
                    setTimeout(() => {
                        button
                            .style('background', '#28a745')
                            .text(originalText);
                    }, 2000);
                }
            });

        buttonContainer.append('button')
            .style('background', '#6c757d')
            .style('color', 'white')
            .style('border', 'none')
            .style('padding', '10px 20px')
            .style('border-radius', '4px')
            .style('cursor', 'pointer')
            .text('Cancel')
            .on('click', () => form.remove());
    }

    async editComparison(container, comparison, performance) {
        const modalElement = d3.select('.performance-modal');
        const comparisonsContainer = d3.select('.comparisons-container');
        this.showComparisonForm(comparisonsContainer, performance, comparison);
    }

    async refreshModalChart(performance) {
        // Re-render the sales chart with updated comparisons
        const chartContainer = d3.select('#modal-sales-chart');
        if (!chartContainer.empty()) {
            console.log('🔄 Refreshing chart for performance:', performance.performanceId || performance.id);
            chartContainer.html('');
            await this.renderSalesChart(chartContainer, performance);
            console.log('✅ Chart refresh complete');
        } else {
            console.warn('⚠️ Chart container not found');
        }
    }

// Patch for data-table.js - add after line 1211

    async renderSalesChart(container, performance) {
        console.log('🔄 renderSalesChart called for performance:', performance.performanceId || performance.id);

        // Fetch historical snapshots for this performance
        const performanceCode = performance.code || performance.performanceCode;
        let historicalData = [];

        try {
            console.log(`📊 Fetching historical snapshots for ${performanceCode}...`);
            const response = await fetch(
                `/netlify/functions/bigquery-snapshots?action=get-performance-history&performanceCode=${performanceCode}`
            );

            if (response.ok) {
                const apiResponse = await response.json();
                // API returns {performanceCode, snapshots: [...]}
                historicalData = apiResponse.snapshots || [];
                console.log(`✅ Fetched ${historicalData.length} historical snapshots`);

                // Get unique dates and keep only one snapshot per date (latest)
                const uniqueByDate = {};
                for (const snapshot of historicalData) {
                    const date = snapshot.snapshot_date;
                    if (!uniqueByDate[date] || new Date(snapshot.created_at) > new Date(uniqueByDate[date].created_at)) {
                        uniqueByDate[date] = snapshot;
                    }
                }
                historicalData = Object.values(uniqueByDate);
                console.log(`📅 Unique dates: ${historicalData.length}`);
            } else {
                console.warn('⚠️ No historical data available, using current data only');
            }
        } catch (error) {
            console.warn('⚠️ Error fetching historical data:', error.message);
        }

        // If we have historical data (more than 1 unique date), render timeline chart
        if (historicalData && historicalData.length > 1) {
            this.renderHistoricalTimelineChart(container, performance, historicalData);
        } else {
            // Fallback to standard sales curve chart
            const chartId = container.attr('id') || 'modal-sales-chart';
            const salesChart = new SalesCurveChart(chartId, { showSelector: false });
            const chartData = [performance];
            salesChart.data = chartData;
            salesChart.selectedPerformance = performance.id;
            await salesChart.render();
        }

        console.log('✅ renderSalesChart complete');
    }
/**
 * Historical Timeline Chart
 * Displays longitudinal sales progression from daily snapshots
 */

    renderHistoricalTimelineChart(container, performance, historicalData) {
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
        .attr('r', 5)
        .attr('fill', '#2E86AB')
        .attr('stroke', 'white')
        .attr('stroke-width', 2)
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
                .attr('r', 7)
                .attr('fill', '#F18F01');
        })
        .on('mouseout', function() {
            container.selectAll('.chart-tooltip').remove();
            d3.select(this)
                .attr('r', 5)
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
            if (column.hidden) return;

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

        let filteredData = this.getFilteredData();
        let displayData = [];

        // Apply grouping if enabled
        if (this.groupByProduction) {
            const groups = this.groupDataByProduction(filteredData);

            // Build display data with groups and optionally their children
            groups.forEach(group => {
                displayData.push(group);

                // If group is expanded, add child performances
                if (this.expandedGroups.has(group.groupKey)) {
                    group.performances.forEach(perf => {
                        displayData.push({
                            ...perf,
                            isChild: true,
                            parentKey: group.groupKey
                        });
                    });
                }
            });
        } else {
            displayData = filteredData;
        }

        // Update info display
        const count = this.groupByProduction ?
            displayData.filter(d => d.isGroup).length :
            displayData.length;
        this.container.select('.table-info')
            .text(`${count} ${this.groupByProduction ? 'productions' : 'performances'}`);

        // Create rows
        const rows = this.tbody
            .selectAll('tr')
            .data(displayData, d => d.isGroup ? d.id : (d.isChild ? `child-${d.id}` : d.id));

        rows.exit().remove();

        const newRows = rows.enter()
            .append('tr')
            .attr('class', d => `table-row ${d.isGroup ? 'group-row' : ''} ${d.isChild ? 'child-row' : ''}`)
            .style('cursor', 'pointer')
            .on('click', (event, d) => {
                if (d.isGroup) {
                    // Toggle expansion
                    if (this.expandedGroups.has(d.groupKey)) {
                        this.expandedGroups.delete(d.groupKey);
                    } else {
                        this.expandedGroups.add(d.groupKey);
                    }
                    this.renderTableRows();
                } else {
                    this.showPerformanceDetails(d);
                }
            });

        const allRows = newRows.merge(rows)
            .attr('class', d => `table-row ${d.isGroup ? 'group-row' : ''} ${d.isChild ? 'child-row' : ''}`);

        // Create cells
        this.columns.forEach(column => {
            if (column.hidden) return;

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

        // Apply dropdown filters (case-insensitive)
        if (this.filters.season !== 'all') {
            filtered = filtered.filter(row => {
                const cleanSeason = row.season?.replace(/^\d{2}-\d{2}\s+/, '') || '';
                return cleanSeason.toLowerCase() === this.filters.season.toLowerCase();
            });
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

    groupDataByProduction(data) {
        const groups = {};

        // Group performances by title
        data.forEach(perf => {
            const title = perf.title || 'Unknown';
            if (!groups[title]) {
                groups[title] = {
                    title: title,
                    performances: [],
                    isGroup: true,
                    groupKey: title
                };
            }
            groups[title].performances.push(perf);
        });

        // Calculate aggregated stats for each group
        const groupedData = [];
        Object.values(groups).forEach(group => {
            const perfs = group.performances;
            const count = perfs.length;

            // Aggregate calculations
            const totalCapacity = perfs.reduce((sum, p) => sum + (p.capacity || 0), 0);
            const totalSingleTickets = perfs.reduce((sum, p) => sum + (p.singleTicketsSold || 0), 0);
            const totalSubscriptionTickets = perfs.reduce((sum, p) => sum + (p.subscriptionTicketsSold || 0), 0);
            const totalTickets = totalSingleTickets + totalSubscriptionTickets;
            const totalRevenue = perfs.reduce((sum, p) => sum + (p.totalRevenue || 0), 0);
            const totalBudget = perfs.reduce((sum, p) => sum + (p.budgetGoal || 0), 0);

            // Average occupancy across all performances
            const avgOccupancy = totalCapacity > 0 ? (totalTickets / totalCapacity * 100) : 0;

            // Use first performance's metadata
            const firstPerf = perfs[0];

            groupedData.push({
                ...group,
                id: `group-${group.groupKey}`,
                title: group.title,
                code: `${count} performance${count > 1 ? 's' : ''}`,
                date: firstPerf.date, // Use earliest date for sorting
                venue: firstPerf.venue,
                series: firstPerf.series,
                season: firstPerf.season,
                capacity: totalCapacity,
                singleTicketsSold: totalSingleTickets,
                subscriptionTicketsSold: totalSubscriptionTickets,
                totalRevenue: totalRevenue,
                budgetGoal: totalBudget,
                occupancyGoal: firstPerf.occupancyGoal || 85,
                performanceCount: count
            });
        });

        return groupedData;
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
    background: linear-gradient(to bottom, #ffffff, #f8f9fa);
    border-bottom: 2px solid #dee2e6;
    gap: 20px;
}

.filter-left {
    flex: 0 0 auto;
    min-width: 250px;
}

.filter-center {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 15px;
    flex-wrap: wrap;
}

.filter-right {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 15px;
}

.search-input {
    width: 100%;
    padding: 10px 15px;
    border: 2px solid #e9ecef;
    border-radius: 8px;
    font-size: 14px;
    transition: all 0.2s ease;
}

.search-input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.filter-group {
    display: flex;
    align-items: center;
    gap: 8px;
}

.filter-label {
    font-size: 14px;
    color: #495057;
    font-weight: 600;
    white-space: nowrap;
}

.filter-select {
    padding: 8px 12px;
    border: 2px solid #e9ecef;
    border-radius: 6px;
    font-size: 14px;
    background: white;
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 150px;
}

.filter-select:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.filter-select:hover {
    border-color: #667eea;
}

.view-toggle-container {
    display: flex;
    align-items: center;
    gap: 12px;
}

.toggle-text {
    font-size: 14px;
    color: #495057;
    font-weight: 500;
}

.toggle-switch {
    position: relative;
    display: inline-block;
    width: 48px;
    height: 24px;
}

.toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
}

.toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #667eea;
    transition: 0.3s;
    border-radius: 24px;
}

.toggle-slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.3s;
    border-radius: 50%;
}

.toggle-switch input:checked + .toggle-slider {
    background-color: #ccc;
}

.toggle-switch input:checked + .toggle-slider:before {
    transform: translateX(24px);
}

.toggle-switch input:focus + .toggle-slider {
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
}

.clear-filters-btn {
    padding: 8px 16px;
    background: #ffffff;
    color: #495057;
    border: 2px solid #e9ecef;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s ease;
    white-space: nowrap;
}

.clear-filters-btn:hover {
    background: #f8f9fa;
    border-color: #667eea;
    color: #667eea;
}

.table-info {
    color: #495057;
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
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
    padding: 14px 8px;
    border-bottom: 1px solid #dee2e6;
    vertical-align: middle;
    height: 60px;
    box-sizing: border-box;
}

.table-row {
    height: 60px;
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
    display: flex;
    align-items: center;
    gap: 8px;
}

.chevron {
    display: inline-block;
    width: 16px;
    cursor: pointer;
    user-select: none;
    color: #667eea;
    font-size: 12px;
}

.child-indent {
    color: #6c757d;
    margin-left: 16px;
    margin-right: 4px;
}

.group-row {
    background: #f8f9fa;
    font-weight: 500;
    height: 60px;
}

.group-row td {
    height: 60px;
}

.group-row:hover {
    background: #e9ecef !important;
}

.group-row:hover td {
    background: #e9ecef !important;
}

.child-row {
    background: #ffffff;
    height: 60px;
}

.child-row td {
    border-bottom: 1px dotted #dee2e6;
    height: 60px;
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

.revenue-cell {
    min-width: 100px;
}

.revenue-amount {
    font-weight: 500;
}

.revenue-variance {
    font-size: 12px;
    margin-top: 2px;
}

.revenue-variance.over-budget {
    color: #28a745;
}

.revenue-variance.under-budget {
    color: #dc3545;
}

.target-variance.over-target {
    color: #28a745;
    font-weight: 500;
}

.target-variance.under-target {
    color: #dc3545;
    font-weight: 500;
}

.tickets-sold {
    font-weight: 500;
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