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
 * @param {boolean} exact - If true, return exact decimal weeks; if false, return rounded up integer
 * @returns {number} Weeks until performance
 */
function calculateWeeksUntilPerformance(performanceDate, exact = false) {
    // Parse date without timezone shift
    const [year, month, day] = performanceDate.split('-');
    const perfDate = new Date(year, month - 1, day);
    const today = new Date();

    // Reset time to midnight for accurate day calculation
    today.setHours(0, 0, 0, 0);
    perfDate.setHours(0, 0, 0, 0);

    const daysUntil = Math.ceil((perfDate - today) / (1000 * 60 * 60 * 24));

    if (exact) {
        // Return exact decimal weeks for interpolation
        return Math.max(0, daysUntil / 7);
    }

    // Return rounded up integer weeks (legacy behavior)
    const weeksUntil = Math.ceil(daysUntil / 7);
    return weeksUntil;
}

/**
 * Get the pacing percentage for a given number of weeks
 * @param {number} weeksUntil - Weeks until performance
 * @returns {number|null} Pacing percentage (0-1) or null if too early
 */
function getPacingPercentage(weeksUntil) {
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
function calculateProjectedSales(currentSingleTicketsSold, performanceDate) {
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
function calculateProjectionPerformance(projectedSales, targetSales) {
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
function formatProjectionText(projection) {
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

/**
 * Calculate projected final sales based on target comp variance
 * Uses interpolation for accurate projections at fractional weeks
 * @param {number} currentSingleTicketsSold - Current single tickets sold
 * @param {string} performanceDate - Date string in YYYY-MM-DD format
 * @param {Object} targetComp - Target comparison object from API (with weeksArray)
 * @returns {Object} Projection data with comp-based logic
 */
function calculateCompBasedProjection(currentSingleTicketsSold, performanceDate, targetComp, availableSingleCapacity = null) {
    // Use exact decimal weeks for interpolation (matches tracking status box logic)
    const exactWeeksUntil = calculateWeeksUntilPerformance(performanceDate, true);

    // Can't project if no target comp or no sales
    if (!targetComp || !targetComp.weeksArray || currentSingleTicketsSold === 0) {
        return {
            projected: null,
            variance: null,
            targetCompCurrent: null,
            targetCompFinal: null,
            weeksUntil: exactWeeksUntil,
            canProject: false,
            reason: !targetComp ? 'no_target_comp' : 'no_sales'
        };
    }

    const numWeeks = targetComp.weeksArray.length;

    // Calculate interpolated target comp value at exact week position
    const lowerWeek = Math.floor(exactWeeksUntil);
    const upperWeek = Math.ceil(exactWeeksUntil);
    const lowerWeekIndex = numWeeks - 1 - lowerWeek;
    const upperWeekIndex = numWeeks - 1 - upperWeek;

    // Check if current week is within comp data range
    if (lowerWeekIndex < 0 || upperWeekIndex >= numWeeks) {
        return {
            projected: null,
            variance: null,
            targetCompCurrent: null,
            targetCompFinal: null,
            weeksUntil: exactWeeksUntil,
            canProject: false,
            reason: 'week_out_of_range'
        };
    }

    // Calculate interpolated target comp value at exact week
    let targetCompCurrent;
    if (lowerWeek === upperWeek) {
        // Exact integer week, use direct value
        targetCompCurrent = targetComp.weeksArray[lowerWeekIndex];
    } else {
        // Interpolate between the two surrounding weeks
        const lowerValue = targetComp.weeksArray[lowerWeekIndex];
        const upperValue = targetComp.weeksArray[upperWeekIndex];
        const fraction = exactWeeksUntil - lowerWeek;
        targetCompCurrent = lowerValue + (upperValue - lowerValue) * fraction;
    }

    const targetCompFinal = targetComp.weeksArray[numWeeks - 1]; // Comp final sales (last value)

    // Calculate variance (how far ahead/behind we are)
    const variance = currentSingleTicketsSold - targetCompCurrent;

    // Project final sales: target comp final + our current variance
    // Cap at available single capacity, then round (matches sales-curve-chart.js logic)
    let projectionValue = targetCompFinal + variance;
    if (availableSingleCapacity !== null && availableSingleCapacity > 0) {
        projectionValue = Math.min(projectionValue, availableSingleCapacity);
    }
    const projected = Math.round(projectionValue);

    return {
        projected: Math.max(0, projected), // Don't allow negative projections
        variance: Math.round(variance),
        targetCompCurrent: Math.round(targetCompCurrent),
        targetCompFinal,
        weeksUntil: exactWeeksUntil,
        canProject: true,
        comparisonName: targetComp.comparison_name || 'Target Comp',
        confidence: getProjectionConfidence(Math.ceil(exactWeeksUntil))
    };
}

/**
 * Format comp-based projection display text
 * @param {Object} projection - Projection data from calculateCompBasedProjection
 * @returns {string} Human-readable projection description
 */
function formatCompProjectionText(projection) {
    if (!projection.canProject) {
        if (projection.reason === 'no_target_comp') {
            return 'No target comp set';
        }
        if (projection.reason === 'no_sales') {
            return 'No sales data yet';
        }
        if (projection.reason === 'week_out_of_range') {
            return 'Outside comp data range';
        }
        return 'Cannot project';
    }

    const roundedWeeks = Math.ceil(projection.weeksUntil);
    const weeksText = roundedWeeks === 0 ? 'today' :
                      roundedWeeks === 1 ? '1 week out' :
                      `${roundedWeeks} weeks out`;

    const varianceText = projection.variance > 0 ?
        `${projection.variance.toLocaleString()} ahead` :
        projection.variance < 0 ?
        `${Math.abs(projection.variance).toLocaleString()} behind` :
        'on pace with';

    return `${varianceText} ${projection.comparisonName} (${weeksText})`;
}

// Export functions
if (typeof window !== 'undefined') {
    window.SalesProjections = {
        calculateProjectedSales,
        calculateCompBasedProjection,
        calculateProjectionPerformance,
        formatProjectionText,
        formatCompProjectionText,
        calculateWeeksUntilPerformance,
        getPacingPercentage
    };
}
