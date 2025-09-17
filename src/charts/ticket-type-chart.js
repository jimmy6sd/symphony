class TicketTypeChart {
    constructor(containerId) {
        this.containerId = containerId;
        this.data = [];
        this.svg = null;
        this.width = CONFIG.charts.dimensions.defaultWidth;
        this.height = CONFIG.charts.dimensions.defaultHeight + 200; // Extra height for table
        this.margin = { top: 20, right: 30, bottom: 40, left: 50 };
    }

    async init() {
        console.log('🔄 TicketTypeChart init() called');
        this.data = await dataService.getPerformances();
        console.log('📊 TicketTypeChart received data:', this.data?.length || 0, 'performances');
        if (this.data && this.data.length > 0) {
            this.render();
        } else {
            console.warn('⚠️ TicketTypeChart: No data available for rendering');
        }
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

        // Calculate totals for pie chart
        const totalSingle = this.data.reduce((sum, d) => sum + d.singleTicketsSold, 0);
        const totalSubscription = this.data.reduce((sum, d) => sum + d.subscriptionTicketsSold, 0);
        const totalTickets = totalSingle + totalSubscription;

        // Pie chart data
        const pieData = [
            {
                type: "Single Tickets",
                value: totalSingle,
                percentage: (totalSingle / totalTickets * 100).toFixed(1),
                color: CONFIG.charts.colors.singleTickets
            },
            {
                type: "Subscriptions",
                value: totalSubscription,
                percentage: (totalSubscription / totalTickets * 100).toFixed(1),
                color: CONFIG.charts.colors.subscriptionTickets
            }
        ];

        // Create pie layout
        const pie = d3.pie()
            .value(d => d.value)
            .sort(null);

        // Use controlled radius for consistent sizing
        const pieRadius = Math.min(innerWidth * 0.25, 120);

        const arc = d3.arc()
            .innerRadius(0)
            .outerRadius(pieRadius);

        const labelArc = d3.arc()
            .innerRadius(pieRadius + 20)
            .outerRadius(pieRadius + 20);

        // Position pie chart in upper area
        const pieGroup = g.append("g")
            .attr("transform", `translate(${pieRadius + 50}, ${pieRadius + 50})`);

        // Draw pie slices
        const slices = pieGroup.selectAll(".slice")
            .data(pie(pieData))
            .enter()
            .append("g")
            .attr("class", "slice");

        slices.append("path")
            .attr("d", arc)
            .attr("fill", d => d.data.color)
            .attr("stroke", "white")
            .attr("stroke-width", 2);

        // Add percentage labels
        slices.append("text")
            .attr("transform", d => `translate(${labelArc.centroid(d)})`)
            .attr("text-anchor", "middle")
            .attr("font-size", "14px")
            .attr("font-weight", "bold")
            .attr("fill", "white")
            .text(d => `${d.data.percentage}%`);

        // Add summary statistics on the right side
        const statsGroup = g.append("g")
            .attr("transform", `translate(${innerWidth * 0.6}, 50)`);

        const stats = [
            { label: "Total Tickets Sold", value: totalTickets.toLocaleString(), color: "#333" },
            { label: "Single Tickets", value: totalSingle.toLocaleString(), color: CONFIG.charts.colors.singleTickets },
            { label: "Subscription Tickets", value: totalSubscription.toLocaleString(), color: CONFIG.charts.colors.subscriptionTickets },
            { label: "Single/Subscription Ratio", value: `${(totalSingle / totalSubscription).toFixed(2)}:1`, color: "#666" }
        ];

        stats.forEach((stat, i) => {
            const statGroup = statsGroup.append("g")
                .attr("transform", `translate(0, ${i * 40})`);

            statGroup.append("text")
                .attr("x", 0)
                .attr("y", 0)
                .attr("font-size", "14px")
                .attr("font-weight", "bold")
                .attr("fill", stat.color)
                .text(stat.label);

            statGroup.append("text")
                .attr("x", 0)
                .attr("y", 20)
                .attr("font-size", "18px")
                .attr("font-weight", "bold")
                .attr("fill", stat.color)
                .text(stat.value);
        });

        // Add performance breakdown table
        this.addPerformanceTable(g, innerWidth, innerHeight);

        // Add tooltips to pie slices
        this.addPieTooltips(slices, pieData);
    }

    addPerformanceTable(g, innerWidth, innerHeight) {
        const tableGroup = g.append("g")
            .attr("transform", `translate(0, ${innerHeight - 180})`);

        // Table headers
        const headers = ["Performance", "Single", "Subscription", "Total", "%Single"];
        const colWidth = innerWidth / headers.length;

        headers.forEach((header, i) => {
            tableGroup.append("text")
                .attr("x", i * colWidth)
                .attr("y", 0)
                .attr("font-size", "12px")
                .attr("font-weight", "bold")
                .attr("fill", "#333")
                .text(header);
        });

        // Table rows
        this.data.forEach((d, i) => {
            const total = d.singleTicketsSold + d.subscriptionTicketsSold;
            const singlePercentage = ((d.singleTicketsSold / total) * 100).toFixed(1);

            const rowData = [
                d.title.length > 15 ? d.title.substring(0, 15) + "..." : d.title,
                d.singleTicketsSold.toLocaleString(),
                d.subscriptionTicketsSold.toLocaleString(),
                total.toLocaleString(),
                `${singlePercentage}%`
            ];

            rowData.forEach((value, j) => {
                tableGroup.append("text")
                    .attr("x", j * colWidth)
                    .attr("y", (i + 1) * 20 + 10)
                    .attr("font-size", "11px")
                    .attr("fill", "#666")
                    .text(value);
            });

            // Add subtle row background
            tableGroup.append("rect")
                .attr("x", -5)
                .attr("y", (i + 1) * 20 - 2)
                .attr("width", innerWidth + 10)
                .attr("height", 18)
                .attr("fill", i % 2 === 0 ? "#f8f9fa" : "white")
                .attr("stroke", "none")
                .lower();
        });

        // Add table border
        tableGroup.append("rect")
            .attr("x", -5)
            .attr("y", -10)
            .attr("width", innerWidth + 10)
            .attr("height", (this.data.length + 1) * 20 + 20)
            .attr("fill", "none")
            .attr("stroke", "#ddd")
            .attr("stroke-width", 1);
    }

    addPieTooltips(slices, pieData) {
        const tooltip = d3.select("body")
            .append("div")
            .attr("class", "pie-tooltip")
            .style("position", "absolute")
            .style("visibility", "hidden")
            .style("background", "rgba(0, 0, 0, 0.8)")
            .style("color", "white")
            .style("padding", "10px")
            .style("border-radius", "5px")
            .style("font-size", "12px");

        slices.on("mouseover", function(event, d) {
            tooltip.html(`
                <strong>${d.data.type}</strong><br/>
                Tickets: ${d.data.value.toLocaleString()}<br/>
                Percentage: ${d.data.percentage}%
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
    window.TicketTypeChart = TicketTypeChart;
}

// Export for module use if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TicketTypeChart;
}