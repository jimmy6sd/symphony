/**
 * KCS Data Transformer
 * Transforms KCS CSV format data to standard dashboard format
 */

class KCSTransformer extends SymphonyModule {
    constructor(framework) {
        super(framework);
        this.name = 'kcs-csv-performance';
    }

    async init(config) {
        await super.init(config);

        // Register with data manager
        this.emit('transformer:available', {
            name: this.name,
            transformer: this
        });

        this.log('debug', 'KCS Transformer initialized');
    }

    /**
     * Transform KCS CSV data to dashboard format
     * @param {Object} data - Raw KCS data
     * @returns {Array} Transformed performance data
     */
    async transform(data) {
        this.log('debug', 'Transforming KCS CSV data to dashboard format');

        if (!data.performances || !Array.isArray(data.performances)) {
            throw new Error('Invalid KCS data format: missing performances array');
        }

        const transformed = data.performances.map(perf => this.transformPerformance(perf));

        this.log('debug', `Transformed ${transformed.length} KCS performances`);
        return transformed;
    }

    /**
     * Transform individual performance from KCS format
     * @param {Object} perf - KCS performance data
     * @returns {Object} Dashboard format performance
     */
    transformPerformance(perf) {
        // Extract series code from performance name
        const series = this.extractSeries(perf.performanceName);

        // Calculate ticket totals
        const singleTickets = perf.actualSingleTicketsSold || 0;
        const subscriptionTickets = perf.actualSubTicketsSold || 0;
        const totalTickets = perf.actualTotalTicketsSold || (singleTickets + subscriptionTickets);

        // Calculate occupancy
        const capacity = perf.maxCapacity || 1590; // Default capacity
        const occupancyRate = capacity > 0 ? (totalTickets / capacity * 100) : 0;

        // Determine status based on occupancy goal
        const occupancyGoal = this.getOccupancyGoal(series);
        const status = this.calculateStatus(occupancyRate, occupancyGoal, perf);

        return {
            // Basic identification
            id: perf.id,
            performanceId: perf.id,
            title: this.cleanPerformanceName(perf.performanceName),
            series: series,
            date: this.formatDate(perf.performanceDate),
            venue: "Kansas City Symphony - Helzberg Hall",
            season: "2025-2026",

            // Capacity and seating
            capacity: capacity,
            maxCapacity: capacity,

            // Ticket sales
            singleTicketsSold: singleTickets,
            subscriptionTicketsSold: subscriptionTickets,
            totalTicketsSold: totalTickets,

            // Revenue
            totalRevenue: perf.totalActualRevenue || 0,
            singleTicketRevenue: perf.singleTicketRevenue || 0,
            subscriptionRevenue: perf.subTicketRevenue || 0,

            // Goals and targets
            occupancyGoal: occupancyGoal,
            budgetGoal: perf.totalBudget || 0,
            occupancyRate: occupancyRate,
            budgetPercent: perf.actualVsBudgetPercent || 0,

            // Status indicators
            status: status,

            // Performance tracking
            weeklySales: this.generateWeeklySales(perf),

            // Additional KCS-specific fields
            performanceType: perf.performanceType,
            weekNumber: perf.weekNumber,
            weeksUntilPerformance: perf.weeksUntilPerformance,
            actualOccupancyPercent: perf.actualOccupancyPercent,
            actualVsBudgetPercent: perf.actualVsBudgetPercent,
            averageTicketPrice: perf.averageTicketPrice,
            newHouseholds: perf.newHouseholds,
            returningHouseholds: perf.returningHouseholds,
            totalHouseholds: perf.totalHouseholds,
            weeklyRevenueIncrease: perf.weeklyRevenueIncrease,

            // Data source metadata
            realData: true,
            kcsData: true,
            hasSalesData: true
        };
    }

    /**
     * Extract series code from performance name
     * @param {string} performanceName - Full performance name
     * @returns {string} Series code
     */
    extractSeries(performanceName) {
        if (!performanceName) return 'Unknown';

        // Remove year prefix (e.g., "26 PS1" -> "PS1")
        const cleaned = performanceName.replace(/^\d+\s+/, '');

        // Extract series patterns
        const patterns = [
            /^(CS\d+)/i,    // Classical Series: CS01, CS02, etc.
            /^(PS\d+)/i,    // Pops Series: PS1, PS2, etc.
            /^(FS\d+)/i,    // Family Series: FS1, FS2, etc.
            /^(OS\d*)/i,    // On-Stage: OS, OS1, etc.
            /^(HOL)/i,      // Holiday
            /^(FILM)/i      // Film concerts
        ];

        for (const pattern of patterns) {
            const match = cleaned.match(pattern);
            if (match) {
                return match[1].toUpperCase();
            }
        }

        // Check for specific types
        if (cleaned.includes('Christmas') || cleaned.includes('Holiday') || cleaned.includes('Messiah')) {
            return 'HOL';
        }

        if (cleaned.includes('Concert') && (cleaned.includes('Gun') || cleaned.includes('Potter') || cleaned.includes('Elf'))) {
            return 'FILM';
        }

        if (cleaned.includes('On-Stage')) {
            return 'OS';
        }

        // Default to SP (Special) for everything else
        return 'SP';
    }

