class SalesCurveChart {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.data = [];
        this.svg = null;
        this.width = CONFIG.charts.dimensions.defaultWidth;
        this.height = CONFIG.charts.dimensions.defaultHeight;
        this.margin = { top: 50, right: 220, bottom: 75, left: 70 }; // Proper spacing for labels and legend
        this.selectedPerformance = null;
        this.showSelector = options.showSelector !== false; // Default to true unless explicitly false
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

        // Get container dimensions dynamically
        const containerElement = container.node();
        const containerRect = containerElement.getBoundingClientRect();
        this.width = Math.max(800, containerRect.width - 16); // Account for reduced padding
        this.height = Math.max(350, containerRect.height - 16); // Account for reduced padding, smaller min height

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
        const performanceDate = new Date(performance.date);
        const weeksToPerformance = Math.max(1, Math.ceil((performanceDate - today) / (7 * 24 * 60 * 60 * 1000)));

        console.log('📊 Single ticket sales:', currentSales, 'Subscription sales:', subscriptionSales, 'Weeks to performance:', weeksToPerformance);

        // Calculate maxWeeks dynamically based on comparisons
        const comparisons = await window.dataService.getPerformanceComparisons(performance.performanceId);
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

        // Generate on-track line data based on historic progression
        const onTrackData = this.generateOnTrackLine(performance, maxWeeks, capacity);
        console.log('📊 Target line data:', onTrackData.filter(d => d.hasTarget));

        // Line generator for expected sales only
        // (No actual line since we only have one data point)

