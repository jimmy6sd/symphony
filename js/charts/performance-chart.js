class PerformanceChart {
    constructor(containerId) {
        this.containerId = containerId;
        this.data = [];
        this.svg = null;
        this.width = CONFIG.charts.dimensions.defaultWidth;
        this.height = CONFIG.charts.dimensions.defaultHeight;
        this.margin = { top: 20, right: 180, bottom: 80, left: 70 }; // More space for legend and labels
    }

    async init() {
        console.log('🔄 PerformanceChart init() called');
        this.data = await dataService.getPerformances();
        console.log('📊 PerformanceChart received data:', this.data?.length || 0, 'performances');
        if (this.data && this.data.length > 0) {
            console.log('📊 First performance:', this.data[0]);
        }
        this.render();
    }

    render() {
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

        // Limit to top 12 performances by revenue for readability
        const topPerformances = [...this.data]
            .sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0))
            .slice(0, 12);

        console.log(`📊 Displaying top ${topPerformances.length} performances out of ${this.data.length} total`);

        // Prepare data for stacked bar chart
        const chartData = topPerformances.map(d => ({
            title: d.title.length > 20 ? d.title.substring(0, 20) + "..." : d.title,
            fullTitle: d.title,
            date: d.date,
            singleTickets: d.singleTicketsSold,
            subscriptionTickets: d.subscriptionTicketsSold,
            totalSold: d.singleTicketsSold + d.subscriptionTicketsSold,
            capacity: d.capacity,
            occupancy: ((d.singleTicketsSold + d.subscriptionTicketsSold) / d.capacity) * 100,
            occupancyGoal: d.occupancyGoal,
            revenue: d.totalRevenue,
            budgetGoal: d.budgetGoal
        }));

        // Scales
        const xScale = d3.scaleBand()
            .domain(chartData.map(d => d.title))
            .range([0, innerWidth])
            .padding(0.1);

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(chartData, d => d.capacity)])
            .range([innerHeight, 0]);

        // Create stack data
        const stackData = chartData.map(d => ({
            ...d,
            singleTicketsY0: 0,
            singleTicketsY1: d.singleTickets,
            subscriptionTicketsY0: d.singleTickets,
            subscriptionTicketsY1: d.singleTickets + d.subscriptionTickets
        }));

        // Draw capacity reference lines
        g.selectAll(".capacity-line")
            .data(chartData)
            .enter()
            .append("line")
            .attr("class", "capacity-line")
            .attr("x1", d => xScale(d.title))
            .attr("x2", d => xScale(d.title) + xScale.bandwidth())
            .attr("y1", d => yScale(d.capacity))
            .attr("y2", d => yScale(d.capacity))
            .attr("stroke", "#ccc")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "3,3");

        // Draw occupancy goal lines
        g.selectAll(".occupancy-goal-line")
            .data(chartData)
            .enter()
            .append("line")
            .attr("class", "occupancy-goal-line")
            .attr("x1", d => xScale(d.title))
            .attr("x2", d => xScale(d.title) + xScale.bandwidth())
            .attr("y1", d => yScale(d.capacity * (d.occupancyGoal / 100)))
            .attr("y2", d => yScale(d.capacity * (d.occupancyGoal / 100)))
            .attr("stroke", CONFIG.charts.colors.occupancyGoal)
            .attr("stroke-width", 2);

        // Draw subscription tickets (bottom layer)
        g.selectAll(".subscription-bar")
            .data(stackData)
            .enter()
            .append("rect")
            .attr("class", "subscription-bar")
            .attr("x", d => xScale(d.title))
            .attr("y", d => yScale(d.subscriptionTicketsY1))
            .attr("width", xScale.bandwidth())
            .attr("height", d => yScale(d.subscriptionTicketsY0) - yScale(d.subscriptionTicketsY1))
            .attr("fill", CONFIG.charts.colors.subscriptionTickets);

        // Draw single tickets (top layer)
        g.selectAll(".single-bar")
            .data(stackData)
            .enter()
            .append("rect")
            .attr("class", "single-bar")
            .attr("x", d => xScale(d.title))
            .attr("y", d => yScale(d.singleTicketsY1))
            .attr("width", xScale.bandwidth())
            .attr("height", d => yScale(d.singleTicketsY0) - yScale(d.singleTicketsY1))
            .attr("fill", CONFIG.charts.colors.singleTickets)
            .style("cursor", "pointer")
            .on("click", (event, d) => {
                this.onPerformanceClick(d);
            })
            .on("mouseover", function(event, d) {
                d3.select(this).attr("fill", d3.color(CONFIG.charts.colors.singleTickets).brighter(0.3));
            })
            .on("mouseout", function(event, d) {
                d3.select(this).attr("fill", CONFIG.charts.colors.singleTickets);
            });

        // Add click handler to subscription bars as well
        g.selectAll(".subscription-bar")
            .style("cursor", "pointer")
            .on("click", (event, d) => {
                this.onPerformanceClick(d);
            })
            .on("mouseover", function(event, d) {
                d3.select(this).attr("fill", d3.color(CONFIG.charts.colors.subscriptionTickets).brighter(0.3));
            })
            .on("mouseout", function(event, d) {
                d3.select(this).attr("fill", CONFIG.charts.colors.subscriptionTickets);
            });

        // Add occupancy percentage labels
        g.selectAll(".occupancy-label")
            .data(chartData)
            .enter()
            .append("text")
            .attr("class", "occupancy-label")
            .attr("x", d => xScale(d.title) + xScale.bandwidth() / 2)
            .attr("y", d => yScale(d.totalSold) - 5)
            .attr("text-anchor", "middle")
            .attr("font-size", "12px")
            .attr("font-weight", "bold")
            .attr("fill", d => d.occupancy >= d.occupancyGoal ? "#2ca02c" : "#d62728")
            .text(d => `${Math.round(d.occupancy)}%`);

        // X-axis
        g.append("g")
            .attr("transform", `translate(0,${innerHeight})`)
            .call(d3.axisBottom(xScale))
            .selectAll("text")
            .style("text-anchor", "end")
            .attr("dx", "-.8em")
            .attr("dy", ".15em")
            .attr("transform", "rotate(-45)");

        // Y-axis
        g.append("g")
            .call(d3.axisLeft(yScale));

        // Y-axis label
        g.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", 0 - this.margin.left)
            .attr("x", 0 - (innerHeight / 2))
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .text("Tickets Sold");

        // Legend - positioned safely in the right margin
        const legend = g.append("g")
            .attr("transform", `translate(${innerWidth + 20}, 20)`);

        const legendItems = [
            { label: "Single Tickets", color: CONFIG.charts.colors.singleTickets },
            { label: "Subscriptions", color: CONFIG.charts.colors.subscriptionTickets },
            { label: "Capacity", color: "#ccc" },
            { label: "Goal", color: CONFIG.charts.colors.occupancyGoal }
        ];

        legendItems.forEach((item, i) => {
            const legendRow = legend.append("g")
                .attr("transform", `translate(0, ${i * 20})`);

            legendRow.append("rect")
                .attr("width", 15)
                .attr("height", 15)
                .attr("fill", item.color)
                .attr("stroke", item.color === "#ccc" ? item.color : "none")
                .attr("stroke-dasharray", item.color === "#ccc" ? "3,3" : "none")
                .attr("fill", item.color === "#ccc" ? "none" : item.color);

            legendRow.append("text")
                .attr("x", 20)
                .attr("y", 12)
                .style("font-size", "12px")
                .text(item.label);
        });

        this.addTooltips(stackData);
    }

    onPerformanceClick(performance) {
        console.log('Performance clicked:', performance);

        // Dispatch custom event for drill-down functionality
        const event = new CustomEvent('performance-selected', {
            detail: performance,
            bubbles: true
        });
        window.dispatchEvent(event);
    }

    addTooltips(data) {
        const tooltip = d3.select("body")
            .append("div")
            .attr("class", "tooltip")
            .style("position", "absolute")
            .style("visibility", "hidden")
            .style("background", "rgba(0, 0, 0, 0.8)")
            .style("color", "white")
            .style("padding", "10px")
            .style("border-radius", "5px")
            .style("font-size", "12px");

        // Apply tooltips only to data bars (subscription and single ticket bars)
        this.svg.selectAll(".subscription-bar, .single-bar")
            .on("mouseover", function(event, d) {
                // Check if data object exists
                if (!d) {
                    console.warn('No data available for tooltip');
                    return;
                }

                const occupancy = d.occupancy || 0;
                const occupancyGoal = d.occupancyGoal || 0;
                const revenue = d.revenue || 0;
                const budgetGoal = d.budgetGoal || 0;

                const occupancyStatus = occupancy >= occupancyGoal ? "✓ On Target" : "⚠ Below Target";
                const revenueStatus = revenue >= budgetGoal ? "✓ On Target" : "⚠ Below Target";

                tooltip.html(`
                    <strong>${d.fullTitle || 'Unknown Performance'}</strong><br/>
                    Date: ${d.date || 'N/A'}<br/>
                    Single Tickets: ${(d.singleTickets || 0).toLocaleString()}<br/>
                    Subscriptions: ${(d.subscriptionTickets || 0).toLocaleString()}<br/>
                    Total Sold: ${(d.totalSold || 0).toLocaleString()} / ${(d.capacity || 0).toLocaleString()}<br/>
                    Occupancy: ${Math.round(occupancy)}% (Goal: ${occupancyGoal}%) ${occupancyStatus}<br/>
                    Revenue: $${revenue.toLocaleString()} (Goal: $${budgetGoal.toLocaleString()}) ${revenueStatus}
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
    window.PerformanceChart = PerformanceChart;
}

// Export for module use if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceChart;
}