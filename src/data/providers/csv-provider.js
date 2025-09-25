/**
 * CSV Data Provider
 * Handles loading and processing CSV/JSON data files
 */

class CSVDataProvider extends SymphonyModule {
    constructor(framework) {
        super(framework);
        this.connected = false;
        this.dataUrl = './data/dashboard.json';
        this.capabilities = ['performances', 'sales'];
    }

    async init(config) {
        await super.init(config);

        // Register with data manager
        this.emit('provider:available', {
            name: 'csv',
            provider: this
        });

        this.log('debug', 'CSV Data Provider initialized');
    }

    /**
     * Connect to data source
     */
    async connect() {
        try {
            // Test connection by attempting to fetch data
            const response = await fetch(this.dataUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            this.connected = true;
            this.log('info', 'CSV Data Provider connected successfully');
            this.emit('provider:connected', { name: 'csv' });

        } catch (error) {
            this.connected = false;
            this.log('error', 'CSV Data Provider connection failed:', error);
            throw error;
        }
    }

    /**
     * Fetch data by type
     * @param {string} dataType - Type of data ('performances', 'sales')
     * @param {Object} options - Query options
     * @returns {*} Raw data
     */
    async fetch(dataType, options = {}) {
        if (!this.connected) {
            await this.connect();
        }

        switch (dataType) {
            case 'performances':
                return this.fetchPerformances(options);
            case 'sales':
                return this.fetchSales(options);
            default:
                throw new Error(`Unsupported data type: ${dataType}`);
        }
    }

    /**
     * Fetch performance data
     * @param {Object} options - Query options
     * @returns {Object} Performance data
     */
    async fetchPerformances(options = {}) {
        try {
            this.log('debug', 'Fetching performance data from CSV source');

            const response = await fetch(this.dataUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            // Apply filters if provided
            let performances = data.performances || data;
            if (Array.isArray(performances)) {
                performances = this.applyFilters(performances, options);
            } else if (data.performances) {
                // Handle KCS format with metadata
                return {
                    metadata: data.metadata,
                    performances: this.applyFilters(data.performances, options),
                    summary: data.summary
                };
            }

            this.log('debug', `Fetched ${performances.length} performances from CSV`);
            return performances;

        } catch (error) {
            this.log('error', 'Failed to fetch performance data:', error);
            throw error;
        }
    }

    /**
     * Fetch sales data for a specific performance
     * @param {Object} options - Query options with performanceId
     * @returns {Object} Sales data
     */
    async fetchSales(options = {}) {
        const { performanceId } = options;
        if (!performanceId) {
            throw new Error('Performance ID required for sales data');
        }

        try {
            // For CSV provider, sales data is embedded in performance data
            const performances = await this.fetchPerformances();
            const performanceList = Array.isArray(performances) ? performances : performances.performances;

            const performance = performanceList.find(p => p.id === performanceId);
            if (!performance) {
                throw new Error(`Performance not found: ${performanceId}`);
            }

            // Extract sales-related data from performance
            const salesData = {
                performanceId: performance.id,
                totalSold: (performance.actualTotalTicketsSold || 0) +
                          (performance.actualSingleTicketsSold || 0) +
                          (performance.actualSubTicketsSold || 0),
                singleTickets: performance.actualSingleTicketsSold || 0,
                subscriptionTickets: performance.actualSubTicketsSold || 0,
                revenue: performance.totalActualRevenue || 0,
                capacity: performance.maxCapacity || 0,
                occupancyPercent: performance.actualOccupancyPercent || 0,

                // Weekly progression data if available
                weeklySales: performance.weeklySales || this.generateMockWeeklySales(performance),

                // Budget information
                budget: performance.totalBudget || 0,
                budgetPercent: performance.actualVsBudgetPercent || 0,

                // Additional metrics
                averageTicketPrice: performance.averageTicketPrice || 0,
                newHouseholds: performance.newHouseholds || 0,
                returningHouseholds: performance.returningHouseholds || 0
            };

            this.log('debug', `Fetched sales data for performance ${performanceId}`);
            return salesData;

        } catch (error) {
            this.log('error', `Failed to fetch sales data for performance ${performanceId}:`, error);
            throw error;
        }
    }

    /**
     * Apply filters to data
     * @param {Array} data - Data to filter
     * @param {Object} options - Filter options
     * @returns {Array} Filtered data
     */
    applyFilters(data, options = {}) {
        let filtered = [...data];

        // Date range filter
        if (options.startDate || options.endDate) {
            filtered = filtered.filter(item => {
                const itemDate = new Date(item.performanceDate || item.date);
                if (options.startDate && itemDate < new Date(options.startDate)) return false;
                if (options.endDate && itemDate > new Date(options.endDate)) return false;
                return true;
            });
        }

        // Series filter
        if (options.series) {
            filtered = filtered.filter(item =>
                (item.performanceType || item.series) === options.series
            );
        }

        // Venue filter
        if (options.venue) {
            filtered = filtered.filter(item =>
                (item.venue || '').includes(options.venue)
            );
        }

        // Season filter
        if (options.season) {
            filtered = filtered.filter(item =>
                (item.season || '').includes(options.season)
            );
        }

        // Limit results
        if (options.limit) {
            filtered = filtered.slice(0, options.limit);
        }

        return filtered;
    }

    /**
     * Generate mock weekly sales progression for performance
     * @param {Object} performance - Performance data
     * @returns {Array} Weekly sales data
     */
    generateMockWeeklySales(performance) {
        const totalSold = (performance.actualTotalTicketsSold || 0) +
                         (performance.actualSingleTicketsSold || 0) +
                         (performance.actualSubTicketsSold || 0);

        if (totalSold === 0) return [];

        // Create realistic sales progression over 6 weeks
        const progression = [0.1, 0.25, 0.45, 0.65, 0.85, 1.0];
        const weeklySales = [];

        for (let i = 0; i < progression.length; i++) {
            const weekSales = Math.floor(totalSold * progression[i]);
            const weeklyIncrease = i === 0 ? weekSales : weekSales - weeklySales[i - 1].cumulative;

            weeklySales.push({
                week: i + 1,
                weeksSince: i,
                weeksUntil: 5 - i,
                sold: weeklyIncrease,
                cumulative: weekSales,
                percentage: (weekSales / totalSold) * 100
            });
        }

        return weeklySales;
    }

    /**
     * Get provider capabilities
     * @returns {Array} List of capabilities
     */
    getCapabilities() {
        return [...this.capabilities];
    }

    /**
     * Test connection to data source
     * @returns {Object} Connection test results
     */
    async testConnection() {
        try {
            const startTime = Date.now();
            await this.connect();
            const duration = Date.now() - startTime;

            return {
                success: true,
                duration,
                message: 'CSV data source accessible'
            };
        } catch (error) {
            return {
                success: false,
                duration: 0,
                message: error.message,
                error: error
            };
        }
    }

    /**
     * Get data source information
     * @returns {Object} Data source info
     */
    getInfo() {
        return {
            name: 'CSV Data Provider',
            type: 'csv',
            url: this.dataUrl,
            connected: this.connected,
            capabilities: this.capabilities,
            description: 'Loads performance and sales data from JSON/CSV files'
        };
    }

    /**
     * Disconnect from data source
     */
    async disconnect() {
        this.connected = false;
        this.emit('provider:disconnected', { name: 'csv' });
        this.log('debug', 'CSV Data Provider disconnected');
    }
}

// Export for use in framework
window.CSVDataProvider = CSVDataProvider;