    /**
     * Clean performance name for display
     * @param {string} name - Raw performance name
     * @returns {string} Cleaned name
     */
    cleanPerformanceName(name) {
        if (!name) return 'Unknown Performance';

        return name
            .replace(/^\d+\s+/, '')  // Remove year prefix
            .replace(/^26\s+/, '')   // Remove "26 " prefix
            .replace(/^27\s+/, '')   // Remove "27 " prefix
            .replace(/^28\s+/, '')   // Remove "28 " prefix
            .trim();
    }

    /**
     * Format performance date
     * @param {string} dateStr - Raw date string
     * @returns {string} Formatted date
     */
    formatDate(dateStr) {
        if (!dateStr) return '';

        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        } catch (error) {
            this.log('warn', `Invalid date format: ${dateStr}`);
            return dateStr;
        }
    }

    /**
     * Get occupancy goal for series
     * @param {string} series - Series code
     * @returns {number} Occupancy goal percentage
     */
    getOccupancyGoal(series) {
        const goals = {
            'CS01': 85, 'CS02': 85, 'CS03': 85, 'CS04': 85, 'CS05': 85,
            'CS06': 85, 'CS07': 85, 'CS08': 85, 'CS09': 85, 'CS10': 85,
            'CS11': 85, 'CS12': 85, 'CS13': 85, 'CS14': 85, // Classical series
            'PS1': 80, 'PS2': 80, 'PS3': 80, 'PS4': 80, 'PS5': 80, // Pops series
            'FS1': 75, 'FS2': 75, 'FS3': 75, // Family series
            'FILM': 70, // Film concerts
            'HOL': 85, // Holiday concerts
            'OS': 60,  // On-Stage (smaller venue)
            'SP': 75   // Special events
        };

        return goals[series] || 85; // Default to 85%
    }

    /**
     * Calculate performance status
     * @param {number} occupancyRate - Current occupancy rate
     * @param {number} occupancyGoal - Target occupancy rate
     * @param {Object} perf - Performance data
     * @returns {string} Status
     */
    calculateStatus(occupancyRate, occupancyGoal, perf) {
        // Check if performance is in the future
        const today = new Date();
        const perfDate = new Date(perf.performanceDate);

        if (perfDate > today) {
            // Future performance - base on current trajectory
            if (occupancyRate >= occupancyGoal) {
                return 'On Target';
            } else if (occupancyRate >= occupancyGoal * 0.6) {
                return 'Below Target';
            } else {
                return 'At Risk';
            }
        } else {
            // Past performance - final results
            if (occupancyRate >= occupancyGoal) {
                return 'On Target';
            } else {
                return 'Below Target';
            }
        }
    }

    /**
     * Generate weekly sales progression data
     * @param {Object} perf - Performance data
     * @returns {Array} Weekly sales data
     */
    generateWeeklySales(perf) {
        const totalSold = perf.actualTotalTicketsSold || 0;
        if (totalSold === 0) return [];

        // Use actual data if available, otherwise generate realistic progression
        if (perf.weeklySales && Array.isArray(perf.weeklySales)) {
            return perf.weeklySales;
        }

        // Generate based on current sales state and weeks until performance
        const weeksUntil = perf.weeksUntilPerformance || 0;
        const currentWeek = Math.max(1, 10 - weeksUntil);

        // Standard sales progression curve (percentage of final sales by week)
        const progression = [0, 0.05, 0.12, 0.22, 0.35, 0.48, 0.62, 0.75, 0.87, 0.95, 1.0];

        const weeklySales = [];
        for (let week = 1; week <= 10; week++) {
            const cumulative = Math.floor(totalSold * progression[week]);
            const weekSales = week === 1 ? cumulative : cumulative - Math.floor(totalSold * progression[week - 1]);

            weeklySales.push({
                week: week,
                weeksSince: week - 1,
                weeksUntil: 10 - week,
                sold: weekSales,
                cumulative: cumulative,
                percentage: progression[week] * 100,
                isProjected: week > currentWeek
            });
        }

        return weeklySales;
    }

    /**
     * Validate KCS data structure
     * @param {Object} data - Data to validate
     * @returns {boolean} Is valid
     */
    validate(data) {
        if (!data || typeof data !== 'object') {
            return false;
        }

        if (!data.performances || !Array.isArray(data.performances)) {
            return false;
        }

        // Check if at least one performance has KCS structure
        const sample = data.performances[0];
        if (!sample) return false;

        const requiredFields = ['id', 'performanceName', 'performanceDate'];
        return requiredFields.every(field => sample.hasOwnProperty(field));
    }

    /**
     * Get transformer information
     * @returns {Object} Transformer info
     */
    getInfo() {
        return {
            name: 'KCS CSV Transformer',
            type: 'kcs-csv-performance',
            description: 'Transforms KCS CSV format to dashboard performance data',
            inputFormat: 'KCS CSV/JSON',
            outputFormat: 'Dashboard Performance',
            version: '1.0.0'
        };
    }
}

// Export for use in framework
window.KCSTransformer = KCSTransformer;