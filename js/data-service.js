class DataService {
    constructor() {
        this.mockDataEnabled = CONFIG.api.mockDataEnabled;
    }

    // Generate mock performance data
    generateMockPerformances() {
        const performances = [
            {
                id: "perf-001",
                title: "Beethoven's 9th Symphony",
                date: "2024-03-15",
                venue: "Main Hall",
                capacity: 2500,
                singleTicketsSold: 1200,
                subscriptionTicketsSold: 800,
                totalRevenue: 95000,
                occupancyGoal: 90,
                budgetGoal: 120000,
                weeklySales: this.generateWeeklySales(2000, 10)
            },
            {
                id: "perf-002",
                title: "Mozart Piano Concerto No. 21",
                date: "2024-03-22",
                venue: "Chamber Hall",
                capacity: 1200,
                singleTicketsSold: 600,
                subscriptionTicketsSold: 400,
                totalRevenue: 58000,
                occupancyGoal: 85,
                budgetGoal: 70000,
                weeklySales: this.generateWeeklySales(1000, 10)
            },
            {
                id: "perf-003",
                title: "Brahms Symphony No. 4",
                date: "2024-04-05",
                venue: "Main Hall",
                capacity: 2500,
                singleTicketsSold: 900,
                subscriptionTicketsSold: 600,
                totalRevenue: 82000,
                occupancyGoal: 88,
                budgetGoal: 110000,
                weeklySales: this.generateWeeklySales(1500, 8) // Only 8 weeks out
            },
            {
                id: "perf-004",
                title: "Tchaikovsky's Swan Lake Suite",
                date: "2024-04-12",
                venue: "Main Hall",
                capacity: 2500,
                singleTicketsSold: 450,
                subscriptionTicketsSold: 350,
                totalRevenue: 42000,
                occupancyGoal: 92,
                budgetGoal: 125000,
                weeklySales: this.generateWeeklySales(800, 6) // Only 6 weeks out
            }
        ];

        return performances;
    }

    // Generate weekly sales data for sales curve visualization
    generateWeeklySales(targetTotal, weeksOut) {
        // Get the current sales curve model from config
        const curveModel = window.appConfig?.get('salesCurve.defaultModel', 'expectedProgression');
        const salesCurve = window.appConfig?.get(`salesCurve.${curveModel}`) ||
                          CONFIG.salesCurve.expectedSalesProgression;
        const weeklySales = [];

        // Add some variance to make it more realistic
        for (let week = 1; week <= weeksOut; week++) {
            const expectedPercentage = this.getExpectedPercentageAtWeek(week, salesCurve);
            const actualPercentage = expectedPercentage + (Math.random() - 0.5) * 10; // +/- 5% variance

            const actualSales = Math.max(0, Math.floor(targetTotal * (actualPercentage / 100)));
            const expectedSales = Math.floor(targetTotal * (expectedPercentage / 100));

            weeklySales.push({
                week: week,
                actualSales: actualSales,
                expectedSales: expectedSales,
                actualCumulative: actualSales,
                expectedCumulative: expectedSales
            });
        }

        // Calculate cumulative totals
        let actualCumulative = 0;
        let expectedCumulative = 0;

        weeklySales.forEach(weekData => {
            actualCumulative += weekData.actualSales;
            expectedCumulative += weekData.expectedSales;
            weekData.actualCumulative = actualCumulative;
            weekData.expectedCumulative = expectedCumulative;
        });

        return weeklySales;
    }

    // Helper to get expected percentage at a specific week
    getExpectedPercentageAtWeek(week, salesCurve) {
        const dataPoint = salesCurve.find(point => point.week === week);
        if (dataPoint) {
            return dataPoint.percentage;
        }

        // Interpolate if exact week not found
        const lowerPoint = salesCurve.filter(point => point.week < week).pop();
        const upperPoint = salesCurve.find(point => point.week > week);

        if (!lowerPoint) return salesCurve[0].percentage;
        if (!upperPoint) return salesCurve[salesCurve.length - 1].percentage;

        const ratio = (week - lowerPoint.week) / (upperPoint.week - lowerPoint.week);
        return lowerPoint.percentage + ratio * (upperPoint.percentage - lowerPoint.percentage);
    }

    // Main method to get performance data
    async getPerformances() {
        // Check if we should use mock data
        const shouldUseMockData = CONFIG?.api?.mockDataEnabled ||
                                 window.appConfig?.get('api.mockDataEnabled', false);

        console.log('🔍 DataService Debug Info:');
        console.log('  - CONFIG.api.mockDataEnabled:', CONFIG?.api?.mockDataEnabled);
        console.log('  - appConfig mockDataEnabled:', window.appConfig?.get('api.mockDataEnabled', false));
        console.log('  - shouldUseMockData:', shouldUseMockData);
        console.log('  - authManager available:', !!window.authManager);
        console.log('  - authManager authenticated:', window.authManager?.isAuthenticated());

        if (shouldUseMockData) {
            console.log('🔒 Using mock data for development');
            return this.generateMockPerformances();
        } else {
            console.log('📊 Loading real Tessitura data from secure API');
            const result = await this.loadDashboardData();
            console.log('  - API result length:', result?.length || 0);
            return result;
        }
    }

    // Load dashboard data from authenticated API
    async loadDashboardData() {
        try {
            console.log('📊 Loading dashboard data from authenticated API...');

            // Check if authManager is available
            if (typeof window.authManager === 'undefined') {
                throw new Error('Authentication manager not available');
            }

            // Make authenticated API request
            const data = await window.authManager.apiRequest('/.netlify/functions/dashboard-data');

            const performances = data.performances;

            return performances || [];
        } catch (error) {
            console.error('⚠️ Could not load dashboard data from API:', error.message);

            // Try fallback to local files for development
            return await this.loadLocalFallback();
        }
    }

    // Fallback to local files for development
    async loadLocalFallback() {
        try {
            console.log('📊 Attempting to load from local files as fallback...');

            const response = await fetch('./data/final-performances-in-range.json');
            if (!response.ok) {
                throw new Error(`Could not load local data: ${response.status}`);
            }

            const performances = await response.json();
            console.log(`✅ Loaded ${performances.length} performances from local fallback`);

            return performances;
        } catch (error) {
            console.warn('⚠️ Local fallback failed, using enhanced mock data:', error.message);
            return this.generateEnhancedMockData();
        }
    }

    // Generate more comprehensive mock data for demo
    generateEnhancedMockData() {
        console.log('🎭 Generating enhanced mock data for demonstration');

        const mockPerformances = [
            {
                id: "perf-001",
                title: "Beethoven's 9th Symphony",
                date: "2024-03-15",
                venue: "Main Hall",
                capacity: 2500,
                singleTicketsSold: 1200,
                subscriptionTicketsSold: 800,
                totalRevenue: 95000,
                occupancyGoal: 90,
                budgetGoal: 120000,
                weeklySales: this.generateWeeklySales(2000, 10)
            },
            {
                id: "perf-002",
                title: "Mozart Piano Concerto No. 21",
                date: "2024-03-22",
                venue: "Chamber Hall",
                capacity: 1200,
                singleTicketsSold: 600,
                subscriptionTicketsSold: 400,
                totalRevenue: 58000,
                occupancyGoal: 85,
                budgetGoal: 70000,
                weeklySales: this.generateWeeklySales(1000, 10)
            },
            {
                id: "perf-003",
                title: "Brahms Symphony No. 4",
                date: "2024-04-05",
                venue: "Main Hall",
                capacity: 2500,
                singleTicketsSold: 1100,
                subscriptionTicketsSold: 750,
                totalRevenue: 87000,
                occupancyGoal: 88,
                budgetGoal: 110000,
                weeklySales: this.generateWeeklySales(1850, 8)
            },
            {
                id: "perf-004",
                title: "Tchaikovsky's Swan Lake Suite",
                date: "2024-04-12",
                venue: "Main Hall",
                capacity: 2500,
                singleTicketsSold: 950,
                subscriptionTicketsSold: 650,
                totalRevenue: 78000,
                occupancyGoal: 85,
                budgetGoal: 105000,
                weeklySales: this.generateWeeklySales(1600, 6)
            },
            {
                id: "perf-005",
                title: "Handel's Messiah",
                date: "2024-12-20",
                venue: "Main Hall",
                capacity: 2500,
                singleTicketsSold: 1850,
                subscriptionTicketsSold: 500,
                totalRevenue: 125000,
                occupancyGoal: 95,
                budgetGoal: 130000,
                weeklySales: this.generateWeeklySales(2350, 12)
            },
            {
                id: "perf-006",
                title: "Vivaldi's Four Seasons",
                date: "2024-05-15",
                venue: "Chamber Hall",
                capacity: 1200,
                singleTicketsSold: 850,
                subscriptionTicketsSold: 300,
                totalRevenue: 68000,
                occupancyGoal: 90,
                budgetGoal: 75000,
                weeklySales: this.generateWeeklySales(1150, 9)
            }
        ];

        return mockPerformances;
    }

    // Get individual performance details
    async getPerformanceDetails(performanceId) {
        const performances = await this.getPerformances();
        return performances.find(p => p.id === performanceId);
    }

    // Get sales summary across all performances
    async getSalesSummary() {
        const performances = await this.getPerformances();

        const summary = {
            totalPerformances: performances.length,
            totalSingleTickets: performances.reduce((sum, p) => sum + p.singleTicketsSold, 0),
            totalSubscriptionTickets: performances.reduce((sum, p) => sum + p.subscriptionTicketsSold, 0),
            totalRevenue: performances.reduce((sum, p) => sum + p.totalRevenue, 0),
            averageOccupancy: performances.reduce((sum, p) => {
                const occupancy = ((p.singleTicketsSold + p.subscriptionTicketsSold) / p.capacity) * 100;
                return sum + occupancy;
            }, 0) / performances.length
        };

        return summary;
    }

    // Get live sales data for a specific performance
    async getPerformanceSalesData(performanceId) {
        if (this.mockDataEnabled) {
            const performances = await this.getPerformances();
            const performance = performances.find(p => p.id === performanceId);
            return performance ? performance.weeklySales : [];
        }

        try {
            console.log(`Fetching sales data for performance ${performanceId} from Tessitura...`);
            return await tessituraAPI.fetchPerformanceSales(performanceId);
        } catch (error) {
            console.error('Failed to fetch sales data from Tessitura:', error);
            // Fallback to mock data
            const performances = await this.getPerformances();
            const performance = performances.find(p => p.id === performanceId);
            return performance ? performance.weeklySales : [];
        }
    }

    // Get revenue data
    async getRevenueData(performanceId = null) {
        if (this.mockDataEnabled) {
            const performances = await this.getPerformances();
            if (performanceId) {
                const performance = performances.find(p => p.id === performanceId);
                return performance ? { totalRevenue: performance.totalRevenue } : null;
            } else {
                const totalRevenue = performances.reduce((sum, p) => sum + p.totalRevenue, 0);
                return { totalRevenue };
            }
        }

        try {
            console.log('Fetching revenue data from Tessitura...');
            return await tessituraAPI.fetchRevenueData(performanceId);
        } catch (error) {
            console.error('Failed to fetch revenue data from Tessitura:', error);
            // Fallback logic as above
            const performances = await this.getPerformances();
            if (performanceId) {
                const performance = performances.find(p => p.id === performanceId);
                return performance ? { totalRevenue: performance.totalRevenue } : null;
            } else {
                const totalRevenue = performances.reduce((sum, p) => sum + p.totalRevenue, 0);
                return { totalRevenue };
            }
        }
    }

    // Test Tessitura connection
    async testTessituraConnection() {
        return await tessituraAPI.testConnection();
    }
}

// Global instance
const dataService = new DataService();

// Make available globally
if (typeof window !== 'undefined') {
    window.dataService = dataService;
}

// Export for module use if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = dataService;
}