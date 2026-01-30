/**
 * Dashboard UI Management
 * Handles the new polished interface with KPI cards, view switching, and drill-down functionality
 */
class DashboardUI extends BaseComponent {
    constructor() {
        super({ id: 'dashboard-ui' });

        this.currentView = 'overview';
        this.currentCurveModel = 'expectedProgression';
        this.selectedPerformance = null;
        this.kpiData = {};

        // Initialize state
        this.state = {
            loading: false,
            error: null,
            authenticated: false
        };

        // Initialize after DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    async init() {
        try {
            this.log('info', 'Initializing Dashboard UI');

            // Setup URL routing before anything else
            this.setupRoutes();

            this.setupEventListeners();

            // Initialize data table view directly
            await this.initializeTableView();

            // Handle initial route (if user navigated directly to a URL)
            if (window.router) {
                window.router.handleRoute(false);
            }

            this.log('info', 'Dashboard UI initialized successfully');
        } catch (error) {
            this.handleError(error, 'Dashboard UI Initialization');
        }
    }

    setupRoutes() {
        if (!window.router) {
            this.log('warn', 'Router not available, skipping route setup');
            return;
        }

        this.log('info', 'Setting up URL routes');

        // Home route - close any open modals
        window.router.register('/', () => {
            this.log('debug', 'Route: Home');
            this.closeModalSilent(); // Close without changing URL
        });

        // Performance detail with group context: /performance/cs02-rach-cele-pt-1/250903E
        window.router.register('/performance/:groupSlug/:code', async (params) => {
            this.log('debug', 'Route: Performance detail with group', params);
            await this.openPerformanceByCode(params.code);
        });

        // Performance detail (legacy): /performance/250903E
        window.router.register('/performance/:code', async (params) => {
            this.log('debug', 'Route: Performance detail', params.code);
            await this.openPerformanceByCode(params.code);
        });

        // Short alias: /p/250903E
        window.router.register('/p/:code', async (params) => {
            this.log('debug', 'Route: Performance detail (short)', params.code);
            await this.openPerformanceByCode(params.code);
        });

        // Chart view: /charts/sales-curve
        window.router.register('/charts/:type', (params) => {
            this.log('debug', 'Route: Chart view', params.type);
            this.expandChart(params.type);
        });

        // Table filter: /table/cs02-rach-cele-pt-1-piazza-1 (expand group by slug)
        window.router.register('/table/:series', (params) => {
            this.log('debug', 'Route: Table filter/expand', params.series);
            const slug = decodeURIComponent(params.series);
            if (window.dataTable) {
                // Convert slug back to original group key
                const groupKey = window.dataTable.getGroupKeyFromSlug(slug);
                // Expand the group in the table
                window.dataTable.expandedGroups.add(groupKey);
                window.dataTable.renderTableRows();
            }
        });

        // Table view (no filter): /table
        window.router.register('/table', () => {
            this.log('debug', 'Route: Table view');
            // Already in table view by default
        });
    }

    /**
     * Open performance modal by code (from URL)
     * @param {string} code - Performance code like '250903E'
     * @param {string} view - Optional view to expand (e.g., 'sales-curve')
     */
    async openPerformanceByCode(code, view = null) {
        try {
            this.log('info', `Opening performance from URL: ${code}`, view);

            // Ensure data is loaded - data lives in dataTable, not dataService
            let performances = [];
            if (window.dataTable && window.dataTable.data) {
                performances = window.dataTable.data;
                this.log('debug', `Found ${performances.length} performances in dataTable`);
            } else if (window.dataService) {
                // Load data if table hasn't been initialized yet
                this.log('debug', 'Loading data from dataService...');
                performances = await window.dataService.getPerformances();
                this.log('debug', `Loaded ${performances.length} performances from dataService`);
            } else {
                throw new Error('No data source available');
            }

            // Find performance in loaded data - check multiple property names
            const performance = performances.find(
                p => (p.performanceCode === code || p.performance_code === code || p.code === code || p.id === code)
            );

            if (performance) {
                this.log('info', `Found performance: ${performance.title || performance.id}`);

                // Use the data table's full modal (with charts, comparisons, navigation)
                if (window.dataTable && window.dataTable.showPerformanceDetails) {
                    await window.dataTable.showPerformanceDetails(performance);
                } else {
                    // Fallback to simple details view
                    this.showPerformanceDetailsSilent(performance);
                }

                // If specific view requested, expand it
                if (view) {
                    setTimeout(() => {
                        this.expandChart(view);
                    }, 100);
                }
            } else {
                // Performance not found
                this.log('warn', `Performance ${code} not found in ${performances.length} performances`);
                this.handleError(
                    new Error(`Performance ${code} not found`),
                    'URL Navigation'
                );
                // Redirect to home
                window.router.navigate('/');
            }
        } catch (error) {
            this.handleError(error, 'Open Performance from URL');
            window.router.navigate('/');
        }
    }