        const expectedLine = d3.line()
            .x(d => xScale(d.week))
            .y(d => yScale(d.expectedCumulative))
            .curve(d3.curveMonotoneX)
            .defined(d => d.hasTarget && d.expectedCumulative !== null); // Only draw where we have target data

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
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "5,5");

        // Draw available single tickets line (capacity minus subscriptions)
        const subscriptionSeats = performance.subscriptionTicketsSold || 0;
        const availableSingleCapacity = capacity - subscriptionSeats;
        chartGroup.append("line")
            .attr("x1", 0)
            .attr("x2", innerWidth)
            .attr("y1", yScale(availableSingleCapacity))
            .attr("y2", yScale(availableSingleCapacity))
            .attr("stroke", "#9b59b6")  // Purple
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "4,4");

        // Label for available single tickets line
        chartGroup.append("text")
            .attr("x", innerWidth - 5)
            .attr("y", yScale(availableSingleCapacity) - 5)
            .attr("text-anchor", "end")
            .attr("fill", "#9b59b6")
            .attr("font-size", "12px")
            .attr("font-weight", "600")
            .text(`Available Single Tickets (${availableSingleCapacity.toLocaleString()})`);

        // Draw occupancy goal line (now based on subscription + single ticket target)
        const singleTicketTarget = Math.floor(availableSingleCapacity * (performance.occupancyGoal / 100));
        const occupancyTarget = subscriptionSeats + singleTicketTarget;
        chartGroup.append("line")
            .attr("x1", 0)
            .attr("x2", innerWidth)
            .attr("y1", yScale(occupancyTarget))
            .attr("y2", yScale(occupancyTarget))
            .attr("stroke", CONFIG.charts.colors.occupancyGoal)
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "3,3");

        // Label for occupancy goal line
        chartGroup.append("text")
            .attr("x", innerWidth - 5)
            .attr("y", yScale(occupancyTarget) - 5)
            .attr("text-anchor", "end")
            .attr("fill", CONFIG.charts.colors.occupancyGoal)
            .attr("font-size", "12px")
            .attr("font-weight", "600")
            .text(`Occupancy Goal (${occupancyTarget.toLocaleString()})`);

        // Draw expected sales line (on-track heuristic) - 6 weeks only
        chartGroup.append("path")
            .datum(onTrackData)
            .attr("class", "expected-line")
            .attr("d", expectedLine)
            .attr("fill", "none")
            .attr("stroke", CONFIG.charts.colors.onTrackLine || "#2ca02c")
            .attr("stroke-width", 3)
            .attr("stroke-dasharray", "8,4") // Dashed line to indicate target
            .attr("stroke-linecap", "round")
            .attr("stroke-linejoin", "round")
            .style("filter", "drop-shadow(0 1px 2px rgba(44, 160, 44, 0.2))")
            .attr("opacity", 0.9);

        // Draw single actual sales point (current sales at current week)
        if (currentSales > 0 && weeksToPerformance <= maxWeeks) {
            // Add a subtle glow effect
            chartGroup.append("circle")
                .attr("class", "current-sales-glow")
                .attr("cx", xScale(weeksToPerformance))
                .attr("cy", yScale(currentSales))
                .attr("r", 12)
                .attr("fill", CONFIG.charts.colors.actualSales)
                .attr("opacity", 0.2);

            chartGroup.append("circle")
                .attr("class", "current-sales-point")
                .attr("cx", xScale(weeksToPerformance))
                .attr("cy", yScale(currentSales))
                .attr("r", 8)
                .attr("fill", CONFIG.charts.colors.actualSales)
                .attr("stroke", "white")
                .attr("stroke-width", 3)
                .style("filter", "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))");
        }

        // No multiple actual sales points - only the single current sales point above

        // Render comparison lines
        this.renderComparisonLines(chartGroup, xScale, yScale, performance);

        // Add data points for expected sales (6 weeks only)
        const expectedPoints = chartGroup.selectAll(".expected-point")
            .data(onTrackData.filter(d => d.hasTarget && d.expectedCumulative !== null))
            .enter()
            .append("circle")
            .attr("class", "expected-point")
            .attr("cx", d => xScale(d.week))
            .attr("cy", d => yScale(d.expectedCumulative))
            .attr("r", 4)
            .attr("fill", CONFIG.charts.colors.onTrackLine || "#2ca02c")
            .attr("stroke", "white")
            .attr("stroke-width", 2)
            .attr("opacity", 0.8)
            .style("cursor", "pointer")
            .on("mouseover", function(event, d) {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("r", 6)
                    .attr("opacity", 1);
            })
            .on("mouseout", function(event, d) {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("r", 4)
                    .attr("opacity", 0.8);
            });

        // X-axis
        const xAxis = chartGroup.append("g")
            .attr("transform", `translate(0,${innerHeight})`)
            .call(d3.axisBottom(xScale).tickFormat(d => d === 0 ? 'Performance' : `${d}w before`));

        // Style x-axis tick labels
        xAxis.selectAll("text")
            .style("text-anchor", "end")
            .style("font-size", "11px")
            .style("fill", "#666")
            .attr("dx", "-.5em")
            .attr("dy", ".3em")
            .attr("transform", "rotate(-35)");

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
            .style("font-size", "11px")
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
            .style("font-size", "12px")
            .style("fill", "#666")
            .text("Weeks Before Performance");

        // Y-axis label
        chartGroup.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", 0 - this.margin.left + 20)
            .attr("x", 0 - (innerHeight / 2))
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .style("font-weight", "500")
            .style("font-size", "12px")
            .style("fill", "#666")
            .text("Cumulative Tickets Sold");

        // Add performance tracking status
        this.addTrackingStatus(chartGroup, performance, innerWidth);

        // Add legend
        this.addLegend(chartGroup, innerWidth);

        // Add tooltips for the single current sales point
        this.addTooltips(currentSales, weeksToPerformance, onTrackData, performance);
    }

    generateOnTrackLine(performance, maxWeeks, capacity = null) {
        const useCapacity = capacity || performance.capacity || 2000;

        // NEW LOGIC: Calculate target based on available single tickets ONLY
        // The target line shows the progression toward selling 85% of available single tickets
        const subscriptionSeats = performance.subscriptionTicketsSold || 0;
        const availableSingleTickets = useCapacity - subscriptionSeats;
        const singleTicketTarget = Math.floor(availableSingleTickets * (performance.occupancyGoal / 100));

        // Target sales = ONLY single ticket target (not including subscriptions)
        // This shows the sales curve for single tickets only
        const targetSales = singleTicketTarget;

        const progression = CONFIG.salesCurve.historicSalesProgression;

        console.log('🎯 Target generation (SINGLE TICKET TARGET):');
        console.log('   Total Capacity:', useCapacity);
        console.log('   Subscription Sold:', subscriptionSeats);
        console.log('   Available Single Tickets:', availableSingleTickets);
        console.log('   Single Ticket Target (85%):', singleTicketTarget);
        console.log('   Target line shows:', targetSales, '(single tickets only)');
        console.log('   Occupancy goal:', performance.occupancyGoal + '%');

        const onTrackData = [];

        // Generate target line from 6 weeks out to performance date (week 0)
        // First add week 0 (performance date)
        const week0Percentage = this.getHistoricPercentageAtWeek(0, progression);
        const week0Cumulative = Math.floor(targetSales * (week0Percentage / 100));
        console.log(`   Week 0 (performance): ${week0Percentage}% = ${week0Cumulative} tickets`);

        for (let week = 1; week <= maxWeeks; week++) {
            if (week <= 6) {
                // Use historic progression for weeks 1-6
                const expectedPercentage = this.getHistoricPercentageAtWeek(week, progression);
                const expectedCumulative = Math.floor(targetSales * (expectedPercentage / 100));

                console.log(`   Week ${week}: ${expectedPercentage}% = ${expectedCumulative} tickets`);

                onTrackData.push({
                    week: week,
                    expectedCumulative: expectedCumulative,
                    expectedPercentage: expectedPercentage,
                    hasTarget: true  // Flag to indicate this point has target data
                });
            } else {
                // No target line for weeks 7-10, but maintain data structure
                onTrackData.push({
                    week: week,
                    expectedCumulative: null,
                    expectedPercentage: null,
                    hasTarget: false
                });
            }
        }

        // Add week 0 data point at the end for proper line drawing
        onTrackData.unshift({
            week: 0,
            expectedCumulative: week0Cumulative,
            expectedPercentage: week0Percentage,
            hasTarget: true
        });

        return onTrackData;
    }

    getExpectedPercentageAtWeek(week, progression) {
        if (!progression || !Array.isArray(progression)) {
            return 0;
        }
        const dataPoint = progression.find(point => point.week === week);
        if (dataPoint) {
            return dataPoint.percentage;
        }

        // Interpolate if exact week not found
        const lowerPoint = progression.filter(point => point.week < week).pop();
        const upperPoint = progression.find(point => point.week > week);

        if (!lowerPoint) return progression[0].percentage;
        if (!upperPoint) return progression[progression.length - 1].percentage;

        const ratio = (week - lowerPoint.week) / (upperPoint.week - lowerPoint.week);
        return lowerPoint.percentage + ratio * (upperPoint.percentage - lowerPoint.percentage);
    }

    getHistoricPercentageAtWeek(week, progression) {
        if (!progression || !Array.isArray(progression)) {
            return 0;
        }

        // Historic progression has weeks 6, 5, 4, 3, 2, 1, 0
        // Find the exact match first
        const dataPoint = progression.find(point => point.week === week);
        if (dataPoint) {
            return dataPoint.percentage;
        }

        // Interpolate if exact week not found
        const lowerPoint = progression.filter(point => point.week < week).pop();
        const upperPoint = progression.find(point => point.week > week);

        if (!lowerPoint) return progression[progression.length - 1].percentage; // lowest week
        if (!upperPoint) return progression[0].percentage; // highest week

        const ratio = (week - lowerPoint.week) / (upperPoint.week - lowerPoint.week);
        return lowerPoint.percentage + ratio * (upperPoint.percentage - lowerPoint.percentage);
    }

    addTrackingStatus(chartGroup, performance, innerWidth) {
        // Track ONLY single ticket sales vs single ticket target
        const singleTicketsSold = performance.singleTicketsSold || 0;

        const today = new Date();
        const performanceDate = new Date(performance.date);
        const weeksToPerformance = Math.max(1, Math.ceil((performanceDate - today) / (7 * 24 * 60 * 60 * 1000)));

        const onTrackData = this.generateOnTrackLine(performance, 10);
        const expectedAtCurrentWeek = onTrackData.find(d => d.week === weeksToPerformance);

        if (!expectedAtCurrentWeek || !expectedAtCurrentWeek.expectedCumulative) return;

        // Calculate variance based on SINGLE TICKET sales only
        const variance = singleTicketsSold - expectedAtCurrentWeek.expectedCumulative;
        const variancePercentage = ((variance / expectedAtCurrentWeek.expectedCumulative) * 100).toFixed(1);

        let status = "On Track";
        let statusColor = CONFIG.charts.colors.onTrackLine;

        if (variance < -expectedAtCurrentWeek.expectedCumulative * 0.1) {
            status = "Behind";
            statusColor = "#d62728";
        } else if (variance > expectedAtCurrentWeek.expectedCumulative * 0.1) {
            status = "Ahead";
            statusColor = "#2ca02c";
        }

        const statusGroup = chartGroup.append("g")
            .attr("transform", `translate(${innerWidth + 20}, 30)`);

        statusGroup.append("rect")
            .attr("width", 180)
            .attr("height", 80)
            .attr("fill", "white")
            .attr("stroke", statusColor)
            .attr("stroke-width", 2)
            .attr("rx", 5);

        statusGroup.append("text")
            .attr("x", 90)
            .attr("y", 20)
            .attr("text-anchor", "middle")
            .attr("font-size", "14px")
            .attr("font-weight", "bold")
            .text("Sales Tracking Status");

        statusGroup.append("text")
            .attr("x", 90)
            .attr("y", 40)
            .attr("text-anchor", "middle")
            .attr("font-size", "18px")
            .attr("font-weight", "bold")
            .attr("fill", statusColor)
            .text(status);

        statusGroup.append("text")
            .attr("x", 90)
            .attr("y", 60)
            .attr("text-anchor", "middle")
            .attr("font-size", "12px")
            .text(`${variancePercentage > 0 ? '+' : ''}${variancePercentage}% vs target`);
    }

    addLegend(chartGroup, innerWidth) {
        const legend = chartGroup.append("g")
            .attr("transform", `translate(${innerWidth + 20}, 150)`);

        const legendItems = [
            { label: "Actual Sales", color: CONFIG.charts.colors.actualSales, style: "solid" },
            { label: "Target Sales (85% of avail.)", color: CONFIG.charts.colors.onTrackLine || "#2ca02c", style: "dashed" },
            { label: "Occupancy Goal", color: CONFIG.charts.colors.occupancyGoal, style: "dashed" },
            { label: "Available Single Tickets", color: "#9b59b6", style: "dashed" },
            { label: "Total Capacity", color: "#ccc", style: "dashed" }
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
                .attr("stroke-width", 3)
                .attr("stroke-dasharray", item.style === "dashed" ? "5,3" : "none");

            legendRow.append("text")
                .attr("x", 25)
                .attr("y", 14)
                .style("font-size", "12px")
                .text(item.label);
        });
    }

    addTooltips(currentSales, weeksToPerformance, expectedData, performance) {
        const tooltip = d3.select("body")
            .append("div")
            .attr("class", "sales-curve-tooltip")
            .style("position", "absolute")
            .style("visibility", "hidden")
            .style("background", "rgba(0, 0, 0, 0.8)")
            .style("color", "white")
            .style("padding", "10px")
            .style("border-radius", "5px")
            .style("font-size", "12px")
            .style("z-index", "1001")
            .style("pointer-events", "none");

        // Tooltip for current sales point
        this.svg.selectAll(".current-sales-point")
            .on("mouseover", function(event) {
                const expected = expectedData.find(e => e.week === weeksToPerformance);
                const variance = expected ? currentSales - expected.expectedCumulative : 0;
                const capacityPercent = performance.capacity ? ((currentSales / performance.capacity) * 100).toFixed(1) : 'N/A';

                tooltip.html(`
                    <strong>Current Sales (${weeksToPerformance} weeks before)</strong><br/>
                    Actual: ${currentSales.toLocaleString()} tickets<br/>
                    Target: ${expected ? expected.expectedCumulative.toLocaleString() : 'N/A'} tickets<br/>
                    Variance: ${variance > 0 ? '+' : ''}${variance.toLocaleString()}<br/>
                    Capacity: ${capacityPercent}%
                `);
                return tooltip.style("visibility", "visible");
            })
            .on("mousemove", function(event) {
                return tooltip
                    .style("top", (event.pageY - 10) + "px")
                    .style("left", (event.pageX + 10) + "px");
            })
            .on("mouseout", function() {
                return tooltip.style("visibility", "hidden");
            });

        // Tooltip for expected sales points (target line)
        this.svg.selectAll(".expected-point")
            .on("mouseover", function(event, d) {
                const targetPercent = performance.capacity ? ((d.expectedCumulative / performance.capacity) * 100).toFixed(1) : 'N/A';
                const weekLabel = d.week === 0 ? 'Performance Day' : `${d.week} week${d.week > 1 ? 's' : ''} before`;

                tooltip.html(`
                    <strong>Target Sales (${weekLabel})</strong><br/>
                    Expected: ${d.expectedCumulative.toLocaleString()} tickets<br/>
                    Target %: ${d.expectedPercentage.toFixed(1)}% of goal<br/>
                    Capacity: ${targetPercent}%
                `);
                return tooltip.style("visibility", "visible");
            })
            .on("mousemove", function(event) {
                return tooltip
                    .style("top", (event.pageY - 10) + "px")
                    .style("left", (event.pageX + 10) + "px");
            })
            .on("mouseout", function() {
                return tooltip.style("visibility", "hidden");
            });
    }

    async renderComparisonLines(chartGroup, xScale, yScale, performance) {
        // Fetch comparisons for this performance
        const comparisons = await window.dataService.getPerformanceComparisons(performance.performanceId);

        if (!comparisons || comparisons.length === 0) {
            return; // No comparisons to render
        }

        // Calculate max weeks from comparisons to potentially extend x-axis
        const maxComparisonWeeks = Math.max(...comparisons.map(c => c.weeksArray.length));

        // Render each comparison line
        comparisons.forEach(comparison => {
            this.renderSingleComparison(chartGroup, xScale, yScale, comparison);
        });

        // Update legend to include comparisons
        this.updateLegendWithComparisons(chartGroup, comparisons);
    }

    renderSingleComparison(chartGroup, xScale, yScale, comparison) {
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

        // Draw comparison line
        chartGroup.append("path")
            .datum(comparisonData)
            .attr("class", `comparison-line comparison-${comparison.comparison_id}`)
            .attr("d", line)
            .attr("fill", "none")
            .attr("stroke", comparison.line_color)
            .attr("stroke-width", 2.5)
            .attr("stroke-dasharray", this.getStrokeDashArray(comparison.line_style))
            .attr("stroke-linecap", "round")
            .attr("stroke-linejoin", "round")
            .attr("opacity", 0.8)
            .style("filter", `drop-shadow(0 1px 2px ${comparison.line_color}40)`);

        // Add data points for comparison line
        chartGroup.selectAll(`.comparison-point-${comparison.comparison_id}`)
            .data(comparisonData)
            .enter()
            .append("circle")
            .attr("class", `comparison-point comparison-point-${comparison.comparison_id}`)
            .attr("cx", d => xScale(d.week))
            .attr("cy", d => yScale(d.sales))
            .attr("r", 3)
            .attr("fill", comparison.line_color)
            .attr("stroke", "white")
            .attr("stroke-width", 1.5)
            .attr("opacity", 0.7)
            .style("cursor", "pointer")
            .on("mouseover", function(event, d) {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("r", 5)
                    .attr("opacity", 1);

                // Show tooltip
                const tooltip = d3.select(".sales-curve-tooltip");
                if (tooltip.empty()) return;

                const weekLabel = d.week === 0 ? 'Performance Day' : `${d.week} week${d.week > 1 ? 's' : ''} before`;
                tooltip.html(`
                    <strong>${comparison.comparison_name}</strong><br/>
                    ${weekLabel}<br/>
                    Target: ${d.sales.toLocaleString()} tickets
                `);
                tooltip.style("visibility", "visible");
            })
            .on("mousemove", function(event) {
                const tooltip = d3.select(".sales-curve-tooltip");
                tooltip
                    .style("top", (event.pageY - 10) + "px")
                    .style("left", (event.pageX + 10) + "px");
            })
            .on("mouseout", function() {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("r", 3)
                    .attr("opacity", 0.7);

                const tooltip = d3.select(".sales-curve-tooltip");
                tooltip.style("visibility", "hidden");
            });
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
        const legend = chartGroup.select("g[transform*='150']"); // The legend is at y=150

        if (legend.empty()) return;

        // Count existing legend items (5 default items)
        const startIndex = 5;

        comparisons.forEach((comp, i) => {
            const legendRow = legend.append("g")
                .attr("transform", `translate(0, ${(startIndex + i) * 20})`);

            legendRow.append("line")
                .attr("x1", 0)
                .attr("x2", 20)
                .attr("y1", 10)
                .attr("y2", 10)
                .attr("stroke", comp.line_color)
                .attr("stroke-width", 2.5)
                .attr("stroke-dasharray", this.getStrokeDashArray(comp.line_style));

            legendRow.append("text")
                .attr("x", 25)
                .attr("y", 14)
                .style("font-size", "11px")
                .style("font-weight", "500")
                .text(comp.comparison_name);
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