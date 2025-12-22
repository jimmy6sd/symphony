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