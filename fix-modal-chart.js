// Quick fix script to update data-table.js renderSalesChart function

const fs = require('fs');

const fileContent = fs.readFileSync('src/charts/data-table.js', 'utf8');

// Find and replace the renderSalesChart function
const oldFunction = `    async renderSalesChart(container, performance) {
        console.log('🔄 renderSalesChart called for performance:', performance.performanceId || performance.id);

        // Fetch historical snapshots for this performance
        const performanceCode = performance.code || performance.performanceCode;
        let historicalData = [];

        try {
            console.log(\`📊 Fetching historical snapshots for \${performanceCode}...\`);
            const response = await fetch(
                \`/netlify/functions/bigquery-snapshots?action=get-performance-history&performanceCode=\${performanceCode}\`
            );

            if (response.ok) {
                historicalData = await response.json();
                console.log(\`✅ Fetched \${historicalData.length} historical snapshots\`);
            } else {
                console.warn('⚠️ No historical data available, using current data only');
            }
        } catch (error) {
            console.warn('⚠️ Error fetching historical data:', error.message);
        }

        // If we have historical data (more than 1 snapshot), render timeline chart
        if (historicalData && historicalData.length > 1) {
            // Import and use the historical timeline chart
            const { renderHistoricalTimelineChart } = await import('./historical-timeline-chart.js');
            renderHistoricalTimelineChart(container, performance, historicalData);
        } else {
            // Fallback to standard sales curve chart
            const chartId = container.attr('id') || 'modal-sales-chart';
            const salesChart = new SalesCurveChart(chartId, { showSelector: false });
            const chartData = [performance];
            salesChart.data = chartData;
            salesChart.selectedPerformance = performance.id;
            await salesChart.render();
        }

        console.log('✅ renderSalesChart complete');
    }`;

const newFunction = `    async renderSalesChart(container, performance) {
        console.log('🔄 renderSalesChart called for performance:', performance.performanceId || performance.id);

        // Fetch historical snapshots for this performance
        const performanceCode = performance.code || performance.performanceCode;
        let historicalData = [];

        try {
            console.log(\`📊 Fetching historical snapshots for \${performanceCode}...\`);
            const response = await fetch(
                \`/netlify/functions/bigquery-snapshots?action=get-performance-history&performanceCode=\${performanceCode}\`
            );

            if (response.ok) {
                const apiResponse = await response.json();
                // API returns {performanceCode, snapshots: [...]}
                historicalData = apiResponse.snapshots || [];
                console.log(\`✅ Fetched \${historicalData.length} historical snapshots\`);

                // Get unique dates and keep only one snapshot per date (latest)
                const uniqueByDate = {};
                for (const snapshot of historicalData) {
                    const date = snapshot.snapshot_date;
                    if (!uniqueByDate[date] || new Date(snapshot.created_at) > new Date(uniqueByDate[date].created_at)) {
                        uniqueByDate[date] = snapshot;
                    }
                }
                historicalData = Object.values(uniqueByDate);
                console.log(\`📅 Unique dates: \${historicalData.length}\`);
            } else {
                console.warn('⚠️ No historical data available, using current data only');
            }
        } catch (error) {
            console.warn('⚠️ Error fetching historical data:', error.message);
        }

        // If we have historical data (more than 1 unique date), render timeline chart
        if (historicalData && historicalData.length > 1) {
            this.renderHistoricalTimelineChart(container, performance, historicalData);
        } else {
            // Fallback to standard sales curve chart
            const chartId = container.attr('id') || 'modal-sales-chart';
            const salesChart = new SalesCurveChart(chartId, { showSelector: false });
            const chartData = [performance];
            salesChart.data = chartData;
            salesChart.selectedPerformance = performance.id;
            await salesChart.render();
        }

        console.log('✅ renderSalesChart complete');
    }`;

const updatedContent = fileContent.replace(oldFunction, newFunction);

fs.writeFileSync('src/charts/data-table.js', updatedContent);
console.log('✅ Updated renderSalesChart function');
