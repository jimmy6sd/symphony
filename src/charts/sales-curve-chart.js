class SalesCurveChart {
    constructor(containerId, options = {}) {
        console.log('🔥 SalesCurveChart v2.2 - MOBILE-OPTIMIZED - Nov 24 2025');
        this.containerId = containerId;
        this.data = [];
        this.svg = null;
        this.width = CONFIG.charts.dimensions.defaultWidth;
        this.height = CONFIG.charts.dimensions.defaultHeight;

        // Initialize responsive state
        this.updateResponsiveState();

        // Set responsive margins
        this.margin = this.getResponsiveMargins();

        this.selectedPerformance = null;
        this.showSelector = options.showSelector !== false; // Default to true unless explicitly false
        this.historicalData = options.historicalData || []; // Store historical snapshots for projection alignment

        // Debounced resize handler to prevent excessive re-renders
        this.resizeTimeout = null;
        this.boundResizeHandler = this.handleResize.bind(this);
        window.addEventListener('resize', this.boundResizeHandler);
    }

    // Debounced resize handler
    handleResize() {
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            const previousMobile = this.isMobile;
            this.updateResponsiveState();
            // Only re-render if breakpoint changed or on mobile (for orientation changes)
            if (previousMobile !== this.isMobile || this.isMobile) {
                if (this.data && this.data.length > 0) {
                    this.render();
                }
            }
        }, 150); // 150ms debounce
    }

    // Cleanup method to prevent memory leaks
    destroy() {
        clearTimeout(this.resizeTimeout);
        window.removeEventListener('resize', this.boundResizeHandler);
        // Remove any tooltips
        d3.select('.sales-curve-tooltip').remove();
    }

    updateResponsiveState() {
        const width = window.innerWidth;
        this.isMobile = width <= 768;
        this.isTablet = width > 768 && width <= 1024;
        this.isDesktop = width > 1024;
    }

    // Smart tooltip positioning that stays within viewport
    positionTooltip(tooltip, event) {
        const tooltipNode = tooltip.node();
        if (!tooltipNode) return;

        // Get tooltip dimensions
        const tooltipRect = tooltipNode.getBoundingClientRect();
        const tooltipWidth = tooltipRect.width || 200;
        const tooltipHeight = tooltipRect.height || 100;

        // Get viewport dimensions
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Calculate initial position
        let left = event.pageX + 15;
        let top = event.pageY - 10;

        // Adjust horizontal position if tooltip would go off right edge
        if (left + tooltipWidth > viewportWidth - 10) {
            left = event.pageX - tooltipWidth - 15;
        }

        // Adjust horizontal position if tooltip would go off left edge
        if (left < 10) {
            left = 10;
        }

        // Adjust vertical position if tooltip would go off bottom edge
        if (top + tooltipHeight > viewportHeight - 10) {
            top = event.pageY - tooltipHeight - 15;
        }

        // Adjust vertical position if tooltip would go off top edge
        if (top < 10) {
            top = 10;
        }

        tooltip
            .style("left", left + "px")
            .style("top", top + "px");
    }

    getResponsiveMargins() {
        if (this.isMobile) {
            return { top: 30, right: 15, bottom: 50, left: 45 };
        } else if (this.isTablet) {
            return { top: 40, right: 150, bottom: 60, left: 55 };
        } else {
            return { top: 50, right: 220, bottom: 75, left: 70 };
        }
    }

    async init() {
        console.log('🔄 SalesCurveChart init() called');
        this.data = await dataService.getPerformances();
        console.log('📊 SalesCurveChart received data:', this.data?.length || 0, 'performances');
        if (this.data && this.data.length > 0) {
            console.log('📊 First performance:', this.data[0]);
            this.render();
        } else {
            console.warn('⚠️ SalesCurveChart: No data available for rendering');
        }
    }

    async render() {
        // Safety check for data availability
        if (!this.data || !Array.isArray(this.data) || this.data.length === 0) {
            console.warn('⚠️ SalesCurveChart render: No data available');
            return;
        }

        const container = d3.select(`#${this.containerId}`);
        container.select("svg").remove();

        // Clear any existing mobile elements
        container.selectAll(".mobile-status-box, .mobile-legend").remove();

        // Update margins based on current responsive state
        this.margin = this.getResponsiveMargins();

        // Get container dimensions dynamically with responsive minimums
        const containerElement = container.node();
        const containerRect = containerElement.getBoundingClientRect();

        if (this.isMobile) {
            // Mobile: smaller minimums, full width
            this.width = Math.max(320, containerRect.width - 16);
            this.height = Math.max(300, containerRect.height - 16);
        } else if (this.isTablet) {
            // Tablet: moderate minimums
            this.width = Math.max(600, containerRect.width - 16);
            this.height = Math.max(350, containerRect.height - 16);
        } else {
            // Desktop: original minimums
            this.width = Math.max(800, containerRect.width - 16);
            this.height = Math.max(350, containerRect.height - 16);
        }

        const innerWidth = this.width - this.margin.left - this.margin.right;
        const innerHeight = this.height - this.margin.top - this.margin.bottom;

        this.svg = container
            .append("svg")
            .attr("width", this.width)
            .attr("height", this.height);

        const g = this.svg
            .append("g")
            .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        // Add performance selector (only if showSelector is true)
        if (this.showSelector) {
            this.addPerformanceSelector(container);
        }

        // Default to first performance
        if (!this.selectedPerformance && this.data.length > 0) {
            this.selectedPerformance = this.data[0].id;
        }

        await this.renderSalesCurve(g, innerWidth, innerHeight);
    }

    addPerformanceSelector(container) {
        const selectorDiv = container
            .insert("div", ":first-child")
            .style("margin-bottom", "15px");

        selectorDiv.append("label")
            .text("Select Performance: ")
            .style("margin-right", "10px")
            .style("font-weight", "bold");

        const select = selectorDiv
            .append("select")
            .style("padding", "5px")
            .style("font-size", "14px")
            .on("change", async (event) => {
                this.selectedPerformance = event.target.value;
                await this.renderSalesCurve(
                    this.svg.select("g"),
                    this.width - this.margin.left - this.margin.right,
                    this.height - this.margin.top - this.margin.bottom
                );
            });

        select.selectAll("option")
            .data(this.data)
            .enter()
            .append("option")
            .attr("value", d => d.id)
            .text(d => `${d.title} (${d.date})`);

        if (this.selectedPerformance) {
            select.property("value", this.selectedPerformance);
        }
    }

    async renderSalesCurve(g, innerWidth, innerHeight) {
        // Clear previous chart
        g.selectAll(".sales-curve-content").remove();

        const chartGroup = g.append("g").attr("class", "sales-curve-content");

        // Safety check for data availability
        if (!this.data || !Array.isArray(this.data) || this.data.length === 0) {
            console.warn('⚠️ SalesCurveChart render: No data available');
            return;
        }

        const performance = this.data.find(d => d.id === this.selectedPerformance);
        if (!performance) {
            console.warn('⚠️ SalesCurveChart render: No performance found with id:', this.selectedPerformance);
            return;
        }

        // Calculate current SINGLE TICKET sales (actual data point)
        // We only track single ticket progression, not subscriptions
        const currentSales = performance.singleTicketsSold || 0;
        const subscriptionSales = performance.subscriptionTicketsSold || 0;

        // Calculate weeks from today to performance
        const today = new Date();
        const [perfYear, perfMonth, perfDay] = performance.date.split('-');
        const performanceDate = new Date(perfYear, perfMonth - 1, perfDay);
        const weeksToPerformance = Math.max(1, Math.ceil((performanceDate - today) / (7 * 24 * 60 * 60 * 1000)));

        console.log('📊 Single ticket sales:', currentSales, 'Subscription sales:', subscriptionSales, 'Weeks to performance:', weeksToPerformance);

        // Calculate maxWeeks dynamically based on comparisons
        // Use performanceCode (Tessitura code) for comp lookups, fallback to performanceId
        console.log('🔍 DEBUG: performance.performanceCode =', performance.performanceCode);
        console.log('🔍 DEBUG: performance.performanceId =', performance.performanceId);
        const performanceCode = performance.performanceCode || performance.performanceId;
        console.log('📊 Looking up comps for:', performanceCode, '(type:', typeof performanceCode, ')');
        const comparisons = await window.dataService.getPerformanceComparisons(performanceCode);
        console.log('🔍 DEBUG: Fetched comparisons:', comparisons);
        if (comparisons && comparisons.length > 0) {
            comparisons.forEach(c => console.log('   📊 Comp:', c.comparison_name, '| is_target:', c.is_target, '| color:', c.line_color, '| style:', c.line_style));
        }
        const maxComparisonWeeks = comparisons && comparisons.length > 0
            ? Math.max(...comparisons.map(c => c.weeksArray.length))
            : 0;
        const maxWeeks = Math.max(10, maxComparisonWeeks); // Minimum 10 weeks, extend if comparisons need more

        // Debug capacity issue
        console.log('📊 Performance capacity:', performance.capacity);
        console.log('📊 Performance data:', performance);

        // Ensure we have a valid capacity
        const capacity = performance.capacity && performance.capacity > 0 ? performance.capacity : 2000;
        const maxSales = Math.max(
            capacity,
            currentSales,
            100  // minimum scale
        );

        console.log('📊 Using capacity:', capacity, 'Max sales for scale:', maxSales);
        console.log('📊 Current sales:', currentSales, 'at week:', weeksToPerformance);

        // Scales (flip x-axis so week 10 is on left, week 0 on right)
        const xScale = d3.scaleLinear()
            .domain([maxWeeks, 0])
            .range([0, innerWidth]);

        const yScale = d3.scaleLinear()
            .domain([0, maxSales])
            .range([innerHeight, 0]);

        // Store scales for use by overlayHistoricalData
        this.xScale = xScale;
        this.yScale = yScale;
        this.maxWeeks = maxWeeks;
        this.maxSales = maxSales;

        // Add subtle grid lines FIRST (so they're in the back)
        chartGroup.append("g")
            .attr("class", "grid")
            .attr("transform", `translate(0,${innerHeight})`)
            .call(d3.axisBottom(xScale)
                .tickSize(-innerHeight)
                .tickFormat("")
            )
            .selectAll("line")
            .style("stroke", "#f0f0f0")
            .style("stroke-width", 0.5);

        chartGroup.append("g")
            .attr("class", "grid")
            .call(d3.axisLeft(yScale)
                .tickSize(-innerWidth)
                .tickFormat("")
            )
            .selectAll("line")
            .style("stroke", "#f0f0f0")
            .style("stroke-width", 0.5);

        // Draw capacity reference line
        chartGroup.append("line")
            .attr("x1", 0)
            .attr("x2", innerWidth)
            .attr("y1", yScale(capacity))
            .attr("y2", yScale(capacity))
            .attr("stroke", "#ccc")
            .attr("stroke-width", 2);

        // Draw available single tickets line (capacity minus subscriptions)
        const subscriptionSeats = performance.subscriptionTicketsSold || 0;
        const availableSingleCapacity = capacity - subscriptionSeats;
        chartGroup.append("line")
            .attr("x1", 0)
            .attr("x2", innerWidth)
            .attr("y1", yScale(availableSingleCapacity))
            .attr("y2", yScale(availableSingleCapacity))
            .attr("stroke", "#9b59b6")  // Purple
            .attr("stroke-width", 2);

        // Position labels to naturally avoid collisions
        const capacityY = yScale(capacity);
        const availableY = yScale(availableSingleCapacity);

        // Total Capacity label - ABOVE its line, left-aligned
        chartGroup.append("text")
            .attr("x", 5)
            .attr("y", capacityY - 5)
            .attr("text-anchor", "start")
            .attr("fill", "#999")
            .attr("font-size", "12px")
            .attr("font-weight", "600")
            .text(`Total Capacity (${capacity.toLocaleString()})`);

        // Available Single Tickets label - BELOW its line, left-aligned
        chartGroup.append("text")
            .attr("x", 5)
            .attr("y", availableY + 15)
            .attr("text-anchor", "start")
            .attr("fill", "#9b59b6")
            .attr("font-size", "12px")
            .attr("font-weight", "600")
            .text(`Available Single Tickets (${availableSingleCapacity.toLocaleString()})`);

        // REMOVED: Green target sales line - now using historical comp lines instead
        // The target comp is marked with is_target flag and shown with thick orange line

        // REMOVED: Current sales point (red dot) - no longer needed

        // REMOVED: Target line data points - now using historical comp data points instead

        // X-axis with responsive tick formatting
        const xAxisGenerator = d3.axisBottom(xScale);
        const [maxWeek, minWeek] = xScale.domain(); // Domain is [max, 0] since we flip it

        if (this.isMobile) {
            // On mobile: show fewer ticks and use shorter labels
            // Generate tick values: show every 3rd week, plus 0 (show day)
            const tickValues = [];
            for (let w = maxWeek; w >= minWeek; w -= 3) {
                tickValues.push(w);
            }
            // Always include 0 if not already there
            if (!tickValues.includes(0)) {
                tickValues.push(0);
            }
            tickValues.sort((a, b) => b - a); // Sort descending (matches x-axis direction)

            xAxisGenerator
                .tickValues(tickValues)
                .tickFormat(d => d === 0 ? 'Show' : `${d}w`);
        } else {
            xAxisGenerator.tickFormat(d => d === 0 ? 'Performance' : `${d}w before`);
        }

        const xAxis = chartGroup.append("g")
            .attr("transform", `translate(0,${innerHeight})`)
            .call(xAxisGenerator);

        // Responsive font sizes
        const tickFontSize = this.isMobile ? "8px" : "11px";
        const labelFontSize = this.isMobile ? "10px" : "12px";

        // Style x-axis tick labels
        xAxis.selectAll("text")
            .style("text-anchor", "end")
            .style("font-size", tickFontSize)
            .style("fill", "#666")
            .attr("dx", this.isMobile ? "-.3em" : "-.5em")
            .attr("dy", ".15em")
            .attr("transform", this.isMobile ? "rotate(-55)" : "rotate(-35)");

        // Style x-axis line and ticks
        xAxis.select(".domain")
            .style("stroke", "#e0e0e0");
        xAxis.selectAll(".tick line")
            .style("stroke", "#e0e0e0");

        // Y-axis
        const yAxis = chartGroup.append("g")
            .call(d3.axisLeft(yScale));

        // Style y-axis
        yAxis.selectAll("text")
            .style("font-size", tickFontSize)
            .style("fill", "#666");
        yAxis.select(".domain")
            .style("stroke", "#e0e0e0");
        yAxis.selectAll(".tick line")
            .style("stroke", "#e0e0e0");

        // X-axis label
        chartGroup.append("text")
            .attr("transform", `translate(${innerWidth / 2}, ${innerHeight + this.margin.bottom - 15})`)
            .style("text-anchor", "middle")
            .style("font-weight", "500")
            .style("font-size", labelFontSize)
            .style("fill", "#666")
            .text(this.isMobile ? "Weeks Before" : "Weeks Before Performance");

        // Y-axis label - position differently on mobile
        if (!this.isMobile) {
            // Desktop: rotated label on left side
            chartGroup.append("text")
                .attr("transform", "rotate(-90)")
                .attr("y", 0 - this.margin.left + 20)
                .attr("x", 0 - (innerHeight / 2))
                .attr("dy", "1em")
                .style("text-anchor", "middle")
                .style("font-weight", "500")
                .style("font-size", labelFontSize)
                .style("fill", "#666")
                .text("Cumulative Tickets Sold");
        } else {
            // Mobile: shorter label, positioned with more space from tick labels
            chartGroup.append("text")
                .attr("transform", "rotate(-90)")
                .attr("y", 0 - this.margin.left + 6)
                .attr("x", 0 - (innerHeight / 2))
                .attr("dy", "1em")
                .style("text-anchor", "middle")
                .style("font-weight", "500")
                .style("font-size", "9px")
                .style("fill", "#666")
                .text("Tickets Sold");
        }

        // Add performance tracking status
        await this.addTrackingStatus(chartGroup, performance, innerWidth);

        // Add legend FIRST (before comparison lines so they can update it)
        this.addLegend(chartGroup, innerWidth);

        // Render comparison lines (will update the legend)
        this.renderComparisonLines(chartGroup, xScale, yScale, performance);

        // Render projected sales line (capped at available single tickets)
        await this.renderProjectionLine(chartGroup, xScale, yScale, performance, currentSales, weeksToPerformance, comparisons, availableSingleCapacity);

        // Add tooltips for the single current sales point
        this.addTooltips(currentSales, weeksToPerformance, performance);
    }

    calculateTrackingMetrics(targetComp, performance, singleTicketsSold, weeksToPerformance, performanceDate) {
        const numWeeks = targetComp.weeksArray.length;

        // Use historical snapshot data if available
        let actualWeek, actualSales;
        if (this.historicalData && this.historicalData.length > 0) {
            const parseDate = d3.timeParse('%Y-%m-%d');
            const historicalPoints = this.historicalData.map(snapshot => {
                const snapshotDate = parseDate(snapshot.snapshot_date);
                const daysOut = (performanceDate - snapshotDate) / (24 * 60 * 60 * 1000);
                const exactWeeksOut = daysOut / 7;
                return {
                    week: Math.max(0, exactWeeksOut),
                    tickets: snapshot.single_tickets_sold || 0
                };
            }).filter(d => d.week >= 0 && d.week <= 10)
              .sort((a, b) => b.week - a.week);

            if (historicalPoints.length > 0) {
                const lastPoint = historicalPoints[historicalPoints.length - 1];
                actualWeek = lastPoint.week;
                actualSales = lastPoint.tickets;
            } else {
                actualWeek = weeksToPerformance;
                actualSales = singleTicketsSold;
            }
        } else {
            actualWeek = weeksToPerformance;
            actualSales = singleTicketsSold;
        }

        // Calculate target comp value at actual week using interpolation
        const lowerWeek = Math.floor(actualWeek);
        const upperWeek = Math.ceil(actualWeek);
        const lowerWeekIndex = numWeeks - 1 - lowerWeek;
        const upperWeekIndex = numWeeks - 1 - upperWeek;

        // Handle sparse weeksArray (e.g. ",,,,,,,,,,,672" -> [672] with only 1 element)
        let targetCompSales;
        if (lowerWeekIndex < 0 || upperWeekIndex < 0 || upperWeekIndex >= numWeeks || lowerWeekIndex >= numWeeks) {
            // Use final sales value as baseline when weeks data is sparse or out of range
            targetCompSales = targetComp.weeksArray[numWeeks - 1];
        } else if (lowerWeek === upperWeek) {
            targetCompSales = targetComp.weeksArray[lowerWeekIndex];
        } else {
            const lowerValue = targetComp.weeksArray[lowerWeekIndex];
            const upperValue = targetComp.weeksArray[upperWeekIndex];
            const fraction = actualWeek - lowerWeek;
            targetCompSales = lowerValue + (upperValue - lowerValue) * fraction;
        }

        // Calculate variance
        const variance = actualSales - targetCompSales;

        // Determine status
        let status = "On Track";
        let badgeColor = "#f59e0b"; // Amber

        if (variance < -targetCompSales * 0.1) {
            status = "Behind";
            badgeColor = "#ef4444"; // Red
        } else if (variance > targetCompSales * 0.1) {
            status = "Ahead";
            badgeColor = "#10b981"; // Green
        }

        // Calculate projected final metrics
        const capacity = performance.capacity || 0;
        const currentSingleRevenue = performance.singleTicketRevenue || 0;
        const targetCompFinal = targetComp.weeksArray[numWeeks - 1];
        const subscriptionSeats = performance.subscriptionTicketsSold || 0;
        const availableSingleCapacity = capacity - subscriptionSeats;
        // Project final sales: target comp final + variance, capped at available capacity
        // IMPORTANT: Floor at actual sales - can't project fewer tickets than already sold
        const projectedFinal = Math.round(Math.max(actualSales, Math.min(targetCompFinal + variance, availableSingleCapacity)));
        const avgTicketPrice = singleTicketsSold > 0 ? currentSingleRevenue / singleTicketsSold : 0;
        const projectedRevenue = Math.round(projectedFinal * avgTicketPrice);

        return {
            variance,
            status,
            badgeColor,
            singleTicketsSold,
            currentSingleRevenue,
            projectedFinal,
            projectedRevenue,
            targetComp
        };
    }

    async addTrackingStatus(chartGroup, performance, innerWidth) {
        // Track ONLY single ticket sales vs target historical comp
        const singleTicketsSold = performance.singleTicketsSold || 0;

        const today = new Date();
        const [perfYear, perfMonth, perfDay] = performance.date.split('-');
        const performanceDate = new Date(perfYear, perfMonth - 1, perfDay);
        const weeksToPerformance = Math.max(1, Math.ceil((performanceDate - today) / (7 * 24 * 60 * 60 * 1000)));

        // Get target comp data
        const performanceCode = performance.performanceCode || performance.performanceId;
        const comparisons = await window.dataService.getPerformanceComparisons(performanceCode);
        const targetComp = comparisons?.find(c => c.is_target === true);

        if (!targetComp || !targetComp.weeksArray) return; // No target comp set

        // Route to appropriate rendering method
        if (this.isMobile) {
            await this.addTrackingStatusHTML(performance, targetComp, singleTicketsSold, weeksToPerformance, performanceDate);
        } else {
            await this.addTrackingStatusSVG(chartGroup, performance, targetComp, singleTicketsSold, weeksToPerformance, performanceDate, innerWidth);
        }
    }

    async addTrackingStatusSVG(chartGroup, performance, targetComp, singleTicketsSold, weeksToPerformance, performanceDate, innerWidth) {
        // Calculate tracking metrics
        const metrics = this.calculateTrackingMetrics(
            targetComp,
            performance,
            singleTicketsSold,
            weeksToPerformance,
            performanceDate
        );

        if (!metrics) return; // Couldn't calculate metrics

        const { variance, status, badgeColor, currentSingleRevenue, projectedFinal, projectedRevenue } = metrics;

        const statusGroup = chartGroup.append("g")
            .attr("transform", `translate(${innerWidth + 20}, 10)`);

        // Beautiful gradient background
        const gradient = chartGroup.append("defs")
            .append("linearGradient")
            .attr("id", "metricsGradient")
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "0%")
            .attr("y2", "100%");

        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", "#667eea")
            .attr("stop-opacity", 1);

        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", "#764ba2")
            .attr("stop-opacity", 1);

        // Main box with gradient
        statusGroup.append("rect")
            .attr("width", 180)
            .attr("height", 175)
            .attr("fill", "url(#metricsGradient)")
            .attr("rx", 8)
            .attr("filter", "drop-shadow(0 2px 8px rgba(102, 126, 234, 0.3))");

        // Header
        statusGroup.append("text")
            .attr("x", 90)
            .attr("y", 18)
            .attr("text-anchor", "middle")
            .attr("font-size", "13px")
            .attr("font-weight", "600")
            .attr("fill", "white")
            .text("📊 Tracking Status");

        // Status badge with GYR color coding
        statusGroup.append("rect")
            .attr("x", 25)
            .attr("y", 25)
            .attr("width", 130)
            .attr("height", 22)
            .attr("fill", badgeColor)
            .attr("rx", 11)
            .attr("opacity", 0.9);

        statusGroup.append("text")
            .attr("x", 90)
            .attr("y", 40)
            .attr("text-anchor", "middle")
            .attr("font-size", "12px")
            .attr("font-weight", "bold")
            .attr("fill", "white")
            .text(`${status} ${variance > 0 ? '+' : ''}${Math.round(variance).toLocaleString()}`);

        // Current section
        statusGroup.append("text")
            .attr("x", 90)
            .attr("y", 62)
            .attr("text-anchor", "middle")
            .attr("font-size", "10px")
            .attr("font-weight", "600")
            .attr("fill", "rgba(255, 255, 255, 0.7)")
            .text("CURRENT");

        statusGroup.append("text")
            .attr("x", 90)
            .attr("y", 84)
            .attr("text-anchor", "middle")
            .attr("font-size", "18px")
            .attr("font-weight", "600")
            .attr("fill", "white")
            .text(`${singleTicketsSold.toLocaleString()} · $${(currentSingleRevenue / 1000).toFixed(0)}k`);

        // Divider line
        statusGroup.append("line")
            .attr("x1", 30)
            .attr("x2", 150)
            .attr("y1", 100)
            .attr("y2", 100)
            .attr("stroke", "rgba(255, 255, 255, 0.3)")
            .attr("stroke-width", 1);

        // Projected section
        statusGroup.append("text")
            .attr("x", 90)
            .attr("y", 116)
            .attr("text-anchor", "middle")
            .attr("font-size", "10px")
            .attr("font-weight", "600")
            .attr("fill", "rgba(255, 255, 255, 0.7)")
            .text("PROJECTED FINAL");

        statusGroup.append("text")
            .attr("x", 90)
            .attr("y", 138)
            .attr("text-anchor", "middle")
            .attr("font-size", "18px")
            .attr("font-weight", "600")
            .attr("fill", "white")
            .text(`${projectedFinal.toLocaleString()} · $${(projectedRevenue / 1000).toFixed(0)}k`);

        // Projection basis note
        statusGroup.append("text")
            .attr("x", 90)
            .attr("y", 160)
            .attr("text-anchor", "middle")
            .attr("font-size", "8px")
            .attr("font-style", "italic")
            .attr("fill", "rgba(255, 255, 255, 0.6)")
            .text(`Based on ${targetComp.comparison_name}`)
            .each(function() {
                const text = d3.select(this);
                const textLength = this.getComputedTextLength();
                if (textLength > 160) {
                    text.text(text.text().substring(0, 20) + "...");
                }
            });
    }

    async addTrackingStatusHTML(performance, targetComp, singleTicketsSold, weeksToPerformance, performanceDate) {
        // Calculate tracking metrics
        const metrics = this.calculateTrackingMetrics(
            targetComp,
            performance,
            singleTicketsSold,
            weeksToPerformance,
            performanceDate
        );

        if (!metrics) return; // Couldn't calculate metrics

        const { variance, status, badgeColor, currentSingleRevenue, projectedFinal, projectedRevenue } = metrics;

        // Create HTML status box below the chart
        const container = d3.select(`#${this.containerId}`);

        const statusBox = container
            .append("div")
            .attr("class", "mobile-status-box")
            .style("background", "linear-gradient(135deg, #667eea 0%, #764ba2 100%)")
            .style("border-radius", "12px")
            .style("padding", "12px")
            .style("margin-top", "12px")
            .style("color", "white")
            .style("box-shadow", "0 2px 8px rgba(102, 126, 234, 0.3)");

        // Header with status badge - compact single line
        const headerRow = statusBox.append("div")
            .style("display", "flex")
            .style("justify-content", "space-between")
            .style("align-items", "center")
            .style("margin-bottom", "10px");

        headerRow.append("div")
            .style("font-size", "12px")
            .style("font-weight", "600")
            .text("📊 Sales Tracking");

        // Status badge inline
        headerRow.append("div")
            .style("background-color", badgeColor)
            .style("border-radius", "10px")
            .style("padding", "4px 10px")
            .style("font-size", "11px")
            .style("font-weight", "bold")
            .text(`${status} ${variance > 0 ? '+' : ''}${Math.round(variance).toLocaleString()}`);

        // Two-column layout for Current and Projected
        const metricsRow = statusBox.append("div")
            .style("display", "flex")
            .style("gap", "10px");

        // Current section (left column)
        const currentSection = metricsRow.append("div")
            .style("flex", "1")
            .style("background", "rgba(255, 255, 255, 0.1)")
            .style("border-radius", "8px")
            .style("padding", "10px")
            .style("text-align", "center");

        currentSection.append("div")
            .style("font-size", "9px")
            .style("font-weight", "600")
            .style("color", "rgba(255, 255, 255, 0.7)")
            .style("margin-bottom", "4px")
            .style("text-transform", "uppercase")
            .style("letter-spacing", "0.5px")
            .text("Current");

        currentSection.append("div")
            .style("font-size", "20px")
            .style("font-weight", "700")
            .style("line-height", "1.1")
            .text(singleTicketsSold.toLocaleString());

        currentSection.append("div")
            .style("font-size", "11px")
            .style("color", "rgba(255, 255, 255, 0.8)")
            .style("margin-top", "2px")
            .text(`$${(currentSingleRevenue / 1000).toFixed(0)}k`);

        // Arrow indicator between columns
        metricsRow.append("div")
            .style("display", "flex")
            .style("align-items", "center")
            .style("font-size", "16px")
            .style("color", "rgba(255, 255, 255, 0.6)")
            .text("→");

        // Projected section (right column)
        const projectedSection = metricsRow.append("div")
            .style("flex", "1")
            .style("background", "rgba(255, 255, 255, 0.15)")
            .style("border-radius", "8px")
            .style("padding", "10px")
            .style("text-align", "center");

        projectedSection.append("div")
            .style("font-size", "9px")
            .style("font-weight", "600")
            .style("color", "rgba(255, 255, 255, 0.7)")
            .style("margin-bottom", "4px")
            .style("text-transform", "uppercase")
            .style("letter-spacing", "0.5px")
            .text("Projected");

        projectedSection.append("div")
            .style("font-size", "20px")
            .style("font-weight", "700")
            .style("line-height", "1.1")
            .text(projectedFinal.toLocaleString());

        projectedSection.append("div")
            .style("font-size", "11px")
            .style("color", "rgba(255, 255, 255, 0.8)")
            .style("margin-top", "2px")
            .text(`$${(projectedRevenue / 1000).toFixed(0)}k`);

        // Projection basis note - compact
        statusBox.append("div")
            .style("text-align", "center")
            .style("font-size", "9px")
            .style("font-style", "italic")
            .style("color", "rgba(255, 255, 255, 0.5)")
            .style("margin-top", "8px")
            .text(`vs ${targetComp.comparison_name}`);
    }

    addLegend(chartGroup, innerWidth) {
        if (this.isMobile) {
            // Mobile: legend will be added as HTML below chart
            return;
        }

        // Desktop/Tablet: SVG legend on right side
        const legend = chartGroup.append("g")
            .attr("class", "chart-legend")
            .attr("transform", `translate(${innerWidth + 20}, 230)`);

        const legendItems = [
            { label: "Actual Ticket Sales", color: "#3498db", style: "solid", lineWidth: 3 },
            { label: "Available Single Tickets", color: "#9b59b6", style: "solid" },
            { label: "Total Capacity", color: "#ccc", style: "solid" }
        ];

        legendItems.forEach((item, i) => {
            const legendRow = legend.append("g")
                .attr("transform", `translate(0, ${i * 20})`);

            legendRow.append("line")
                .attr("x1", 0)
                .attr("x2", 20)
                .attr("y1", 10)
                .attr("y2", 10)
                .attr("stroke", item.color)
                .attr("stroke-width", item.lineWidth || 3)
                .attr("stroke-dasharray", item.style === "dashed" ? "5,3" : "none");

            legendRow.append("text")
                .attr("x", 25)
                .attr("y", 14)
                .style("font-size", "12px")
                .text(item.label);
        });
    }

    addLegendHTML(comparisons) {
        const container = d3.select(`#${this.containerId}`);

        const legendBox = container
            .append("div")
            .attr("class", "mobile-legend")
            .style("background", "#f8f9fa")
            .style("border-radius", "8px")
            .style("margin-top", "12px")
            .style("overflow", "hidden");

        // Collapsible header
        const legendHeader = legendBox.append("div")
            .attr("class", "mobile-legend-header")
            .style("display", "flex")
            .style("justify-content", "space-between")
            .style("align-items", "center")
            .style("padding", "10px 12px")
            .style("cursor", "pointer")
            .style("user-select", "none")
            .style("background", "#eef1f5")
            .style("border-bottom", "1px solid #dde3eb");

        legendHeader.append("span")
            .style("font-size", "11px")
            .style("font-weight", "600")
            .style("color", "#333")
            .text("Legend");

        const toggleIcon = legendHeader.append("span")
            .attr("class", "legend-toggle-icon")
            .style("font-size", "12px")
            .style("color", "#666")
            .style("transition", "transform 0.2s")
            .text("▼");

        // Legend content (collapsible)
        const legendContent = legendBox.append("div")
            .attr("class", "mobile-legend-content")
            .style("padding", "10px 12px")
            .style("display", "block"); // Start expanded

        const legendItems = [
            { label: "Actual Sales", color: "#3498db", style: "solid", lineWidth: 3 },
            { label: "Available Singles", color: "#9b59b6", style: "solid" },
            { label: "Total Capacity", color: "#ccc", style: "solid" }
        ];

        // Add comparisons to legend items
        if (comparisons && comparisons.length > 0) {
            comparisons.forEach(comp => {
                const isTarget = comp.is_target === true;
                const color = comp._displayColor || comp.line_color;
                // Truncate long names on mobile
                let label = comp.comparison_name;
                if (label.length > 20) {
                    label = label.substring(0, 18) + '...';
                }
                legendItems.push({
                    label: isTarget ? `★ ${label}` : label,
                    color: color,
                    style: isTarget ? "solid" : comp.line_style,
                    lineWidth: isTarget ? 3 : 1.5
                });
            });

            // Add projection line
            legendItems.push({
                label: "Projected Sales",
                color: "#2ecc71",
                style: "dashed",
                lineWidth: 2.5
            });
        }

        // Use a two-column grid for legend items on mobile
        const legendGrid = legendContent.append("div")
            .style("display", "grid")
            .style("grid-template-columns", "1fr 1fr")
            .style("gap", "6px 12px");

        legendItems.forEach(item => {
            const row = legendGrid.append("div")
                .style("display", "flex")
                .style("align-items", "center");

            // Create line representation
            const lineStyle = item.style === "dashed" ? "dashed" : "solid";
            row.append("div")
                .style("width", "18px")
                .style("height", "0")
                .style("border-top", `${item.lineWidth || 2}px ${lineStyle} ${item.color}`)
                .style("margin-right", "6px")
                .style("flex-shrink", "0");

            row.append("span")
                .style("font-size", "10px")
                .style("color", "#666")
                .style("white-space", "nowrap")
                .style("overflow", "hidden")
                .style("text-overflow", "ellipsis")
                .text(item.label);
        });

        // Toggle functionality
        let isExpanded = true;
        legendHeader.on("click", function() {
            isExpanded = !isExpanded;
            legendContent.style("display", isExpanded ? "block" : "none");
            toggleIcon
                .style("transform", isExpanded ? "rotate(0deg)" : "rotate(-90deg)");
        });
    }

    addTooltips(currentSales, weeksToPerformance, performance) {
        // Remove any existing tooltip first
        d3.select(".sales-curve-tooltip").remove();

        const tooltip = d3.select("body")
            .append("div")
            .attr("class", "sales-curve-tooltip")
            .style("position", "absolute")
            .style("visibility", "hidden")
            .style("background", "rgba(0, 0, 0, 0.9)")
            .style("color", "white")
            .style("padding", this.isMobile ? "8px 10px" : "10px")
            .style("border-radius", "8px")
            .style("font-size", this.isMobile ? "11px" : "12px")
            .style("z-index", "1001")
            .style("pointer-events", "none")
            .style("max-width", this.isMobile ? "200px" : "280px")
            .style("box-shadow", "0 4px 12px rgba(0, 0, 0, 0.3)");

        // Tooltip for current sales point
        this.svg.selectAll(".current-sales-point")
            .on("mouseover", function(event) {
                const capacityPercent = performance.capacity ? ((currentSales / performance.capacity) * 100).toFixed(1) : 'N/A';

                // Calculate ATP and revenue
                const totalRevenue = performance.totalRevenue || performance.total_revenue || 0;
                const totalTickets = (performance.singleTicketsSold || performance.single_tickets_sold || 0) +
                                    (performance.subscriptionTicketsSold || performance.subscription_tickets_sold || 0);
                const atp = totalTickets > 0 ? totalRevenue / totalTickets : 0;
                const currentRevenue = currentSales * atp;

                let atpLine = '';
                if (atp > 0) {
                    atpLine = `ATP: $${atp.toFixed(2)}<br/>Revenue: $${currentRevenue.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}<br/>`;
                }

                tooltip.html(`
                    <strong>Current Sales (${weeksToPerformance} weeks before)</strong><br/>
                    Actual: ${currentSales.toLocaleString()} tickets<br/>
                    Capacity: ${capacityPercent}%<br/>
                    ${atpLine}<em>Compare to historical comp lines below</em>
                `);
                return tooltip.style("visibility", "visible");
            })
            .on("mousemove", (event) => {
                this.positionTooltip(tooltip, event);
            })
            .on("mouseout", function() {
                return tooltip.style("visibility", "hidden");
            });

        // REMOVED: Tooltip for target line points - using historical comp tooltips instead
    }

    async renderComparisonLines(chartGroup, xScale, yScale, performance) {
        // Fetch comparisons for this performance
        // Use performanceCode (Tessitura code) for comp lookups
        const performanceCode = performance.performanceCode || performance.performanceId;
        const comparisons = await window.dataService.getPerformanceComparisons(performanceCode);

        if (!comparisons || comparisons.length === 0) {
            return; // No comparisons to render
        }

        // Calculate max weeks from comparisons to potentially extend x-axis
        const maxComparisonWeeks = Math.max(...comparisons.map(c => c.weeksArray.length));

        // Assign display colors: target=orange, then purple, then gray
        const nonTargetColors = ['#9b59b6', '#999999'];
        let nonTargetIndex = 0;
        comparisons.forEach(comparison => {
            if (comparison.is_target === true) {
                comparison._displayColor = '#e67e22';
            } else {
                comparison._displayColor = nonTargetColors[nonTargetIndex] || '#999999';
                nonTargetIndex++;
            }
        });

        // Render each comparison line
        comparisons.forEach(comparison => {
            this.renderSingleComparison(chartGroup, xScale, yScale, comparison);
        });

        // Update legend to include comparisons
        if (this.isMobile) {
            // Mobile: add HTML legend below chart
            this.addLegendHTML(comparisons);
        } else {
            // Desktop/Tablet: update SVG legend
            this.updateLegendWithComparisons(chartGroup, comparisons);
        }
    }

    renderSingleComparison(chartGroup, xScale, yScale, comparison) {
        const self = this; // For use in D3 callbacks

        // Parse CSV data
        // Input format: "10,20,30,40,50,60,70,80,90"
        // First value (10) = farthest week out
        // Last value (90) = performance day (week 0)
        const weeksArray = [...comparison.weeksArray]; // Make a copy to avoid mutating original
        const numWeeks = weeksArray.length;

        // Create data points
        const comparisonData = [];

        // Map array: first value = week (N-1), last value = week 0
        for (let i = 0; i < numWeeks; i++) {
            comparisonData.push({
                week: numWeeks - 1 - i, // First iteration: week N-1, last iteration: week 0
                sales: weeksArray[i]
            });
        }

        // Line generator
        const line = d3.line()
            .x(d => xScale(d.week))
            .y(d => yScale(d.sales))
            .curve(d3.curveMonotoneX);

        // Determine styling based on is_target flag
        const isTarget = comparison.is_target === true;
        const color = comparison._displayColor || comparison.line_color;
        const strokeWidth = isTarget ? 3 : 1.5;
        const strokeDasharray = isTarget ? 'none' : this.getStrokeDashArray(comparison.line_style);
        const opacity = isTarget ? 1.0 : 0.35;

        // Draw comparison line
        chartGroup.append("path")
            .datum(comparisonData)
            .attr("class", `comparison-line comparison-${comparison.comparison_id} ${isTarget ? 'target-comp' : ''}`)
            .attr("d", line)
            .attr("fill", "none")
            .attr("stroke", color)
            .attr("stroke-width", strokeWidth)
            .attr("stroke-dasharray", strokeDasharray)
            .attr("stroke-linecap", "round")
            .attr("stroke-linejoin", "round")
            .attr("opacity", opacity)
            .style("filter", `drop-shadow(0 1px 2px ${color}40)`);

        // Add data points for comparison line
        const pointRadius = this.isMobile ? 5 : 3.5; // Larger on mobile for touch
        const hoverRadius = this.isMobile ? 7 : 5.5;

        chartGroup.selectAll(`.comparison-point-${comparison.comparison_id}`)
            .data(comparisonData)
            .enter()
            .append("circle")
            .attr("class", `comparison-point comparison-point-${comparison.comparison_id}`)
            .attr("cx", d => xScale(d.week))
            .attr("cy", d => yScale(d.sales))
            .attr("r", pointRadius)
            .attr("fill", color)
            .attr("stroke", "white")
            .attr("stroke-width", 1.5)
            .attr("opacity", isTarget ? 0.7 : 0.35)
            .style("cursor", "pointer")
            .on("mouseover", function(event, d) {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("r", hoverRadius)
                    .attr("opacity", 1);

                // Show tooltip
                const tooltip = d3.select(".sales-curve-tooltip");
                if (tooltip.empty()) return;

                const weekLabel = d.week === 0 ? 'Performance Day' : `${d.week} week${d.week > 1 ? 's' : ''} before`;
                const targetBadge = comparison.is_target ? '<span style="color: gold; font-weight: bold;">★ TARGET COMP</span><br/>' : '';

                // Show stored occupancy % and subscription info if available
                // Only show metadata at performance day (week 0) since that's the final data
                let occupancyLine = '';
                let atpLine = '';
                let revenueLine = '';

                if (d.week === 0) {
                    if (comparison.occupancy_percent && comparison.occupancy_percent > 0) {
                        occupancyLine = `Occupancy: ${parseFloat(comparison.occupancy_percent).toFixed(1)}%<br/>`;
                    }

                    if (comparison.atp && comparison.atp > 0) {
                        atpLine = `Blended ATP: $${comparison.atp.toFixed(2)}<br/>`;
                        // Calculate total revenue including subscriptions
                        const subs = comparison.subs || 0;
                        const totalTickets = d.sales + subs;
                        const revenue = totalTickets * comparison.atp;
                        revenueLine = `Revenue: $${revenue.toLocaleString()}<br/>`;
                    }
                }

                // Build tooltip with metadata
                let metadataSection = '';
                if (occupancyLine || atpLine || revenueLine) {
                    metadataSection = `<br/><em style="font-size: 10px; color: #ccc;">Comp Metadata:</em><br/>${occupancyLine}${atpLine}${revenueLine}`;
                }

                tooltip.html(`
                    ${targetBadge}
                    <strong>${comparison.comparison_name}</strong><br/>
                    ${weekLabel}<br/>
                    Target: ${d.sales.toLocaleString()} tickets${metadataSection}
                `);
                tooltip.style("visibility", "visible");
            })
            .on("mousemove", function(event) {
                const tooltip = d3.select(".sales-curve-tooltip");
                self.positionTooltip(tooltip, event);
            })
            .on("mouseout", function() {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("r", pointRadius)  // Match default size
                    .attr("opacity", 0.7);

                const tooltip = d3.select(".sales-curve-tooltip");
                tooltip.style("visibility", "hidden");
            });
    }

    async renderProjectionLine(chartGroup, xScale, yScale, performance, currentSales, weeksToPerformance, comparisons, availableSingleCapacity) {
        const self = this; // For use in D3 callbacks

        // Only render projection if we have a target comp and performance is in the future
        if (!comparisons || comparisons.length === 0 || weeksToPerformance <= 0) {
            return;
        }

        // Also check actual performance date to ensure we don't project for past performances
        const [perfYear, perfMonth, perfDay] = performance.date.split('-');
        const performanceDate = new Date(perfYear, perfMonth - 1, perfDay);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        performanceDate.setHours(0, 0, 0, 0);

        if (performanceDate < today) {
            return; // Don't show projection for past performances
        }

        const targetComp = comparisons.find(c => c.is_target === true);
        if (!targetComp || !targetComp.weeksArray) {
            return; // No target comp to project from
        }

        const numWeeks = targetComp.weeksArray.length;

        // Use last historical point if available, otherwise use current calculated values
        let actualWeek, actualSales;

        if (this.historicalData && this.historicalData.length > 0) {
            // Parse performance date consistently (midnight local time)
            // Must use component-based constructor to avoid UTC/local timezone issues
            const [perfYear, perfMonth, perfDay] = performance.date.split('-');
            const performanceDate = new Date(parseInt(perfYear), parseInt(perfMonth) - 1, parseInt(perfDay));
            const parseDate = d3.timeParse('%Y-%m-%d');

            const historicalPoints = this.historicalData.map(snapshot => {
                const snapshotDate = parseDate(snapshot.snapshot_date);
                const daysOut = (performanceDate - snapshotDate) / (24 * 60 * 60 * 1000);
                const exactWeeksOut = daysOut / 7;
                return {
                    week: Math.max(0, exactWeeksOut),
                    daysOut: Math.max(0, daysOut),  // Store days for tooltip display
                    tickets: snapshot.single_tickets_sold || 0,
                    snapshot_date: snapshot.snapshot_date
                };
            }).filter(d => d.week >= 0 && d.week <= 10)
              .sort((a, b) => b.week - a.week); // Sort by week descending (oldest first)

            if (historicalPoints.length > 0) {
                // Get the LAST element (most recent snapshot = smallest week number)
                const lastPoint = historicalPoints[historicalPoints.length - 1];

                // Use the last snapshot's week position so projection connects to last blue dot
                actualWeek = lastPoint.week;
                actualSales = lastPoint.tickets;
                var actualDaysOut = lastPoint.daysOut;  // Store for tooltip display

                console.log('📈 Using historical endpoint for projection:');
                console.log('   Last snapshot date:', lastPoint.snapshot_date);
                console.log('   Exact weeks out:', actualWeek.toFixed(2));
                console.log('   Days out:', actualDaysOut);
                console.log('   Actual sales from snapshot:', actualSales);
            } else {
                // No valid historical points
                actualWeek = weeksToPerformance;
                actualSales = currentSales;
                console.log('📈 No valid historical points, using calculated values');
            }
        } else {
            // Fallback to calculated values
            actualWeek = weeksToPerformance;
            actualSales = currentSales;
            console.log('📈 No historical data, using calculated values:');
            console.log('   Calculated weeks out:', actualWeek);
            console.log('   Current sales:', actualSales);
        }

        // Calculate target comp value at actualWeek using interpolation for accurate variance
        // This ensures the projection starts exactly on the shifted target comp curve
        const lowerWeek = Math.floor(actualWeek);
        const upperWeek = Math.ceil(actualWeek);
        const lowerWeekIndex = numWeeks - 1 - lowerWeek;
        const upperWeekIndex = numWeeks - 1 - upperWeek;

        // Handle sparse weeksArray (e.g. ",,,,,,,,,,,672" -> [672] with only 1 element)
        let targetCompAtActualWeek;
        if (lowerWeekIndex < 0 || upperWeekIndex < 0 || upperWeekIndex >= numWeeks || lowerWeekIndex >= numWeeks) {
            // Use final sales value as baseline when weeks data is sparse or out of range
            targetCompAtActualWeek = targetComp.weeksArray[numWeeks - 1];
        } else if (lowerWeek === upperWeek) {
            // actualWeek is an integer, use direct value
            targetCompAtActualWeek = targetComp.weeksArray[lowerWeekIndex];
        } else {
            // Interpolate between the two surrounding weeks
            const lowerValue = targetComp.weeksArray[lowerWeekIndex];
            const upperValue = targetComp.weeksArray[upperWeekIndex];
            const fraction = actualWeek - lowerWeek;
            targetCompAtActualWeek = lowerValue + (upperValue - lowerValue) * fraction;
        }

        // Calculate absolute variance at actual week (using interpolated target comp value)
        const variance = actualSales - targetCompAtActualWeek;

        console.log('   Actual week (interpolated):', actualWeek.toFixed(2));
        console.log('   Target comp at actual week (interpolated):', targetCompAtActualWeek.toFixed(1));
        console.log('   Absolute variance:', variance, 'tickets');
        console.log('   Available single capacity cap:', availableSingleCapacity);

        // Generate projection data from current week to performance date
        const projectionData = [];

        // Start with actual sales point (from historical data or current)
        projectionData.push({
            week: actualWeek,
            projectedSales: actualSales
        });

        // Project future weeks using absolute variance, capped at available single tickets
        // Generate points for ALL integer weeks from current down to 0 to ensure
        // the projection follows the exact same curve shape as the target comp
        for (let week = Math.floor(actualWeek); week >= 0; week--) {
            const weekIndex = numWeeks - 1 - week;
            if (weekIndex >= 0 && weekIndex < numWeeks) {
                const targetCompAtWeek = targetComp.weeksArray[weekIndex];
                const projectedSales = targetCompAtWeek + variance;

                // Cap between actualSales (floor) and available single tickets capacity (ceiling)
                // Floor at actualSales: can't project fewer tickets than already sold
                const cappedProjection = Math.round(Math.min(
                    Math.max(actualSales, projectedSales),
                    availableSingleCapacity
                ));

                projectionData.push({
                    week: week,
                    projectedSales: cappedProjection
                });

                console.log(`   Week ${week}: target=${targetCompAtWeek}, projected=${projectedSales}, capped=${cappedProjection}`);
            }
        }

        // Draw projection line
        const line = d3.line()
            .x(d => xScale(d.week))
            .y(d => yScale(d.projectedSales))
            .curve(d3.curveMonotoneX);

        chartGroup.append("path")
            .datum(projectionData)
            .attr("class", "projection-line")
            .attr("d", line)
            .attr("fill", "none")
            .attr("stroke", "#2ecc71")  // Green
            .attr("stroke-width", 2.5)
            .attr("stroke-dasharray", "8,4")  // Dashed
            .attr("stroke-linecap", "round")
            .attr("stroke-linejoin", "round")
            .attr("opacity", 0.8)
            .style("filter", "drop-shadow(0 1px 2px #2ecc7140)");

        // Add data points for projection line
        const projPointRadius = this.isMobile ? 6 : 4; // Larger on mobile for touch
        const projHoverRadius = this.isMobile ? 8 : 6;

        chartGroup.selectAll(".projection-point")
            .data(projectionData)
            .enter()
            .append("circle")
            .attr("class", "projection-point")
            .attr("cx", d => xScale(d.week))
            .attr("cy", d => yScale(d.projectedSales))
            .attr("r", projPointRadius)
            .attr("fill", "#2ecc71")
            .attr("stroke", "white")
            .attr("stroke-width", 1.5)
            .attr("opacity", 0.7)
            .style("cursor", "pointer")
            .on("mouseover", function(event, d) {
                console.log('🎯 Projection point mouseover:', d.week, 'weeks before');

                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("r", projHoverRadius)
                    .attr("opacity", 1);

                const tooltip = d3.select(".sales-curve-tooltip");
                if (tooltip.empty()) return;

                // Show days if less than 1 week, otherwise show weeks
                let weekLabel;
                if (d.week === 0) {
                    weekLabel = 'Performance Day';
                } else if (d.week < 1) {
                    const days = Math.round(d.week * 7);
                    weekLabel = `${days} day${days !== 1 ? 's' : ''} before performance`;
                } else {
                    const weeks = Math.round(d.week);
                    weekLabel = `${weeks} week${weeks !== 1 ? 's' : ''} before`;
                }

                // Check if this is the current sales point (first point in projection)
                // Use actualWeek which may be decimal (from historical data)
                const isCurrentPoint = Math.abs(d.week - actualWeek) < 0.01;
                console.log('   isCurrentPoint?', isCurrentPoint, '(d.week:', d.week, 'actualWeek:', actualWeek, ')');

                if (isCurrentPoint) {
                    // Show actual sales data for current point (from historical snapshot or current)
                    const singleTickets = actualSales;
                    const subscriptionTickets = performance.subscriptionTicketsSold || 0;
                    const totalSeats = singleTickets + subscriptionTickets;

                    // Ensure we handle both string and number types properly
                    const capacityValue = typeof performance.capacity === 'string'
                        ? parseFloat(performance.capacity)
                        : (performance.capacity || 0);
                    const capacity = capacityValue > 0 ? capacityValue : 0;

                    const revenueValue = typeof performance.totalRevenue === 'string'
                        ? parseFloat(performance.totalRevenue)
                        : (performance.totalRevenue || 0);
                    const revenue = revenueValue > 0 ? revenueValue : 0;

                    // Occupancy = (single + subscription) / total capacity
                    const occupancyPercent = capacity > 0 ? ((totalSeats / capacity) * 100).toFixed(1) : '0.0';

                    // Get ATP for single tickets
                    const atp = performance.single_atp || 0;

                    tooltip.html(`
                        <strong style="color: #3498db;">🎫 Current Sales</strong><br/>
                        ${weekLabel}<br/>
                        Single Tickets: ${singleTickets.toLocaleString()}<br/>
                        Occupancy: ${occupancyPercent}%<br/>
                        Single Ticket ATP: $${atp.toFixed(2)}<br/>
                        Revenue: $${revenue.toLocaleString()}<br/>
                        <em style="font-size: 10px;">Tracking ${variance >= 0 ? 'ahead' : 'behind'} target by ${Math.abs(variance).toLocaleString()} tickets</em>
                    `);
                } else {
                    // Show projected data for future points with occupancy and estimated revenue
                    const projectedSingleTickets = Math.round(d.projectedSales);
                    const subscriptionTickets = performance.subscriptionTicketsSold || 0;
                    const projectedTotalSeats = projectedSingleTickets + subscriptionTickets;
                    const capacity = parseFloat(performance.capacity) || 0;

                    // Occupancy = (projected single + subscription) / total capacity
                    const projectedOccupancy = capacity > 0 ? ((projectedTotalSeats / capacity) * 100).toFixed(1) : '0.0';

                    // Estimate revenue based on current single ticket average price
                    const currentSingleRevenue = parseFloat(performance.singleTicketRevenue) || 0;
                    const avgTicketPrice = actualSales > 0 ? currentSingleRevenue / actualSales : 0;
                    const projectedRevenue = Math.round(projectedSingleTickets * avgTicketPrice);

                    tooltip.html(`
                        <strong style="color: #2ecc71;">📈 Projected Sales</strong><br/>
                        ${weekLabel}<br/>
                        Projected Singles: ${projectedSingleTickets.toLocaleString()}<br/>
                        Occupancy: ${projectedOccupancy}%<br/>
                        Est. Revenue: $${projectedRevenue.toLocaleString()}<br/>
                        <em style="font-size: 10px;">Based on maintaining current ${variance >= 0 ? '+' : ''}${variance.toLocaleString()} ticket variance</em>
                    `);
                }
                tooltip.style("visibility", "visible");
            })
            .on("mousemove", function(event) {
                const tooltip = d3.select(".sales-curve-tooltip");
                self.positionTooltip(tooltip, event);
            })
            .on("mouseout", function() {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("r", projPointRadius)  // Match default size
                    .attr("opacity", 0.7);

                const tooltip = d3.select(".sales-curve-tooltip");
                tooltip.style("visibility", "hidden");
            });

        // Update legend to include projection
        this.addProjectionToLegend(chartGroup, comparisons.length);
    }

    addProjectionToLegend(chartGroup, numComparisons) {
        const legend = chartGroup.select(".chart-legend");
        if (legend.empty()) return;

        // Add projection after all other items
        // 3 default items + comparisons + 1 for projection
        const startIndex = 3 + numComparisons;

        const legendRow = legend.append("g")
            .attr("transform", `translate(0, ${startIndex * 20})`);

        legendRow.append("line")
            .attr("x1", 0)
            .attr("x2", 20)
            .attr("y1", 10)
            .attr("y2", 10)
            .attr("stroke", "#2ecc71")
            .attr("stroke-width", 2.5)
            .attr("stroke-dasharray", "8,4");

        legendRow.append("text")
            .attr("x", 25)
            .attr("y", 14)
            .style("font-size", "11px")
            .style("font-weight", "500")
            .text("Projected Sales");
    }

    getStrokeDashArray(style) {
        const styles = {
            'solid': 'none',
            'dashed': '8,4',
            'dotted': '2,3'
        };
        return styles[style] || 'none';
    }

    updateLegendWithComparisons(chartGroup, comparisons) {
        // Find existing legend and add comparison items
        const legend = chartGroup.select(".chart-legend");

        if (legend.empty()) {
            console.warn('⚠️ Legend not found for comparisons');
            return;
        }

        console.log('📊 Adding', comparisons.length, 'comparisons to legend');

        // Count existing legend items (3 default items: Actual Ticket Sales, Available Single Tickets, Total Capacity)
        const startIndex = 3;

        comparisons.forEach((comp, i) => {
            const isTarget = comp.is_target === true;
            const color = comp._displayColor || comp.line_color;
            const legendRow = legend.append("g")
                .attr("transform", `translate(0, ${(startIndex + i) * 20})`);

            // Add star marker for target comp
            if (isTarget) {
                legendRow.append("text")
                    .attr("x", 0)
                    .attr("y", 14)
                    .style("font-size", "16px")
                    .style("fill", "gold")
                    .style("font-weight", "bold")
                    .text("★");
            }

            // Shift line and text right if target to make room for star
            const xOffset = isTarget ? 18 : 0;

            legendRow.append("line")
                .attr("x1", xOffset)
                .attr("x2", 20 + xOffset)
                .attr("y1", 10)
                .attr("y2", 10)
                .attr("stroke", color)
                .attr("stroke-width", isTarget ? 3 : 1.5)
                .attr("stroke-dasharray", isTarget ? 'none' : this.getStrokeDashArray(comp.line_style));

            legendRow.append("text")
                .attr("x", 25 + xOffset)
                .attr("y", 14)
                .style("font-size", "11px")
                .style("font-weight", isTarget ? "700" : "500")
                .text(isTarget ? `Target Comp: ${comp.comparison_name}` : comp.comparison_name);
        });
    }
}

// Export to global window object
if (typeof window !== 'undefined') {
    window.SalesCurveChart = SalesCurveChart;
}

// Export for module use if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SalesCurveChart;
}