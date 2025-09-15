class SalesCurveChart {
    constructor(containerId) {
        this.containerId = containerId;
        this.data = [];
        this.svg = null;
        this.width = CONFIG.charts.dimensions.defaultWidth;
        this.height = CONFIG.charts.dimensions.defaultHeight;
        this.margin = { top: 60, right: 250, bottom: 60, left: 70 }; // Extra space for status box and legend
        this.selectedPerformance = null;
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

    render() {
        // Safety check for data availability
        if (!this.data || !Array.isArray(this.data) || this.data.length === 0) {
            console.warn('⚠️ SalesCurveChart render: No data available');
            return;
        }

        const container = d3.select(`#${this.containerId}`);
        container.select("svg").remove();

        const innerWidth = this.width - this.margin.left - this.margin.right;
        const innerHeight = this.height - this.margin.top - this.margin.bottom;

        this.svg = container
            .append("svg")
            .attr("width", this.width)
            .attr("height", this.height);

        const g = this.svg
            .append("g")
            .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        // Add performance selector
        this.addPerformanceSelector(container);

        // Default to first performance
        if (!this.selectedPerformance && this.data.length > 0) {
            this.selectedPerformance = this.data[0].id;
        }

        this.renderSalesCurve(g, innerWidth, innerHeight);
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
            .on("change", (event) => {
                this.selectedPerformance = event.target.value;
                this.renderSalesCurve(
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

    renderSalesCurve(g, innerWidth, innerHeight) {
        // Clear previous chart
        g.selectAll(".sales-curve-content").remove();

        const chartGroup = g.append("g").attr("class", "sales-curve-content");

        // Safety check for data availability
        if (!this.data || !Array.isArray(this.data) || this.data.length === 0) {
            console.warn('⚠️ SalesCurveChart render: No data available');
            return;
        }

        if (!this.data || !Array.isArray(this.data)) {
            console.warn('⚠️ Data became undefined after safety check');
            return;
        }

        const performance = this.data.find(d => d.id === this.selectedPerformance);
        if (!performance) {
            console.warn('⚠️ SalesCurveChart render: No performance found with id:', this.selectedPerformance);
            return;
        }

        const weeklySales = performance.weeklySales;
        const maxWeeks = Math.max(10, weeklySales.length);

        // Scales (flip x-axis so week 10 is on left, week 1 on right)
        const xScale = d3.scaleLinear()
            .domain([maxWeeks, 1])
            .range([0, innerWidth]);

        const yScale = d3.scaleLinear()
            .domain([0, performance.capacity])
            .range([innerHeight, 0]);

        // Generate on-track line data based on heuristic
        const onTrackData = this.generateOnTrackLine(performance, maxWeeks);

        // Line generators
        const actualLine = d3.line()
            .x(d => xScale(d.week))
            .y(d => yScale(d.actualCumulative))
            .curve(d3.curveMonotoneX);

        const expectedLine = d3.line()
            .x(d => xScale(d.week))
            .y(d => yScale(d.expectedCumulative))
            .curve(d3.curveMonotoneX);

        // Draw capacity reference line
        chartGroup.append("line")
            .attr("x1", 0)
            .attr("x2", innerWidth)
            .attr("y1", yScale(performance.capacity))
            .attr("y2", yScale(performance.capacity))
            .attr("stroke", "#ccc")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "5,5");

        // Draw occupancy goal line
        const occupancyTarget = performance.capacity * (performance.occupancyGoal / 100);
        chartGroup.append("line")
            .attr("x1", 0)
            .attr("x2", innerWidth)
            .attr("y1", yScale(occupancyTarget))
            .attr("y2", yScale(occupancyTarget))
            .attr("stroke", CONFIG.charts.colors.occupancyGoal)
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "3,3");

        // Draw expected sales line (on-track heuristic)
        chartGroup.append("path")
            .datum(onTrackData)
            .attr("class", "expected-line")
            .attr("d", expectedLine)
            .attr("fill", "none")
            .attr("stroke", CONFIG.charts.colors.onTrackLine)
            .attr("stroke-width", 3)
            .attr("stroke-dasharray", "8,4");

        // Draw actual sales line
        chartGroup.append("path")
            .datum(weeklySales)
            .attr("class", "actual-line")
            .attr("d", actualLine)
            .attr("fill", "none")
            .attr("stroke", CONFIG.charts.colors.actualSales)
            .attr("stroke-width", 3);

        // Add data points for actual sales
        chartGroup.selectAll(".actual-point")
            .data(weeklySales)
            .enter()
            .append("circle")
            .attr("class", "actual-point")
            .attr("cx", d => xScale(d.week))
            .attr("cy", d => yScale(d.actualCumulative))
            .attr("r", 5)
            .attr("fill", CONFIG.charts.colors.actualSales)
            .attr("stroke", "white")
            .attr("stroke-width", 2);

        // Add data points for expected sales
        chartGroup.selectAll(".expected-point")
            .data(onTrackData.filter(d => d.week <= weeklySales.length))
            .enter()
            .append("circle")
            .attr("class", "expected-point")
            .attr("cx", d => xScale(d.week))
            .attr("cy", d => yScale(d.expectedCumulative))
            .attr("r", 4)
            .attr("fill", CONFIG.charts.colors.onTrackLine)
            .attr("stroke", "white")
            .attr("stroke-width", 2);

        // X-axis
        chartGroup.append("g")
            .attr("transform", `translate(0,${innerHeight})`)
            .call(d3.axisBottom(xScale).tickFormat(d => `${d} weeks before`));

        // Y-axis
        chartGroup.append("g")
            .call(d3.axisLeft(yScale));

        // X-axis label
        chartGroup.append("text")
            .attr("transform", `translate(${innerWidth / 2}, ${innerHeight + this.margin.bottom})`)
            .style("text-anchor", "middle")
            .text("Weeks Before Performance");

        // Y-axis label
        chartGroup.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", 0 - this.margin.left)
            .attr("x", 0 - (innerHeight / 2))
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .text("Cumulative Tickets Sold");

        // Add performance tracking status
        this.addTrackingStatus(chartGroup, performance, innerWidth);

        // Add legend
        this.addLegend(chartGroup, innerWidth);

        // Add tooltips
        this.addTooltips(weeklySales, onTrackData, performance);
    }

    generateOnTrackLine(performance, maxWeeks) {
        const targetSales = performance.capacity * (performance.occupancyGoal / 100);
        const progression = CONFIG.salesCurve.expectedSalesProgression;

        const onTrackData = [];
        for (let week = 1; week <= maxWeeks; week++) {
            const expectedPercentage = this.getExpectedPercentageAtWeek(week, progression);
            const expectedCumulative = Math.floor(targetSales * (expectedPercentage / 100));

            onTrackData.push({
                week: week,
                expectedCumulative: expectedCumulative,
                expectedPercentage: expectedPercentage
            });
        }

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

    addTrackingStatus(chartGroup, performance, innerWidth) {
        const currentWeek = performance.weeklySales.length;
        const latestSales = performance.weeklySales[currentWeek - 1];

        if (!latestSales) return;

        const onTrackData = this.generateOnTrackLine(performance, 10);
        const expectedAtCurrentWeek = onTrackData.find(d => d.week === currentWeek);

        if (!expectedAtCurrentWeek) return;

        const variance = latestSales.actualCumulative - expectedAtCurrentWeek.expectedCumulative;
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
            { label: "On-Track Target", color: CONFIG.charts.colors.onTrackLine, style: "dashed" },
            { label: "Occupancy Goal", color: CONFIG.charts.colors.occupancyGoal, style: "dashed" },
            { label: "Capacity", color: "#ccc", style: "dashed" }
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

    addTooltips(actualData, expectedData, performance) {
        const tooltip = d3.select("body")
            .append("div")
            .attr("class", "sales-curve-tooltip")
            .style("position", "absolute")
            .style("visibility", "hidden")
            .style("background", "rgba(0, 0, 0, 0.8)")
            .style("color", "white")
            .style("padding", "10px")
            .style("border-radius", "5px")
            .style("font-size", "12px");

        // Tooltips for actual data points
        this.svg.selectAll(".actual-point")
            .on("mouseover", function(event, d) {
                const expected = expectedData.find(e => e.week === d.week);
                const variance = expected ? d.actualCumulative - expected.expectedCumulative : 0;

                tooltip.html(`
                    <strong>Week ${d.week}</strong><br/>
                    Actual: ${d.actualCumulative.toLocaleString()} tickets<br/>
                    Expected: ${expected ? expected.expectedCumulative.toLocaleString() : 'N/A'} tickets<br/>
                    Variance: ${variance > 0 ? '+' : ''}${variance.toLocaleString()}<br/>
                    Weekly Sales: ${d.actualSales.toLocaleString()}
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
}

// Export to global window object
if (typeof window !== 'undefined') {
    window.SalesCurveChart = SalesCurveChart;
}

// Export for module use if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SalesCurveChart;
}