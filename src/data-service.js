class DataService {
    constructor() {
        // BigQuery-only data service

        // ⚡ CACHE: In-memory cache for API responses
        this.comparisonCache = new Map();  // performanceId -> comparisons array
    }

    // REMOVED: loadRealData() - no longer needed, using BigQuery only
    // REMOVED: convertRealDataToFormat() - BigQuery data is already in correct format

    // Legacy method kept for compatibility (not used)
    convertRealDataToFormat(realData) {
        return realData.map(perf => {
            // Check if this is already in dashboard format (corrected data)
            if (perf.singleTicketsSold !== undefined && perf.subscriptionTicketsSold !== undefined) {
                // Already in correct format, just ensure all required fields
                return {
                    ...perf,
                    realData: true,
                    title: perf.title || this.getPerformanceName(perf.id) || perf.id
                };
            }

            // Handle legacy formats
            const dateStr = perf.date ? perf.date.split(' ')[0] : perf.date;
            const capacity = perf.capacity ||
                (perf.ticketsSold ? Math.round(perf.ticketsSold / ((perf.capacityPercent || 50) / 100)) : 1500);
            const ticketsSold = perf.ticketsSold || 0;
            const revenue = perf.revenue || 0;

            return {
                id: perf.id,
                performanceId: perf.performanceId,
                title: perf.title || this.getPerformanceName(perf.id) || perf.name || perf.id,
                series: perf.series,
                date: dateStr,
                venue: perf.venue || "HELZBERG HALL",
                season: perf.season,
                capacity: capacity,
                singleTicketsSold: ((perf.breakdown?.single?.count || 0) +
                                   (perf.breakdown?.nonFixedPackages?.count || 0)) ||
                                   Math.round(ticketsSold * 0.6),
                subscriptionTicketsSold: (perf.breakdown?.fixedPackages?.count || 0) ||
                                       Math.round(ticketsSold * 0.4),
                totalRevenue: revenue,
                occupancyGoal: 85,
                budgetGoal: perf.budgetPercent ? Math.round(revenue / (perf.budgetPercent / 100)) : revenue * 1.2,
                weeklySales: this.generateWeeklySalesFromReal(ticketsSold, perf.capacityPercent || 50),
                realData: true,
                hasSalesData: perf.hasSalesData,
                dataSources: perf.dataSources || ['unknown']
            };
        });
    }

    // Generate realistic weekly sales progression for real data
    generateWeeklySalesFromReal(finalTicketsSold, capacityPercent) {
        const weeks = 10;
        const sales = [];

        // Create a realistic sales curve where sales accumulate toward performance date
        // Week 10 = 10 weeks before (low sales), Week 1 = 1 week before (high sales)
        for (let week = 1; week <= weeks; week++) {
            // Reverse the progress: week 1 should have highest sales, week 10 lowest
            const weeksFromEnd = weeks - week + 1; // week 1 -> 10, week 10 -> 1
            const progress = weeksFromEnd / weeks;
            // S-curve progression (slow start, fast middle, slow end)
            const salesProgress = 1 - Math.pow(1 - progress, 2);
            const weeklyTickets = Math.round(finalTicketsSold * salesProgress);
            const weeklyPercent = (weeklyTickets / (finalTicketsSold / (capacityPercent / 100))) * 100;

            sales.push({
                week: week,
                ticketsSold: weeklyTickets,
                percentage: Math.min(weeklyPercent, capacityPercent)
            });
        }

        return sales;
    }

    // Map performance codes to readable names
    getPerformanceName(code) {
        const nameMap = {
            '251010E': 'CS01: Appalachian Spring',
            '251011E': 'CS01: Appalachian Spring',
            '251012M': 'CS01: Appalachian Spring',
            '251031E': 'CS02: Rachmaninoff Celebration Pt 1',
            '251101E': 'CS02: Rachmaninoff Celebration Pt 1',
            '251102M': 'CS02: Rachmaninoff Celebration Pt 1',
            '251121E': 'CS03: Matthias and Mahler 7',
            '251122E': 'CS03: Matthias and Mahler 7',
            '251123M': 'CS03: Matthias and Mahler 7',
            '260109E': 'CS04: Brahms Fourth Symphony',
            '260110E': 'CS04: Brahms Fourth Symphony',
            '260111M': 'CS04: Brahms Fourth Symphony',
            '250919E': 'PS1: Music of Journey',
            '250920E': 'PS1: Music of Journey',
            '250921M': 'PS1: Music of Journey',
            '251024E': 'PS2: 90s Mixtape',
            '251025E': 'PS2: 90s Mixtape',
            '251026M': 'PS2: 90s Mixtape'
        };

        return nameMap[code] || code;
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

    // Main method to get performance data - BIGQUERY ONLY
    async getPerformances() {
        try {
            const result = await this.loadDashboardData();
            if (result && result.length > 0) {
                return result;
            }
            console.error('❌ No data available from BigQuery');
            throw new Error('No performance data returned from BigQuery');
        } catch (error) {
            console.error('❌ BigQuery API failed:', error.message);
            throw error; // Re-throw to let caller handle the error
        }
    }

    // Load dashboard data from BigQuery via API (using snapshots for longitudinal tracking)
    async loadDashboardData() {
        const response = await fetch('/.netlify/functions/bigquery-snapshots?action=get-performances');
        if (!response.ok) {
            throw new Error(`BigQuery API request failed: ${response.status} ${response.statusText}`);
        }
        const performances = await response.json();
        this.updateRefreshTimestamp();

        if (!performances || performances.length === 0) {
            throw new Error('BigQuery returned empty dataset');
        }

        return performances;
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

    // Update refresh timestamp display
    updateRefreshTimestamp() {
        const refreshElement = document.getElementById('last-refresh');
        if (refreshElement) {
            const now = new Date();
            const timeString = now.toLocaleString();
            refreshElement.textContent = `Last refreshed: ${timeString}`;
        }
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

    // ==================== COMPARISON API METHODS ====================

    // Get all comparisons for a performance
    async getPerformanceComparisons(performanceId) {
        try {
            // ⚡ CACHE CHECK: Return cached data if available
            if (this.comparisonCache.has(performanceId)) {
                console.log(`⚡ Using cached comparisons for ${performanceId}`);
                return this.comparisonCache.get(performanceId);
            }

            // Cache miss - fetch from API
            console.log(`🔄 Fetching comparisons for ${performanceId}...`);
            const response = await fetch(`/.netlify/functions/performance-comparisons?performanceId=${performanceId}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch comparisons: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();

            // ⚡ CACHE STORE: Save for future calls
            this.comparisonCache.set(performanceId, data);
            console.log(`💾 Cached comparisons for ${performanceId}`);

            return data;
        } catch (error) {
            console.error('Error fetching comparisons:', error);
            return [];
        }
    }

    // Create a new comparison
    async createComparison(performanceId, comparisonData) {
        try {
            const response = await fetch('/.netlify/functions/performance-comparisons', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    performanceId,
                    ...comparisonData
                })
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create comparison');
            }
            const result = await response.json();

            // ⚡ CACHE INVALIDATION: Clear cache since data changed
            this.comparisonCache.delete(performanceId);
            console.log(`🗑️ Cleared comparison cache for ${performanceId}`);

            return result;
        } catch (error) {
            console.error('Error creating comparison:', error);
            throw error;
        }
    }

    // Update an existing comparison
    async updateComparison(comparisonId, updates) {
        try {
            const response = await fetch(`/.netlify/functions/performance-comparisons/${comparisonId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update comparison');
            }
            return await response.json();
        } catch (error) {
            console.error('Error updating comparison:', error);
            throw error;
        }
    }

    // Delete a comparison
    async deleteComparison(comparisonId) {
        try {
            const response = await fetch(`/.netlify/functions/performance-comparisons/${comparisonId}`, {
                method: 'DELETE'
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete comparison');
            }
            const result = await response.json();

            // ⚡ CACHE INVALIDATION: Clear all caches since we don't know which performance this belongs to
            this.comparisonCache.clear();
            console.log(`🗑️ Cleared all comparison caches (comparison deleted)`);

            return result;
        } catch (error) {
            console.error('Error deleting comparison:', error);
            throw error;
        }
    }

    // Add visual indicator for data source
    updateDataSourceIndicator(source, count, status) {
        // Create or update data source indicator in the UI
        let indicator = document.getElementById('data-source-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'data-source-indicator';
            indicator.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: bold;
                z-index: 9999;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            `;
            document.body.appendChild(indicator);
        }

        const styles = {
            success: 'background: #d4edda; color: #155724; border: 1px solid #c3e6cb;',
            warning: 'background: #fff3cd; color: #856404; border: 1px solid #ffeaa7;',
            error: 'background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;'
        };

        indicator.style.cssText += styles[status] || styles.warning;
        indicator.innerHTML = `
            📊 <strong>${source}</strong><br>
            ${count} performances
        `;

        console.log(`🎯 Data Source Indicator: ${source} (${count} records)`);
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