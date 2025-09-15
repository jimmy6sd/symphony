class SymphonyDashboard {
    constructor() {
        this.performanceChart = null;
        this.salesCurveChart = null;
        this.ticketTypeChart = null;
        this.dataTable = null;
        this.initialized = false;
        this.currentTab = 'charts';
    }

    async init() {
        try {
            this.showLoading();
            this.initializeTabs();
            await this.initializeComponents();
            this.hideLoading();
            this.initialized = true;
            console.log('Symphony Dashboard initialized successfully');
        } catch (error) {
            this.showError('Failed to initialize dashboard: ' + error.message);
            console.error('Dashboard initialization error:', error);
        }
    }

    initializeTabs() {
        // Set up tab functionality
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });
    }

    switchTab(tabName) {
        // Update active tab button
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-tab') === tabName) {
                btn.classList.add('active');
            }
        });

        // Update active tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-view`).classList.add('active');

        this.currentTab = tabName;

        // Initialize data table if switching to table view for the first time
        if (tabName === 'table' && !this.dataTable) {
            this.initializeDataTable();
        }
    }

    async initializeComponents() {
        // Initialize charts first (always needed)
        await this.initializeCharts();
    }

    async initializeCharts() {
        // Initialize all charts
        this.performanceChart = new PerformanceChart('performance-chart');
        this.salesCurveChart = new SalesCurveChart('sales-curve-chart');
        this.ticketTypeChart = new TicketTypeChart('ticket-type-chart');

        // Initialize charts in parallel for better performance
        await Promise.all([
            this.performanceChart.init(),
            this.salesCurveChart.init(),
            this.ticketTypeChart.init()
        ]);
    }

    async initializeDataTable() {
        try {
            console.log('Initializing data table...');

            // Create data table instance
            this.dataTable = dataTable.create('data-table');

            // Load data for the table
            const performances = await dataService.getPerformances();
            this.dataTable.updateData(performances);

            console.log('Data table initialized successfully');
        } catch (error) {
            console.error('Error initializing data table:', error);
        }
    }

    showLoading() {
        const loadingHtml = '<div class="loading"></div>';
        document.getElementById('performance-chart').innerHTML = loadingHtml;
        document.getElementById('sales-curve-chart').innerHTML = loadingHtml;
        document.getElementById('ticket-type-chart').innerHTML = loadingHtml;
    }

    hideLoading() {
        // Loading content will be replaced by chart rendering
        console.log('Charts loaded successfully');
    }

    showError(message) {
        const errorHtml = `<div class="error">${message}</div>`;
        document.getElementById('performance-chart').innerHTML = errorHtml;
        document.getElementById('sales-curve-chart').innerHTML = errorHtml;
        document.getElementById('ticket-type-chart').innerHTML = errorHtml;
    }

    async refreshData() {
        if (!this.initialized) {
            console.warn('Dashboard not initialized yet');
            return;
        }

        try {
            console.log('Refreshing dashboard data...');

            // Refresh charts
            await this.initializeCharts();

            // Refresh data table if it's initialized
            if (this.dataTable) {
                const performances = await dataService.getPerformances();
                this.dataTable.updateData(performances);
            }

            console.log('Dashboard data refreshed successfully');
        } catch (error) {
            console.error('Error refreshing dashboard:', error);
            this.showError('Failed to refresh data: ' + error.message);
        }
    }

    // Method to update configuration and refresh
    updateConfig(newConfig) {
        Object.assign(CONFIG, newConfig);
        this.refreshData();
    }

    // Method to switch between mock and live data
    toggleDataSource(useMockData = true) {
        CONFIG.api.mockDataEnabled = useMockData;
        this.refreshData();
    }

    // Utility method to export dashboard data (for future use)
    async exportData(format = 'json') {
        try {
            const data = {
                performances: await dataService.getPerformances(),
                summary: await dataService.getSalesSummary(),
                config: CONFIG,
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
            console.error('Error exporting data:', error);
        }
    }

    // Method to resize charts on window resize
    handleResize() {
        if (!this.initialized) return;

        // Debounce resize to avoid too many redraws
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            this.refreshData();
        }, 250);
    }
}

// Global dashboard instance
let dashboard;

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    dashboard = new SymphonyDashboard();
    await dashboard.init();

    // Auto-refresh has been disabled
});

// Handle window resize
window.addEventListener('resize', () => {
    if (dashboard) {
        dashboard.handleResize();
    }
});

// Global functions for debugging and development
window.symphonyDashboard = {
    refresh: () => dashboard?.refreshData(),
    toggleMockData: (useMock) => dashboard?.toggleDataSource(useMock),
    exportData: (format) => dashboard?.exportData(format),
    getConfig: () => CONFIG,
    updateConfig: (newConfig) => dashboard?.updateConfig(newConfig)
};