class TessituraAPI {
    constructor() {
        this.config = tessituraConfig;
        this.cache = new Map();
        this.requestQueue = [];
        this.isProcessingQueue = false;
        this.rateLimitState = {
            requests: 0,
            resetTime: Date.now() + 60000
        };
    }

    // Main method to fetch performance data
    async fetchPerformances(filters = {}) {
        try {
            const cacheKey = `performances_${JSON.stringify(filters)}`;

            // Check cache first
            if (this.isCacheValid(cacheKey)) {
                console.log('Returning cached performance data');
                return this.cache.get(cacheKey).data;
            }

            const url = this.config.buildUrl(this.config.getConfig().endpoints.performanceSearch);
            const queryParams = this.buildQueryString(filters);
            const fullUrl = queryParams ? `${url}?${queryParams}` : url;

            const response = await this.makeRequest(fullUrl);
            const data = await response.json();

            // Transform Tessitura data to our format
            const transformedData = this.transformPerformanceData(data);

            // Cache the result
            this.setCache(cacheKey, transformedData);

            return transformedData;
        } catch (error) {
            console.error('Error fetching performances from Tessitura:', error);
            throw new Error(`Failed to fetch performances: ${error.message}`);
        }
    }

    // Fetch detailed sales data for a specific performance
    async fetchPerformanceSales(performanceId, includeHistory = true) {
        try {
            const cacheKey = `sales_${performanceId}_${includeHistory}`;

            if (this.isCacheValid(cacheKey)) {
                return this.cache.get(cacheKey).data;
            }

            // Fetch current sales
            const salesUrl = this.config.buildUrl(
                this.config.getConfig().endpoints.salesByPerformance,
                { id: performanceId }
            );

            // Fetch historical data if requested
            const promises = [this.makeRequest(salesUrl)];

            if (includeHistory) {
                const historyUrl = this.config.buildUrl(
                    this.config.getConfig().endpoints.salesHistory,
                    { performance_id: performanceId }
                );
                promises.push(this.makeRequest(historyUrl));
            }

            const responses = await Promise.all(promises);
            const salesData = await responses[0].json();
            const historyData = includeHistory ? await responses[1].json() : null;

            // Transform and combine data
            const transformedData = this.transformSalesData(salesData, historyData);

            this.setCache(cacheKey, transformedData);
            return transformedData;
        } catch (error) {
            console.error('Error fetching sales data:', error);
            throw new Error(`Failed to fetch sales data: ${error.message}`);
        }
    }

    // Fetch revenue data
    async fetchRevenueData(performanceId = null) {
        try {
            const cacheKey = `revenue_${performanceId || 'all'}`;

            if (this.isCacheValid(cacheKey)) {
                return this.cache.get(cacheKey).data;
            }

            const endpoint = performanceId
                ? this.config.getConfig().endpoints.revenueByPerformance
                : this.config.getConfig().endpoints.revenueSummary;

            const url = this.config.buildUrl(endpoint, performanceId ? { id: performanceId } : {});
            const response = await this.makeRequest(url);
            const data = await response.json();

            const transformedData = this.transformRevenueData(data);
            this.setCache(cacheKey, transformedData);

            return transformedData;
        } catch (error) {
            console.error('Error fetching revenue data:', error);
            throw new Error(`Failed to fetch revenue data: ${error.message}`);
        }
    }

    // Core request method with rate limiting and retry logic
    async makeRequest(url, options = {}) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({
                url,
                options: {
                    method: 'GET',
                    headers: this.config.getAuthHeaders(),
                    ...options
                },
                resolve,
                reject,
                retries: 0
            });

