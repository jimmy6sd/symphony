/**
 * Sales Projection Utility
 * Based on KC Symphony's historical sales pacing model
 *
 * The pacing model assumes ticket sales follow a predictable pattern
 * where certain percentages of final sales occur at specific time intervals
 * before the performance.
 */

// Sales pacing table based on KC Symphony historical data
// Key: weeks until performance
// Value: expected percentage of final sales at that point
const SALES_PACING_TABLE = {
    0: 1.00,   // Event day - 100% of sales complete
    1: 0.59,   // 1 week out - expect 59% of final sales
    2: 0.46,   // 2 weeks out - expect 46% of final sales
    3: 0.39,   // 3 weeks out - expect 39% of final sales
    4: 0.33,   // 4 weeks out - expect 33% of final sales
    5: 0.30,   // 5 weeks out - expect 30% of final sales
    6: 0.27    // 6 weeks out - expect 27% of final sales
    // 7+ weeks: Too early to project reliably
};

/**
 * Calculate weeks until performance from today
 * @param {string} performanceDate - Date string in YYYY-MM-DD format
 * @returns {number} Weeks until performance (rounded)
 */
function calculateWeeksUntilPerformance(performanceDate) {
    // Parse date without timezone shift
    const [year, month, day] = performanceDate.split('-');
    const perfDate = new Date(year, month - 1, day);
    const today = new Date();

    // Reset time to midnight for accurate day calculation
    today.setHours(0, 0, 0, 0);
    perfDate.setHours(0, 0, 0, 0);

    const daysUntil = Math.ceil((perfDate - today) / (1000 * 60 * 60 * 24));
    const weeksUntil = Math.ceil(daysUntil / 7);

    return weeksUntil;
}

/**
 * Get the pacing percentage for a given number of weeks
 * @param {number} weeksUntil - Weeks until performance
 * @returns {number|null} Pacing percentage (0-1) or null if too early
 */
functiongetPacingPercentage(weeksUntil) {
    // For past events or current week
    if (weeksUntil <= 0) return 1.00;

    // For events 7+ weeks out, it's too early to project
    if (weeksUntil > 6) return null;

    return SALES_PACING_TABLE[weeksUntil];
}

/**
 * Calculate projected final single ticket sales
 * @param {number} currentSingleTicketsSold - Current single tickets sold
 * @param {string} performanceDate - Date string in YYYY-MM-DD format
 * @returns {Object} Projection data: { projected, weeksUntil, pacing, canProject }
 */
functioncalculateProjectedSales(currentSingleTicketsSold, performanceDate) {
    const weeksUntil = calculateWeeksUntilPerformance(performanceDate);
    const pacing = getPacingPercentage(weeksUntil);

    // Can't project if too early or if no sales yet
    if (pacing === null || currentSingleTicketsSold === 0) {
        return {
            projected: null,
            weeksUntil,
            pacing: null,
            canProject: false,
            reason: pacing === null ? 'too_early' : 'no_sales'
        };
    }

    // Calculate projection: Current Sales / Pacing %
    const projected = Math.round(currentSingleTicketsSold / pacing);

    return {
        projected,
        weeksUntil,
        pacing,
        canProject: true,
        confidence: getProjectionConfidence(weeksUntil)
    };
}

/**
 * Get confidence level for projection based on weeks until performance
 * @param {number} weeksUntil - Weeks until performance
 * @returns {string} Confidence level: 'high', 'medium', 'low'
 */
function getProjectionConfidence(weeksUntil) {
    if (weeksUntil <= 1) return 'high';
    if (weeksUntil <= 3) return 'medium';
    return 'low';
}

/**
 * Calculate projection vs target performance
 * @param {number} projectedSales - Projected final single ticket sales
 * @param {number} targetSales - Target single ticket sales (85% goal)
 * @returns {Object} Performance data: { percentage, status }
 */
functioncalculateProjectionPerformance(projectedSales, targetSales) {
    if (!projectedSales || !targetSales) {
        return { percentage: 0, status: 'unknown' };
    }

    const percentage = (projectedSales / targetSales) * 100;

    let status;
    if (percentage >= 100) status = 'excellent';
    else if (percentage >= 85) status = 'good';
    else if (percentage >= 70) status = 'warning';
    else status = 'critical';

    return { percentage, status };
}

/**
 * Format projection display text
 * @param {Object} projection - Projection data from calculateProjectedSales
 * @returns {string} Human-readable projection description
 */
functionformatProjectionText(projection) {
    if (!projection.canProject) {
        if (projection.reason === 'too_early') {
            return `Too early to project (${projection.weeksUntil}+ weeks out)`;
        }
        return 'Insufficient data for projection';
    }

    const weeksText = projection.weeksUntil === 0 ? 'Event day' :
                      projection.weeksUntil === 1 ? '1 week out' :
                      `${projection.weeksUntil} weeks out`;

    return `Based on ${Math.round(projection.pacing * 100)}% pacing (${weeksText})`;
}