    setupEventListeners() {


        // Chart expand buttons
        const expandBtns = document.querySelectorAll('.chart-expand');
        expandBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const chartType = e.target.getAttribute('data-chart');
                this.expandChart(chartType);
            });
        });

        // Modal close button
        const modalClose = document.querySelector('.modal-close');
        if (modalClose) {
            modalClose.addEventListener('click', () => {
                this.closeModal();
            });
        }

        // Modal backdrop close (click outside modal)
        const modalView = document.getElementById('detailed-view');
        if (modalView) {
            modalView.addEventListener('click', (e) => {
                if (e.target === modalView) { // Only if clicking the backdrop, not the modal content
                    this.closeModal();
                }
            });
        }

        // Table search
        const tableSearch = document.getElementById('table-search');
        if (tableSearch) {
            tableSearch.addEventListener('input', (e) => {
                this.filterTable(e.target.value);
            });
        }

        // Table export
        const tableExport = document.getElementById('table-export');
        if (tableExport) {
            tableExport.addEventListener('click', () => {
                this.exportTable();
            });
        }

        // Performance chart click for drill-down
        this.setupPerformanceClickHandler();
    }

    async initializeCharts() {
        try {
            this.log('debug', 'Initializing charts from Dashboard UI');

            // Set loading state
            this.setState({ loading: true });

            // Performance Chart
            if (window.PerformanceChart) {
                console.log('🎯 Initializing PerformanceChart...');
                const performanceChart = new window.PerformanceChart('performance-chart');
                await performanceChart.init();
                this.log('debug', 'Performance chart initialized');
                console.log('✅ PerformanceChart initialized');
            } else {
                console.log('❌ PerformanceChart class not found');
            }

            // Sales Curve Chart
            if (window.SalesCurveChart) {
                const salesCurveChart = new window.SalesCurveChart('sales-curve-chart');
                await salesCurveChart.init();
            }

            // Ticket Type Chart
            if (window.TicketTypeChart) {
                const ticketTypeChart = new window.TicketTypeChart('ticket-type-chart');
                await ticketTypeChart.init();
            }

            this.setState({ loading: false });
            this.log('info', 'All charts initialized successfully');
        } catch (error) {
            this.setState({ loading: false, error: error.message });
            this.handleError(error, 'Charts Initialization');
        }
    }

    setupPerformanceClickHandler() {
        // This will be called by the chart component when a performance is clicked
        window.addEventListener('performance-selected', (event) => {
            this.showPerformanceDetails(event.detail);
        });
    }

    switchView(viewName) {
        if (this.currentView === viewName) return;

        this.log('debug', `Switching view from ${this.currentView} to ${viewName}`);

        // Handle modal view specially
        if (viewName === 'detailed') {
            const modalView = document.getElementById('detailed-view');
            if (modalView) {
                modalView.style.display = 'flex';
                modalView.classList.add('active');
            }
            this.currentView = viewName;
            return;
        }

        // Hide modal if switching away from detailed view
        const modalView = document.getElementById('detailed-view');
        if (modalView) {
            modalView.style.display = 'none';
            modalView.classList.remove('active');
        }

        // Hide all regular views
        document.querySelectorAll('.dashboard-view:not(.modal-view)').forEach(view => {
            view.classList.remove('active');
        });

        // Show selected view
        const targetView = document.getElementById(`${viewName}-view`);
        if (targetView) {
            targetView.classList.add('active');
            this.currentView = viewName;


            // Initialize view-specific functionality
            this.onViewChange(viewName);
        }
    }

    async onViewChange(viewName) {
        switch (viewName) {
            case 'overview':
                await this.updateKPIs();
                break;
            case 'data-table':
                await this.initializeTableView();
                break;
            case 'detailed':
                // Handled by expandChart method
                break;
        }
    }

    async changeCurveModel(modelName) {
        if (this.currentCurveModel === modelName) return;

        this.log('debug', `Changing curve model to ${modelName}`);
        this.currentCurveModel = modelName;

        // Update configuration
        if (window.appConfig) {
            window.appConfig.set('salesCurve.defaultModel', modelName);
        }

        // Refresh charts that use curve data
        if (window.symphonyApp) {
            const salesCurveChart = window.symphonyApp.components.get('salesCurveChart');
            if (salesCurveChart) {
                await salesCurveChart.init();
            }
        }
    }

    async updateKPIs() {
        try {
            this.log('debug', 'Updating KPI cards');

            const dataService = this.getDataService();
            this.log('debug', 'Data service obtained:', !!dataService);

            if (!dataService) {
                this.log('warn', 'Data service not available for KPI update');
                return;
            }

            this.log('debug', 'Fetching performances data...');
            const performances = await dataService.getPerformances();
            this.log('debug', 'Performances fetched:', performances?.length || 0);

            if (!performances || performances.length === 0) {
                this.log('warn', 'No performance data available for KPIs');
                // Set empty state
                this.updateKPI('kpi-total-performances', 0, '');
                this.updateKPI('kpi-avg-occupancy', '0%', 'warning');
                this.updateKPI('kpi-total-revenue', '$0', '');
                this.updateKPI('kpi-on-track', '0%', 'warning');
                return;
            }

            this.kpiData = this.calculateKPIs(performances);
            this.log('debug', 'KPI data calculated:', this.kpiData);
            this.renderKPIs();

        } catch (error) {
            this.handleError(error, 'KPI Update');
            // Set error state
            this.updateKPI('kpi-total-performances', 'Error', 'danger');
            this.updateKPI('kpi-avg-occupancy', 'Error', 'danger');
            this.updateKPI('kpi-total-revenue', 'Error', 'danger');
            this.updateKPI('kpi-on-track', 'Error', 'danger');
        }
    }

    calculateKPIs(performances) {
        const totalPerformances = performances.length;
        let totalRevenue = 0;
        let totalCapacity = 0;
        let totalSold = 0;
        let onTrackCount = 0;

        performances.forEach(perf => {
            totalRevenue += perf.totalRevenue || 0;
            totalCapacity += perf.capacity || 0;
            totalSold += (perf.singleTicketsSold || 0) + (perf.subscriptionTicketsSold || 0);

            // Calculate if performance is "on track"
            const occupancyRate = totalSold / (perf.capacity || 1) * 100;
            const occupancyGoal = perf.occupancyGoal || window.appConfig?.get('performance.defaultOccupancyGoal', 85);

            if (occupancyRate >= occupancyGoal * 0.9) { // Within 90% of goal
                onTrackCount++;
            }
        });

        const avgOccupancy = totalCapacity > 0 ? (totalSold / totalCapacity * 100) : 0;
        const onTrackPercentage = totalPerformances > 0 ? (onTrackCount / totalPerformances * 100) : 0;

        return {
            totalPerformances,
            avgOccupancy: avgOccupancy.toFixed(1),
            totalRevenue,
            onTrackPercentage: onTrackPercentage.toFixed(0)
        };
    }

    renderKPIs() {
        // Total Performances
        this.updateKPI('kpi-total-performances', this.kpiData.totalPerformances, '');

        // Average Occupancy
        this.updateKPI('kpi-avg-occupancy', `${this.kpiData.avgOccupancy}%`,
            this.kpiData.avgOccupancy >= 85 ? 'success' :
            this.kpiData.avgOccupancy >= 70 ? 'warning' : 'danger');

        // Total Revenue
        this.updateKPI('kpi-total-revenue', this.formatCurrency(this.kpiData.totalRevenue), '');

        // On Track Percentage
        this.updateKPI('kpi-on-track', `${this.kpiData.onTrackPercentage}%`,
            this.kpiData.onTrackPercentage >= 80 ? 'success' :
            this.kpiData.onTrackPercentage >= 60 ? 'warning' : 'danger');
    }

    updateKPI(elementId, value, status = '') {
        const element = document.getElementById(elementId);
        if (element) {
            const valueElement = element.querySelector('.kpi-value');
            if (valueElement) {
                valueElement.textContent = value;

                // Update status styling
                valueElement.className = `kpi-value ${status ? `text-${status}` : ''}`;
            }
        }
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }

    expandChart(chartType) {
        this.log('debug', `Expanding chart: ${chartType}`);

        // Switch to detailed view
        this.switchView('detailed');

        // Update modal title
        const titles = {
            'performance': 'Performance Overview - Detailed View',
            'sales-curve': 'Single Ticket Sales Progression',
            'ticket-type': 'Ticket Distribution Analysis',
            'details': 'Performance Details'
        };

        const titleElement = document.getElementById('detailed-title');
        if (titleElement) {
            titleElement.textContent = titles[chartType] || 'Detailed Analysis';
        }

        // Render expanded chart
        this.renderExpandedChart(chartType);
    }

    async renderExpandedChart(chartType) {
        const container = document.getElementById('detailed-chart');
        if (!container) return;

        // Clear previous content
        container.innerHTML = '';

        try {
            switch (chartType) {
                case 'performance':
                    await this.renderExpandedPerformanceChart(container);
                    break;
                case 'sales-curve':
                    await this.renderExpandedSalesCurve(container);
                    break;
                case 'ticket-type':
                    await this.renderExpandedTicketType(container);
                    break;
                case 'details':
                    this.renderPerformanceDetails(container);
                    break;
            }
        } catch (error) {
            this.handleError(error, `Expanded Chart Rendering: ${chartType}`);
            container.innerHTML = '<div class="error">Failed to load detailed chart</div>';
        }
    }

    async renderExpandedPerformanceChart(container) {
        // Create a larger version of the performance chart
        if (window.PerformanceChart) {
            container.innerHTML = '<div id="expanded-performance-chart" style="width: 100%; height: 450px;"></div>';

            const expandedChart = new window.PerformanceChart('expanded-performance-chart');
            // Make it larger and more detailed
            expandedChart.width = container.clientWidth - 40;
            expandedChart.height = 450;
            await expandedChart.init();
        }
    }

    async renderExpandedSalesCurve(container) {
        // Create a larger version of the sales curve chart
        if (window.SalesCurveChart) {
            container.innerHTML = '<div id="expanded-sales-curve-chart" style="width: 100%; height: 450px;"></div>';

            const expandedChart = new window.SalesCurveChart('expanded-sales-curve-chart');
            expandedChart.width = container.clientWidth - 40;
            expandedChart.height = 450;
            await expandedChart.init();
        }
    }

    async renderExpandedTicketType(container) {
        // Create a larger version of the ticket type chart
        if (window.TicketTypeChart) {
            container.innerHTML = '<div id="expanded-ticket-type-chart" style="width: 100%; height: 450px;"></div>';

            const expandedChart = new window.TicketTypeChart('expanded-ticket-type-chart');
            expandedChart.width = container.clientWidth - 40;
            expandedChart.height = 450;
            await expandedChart.init();
        }
    }

    renderPerformanceDetails(container) {
        if (!this.selectedPerformance) {
            container.innerHTML = '<div class="details-placeholder">No performance selected</div>';
            return;
        }

        const perf = this.selectedPerformance;

        // Handle both camelCase and snake_case property names
        const singleTickets = perf.singleTicketsSold || perf.single_tickets_sold || 0;
        const subscriptionTickets = perf.subscriptionTicketsSold || perf.subscription_tickets_sold || 0;
        const capacity = perf.capacity || 0;
        const totalRevenue = perf.totalRevenue || perf.total_revenue || 0;
        const performanceDate = perf.date || perf.performance_date?.value || perf.performance_date;

        const occupancy = capacity > 0 ? ((singleTickets + subscriptionTickets) / capacity * 100).toFixed(1) : 0;

        container.innerHTML = `
            <div class="performance-details">
                <div class="detail-header">
                    <h3>${perf.title || 'Untitled Performance'}</h3>
                    <p class="detail-date">${performanceDate ? new Date(performanceDate).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    }) : 'Date not available'}</p>
                </div>
                <div class="detail-grid">
                    <div class="detail-section">
                        <h4>Ticket Sales</h4>
                        <div class="detail-item">
                            <span class="detail-label">Single Tickets:</span>
                            <span class="detail-value">${singleTickets.toLocaleString()}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Subscription Tickets:</span>
                            <span class="detail-value">${subscriptionTickets.toLocaleString()}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Total Sold:</span>
                            <span class="detail-value">${(singleTickets + subscriptionTickets).toLocaleString()}</span>
                        </div>
                    </div>
                    <div class="detail-section">
                        <h4>Performance Metrics</h4>
                        <div class="detail-item">
                            <span class="detail-label">Capacity:</span>
                            <span class="detail-value">${capacity > 0 ? capacity.toLocaleString() : 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Occupancy:</span>
                            <span class="detail-value">${occupancy}%</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Total Revenue:</span>
                            <span class="detail-value">${this.formatCurrency(totalRevenue)}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add styles for the details view
        this.addDetailStyles();
    }

    addDetailStyles() {
        if (document.getElementById('detail-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'detail-styles';
        styles.textContent = `
            .performance-details {
                max-width: 800px;
                margin: 0 auto;
            }
            .detail-header {
                text-align: center;
                margin-bottom: 2rem;
                padding-bottom: 1rem;
                border-bottom: 1px solid var(--border-color);
            }
            .detail-header h3 {
                font-size: 1.5rem;
                color: var(--text-primary);
                margin-bottom: 0.5rem;
            }
            .detail-date {
                color: var(--text-secondary);
                font-size: 1.1rem;
            }
            .detail-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 2rem;
            }
            .detail-section h4 {
                color: var(--primary-color);
                margin-bottom: 1rem;
                font-size: 1.2rem;
            }
            .detail-item {
                display: flex;
                justify-content: space-between;
                padding: 0.5rem 0;
                border-bottom: 1px solid var(--border-color);
            }
            .detail-label {
                color: var(--text-secondary);
            }
            .detail-value {
                font-weight: 600;
                color: var(--text-primary);
            }
            @media (max-width: 768px) {
                .detail-grid {
                    grid-template-columns: 1fr;
                    gap: 1rem;
                }
            }
        `;
        document.head.appendChild(styles);
    }

    /**
     * Show performance details and update URL
     */
    showPerformanceDetails(performance) {
        this.selectedPerformance = performance;
        this.log('debug', 'Performance selected for details', performance);

        // Update URL to reflect current performance
        const code = performance.performanceCode || performance.performance_code;
        if (code && window.router) {
            window.history.pushState({}, '', `/performance/${code}`);
        }

        // Update the details panel
        const detailsContainer = document.getElementById('performance-details');
        if (detailsContainer) {
            this.renderPerformanceDetailsPanel(detailsContainer);
        }
    }

    /**
     * Show performance details WITHOUT updating URL (used by router)
     */
    showPerformanceDetailsSilent(performance) {
        this.selectedPerformance = performance;
        this.log('debug', 'Performance selected for details (silent)', performance);

        // Open the modal to show performance details
        this.expandChart('details');
    }

    renderPerformanceDetailsPanel(container) {
        if (!this.selectedPerformance) {
            container.innerHTML = '<div class="details-placeholder">Click on a performance above to see details</div>';
            return;
        }

        const perf = this.selectedPerformance;
        const occupancy = ((perf.singleTicketsSold + perf.subscriptionTicketsSold) / perf.capacity * 100).toFixed(1);

        container.innerHTML = `
            <div class="mini-details">
                <h4>${perf.title}</h4>
                <div class="mini-detail-item">
                    <strong>Date:</strong> ${new Date(perf.date).toLocaleDateString()}
                </div>
                <div class="mini-detail-item">
                    <strong>Occupancy:</strong> ${occupancy}%
                </div>
                <div class="mini-detail-item">
                    <strong>Revenue:</strong> ${this.formatCurrency(perf.totalRevenue || 0)}
                </div>
                <button class="control-button primary" onclick="window.dashboardUI.expandChart('details')" style="margin-top: 1rem; width: 100%;">
                    View Full Details
                </button>
            </div>
        `;
    }

    /**
     * Close modal and navigate to home URL
     */
    closeModal() {
        this.log('debug', 'Closing modal, returning to overview');

        // Navigate to home (this will trigger closeModalSilent via router)
        if (window.router) {
            window.router.navigate('/');
        } else {
            this.closeModalSilent();
        }
    }

    /**
     * Close modal WITHOUT changing URL (used by router)
     */
    closeModalSilent() {
        this.log('debug', 'Closing modal silently');

        const modalView = document.getElementById('detailed-view');
        if (modalView) {
            modalView.style.display = 'none';
            modalView.classList.remove('active');
        }

        // Reset to data-table
        this.currentView = 'data-table';

        // Ensure data-table is visible
        const dataTableView = document.getElementById('data-table-view');
        if (dataTableView) {
            dataTableView.classList.add('active');
        }

        // Clear selected performance
        this.selectedPerformance = null;
    }

    async initializeTableView() {
        // Initialize data table directly
        if (window.DataTable) {
            this.dataTable = new window.DataTable();
            await this.dataTable.init();

            // Make it globally available for route handlers
            window.dataTable = this.dataTable;

            // Initialize executive dashboard with the data
            if (window.ExecutiveDashboard && this.dataTable.data) {
                this.log('info', 'Initializing Executive Dashboard');
                this.executiveDashboard = new window.ExecutiveDashboard();
                await this.executiveDashboard.init({
                    performances: this.dataTable.data,
                    weekOverWeek: this.dataTable.weekOverWeekData || {}
                });
                this.log('info', 'Executive Dashboard initialized');
            }
        } else if (window.symphonyApp) {
            // Fallback to app method
            await window.symphonyApp.initializeDataTable();
        }
    }

    filterTable(searchTerm) {
        // This will be implemented when the data table is updated
        this.log('debug', `Filtering table with term: ${searchTerm}`);
    }

    async refreshDashboard() {
        this.log('info', 'Refreshing dashboard data');

        try {
            // Show loading state
            this.showLoadingState();

            // Refresh data through the main app
            if (window.symphonyApp) {
                await window.symphonyApp.refreshData();
            }

            // Update KPIs
            await this.updateKPIs();

            // Hide loading state
            this.hideLoadingState();

            this.log('info', 'Dashboard refreshed successfully');
        } catch (error) {
            this.hideLoadingState();
            this.handleError(error, 'Dashboard Refresh');
        }
    }

    showLoadingState() {
        // Add loading indicators to KPI cards
        document.querySelectorAll('.kpi-value').forEach(el => {
            el.textContent = '...';
        });
    }

    hideLoadingState() {
        // Remove loading indicators - KPIs will be updated by updateKPIs()
    }


    getDataService() {
        // Try multiple ways to get the data service
        if (window.symphonyApp?.getDataService) {
            return window.symphonyApp.getDataService();
        }
        if (window.dataService) {
            return window.dataService;
        }

        // Fallback: create a simple data service instance
        this.log('warn', 'No data service found, creating fallback');
        return new (window.DataService || class {
            async getPerformances() {
                console.log('Using fallback mock data service');
                // Return comprehensive mock data for demo
                return [
                    {
                        id: 'fallback-001',
                        title: "Beethoven's 9th Symphony",
                        date: '2024-03-15',
                        capacity: 2500,
                        singleTicketsSold: 1200,
                        subscriptionTicketsSold: 800,
                        totalRevenue: 95000,
                        occupancyGoal: 90,
                        budgetGoal: 120000
                    },
                    {
                        id: 'fallback-002',
                        title: "Mozart Piano Concerto No. 21",
                        date: '2024-03-22',
                        capacity: 1200,
                        singleTicketsSold: 600,
                        subscriptionTicketsSold: 400,
                        totalRevenue: 58000,
                        occupancyGoal: 85,
                        budgetGoal: 70000
                    },
                    {
                        id: 'fallback-003',
                        title: "Brahms Symphony No. 4",
                        date: '2024-04-05',
                        capacity: 2500,
                        singleTicketsSold: 1100,
                        subscriptionTicketsSold: 750,
                        totalRevenue: 87000,
                        occupancyGoal: 88,
                        budgetGoal: 110000
                    },
                    {
                        id: 'fallback-004',
                        title: "Handel's Messiah",
                        date: '2024-12-20',
                        capacity: 2500,
                        singleTicketsSold: 1850,
                        subscriptionTicketsSold: 500,
                        totalRevenue: 125000,
                        occupancyGoal: 95,
                        budgetGoal: 130000
                    }
                ];
            }
        })();
    }

    updateControlsForView(viewName) {
        // Show/hide controls based on current view
        const curveModelGroup = document.querySelector('[for="curve-model"]')?.parentElement;

        if (curveModelGroup) {
            // Show curve model selector only for views that use charts
            curveModelGroup.style.display =
                (viewName === 'overview' || viewName === 'detailed') ? 'flex' : 'none';
        }

        // Add visual indicator for active view
        const dashboardControls = document.querySelector('.dashboard-controls');
        if (dashboardControls) {
            dashboardControls.setAttribute('data-view', viewName);
        }
    }

    // Debug method
    getDebugInfo() {
        return {
            ...super.getDebugInfo(),
            currentView: this.currentView,
            currentCurveModel: this.currentCurveModel,
            selectedPerformance: this.selectedPerformance?.id,
            kpiData: this.kpiData
        };
    }
}

// Create global instance
const dashboardUI = new DashboardUI();

// Export for global access
if (typeof window !== 'undefined') {
    window.dashboardUI = dashboardUI;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DashboardUI;
}
// Tab switching for Single Tickets / Subscriptions
DashboardUI.prototype.setupTabSwitching = function() {
    const tabButtons = document.querySelectorAll('.dashboard-tabs .tab-btn');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            this.switchDashboardTab(tabName);
        });
    });
};

DashboardUI.prototype.switchDashboardTab = function(tabName, updateUrl = true) {
    // Update button states
    document.querySelectorAll('.dashboard-tabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-tab') === tabName) {
            btn.classList.add('active');
        }
    });

    // Update view visibility
    document.querySelectorAll('.tab-content').forEach(view => {
        view.classList.remove('active');
        view.style.display = 'none';
    });

    const targetView = document.getElementById(`${tabName}-view`);
    if (targetView) {
        targetView.classList.add('active');
        targetView.style.display = 'block';
    }

    // Update URL without reload
    if (updateUrl) {
        const url = tabName === 'subscriptions' ? '/subscriptions' : '/';
        window.history.pushState({ tab: tabName }, '', url);
    }

    // Initialize subscription table if switching to subscriptions tab (lazy load)
    if (tabName === 'subscriptions' && !window.subscriptionTable) {
        this.initializeSubscriptionTable();
    }
};

DashboardUI.prototype.initializeSubscriptionTable = async function() {
    if (window.SubscriptionTable) {
        this.log('info', 'Initializing Subscription Table');
        window.subscriptionTable = new window.SubscriptionTable('subscription-table');
        await window.subscriptionTable.init();
        this.log('info', 'Subscription Table initialized');
    }
};

// Detect initial tab from URL path
DashboardUI.prototype.detectInitialTab = function() {
    const path = window.location.pathname;
    if (path === '/subscriptions') {
        return 'subscriptions';
    }
    return 'single-tickets';
};

// Initialize tab switching after DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (window.dashboardUI) {
            window.dashboardUI.setupTabSwitching();
            const initialTab = window.dashboardUI.detectInitialTab();
            if (initialTab !== 'single-tickets') {
                window.dashboardUI.switchDashboardTab(initialTab, false);
            }
        }
    });
} else {
    setTimeout(() => {
        if (window.dashboardUI) {
            window.dashboardUI.setupTabSwitching();
            const initialTab = window.dashboardUI.detectInitialTab();
            if (initialTab !== 'single-tickets') {
                window.dashboardUI.switchDashboardTab(initialTab, false);
            }
        }
    }, 100);
}

// Handle browser back/forward
window.addEventListener('popstate', (event) => {
    if (window.dashboardUI) {
        const tab = event.state?.tab || window.dashboardUI.detectInitialTab();
        window.dashboardUI.switchDashboardTab(tab, false);
    }
});
