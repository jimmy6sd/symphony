// Tessitura Data Transformer
// Transforms real Tessitura API data into our dashboard format

class TessituraDataTransformer {

    // Transform Tessitura performance data to our dashboard format
    static transformPerformanceData(tessituraPerformances) {
        return tessituraPerformances.map(perf => ({
            // Basic performance info
            id: perf.Id,
            title: perf.ProductionSeason?.Production?.Description || perf.Description,
            shortName: perf.ShortName || perf.Description,
            code: perf.Code,
            date: perf.Date,

            // Venue and facility info
            venue: perf.Facility?.Description || 'Unknown Venue',
            facilityId: perf.Facility?.Id,

            // Season information
            season: {
                id: perf.Season?.Id,
                description: perf.Season?.Description,
                fiscalYear: perf.Season?.FYear,
                startDate: perf.Season?.StartDateTime,
                endDate: perf.Season?.EndDateTime
            },

            // Production season info
            productionSeason: {
                id: perf.ProductionSeason?.Id,
                description: perf.ProductionSeason?.Description,
                firstPerformanceDate: perf.ProductionSeason?.FirstPerformanceDate,
                lastPerformanceDate: perf.ProductionSeason?.LastPerformanceDate
            },

            // Performance status and timing
            status: perf.Status?.Description || 'Unknown',
            statusId: perf.Status?.Id,
            timeSlot: perf.TimeSlot?.Description,
            doorsOpen: perf.DoorsOpen,
            doorsClose: perf.DoorsClose,
            duration: perf.Duration,

            // Sales information
            availableForSale: perf.AvailSaleIndicator,
            defaultStartSaleDateTime: perf.DefaultStartSaleDateTime,
            defaultEndSaleDateTime: perf.DefaultEndSaleDateTime,

            // Budget and campaign info
            budgetAmount: perf.BudgetAmount,
            campaign: perf.Campaign ? {
                id: perf.Campaign.Id,
                description: perf.Campaign.Description,
                goalAmount: perf.Campaign.GoalAmount,
                totalTicketIncome: perf.Campaign.TotalTicketIncome,
                fiscalYear: perf.Campaign.FYear
            } : null,

            // Seating and maps
            seatMap: {
                id: perf.BestSeatMap?.Id,
                description: perf.BestSeatMap?.Description,
                isGA: perf.BestSeatMap?.IsGA || false
            },

            zoneMap: {
                id: perf.ZoneMap?.Id,
                description: perf.ZoneMap?.Description
            },

            // Additional metadata
            performanceType: perf.Type?.Description,
            salesNotes: perf.SalesNotes,
            salesNotesRequired: perf.SalesNotesRequired,

            // Timestamps
            createdDateTime: perf.CreatedDateTime,
            updatedDateTime: perf.UpdatedDateTime,

            // Dashboard-specific calculated fields
            // These will need to be populated from sales data
            capacity: null, // Will be determined from seat map data
            singleTicketsSold: 0, // Will be populated from order data
            subscriptionTicketsSold: 0, // Will be populated from subscription data
            totalRevenue: perf.Campaign?.TotalTicketIncome || 0,

            // Goal tracking (using defaults from CONFIG if not specified)
            occupancyGoal: 85, // Default, can be overridden
            budgetGoal: perf.BudgetAmount || perf.Campaign?.GoalAmount || 100000,

            // Weekly sales progression (will be populated separately)
            weeklySales: []
        }));
    }

    // Transform production seasons data
    static transformProductionSeasonsData(tessituraProductionSeasons) {
        return tessituraProductionSeasons.map(ps => ({
            id: ps.Id,
            description: ps.Description,

            // Production info
            production: {
                id: ps.Production?.Id,
                description: ps.Production?.Description,
                titleId: ps.Production?.TitleId
            },

            // Season info
            season: {
                id: ps.Season?.Id,
                description: ps.Season?.Description,
                fiscalYear: ps.Season?.FYear,
                inactive: ps.Season?.Inactive
            },

            // Performance date range
            firstPerformanceDate: ps.FirstPerformanceDate,
            lastPerformanceDate: ps.LastPerformanceDate,

            // Premiere info
            premiere: ps.Premiere ? {
                id: ps.Premiere.Id,
                description: ps.Premiere.Description,
                inactive: ps.Premiere.Inactive
            } : null,

            // Timestamps
            createdDateTime: ps.CreatedDateTime,
            updatedDateTime: ps.UpdatedDateTime
        }));
    }

    // Helper method to extract unique seasons from production seasons
    static extractSeasonsFromProductionSeasons(productionSeasons) {
        const seasonsMap = new Map();

        productionSeasons.forEach(ps => {
            if (ps.Season && ps.Season.Id) {
                seasonsMap.set(ps.Season.Id, {
                    id: ps.Season.Id,
                    description: ps.Season.Description,
                    fiscalYear: ps.Season.FYear,
                    inactive: ps.Season.Inactive,
                    startDate: null, // Not available in this endpoint
                    endDate: null    // Not available in this endpoint
                });
            }
        });

        return Array.from(seasonsMap.values())
            .sort((a, b) => (b.fiscalYear || 0) - (a.fiscalYear || 0)); // Most recent first
    }

    // Generate mock weekly sales data based on performance info
    static generateMockWeeklySalesData(performance, weeksOut = 10) {
        const salesCurve = [0.05, 0.12, 0.22, 0.35, 0.48, 0.62, 0.75, 0.87, 0.95, 1.0];
        const estimatedCapacity = 2000; // Default estimate, should come from seat map
        const estimatedSales = Math.floor(estimatedCapacity * (0.6 + Math.random() * 0.3)); // 60-90% capacity

        return salesCurve.map((percentage, index) => ({
            week: index + 1,
            expectedSales: Math.floor(estimatedSales * (salesCurve[index] - (salesCurve[index-1] || 0))),
            actualSales: Math.floor(estimatedSales * (percentage - (salesCurve[index-1] || 0)) * (0.8 + Math.random() * 0.4)),
            expectedCumulative: Math.floor(estimatedSales * percentage),
            actualCumulative: Math.floor(estimatedSales * percentage * (0.8 + Math.random() * 0.4))
        }));
    }

    // Create complete dashboard data structure
    static createDashboardData(performances, productionSeasons = null) {
        const transformedPerformances = this.transformPerformanceData(performances);

        // Add mock weekly sales data for demonstration
        transformedPerformances.forEach(perf => {
            perf.weeklySales = this.generateMockWeeklySalesData(perf);

            // Calculate some realistic numbers based on venue
            if (perf.venue.includes('Hall')) {
                perf.capacity = 1800;
            } else if (perf.venue.includes('GA')) {
                perf.capacity = 500;
            } else {
                perf.capacity = 2000;
            }

            // Generate realistic ticket sales
            const occupancyRate = 0.6 + Math.random() * 0.35; // 60-95%
            const totalSold = Math.floor(perf.capacity * occupancyRate);

            perf.singleTicketsSold = Math.floor(totalSold * 0.7); // 70% single tickets
            perf.subscriptionTicketsSold = totalSold - perf.singleTicketsSold;
        });

        return {
            performances: transformedPerformances,
            productionSeasons: productionSeasons ? this.transformProductionSeasonsData(productionSeasons) : null,
            metadata: {
                fetchedAt: new Date().toISOString(),
                totalPerformances: transformedPerformances.length,
                dataSource: 'tessitura-api'
            }
        };
    }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TessituraDataTransformer };
} else if (typeof window !== 'undefined') {
    window.TessituraDataTransformer = TessituraDataTransformer;
}