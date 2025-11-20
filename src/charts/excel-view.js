/**
 * Excel-style View Component
 * Replicates the Excel export template with all available columns
 * Based on docs/excel-export-columns-plan.md
 */
class ExcelView {
    constructor() {
        this.container = null;
        this.data = [];
        this.sortColumn = 'weekNum';
        this.sortDirection = 'asc';
        this.filterText = '';

        // Define columns matching Excel template structure
        this.columns = [
            {
                key: 'weekNum',
                label: 'Wk #',
                width: '50px',
                type: 'number',
                sortable: true,
                tooltip: 'Sequential week number\n\nCalculation: Row index + 1\nData Source: Calculated',
                formatter: (value) => value || '-'
            },
            {
                key: 'weeksUntilPerf',
                label: '# Weeks Until<br>Performance',
                width: '60px',
                type: 'number',
                sortable: true,
                tooltip: 'Number of weeks from today until performance\n\nCalculation: Math.floor((Performance Date - Today) / 7 days)\nData Source: Calculated from performance_date in BigQuery\n\nNote: Negative values indicate past performances',
                formatter: (value) => value >= 0 ? value : `${Math.abs(value)} (past)`
            },
            {
                key: 'perfWeekMonday',
                label: 'Performance Week<br>(Monday)',
                width: '80px',
                type: 'date',
                sortable: true,
                tooltip: 'Monday date of the performance week\n\nCalculation: Monday of the week containing the performance date\nData Source: Calculated from performance_date in BigQuery',
                formatter: (value) => {
                    const date = new Date(value);
                    return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
                }
            },
            {
                key: 'title',
                label: 'Performance',
                width: '200px',
                type: 'string',
                sortable: true,
                tooltip: 'Performance title/name and code\n\nData Source: Direct from BigQuery\n  • title: Performance name\n  • performanceCode: Unique identifier',
                formatter: (value, row) => {
                    return `<div class="performance-title-cell">
                        <div class="title">${value}</div>
                        <div class="code">${row.code || ''}</div>
                    </div>`;
                }
            },
            {
                key: 'empty1',
                label: '',
                width: '30px',
                type: 'string',
                sortable: false,
                formatter: () => ''
            },
            {
                key: 'empty2',
                label: '',
                width: '30px',
                type: 'string',
                sortable: false,
                formatter: () => ''
            },
            {
                key: 'date',
                label: 'Performance<br>Date(s)',
                width: '75px',
                type: 'date',
                sortable: true,
                tooltip: 'Date of performance\n\nData Source: Direct from BigQuery (performance_date field)\n\nFormat: M/D/YYYY',
                formatter: (value) => {
                    const date = new Date(value);
                    return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
                }
            },
            {
                key: 'series',
                label: 'Performance<br>Type',
                width: '100px',
                type: 'string',
                sortable: true,
                tooltip: 'Series classification\n\nData Source: Direct from BigQuery (series field)\n\nTypes:\n  • Classical (CS01-CS14)\n  • Pops (PS1-PS5)\n  • Family (FS1-FS4)\n  • Special Event\n  • Holiday\n  • Film Concerts',
                formatter: (value) => {
                    if (!value || value === 'N/A') return '<span class="series-na">N/A</span>';

                    const lowerValue = value.toLowerCase();
                    const seriesClass =
                        lowerValue.includes('classical') ? 'series-classical' :
                        lowerValue.includes('pops') ? 'series-pops' :
                        lowerValue.includes('family') ? 'series-family' :
                        lowerValue.includes('special') ? 'series-special' :
                        lowerValue.includes('holiday') || lowerValue.includes('christmas') ? 'series-holiday' :
                        'series-other';

                    return `<span class="series-badge ${seriesClass}">${value}</span>`;
                }
            },
            {
                key: 'totalTicketsSold',
                label: 'Actual Total<br>Tickets Sold',
                width: '70px',
                type: 'number',
                sortable: true,
                tooltip: 'Total tickets sold (singles + subscriptions)\n\nCalculation: single_tickets_sold + subscription_tickets_sold\nData Source: Direct from BigQuery\n\nBased on PDF weekly sales reports imported via Make.com automation',
                formatter: (value) => value?.toLocaleString() || '0'
            },
            {
                key: 'projectedTotal',
                label: 'Projected Single Tickets<br>+ Actual Subs',
                width: '75px',
                type: 'number',
                sortable: true,
                tooltip: 'Projected single tickets at performance time + actual subscriptions\n\nCalculation: Projected Singles + Subscription Tickets Sold\nData Source: CALCULATED using comparison-based projection (same logic as sales curve chart)\n\nProjection Method: Target Comparison + Variance\n  • Uses target comp curve from similar performance\n  • Calculates current variance from target comp\n  • Projects variance forward to performance date\n  • Capped at available single ticket capacity\n\nFormula:\n  Current Variance = Current Singles - Target Comp Current\n  Projected Singles = Target Comp Final + Current Variance\n  Projected Total = Projected Singles + Subs\n\nNote: N/A if no target comp set, no sales yet, or outside comp data range',
                formatter: (value, row) => {
                    if (value === null || value === undefined) {
                        const reason = row.projection?.reason || 'unknown';
                        const tooltip = reason === 'no_target_comp' ? 'No target comp set' :
                                       reason === 'no_sales' ? 'No sales yet' :
                                       reason === 'week_out_of_range' ? 'Outside comp data range' : 'N/A';
                        return `<span class="na-value" title="${tooltip}">N/A</span>`;
                    }
                    return `<span class="projected-value">${value.toLocaleString()}</span>`;
                },
                className: 'projection-column'
            },
            {
                key: 'projectedOccupancy',
                label: 'Projected Total<br>OCC at Performance',
                width: '70px',
                type: 'percent',
                sortable: true,
                tooltip: 'Projected occupancy percentage at performance time\n\nCalculation: (Projected Total Tickets / Capacity) × 100\nData Source: CALCULATED from comparison-based projection\n\nFormula:\n  Projected OCC = (projectedTotal / capacity) × 100\n\nNote: N/A if no target comp set, no sales yet, or outside comp data range',
                formatter: (value) => {
                    if (value === null || value === undefined) {
                        return '<span class="na-value">N/A</span>';
                    }
                    const percent = value;
                    const className = percent >= 85 ? 'high-occ' : percent >= 70 ? 'medium-occ' : 'low-occ';
                    return `<span class="${className} projected-value">${percent.toFixed(1)}%</span>`;
                },
                className: 'projection-column'
            },
            {
                key: 'totalRevenue',
                label: 'Total Actual<br>Revenue',
                width: '85px',
                type: 'currency',
                sortable: true,
                tooltip: 'Total revenue from all ticket sales\n\nData Source: Direct from BigQuery (total_revenue field)\n\nIncludes:\n  • Single ticket revenue\n  • Subscription ticket revenue\n  • All ticket types and price levels\n\nSource: PDF weekly sales reports',
                formatter: (value) => `$${(value || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
            },
            {
                key: 'budgetGoal',
                label: 'TOTAL<br>BUDGET',
                width: '85px',
                type: 'currency',
                sortable: true,
                tooltip: 'Revenue budget/goal for this performance\n\nData Source: Direct from BigQuery (budget_goal field)\n\nManually set target for each performance',
                formatter: (value) => `$${(value || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                className: 'budget-column'
            },
            {
                key: 'budgetPercent',
                label: 'Actual/Budget<br>%',
                width: '65px',
                type: 'percent',
                sortable: true,
                tooltip: 'Percentage of budget achieved\n\nCalculation: (Total Revenue / Budget Goal) × 100\nData Source: Calculated from BigQuery fields\n\nColor coding:\n  • Green (≥100%): Over budget\n  • Blue (≥85%): On track\n  • Red (<85%): Under budget',
                formatter: (value) => {
                    const percent = value || 0;
                    const className = percent >= 100 ? 'over-budget' : percent >= 85 ? 'on-track' : 'under-budget';
                    return `<span class="${className}">${percent.toFixed(1)}%</span>`;
                }
            },
            {
                key: 'projectedBudgetPercent',
                label: 'Projected/Budget %',
                width: '90px',
                type: 'percent',
                sortable: true,
                tooltip: 'Projected percentage of budget at performance time\n\nCalculation: (Projected Revenue / Budget Goal) × 100\nData Source: CALCULATED from comparison-based projection\n\nProjected Revenue = Projected Total Tickets × Current ATP\n\nFormula:\n  Projected/Budget % = (projectedRevenue / budgetGoal) × 100\n\nNote: Uses current average ticket price (ATP) as estimate for projected revenue\nN/A if no target comp set, no sales yet, or outside comp data range',
                formatter: (value) => {
                    if (value === null || value === undefined) {
                        return '<span class="na-value">N/A</span>';
                    }
                    const percent = value;
                    const className = percent >= 100 ? 'over-budget' : percent >= 85 ? 'on-track' : 'under-budget';
                    return `<span class="${className} projected-value">${percent.toFixed(1)}%</span>`;
                },
                className: 'projection-column'
            },
            {
                key: 'singleTicketsSold',
                label: 'Actual Single Tickets Sold',
                width: '90px',
                type: 'number',
                sortable: true,
                tooltip: 'Number of single tickets sold\n\nData Source: Direct from BigQuery (single_tickets_sold field)\n\nIncludes:\n  • Individual ticket purchases\n  • Non-fixed package tickets\n\nExcludes subscription tickets\n\nSource: PDF weekly sales reports',
                formatter: (value) => value?.toLocaleString() || '0'
            },
            {
                key: 'targetSinglesFor85',
                label: 'Target Single Tickets for 85% OCC',
                width: '100px',
                type: 'number',
                sortable: true,
                tooltip: 'Single tickets needed to reach 85% occupancy goal\n\nCalculation: (Capacity × 0.85) - Subscription Tickets Sold\nData Source: Calculated\n\nFormula:\n  Target = CEILING(capacity × 85%) - subscription_tickets_sold\n\nThis represents additional single tickets needed after accounting for existing subscriptions',
                formatter: (value) => value?.toLocaleString() || '0',
                className: 'target-column'
            },
            {
                key: 'projectedSingles',
                label: 'Projected Single Tickets',
                width: '90px',
                type: 'number',
                sortable: true,
                tooltip: 'Projected final single ticket sales\n\nData Source: CALCULATED using comparison-based projection (same logic as sales curve chart)\n\nProjection Method: Target Comparison + Variance\n\nExample:\n  • Current singles sold: 300\n  • Target comp at current week: 250\n  • Variance: +50 (we\'re ahead)\n  • Target comp final: 600\n  • Projected: 600 + 50 = 650 singles\n\nHow it works:\n  1. Calculate variance from target comp curve\n  2. Add variance to target comp\'s final sales\n  3. Cap at available single ticket capacity\n\nNote: N/A if no target comp set, no sales yet, or outside comp data range',
                formatter: (value, row) => {
                    if (value === null || value === undefined) {
                        const reason = row.projection?.reason || 'unknown';
                        const tooltip = reason === 'no_target_comp' ? 'No target comp set' :
                                       reason === 'no_sales' ? 'No sales yet' :
                                       reason === 'week_out_of_range' ? 'Outside comp data range' : 'N/A';
                        return `<span class="na-value" title="${tooltip}">N/A</span>`;
                    }
                    return `<span class="projected-value">${value.toLocaleString()}</span>`;
                },
                className: 'projection-column'
            },
            {
                key: 'projectedVsTarget',
                label: 'Projected Single Tickets vs 85% OCC Target',
                width: '120px',
                type: 'number',
                sortable: true,
                tooltip: 'Difference between projected singles and 85% occupancy target\n\nCalculation: Projected Singles - Target Singles for 85% OCC\nData Source: CALCULATED from comparison-based projection\n\nFormula:\n  Projected vs Target = projectedSingles - targetSinglesFor85\n\nInterpretation:\n  • Positive: Projected to exceed target\n  • Negative: Projected to fall short of target\n  • Zero: Projected to meet target exactly\n\nNote: N/A if no target comp set, no sales yet, or outside comp data range',
                formatter: (value) => {
                    if (value === null || value === undefined) {
                        return '<span class="na-value">N/A</span>';
                    }
                    const className = value >= 0 ? 'positive-variance' : 'negative-variance';
                    const sign = value >= 0 ? '+' : '';
                    return `<span class="${className} projected-value">${sign}${value.toLocaleString()}</span>`;
                },
                className: 'projection-column'
            },
            {
                key: 'singlesRevenue',
                label: 'Actual Revenue (Singles)',
                width: '110px',
                type: 'currency',
                sortable: true,
                tooltip: 'Actual revenue from single ticket sales\n\nData Source: Direct from BigQuery (single_revenue field)\n\nIncludes revenue from:\n  • Walk-up single ticket sales\n  • Individual ticket purchases\n\nExcludes:\n  • Fixed package/subscription revenue\n  • Non-fixed package revenue\n\nSource: Tessitura PDF sales reports',
                formatter: (value) => `$${(value || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                className: ''
            },
            {
                key: 'singlesBudget',
                label: 'BUDGET (Singles)',
                width: '110px',
                type: 'currency',
                sortable: true,
                tooltip: 'Budget goal for single ticket revenue\n\nData Source: Direct from BigQuery (single_budget_goal field)\n\nImported from weekly sales report CSV',
                formatter: (value) => {
                    if (!value || value === 0) return '<span class="na-value">N/A</span>';
                    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
                },
                className: 'budget-column'
            },
            {
                key: 'singlesBudgetPercent',
                label: 'Actual/Budget % (Singles)',
                width: '90px',
                type: 'percent',
                sortable: true,
                tooltip: 'Percentage of singles budget achieved\n\nCalculation: (Singles Revenue / Singles Budget) × 100\nData Source: Calculated from BigQuery fields',
                formatter: (value) => {
                    if (value === null || value === undefined) {
                        return '<span class="na-value">N/A</span>';
                    }
                    const percent = value;
                    const className = percent >= 100 ? 'over-budget' : percent >= 85 ? 'on-track' : 'under-budget';
                    return `<span class="${className}">${percent.toFixed(1)}%</span>`;
                }
            },
            {
                key: 'projectedSinglesBudgetPercent',
                label: 'Projected/Budget % (Singles)',
                width: '100px',
                type: 'percent',
                sortable: false,
                tooltip: 'Not available',
                formatter: () => '<span class="na-value">N/A</span>',
                className: 'unavailable'
            },
            {
                key: 'subscriptionTicketsSold',
                label: 'Actual Sub Tickets Sold',
                width: '90px',
                type: 'number',
                sortable: true,
                tooltip: 'Number of subscription tickets sold\n\nData Source: Direct from BigQuery (subscription_tickets_sold field)\n\nIncludes:\n  • Fixed package subscriptions\n  • Season ticket holders\n\nSource: PDF weekly sales reports',
                formatter: (value) => value?.toLocaleString() || '0'
            },
            {
                key: 'subsRevenue',
                label: 'Actual Revenue (Subscriptions)',
                width: '110px',
                type: 'currency',
                sortable: true,
                tooltip: 'Actual revenue from subscription/fixed package tickets\n\nData Source: Direct from BigQuery (fixed_revenue field)\n\nIncludes revenue from:\n  • Fixed package subscriptions\n  • Season ticket holders\n\nExcludes:\n  • Single ticket revenue\n  • Non-fixed package revenue\n\nSource: Tessitura PDF sales reports',
                formatter: (value) => `$${(value || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                className: ''
            },
            {
                key: 'subsBudget',
                label: 'BUDGET (Subscriptions)',
                width: '110px',
                type: 'currency',
                sortable: true,
                tooltip: 'Budget goal for subscription ticket revenue\n\nData Source: Direct from BigQuery (subscription_budget_goal field)\n\nImported from weekly sales report CSV',
                formatter: (value) => {
                    if (!value || value === 0) return '<span class="na-value">N/A</span>';
                    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
                },
                className: 'budget-column'
            },
            {
                key: 'subsBudgetPercent',
                label: 'Actual vs Budget % (Subs)',
                width: '90px',
                type: 'percent',
                sortable: true,
                tooltip: 'Percentage of subscription budget achieved\n\nCalculation: (Subs Revenue / Subs Budget) × 100\nData Source: Calculated from BigQuery fields',
                formatter: (value) => {
                    if (value === null || value === undefined) {
                        return '<span class="na-value">N/A</span>';
                    }
                    const percent = value;
                    const className = percent >= 100 ? 'over-budget' : percent >= 85 ? 'on-track' : 'under-budget';
                    return `<span class="${className}">${percent.toFixed(1)}%</span>`;
                }
            },
            {
                key: 'capacity',
                label: 'Max CAP',
                width: '80px',
                type: 'number',
                sortable: true,
                tooltip: 'Maximum venue capacity\n\nData Source: Direct from BigQuery (capacity field)\n\nTypical capacities:\n  • Helzberg Hall: 1,600 seats\n  • Other venues as configured\n\nRepresents total available seats for performance',
                formatter: (value) => value?.toLocaleString() || '0'
            },
            {
                key: 'capacityPercent',
                label: 'Actual OCC SOLD',
                width: '90px',
                type: 'percent',
                sortable: true,
                tooltip: 'Current occupancy percentage\n\nCalculation: (Total Tickets Sold / Capacity) × 100\nData Source: Direct from BigQuery (capacity_percent field)\n\nColor coding:\n  • Green (≥85%): High occupancy\n  • Orange (70-84%): Medium occupancy\n  • Red (<70%): Low occupancy\n\nGoal: Typically 85% occupancy',
                formatter: (value) => {
                    const percent = value || 0;
                    const className = percent >= 85 ? 'high-occ' : percent >= 70 ? 'medium-occ' : 'low-occ';
                    return `<span class="${className}">${percent.toFixed(1)}%</span>`;
                }
            },
            {
                key: 'avgTicketPrice',
                label: 'Single Ticket ATP',
                width: '90px',
                type: 'currency',
                sortable: true,
                tooltip: 'Actual average ticket price for single tickets\n\nData Source: Direct from BigQuery (single_atp field)\n\nCalculation: Single Revenue / Single Tickets Sold\n\nThis is the true single ticket ATP, calculated from actual single ticket revenue and quantities.\n\nExcludes:\n  • Subscription/fixed package pricing\n  • Non-fixed package pricing\n\nSource: Tessitura PDF sales reports',
                formatter: (value) => `$${(value || 0).toFixed(2)}`,
                className: ''
            },
            {
                key: 'revenueLastWeek',
                label: 'Revenue last week',
                width: '110px',
                type: 'currency',
                sortable: true,
                tooltip: 'Revenue from previous week\'s snapshot\n\nData Source: Direct from BigQuery (performance_sales_snapshots table)\n\nCalculation: Current Revenue - Week-over-Week Change\n\nMethod: Compares latest snapshot with snapshot from 5-10 days ago\n\nNote: Shows N/A if no historical snapshot exists within the 5-10 day window',
                formatter: (value) => {
                    if (value === null || value === undefined) {
                        return '<span class="na-value">N/A</span>';
                    }
                    return `$${(value || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
                },
                className: ''
            },
            {
                key: 'increaseOverWeek',
                label: 'Increase over week',
                width: '110px',
                type: 'currency',
                sortable: true,
                tooltip: 'Revenue increase from last week\n\nData Source: Direct from BigQuery (performance_sales_snapshots table)\n\nCalculation: Current Revenue - Previous Week Revenue\n\nMethod: Uses actual historical snapshots from 5-10 days ago\n\nColor coding:\n  • Green: Positive increase\n  • Red: Negative decrease\n\nNote: Shows N/A if no historical snapshot exists within the 5-10 day window',
                formatter: (value) => {
                    if (value === null || value === undefined) {
                        return '<span class="na-value">N/A</span>';
                    }
                    const className = value >= 0 ? 'positive-variance' : 'negative-variance';
                    const sign = value >= 0 ? '+' : '';
                    return `<span class="${className}">${sign}$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>`;
                },
                className: ''
            }
        ];
    }

    /**
     * Process raw data and add calculated columns
     */
    processData(rawData, comparisonsMap = new Map(), weekOverWeek = {}) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return rawData.map((item, index) => {
            // Handle both date field formats
            const dateStr = item.date || item.performance_date;
            const perfDate = new Date(dateStr);
            perfDate.setHours(0, 0, 0, 0);

            // Calculate weeks until performance
            const daysUntilPerf = Math.floor((perfDate - today) / (1000 * 60 * 60 * 24));
            const weeksUntilPerf = Math.floor(daysUntilPerf / 7);

            // Calculate Monday of performance week
            const perfWeekMonday = new Date(perfDate);
            perfWeekMonday.setDate(perfDate.getDate() - perfDate.getDay() + 1); // Monday

            // Calculate target singles for 85% occupancy
            const targetSinglesFor85 = Math.max(0, Math.ceil(item.capacity * 0.85) - (item.subscriptionTicketsSold || item.subscription_tickets_sold || 0));

            // Get actual values from BigQuery (not estimated!)
            const totalTickets = item.totalTicketsSold || item.total_tickets_sold || 0;
            const totalRevenue = item.totalRevenue || item.total_revenue || 0;
            const singleTicketsSold = item.singleTicketsSold || item.single_tickets_sold || 0;
            const subscriptionTicketsSold = item.subscriptionTicketsSold || item.subscription_tickets_sold || 0;

            // Use actual revenue fields from BigQuery
            const singlesRevenue = item.single_revenue || 0;
            const subsRevenue = item.fixed_revenue || 0;

            // Use actual single ticket ATP from BigQuery
            const avgTicketPrice = item.single_atp || 0;

            // Calculate sales projections using comparison-based logic ONLY (same as sales curve chart)
            let projection = { canProject: false, projected: null, reason: 'no_target_comp' };
            let projectedSingles = null;

            if (window.SalesProjections) {
                // Get comparisons for this performance (use performance CODE as key, not ID)
                const lookupCode = item.performance_code || item.id;
                const comparisons = comparisonsMap.get(lookupCode);
                const targetComp = comparisons?.find(c => c.is_target === true);

                // Available single capacity (for capping projections)
                const availableSingleCapacity = (item.capacity || 0) - (item.subscriptionTicketsSold || item.subscription_tickets_sold || 0);

                if (targetComp && targetComp.weeksArray) {
                    // Use comparison-based projection (same as sales curve chart)
                    projection = window.SalesProjections.calculateCompBasedProjection(
                        item.singleTicketsSold || item.single_tickets_sold || 0,
                        dateStr,
                        targetComp,
                        availableSingleCapacity
                    );
                    projectedSingles = projection.canProject ? projection.projected : null;
                }
                // No fallback - only show projections when target comp is available
            }
            const projectedTotal = projectedSingles !== null
                ? projectedSingles + (item.subscriptionTicketsSold || item.subscription_tickets_sold || 0)
                : null;
            const projectedOccupancy = projectedTotal !== null && item.capacity > 0
                ? (projectedTotal / item.capacity) * 100
                : null;

            // Calculate projected vs target for 85% goal
            const projectedVsTarget = projectedSingles !== null
                ? projectedSingles - targetSinglesFor85
                : null;

            // Estimate projected revenue (using current ATP)
            const projectedRevenue = projectedTotal !== null && avgTicketPrice > 0
                ? projectedTotal * avgTicketPrice
                : null;

            // Calculate projected budget percentage
            const projectedBudgetPercent = projectedRevenue !== null && item.budgetGoal > 0
                ? (projectedRevenue / item.budgetGoal) * 100
                : null;

            // Get week-over-week data for this performance
            const perfCode = item.performance_code || item.id;
            const wow = weekOverWeek[perfCode] || {};
            const revenueLastWeek = wow.available ? (totalRevenue - wow.revenue) : null;
            const increaseOverWeek = wow.available ? wow.revenue : null;

            // Budget breakdown fields from BigQuery
            const singlesBudget = item.single_budget_goal || 0;
            const subsBudget = item.subscription_budget_goal || 0;

            // Calculate budget percentages for singles and subs
            const singlesBudgetPercent = singlesBudget > 0 && singlesRevenue > 0
                ? (singlesRevenue / singlesBudget) * 100
                : null;
            const subsBudgetPercent = subsBudget > 0 && subsRevenue > 0
                ? (subsRevenue / subsBudget) * 100
                : null;

            const processedItem = {
                ...item,
                weekNum: index + 1,
                code: item.performance_code || item.id,
                // Normalize field names to camelCase for column access
                totalTicketsSold: totalTickets,
                singleTicketsSold: singleTicketsSold,
                subscriptionTicketsSold: subscriptionTicketsSold,
                totalRevenue: totalRevenue,
                // Actual revenue fields from BigQuery
                singlesRevenue,
                subsRevenue,
                avgTicketPrice,
                // Budget breakdown
                singlesBudget,
                subsBudget,
                singlesBudgetPercent,
                subsBudgetPercent,
                // Calculated fields
                weeksUntilPerf,
                perfWeekMonday: perfWeekMonday.toISOString().split('T')[0],
                targetSinglesFor85,
                // Projection data
                projection,
                projectedSingles,
                projectedTotal,
                projectedOccupancy,
                projectedVsTarget,
                projectedRevenue,
                projectedBudgetPercent,
                // Week-over-week data
                revenueLastWeek,
                increaseOverWeek
            };

            return processedItem;
        });
    }

    /**
     * Render the Excel-style table
     */
    render(container, data, comparisonsMap = new Map(), weekOverWeek = {}) {
        this.container = d3.select(container);
        this.data = this.processData(data, comparisonsMap, weekOverWeek);

        // Clear container
        this.container.html('');

        // Create header section
        const header = this.container.append('div')
            .attr('class', 'excel-view-header');

        header.append('h2')
            .text('Excel Export View');

        header.append('p')
            .attr('class', 'excel-view-description')
            .html(`
                This view replicates the Excel export template with all available columns.
                <span class="estimated">~Values marked with tilde (~) are estimates.</span>
                <span class="na-value">N/A values are not available in the current data.</span>
            `);

        // Add export button
        const toolbar = header.append('div')
            .attr('class', 'excel-view-toolbar');

        toolbar.append('button')
            .attr('class', 'export-button')
            .html('📥 Export to CSV')
            .on('click', () => this.exportToCSV());

        // Create scrollable table container
        const tableContainer = this.container.append('div')
            .attr('class', 'excel-view-table-container');

        const table = tableContainer.append('table')
            .attr('class', 'excel-view-table');

        // Render table header
        this.renderHeader(table);

        // Render table body
        this.renderBody(table);

        return this.container.node();
    }

    /**
     * Render table header
     */
    renderHeader(table) {
        const thead = table.append('thead');
        const headerRow = thead.append('tr');

        this.columns.forEach(col => {
            const th = headerRow.append('th')
                .attr('class', `excel-col-${col.key}${col.className ? ' ' + col.className : ''}`)
                .style('width', col.width)
                .style('min-width', col.width);

            if (col.sortable) {
                th.style('cursor', 'pointer')
                    .on('click', () => this.sortByColumn(col.key));
            }

            const headerContent = th.append('div')
                .attr('class', 'excel-header-content');

            headerContent.append('span')
                .attr('class', 'excel-header-label')
                .html(col.label);

            if (col.tooltip) {
                headerContent.append('span')
                    .attr('class', 'excel-header-tooltip')
                    .attr('title', col.tooltip)
                    .text('ⓘ');
            }

            if (col.sortable && this.sortColumn === col.key) {
                headerContent.append('span')
                    .attr('class', 'sort-indicator')
                    .text(this.sortDirection === 'asc' ? ' ▲' : ' ▼');
            }
        });
    }

    /**
     * Render table body
     */
    renderBody(table) {
        const tbody = table.selectAll('tbody').data([null]);
        const tbodyEnter = tbody.enter().append('tbody');
        const tbodyMerge = tbodyEnter.merge(tbody);

        // Render rows
        const rows = tbodyMerge.selectAll('tr')
            .data(this.data);

        const rowsEnter = rows.enter()
            .append('tr')
            .attr('class', (d, i) => `excel-row ${i % 2 === 0 ? 'even' : 'odd'}`);

        const rowsMerge = rowsEnter.merge(rows);

        rows.exit().remove();

        // Render cells
        this.columns.forEach(col => {
            const cells = rowsMerge.selectAll(`td.excel-col-${col.key}`)
                .data(d => [d]);

            const cellsEnter = cells.enter()
                .append('td')
                .attr('class', `excel-col-${col.key}${col.className ? ' ' + col.className : ''}`);

            const cellsMerge = cellsEnter.merge(cells);

            cellsMerge.html(d => {
                const value = d[col.key];
                return col.formatter ? col.formatter(value, d) : value || '';
            });

            cells.exit().remove();
        });
    }

    /**
     * Sort table by column
     */
    sortByColumn(columnKey) {
        if (this.sortColumn === columnKey) {
            // Toggle direction if same column
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            // New column, default to ascending
            this.sortColumn = columnKey;
            this.sortDirection = 'asc';
        }

        // Sort data
        const column = this.columns.find(c => c.key === columnKey);
        if (!column) return;

        this.data.sort((a, b) => {
            let aVal = a[columnKey];
            let bVal = b[columnKey];

            // Handle different types
            if (column.type === 'number' || column.type === 'currency' || column.type === 'percent') {
                aVal = parseFloat(aVal) || 0;
                bVal = parseFloat(bVal) || 0;
            } else if (column.type === 'date') {
                aVal = new Date(aVal).getTime();
                bVal = new Date(bVal).getTime();
            } else {
                aVal = String(aVal || '').toLowerCase();
                bVal = String(bVal || '').toLowerCase();
            }

            if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        // Re-render
        this.render(this.container.node(), this.data);
    }

    /**
     * Export table data to CSV
     */
    exportToCSV() {
        // Create CSV header
        const headers = this.columns
            .filter(col => col.key !== 'empty1' && col.key !== 'empty2')
            .map(col => col.label);

        // Create CSV rows
        const rows = this.data.map(row => {
            return this.columns
                .filter(col => col.key !== 'empty1' && col.key !== 'empty2')
                .map(col => {
                    let value = row[col.key];

                    // Handle special formatting for CSV
                    if (value === null || value === undefined) {
                        return '';
                    }

                    // Convert dates to readable format
                    if (col.type === 'date') {
                        const date = new Date(value);
                        return date.toLocaleDateString('en-US');
                    }

                    // Handle numbers and currency
                    if (typeof value === 'number') {
                        return value;
                    }

                    // Escape quotes in strings
                    if (typeof value === 'string' && value.includes(',')) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }

                    return value;
                });
        });

        // Combine into CSV string
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        // Create download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', `symphony-performance-data-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExcelView;
}

// Make available globally for non-module usage
if (typeof window !== 'undefined') {
    window.ExcelView = ExcelView;
}

// ES6 module export
export default ExcelView;
