const CONFIG = {
    // Performance occupancy and budget goals
    performances: {
        // Example: each performance can have different targets
        defaultOccupancyGoal: 85, // percentage
        defaultBudgetGoal: 100000, // dollars

        // Performance-specific goals (to be populated later)
        performanceGoals: {
            // "performance-id-123": {
            //     occupancyGoal: 90,
            //     budgetGoal: 120000,
            //     capacity: 2500
            // }
        }
    },

    // Sales curve heuristics for the "on-track" line
    salesCurve: {
        // Heuristic model for expected sales progression over 10 weeks
        // This defines what percentage of total sales should be achieved by each week
        expectedSalesProgression: [
            { week: 1, percentage: 5 },   // Week 1: 5% of total expected sales
            { week: 2, percentage: 12 },  // Week 2: 12% of total expected sales
            { week: 3, percentage: 22 },  // Week 3: 22% of total expected sales
            { week: 4, percentage: 35 },  // Week 4: 35% of total expected sales
            { week: 5, percentage: 48 },  // Week 5: 48% of total expected sales
            { week: 6, percentage: 62 },  // Week 6: 62% of total expected sales
            { week: 7, percentage: 75 },  // Week 7: 75% of total expected sales
            { week: 8, percentage: 87 },  // Week 8: 87% of total expected sales
            { week: 9, percentage: 95 },  // Week 9: 95% of total expected sales
            { week: 10, percentage: 100 } // Week 10: 100% of total expected sales
        ],
        historicSalesProgression: [
            // This is a reversed version of the expected sales progression for historical comparison 6 weeks out
            { week: 6, percentage: 27 },  // Week 6: 35% of total expected sales
            { week: 5, percentage: 30 },  // Week 5: 48% of total expected sales
            { week: 4, percentage: 33 },  // Week 4: 62% of total expected sales
            { week: 3, percentage: 39 },  // Week 3: 75% of total expected sales
            { week: 2, percentage: 46 },  // Week 2: 87% of total expected sales
            { week: 1, percentage: 59 },  // Week 1: 95% of total expected sales
            { week: 0, percentage: 100 } // Week 0: 100% of total expected sales
        ],

        // Alternative heuristic models (to be configured later)
        heuristicModels: {
            // "linear": [...],
            // "exponential": [...],
            // "s-curve": [...],
            // "historical-average": [...]
        },

        // Default model to use
        defaultModel: "expectedSalesProgression"
    },

    // Chart styling and dimensions
    charts: {
        colors: {
            singleTickets: "#1f77b4",
            subscriptionTickets: "#ff7f0e",
            onTrackLine: "#2ca02c",
            actualSales: "#d62728",
            budgetGoal: "#9467bd",
            occupancyGoal: "#8c564b"
        },

        dimensions: {
            margin: { top: 20, right: 30, bottom: 40, left: 50 },
            defaultWidth: 800,
            defaultHeight: 400
        }
    },

    // Data refresh and API configuration (for future Tessitura integration)
    api: {
        // Tessitura API endpoints (to be configured later)
        endpoints: {
            // performances: "/api/performances",
            // sales: "/api/sales",
            // subscriptions: "/api/subscriptions"
        },

        refreshInterval: 0, // Auto-refresh disabled
        mockDataEnabled: false   // Using real production Tessitura data (220 performances)
    },

    // Tessitura settings - credentials handled server-side only
    tessitura: {
        // Frontend only needs to know the data endpoint, not credentials
        dataEndpoint: '/api/dashboard-data',
        refreshEndpoint: '/api/refresh-data'
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}

// Bridge with new app config system when it loads (browser only)
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        // Wait for new config system to load, then merge
        const checkAndMerge = () => {
            if (window.appConfig && window.CONFIG) {
                // Bridge old CONFIG with new appConfig
                console.log('🔗 Bridging legacy CONFIG with new app configuration system');

            // The charts still expect CONFIG.charts.colors, so ensure it exists
            if (!CONFIG.charts) {
                CONFIG.charts = window.appConfig.get('charts', {});
            }

            // Make sure colors are available
            if (!CONFIG.charts.colors) {
                CONFIG.charts.colors = window.appConfig.get('charts.colors', {});
            }

            // Bridge sales curve settings
            if (!CONFIG.salesCurve) {
                CONFIG.salesCurve = window.appConfig.get('salesCurve', {});
            }

            console.log('✅ Configuration bridge established');
        } else {
            // Retry in 100ms if appConfig isn't ready yet
            setTimeout(checkAndMerge, 100);
        }
    };

    checkAndMerge();
    });
}