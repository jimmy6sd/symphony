/**
 * Main Symphony Dashboard Application
 * Coordinates all components and manages the application lifecycle
 */
class SymphonyApp {
    constructor() {
        this.initialized = false;
        this.components = new Map();
        this.services = new Map();
        this.currentTab = 'charts';

        // Application state
        this.state = {
            authenticated: false,
            user: null,
            data: null,
            loading: false,
            error: null
        };

        // Setup error handling
        this.setupErrorHandling();
    }

    setupErrorHandling() {
        // Handle uncaught errors globally
        window.addEventListener('error', (event) => {
            this.handleError(event.error, 'Global Error');
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.handleError(event.reason, 'Unhandled Promise Rejection');
        });
    }

    async init() {
        if (this.initialized) {
            return this;
        }

        try {
            this.log('info', 'Initializing Symphony Dashboard Application');

            // Initialize core utilities first
            await this.initializeUtilities();

            // Check authentication
            await this.checkAuthentication();

            // Initialize services
            await this.initializeServices();

            // Initialize UI components
            await this.initializeComponents();

            // Setup application-level event listeners
            this.setupEventListeners();

            this.initialized = true;
            this.log('info', 'Symphony Dashboard Application initialized successfully');

            return this;
        } catch (error) {
            this.handleError(error, 'Application Initialization');
            throw error;
        }
    }

    async initializeUtilities() {
        // Load utilities if not already loaded
        if (!window.logger) {
            await this.loadScript('/src/utils/logger.js');
        }

        if (!window.errorHandler) {
            await this.loadScript('/src/utils/error-handler.js');
        }

        if (!window.Validators) {
            await this.loadScript('/src/utils/validators.js');
        }

        this.log('debug', 'Utilities initialized');
    }

    async checkAuthentication() {
        if (!window.authManager) {
            this.log('error', 'Authentication manager not found');
            return false;
        }

        const isAuthenticated = window.authManager.isAuthenticated();
        if (!isAuthenticated) {
            this.log('warn', 'User not authenticated, redirecting to login');
            window.location.href = '/login.html';
            return false;
        }

        this.setState({
            authenticated: true,
            user: window.authManager.getCurrentUser()
        });

        this.log('info', 'User authentication verified');
        return true;
    }

    async initializeServices() {
        this.log('debug', 'Initializing services');

        // Data service
        if (window.dataService) {
            this.services.set('data', window.dataService);
        }

        // Other services can be added here
        this.log('debug', 'Services initialized');
    }

    async initializeComponents() {
        this.log('debug', 'Initializing UI components');

        try {
            // Check if we're using the new dashboard UI
            if (window.dashboardUI) {
                this.log('debug', 'New Dashboard UI detected, letting it handle initialization');
                // The new dashboard UI handles its own initialization
                return;
            }

            // Fallback to legacy tab system if new UI not available
            this.initializeTabs();

            // Initialize charts
            await this.initializeCharts();

            this.log('debug', 'UI components initialized');
        } catch (error) {
            this.handleError(error, 'Component Initialization');
        }
    }

    initializeTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        if (tabButtons.length === 0) {
            this.log('warn', 'No tab buttons found');
            return;
        }

        tabButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                const tabName = button.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });

        this.log('debug', 'Tab system initialized');
    }

    async initializeCharts() {
        try {
            // Set loading state
            this.setState({ loading: true });

            // Performance Chart
            if (window.PerformanceChart) {
                const performanceChart = new window.PerformanceChart('performance-chart');
                await performanceChart.init();
                this.components.set('performanceChart', performanceChart);
            }

            // Sales Curve Chart
            if (window.SalesCurveChart) {
                const salesCurveChart = new window.SalesCurveChart('sales-curve-chart');
                await salesCurveChart.init();
                this.components.set('salesCurveChart', salesCurveChart);
            }

            // Ticket Type Chart
            if (window.TicketTypeChart) {
                const ticketTypeChart = new window.TicketTypeChart('ticket-type-chart');
                await ticketTypeChart.init();
                this.components.set('ticketTypeChart', ticketTypeChart);
            }

            this.setState({ loading: false });
            this.log('info', 'Charts initialized successfully');
        } catch (error) {
            this.setState({ loading: false, error: error.message });
            this.handleError(error, 'Charts Initialization');
        }
    }

    async initializeDataTable() {
        if (this.components.has('dataTable')) {
            return this.components.get('dataTable');
        }

        try {
            this.log('debug', 'Initializing data table');

            if (!window.dataTable) {
                this.log('warn', 'DataTable class not found');
                return null;
            }

            const dataTableInstance = window.dataTable.create('data-table');
            const performances = await this.getDataService().getPerformances();
            dataTableInstance.updateData(performances);

            this.components.set('dataTable', dataTableInstance);
            this.log('debug', 'Data table initialized successfully');

            return dataTableInstance;
        } catch (error) {
            this.handleError(error, 'Data Table Initialization');
            return null;
        }
    }

    switchTab(tabName) {
        if (this.currentTab === tabName) {
            return;
        }

        this.log('debug', `Switching tab from ${this.currentTab} to ${tabName}`);

        // Update UI
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-tab') === tabName) {
                btn.classList.add('active');
            }
        });

        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        const targetContent = document.getElementById(`${tabName}-view`);
        if (targetContent) {
            targetContent.classList.add('active');
        }

        this.currentTab = tabName;

        // Initialize data table if switching to table view
        if (tabName === 'table' && !this.components.has('dataTable')) {
            this.initializeDataTable();
        }

        // Emit tab change event
        this.emit('tabChange', { from: this.currentTab, to: tabName });
    }

    setupEventListeners() {
        // Window resize handler
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.handleResize();
            }, 250);
        });

        // Page visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.handlePageVisible();
            }
        });

        this.log('debug', 'Application event listeners setup');
    }

    handleResize() {
        this.log('debug', 'Handling window resize');

        // Refresh charts to adapt to new dimensions
        this.components.forEach((component, name) => {
            if (component && typeof component.render === 'function') {
                try {
                    component.render();
                } catch (error) {
                    this.log('warn', `Failed to refresh component ${name} on resize:`, error);
                }
            }
        });
    }

    handlePageVisible() {
        this.log('debug', 'Page became visible, checking authentication');

        // Re-verify authentication when page becomes visible
        if (window.authManager && !window.authManager.isAuthenticated()) {
            this.log('warn', 'Authentication expired, redirecting to login');
            window.location.href = '/login.html';
        }
    }

    async refreshData() {
        if (!this.initialized) {
            this.log('warn', 'Cannot refresh data: application not initialized');
            return;
        }

        try {
            this.setState({ loading: true, error: null });
            this.log('info', 'Refreshing dashboard data');

            // Refresh all charts
            const chartPromises = [];

            this.components.forEach((component, name) => {
                if (component && typeof component.init === 'function') {
                    chartPromises.push(
                        component.init().catch(error => {
                            this.log('warn', `Failed to refresh component ${name}:`, error);
                        })
                    );
                }
            });

            await Promise.allSettled(chartPromises);

            // Refresh data table if it exists
            if (this.components.has('dataTable')) {
                const performances = await this.getDataService().getPerformances();
                this.components.get('dataTable').updateData(performances);
            }

            this.setState({ loading: false });
            this.log('info', 'Dashboard data refreshed successfully');
        } catch (error) {
            this.setState({ loading: false, error: error.message });
            this.handleError(error, 'Data Refresh');
        }
    }

    // Utility methods
    getDataService() {
        return this.services.get('data') || window.dataService;
    }

    setState(newState) {
        const oldState = { ...this.state };
        this.state = { ...this.state, ...newState };
        this.emit('stateChange', { oldState, newState: this.state });
    }

    getState() {
        return { ...this.state };
    }

    // Event system
    on(event, callback) {
        if (!this.events) {
            this.events = new Map();
        }
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event).push(callback);
    }

    emit(event, data) {
        if (this.events && this.events.has(event)) {
            this.events.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    this.log('error', `Event callback error for "${event}":`, error);
                }
            });
        }
    }

    handleError(error, context = 'Application') {
        if (window.errorHandler) {
            return window.errorHandler.handleError(error, context);
        } else {
            console.error(`${context} Error:`, error);
            this.setState({ error: error.message });
        }
    }

    log(level, message, ...args) {
        if (window.logger) {
            window.logger[level](`[SymphonyApp] ${message}`, ...args);
        } else {
            console[level](`[SymphonyApp] ${message}`, ...args);
        }
    }

    async loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // Public API methods
    async exportData(format = 'json') {
        try {
            const data = {
                performances: await this.getDataService().getPerformances(),
                summary: await this.getDataService().getSalesSummary(),
                user: this.state.user,
                exportDate: new Date().toISOString()
            };

            if (format === 'json') {
                const dataStr = JSON.stringify(data, null, 2);
                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(dataBlob);

                const link = document.createElement('a');
                link.href = url;
                link.download = `symphony-dashboard-${new Date().toISOString().split('T')[0]}.json`;
                link.click();

                URL.revokeObjectURL(url);
            }
        } catch (error) {
            this.handleError(error, 'Data Export');
        }
    }

    getDebugInfo() {
        return {
            initialized: this.initialized,
            state: this.state,
            currentTab: this.currentTab,
            components: Array.from(this.components.keys()),
            services: Array.from(this.services.keys())
        };
    }
}

// Export for global use
if (typeof window !== 'undefined') {
    window.SymphonyApp = SymphonyApp;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SymphonyApp;
}