            this.processQueue();
        });
    }

    async processQueue() {
        if (this.isProcessingQueue || this.requestQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        while (this.requestQueue.length > 0) {
            // Check rate limiting
            if (!this.canMakeRequest()) {
                await this.waitForRateLimit();
                continue;
            }

            const request = this.requestQueue.shift();

            try {
                const response = await fetch(request.url, request.options);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                this.updateRateLimit();
                request.resolve(response);
            } catch (error) {
                // Retry logic
                if (request.retries < this.config.getConfig().retryConfig.maxRetries) {
                    request.retries++;
                    const delay = this.config.getConfig().retryConfig.retryDelay *
                                Math.pow(this.config.getConfig().retryConfig.backoffMultiplier, request.retries - 1);

                    setTimeout(() => {
                        this.requestQueue.unshift(request);
                    }, delay);
                } else {
                    request.reject(error);
                }
            }
        }

        this.isProcessingQueue = false;
    }

    // Rate limiting helpers
    canMakeRequest() {
        const now = Date.now();
        const config = this.config.getConfig();

        if (now > this.rateLimitState.resetTime) {
            this.rateLimitState = {
                requests: 0,
                resetTime: now + config.rateLimiting.windowMs
            };
        }

        return this.rateLimitState.requests < config.rateLimiting.maxRequests;
    }

    updateRateLimit() {
        this.rateLimitState.requests++;
    }

    async waitForRateLimit() {
        const waitTime = this.rateLimitState.resetTime - Date.now();
        if (waitTime > 0) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }

    // Data transformation methods (Tessitura format -> Our format)
    transformPerformanceData(tessituraData) {
        // This will need to be customized based on actual Tessitura API response format
        return tessituraData.map(item => ({
            id: item.performance_id || item.id,
            title: item.performance_title || item.title,
            date: item.performance_date || item.date,
            venue: item.venue_name || item.venue,
            capacity: item.total_capacity || item.capacity,
            singleTicketsSold: item.single_tickets_sold || 0,
            subscriptionTicketsSold: item.subscription_tickets_sold || 0,
            totalRevenue: item.total_revenue || 0,
            occupancyGoal: item.occupancy_target || CONFIG.performances.defaultOccupancyGoal,
            budgetGoal: item.budget_target || CONFIG.performances.defaultBudgetGoal,
            weeklySales: this.transformWeeklySalesData(item.weekly_sales || [])
        }));
    }

    transformSalesData(salesData, historyData = null) {
        // Transform current sales data
        const transformed = {
            performanceId: salesData.performance_id,
            currentSales: {
                single: salesData.single_tickets || 0,
                subscription: salesData.subscription_tickets || 0,
                total: salesData.total_tickets || 0
            },
            revenue: {
                single: salesData.single_revenue || 0,
                subscription: salesData.subscription_revenue || 0,
                total: salesData.total_revenue || 0
            }
        };

        // Add historical data if available
        if (historyData) {
            transformed.weeklySales = this.transformWeeklySalesData(historyData);
        }

        return transformed;
    }

    transformWeeklySalesData(weeklyData) {
        // Transform weekly sales history into our expected format
        return weeklyData.map((week, index) => ({
            week: index + 1,
            actualSales: week.weekly_sales || 0,
            expectedSales: week.expected_sales || 0,
            actualCumulative: week.cumulative_sales || 0,
            expectedCumulative: week.expected_cumulative || 0
        }));
    }

    transformRevenueData(revenueData) {
        return {
            totalRevenue: revenueData.total_revenue || 0,
            singleTicketRevenue: revenueData.single_ticket_revenue || 0,
            subscriptionRevenue: revenueData.subscription_revenue || 0,
            averageTicketPrice: revenueData.average_ticket_price || 0
        };
    }

    // Cache management
    isCacheValid(key) {
        const config = this.config.getConfig();
        if (!config.cache.enabled) return false;

        const cached = this.cache.get(key);
        if (!cached) return false;

        return (Date.now() - cached.timestamp) < config.cache.duration;
    }

    setCache(key, data) {
        const config = this.config.getConfig();
        if (!config.cache.enabled) return;

        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    clearCache() {
        this.cache.clear();
    }

    // Note: Tessitura auth is handled via Basic Auth header, not query params

    // Utility methods
    buildQueryString(params) {
        const queryParts = [];

        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined) {
                queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`);
            }
        });

        return queryParts.length > 0 ? queryParts.join('&') : '';
    }

    // Test connectivity
    async testConnection() {
        return await this.config.testConnection();
    }
}

// Global instance
const tessituraAPI = new TessituraAPI();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TessituraAPI, tessituraAPI };
}