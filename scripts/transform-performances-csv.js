const fs = require('fs');
const path = require('path');

// Read the CSV file and transform it to dashboard JSON format
function transformPerformancesCSV() {
    console.log('🎭 Transforming Performances by Week CSV to Dashboard JSON...');

    // Read the CSV file
    const csvPath = './KCS 25-26 Weekly Sales Report - Sep 17.xlsx - Performances by Week.csv';
    const csvContent = fs.readFileSync(csvPath, 'utf-8');

    // Split into lines and filter out header rows and empty rows
    const lines = csvContent.split('\n');
    const dataLines = lines.slice(7).filter(line => {
        const cols = line.split(',');
        // Skip empty rows, summary rows, and "Too early" entries
        return cols.length > 10 &&
               cols[3] &&
               cols[3].trim() !== '' &&
               !cols[3].includes('CLASSICAL') &&
               !cols[3].includes('POPS') &&
               !cols[3].includes('ALL CONCERTS') &&
               !cols[3].includes('Future Improvements') &&
               cols[3] !== 'OPEN';
    });

    console.log(`📊 Found ${dataLines.length} performance entries to process`);

    const performances = [];

    dataLines.forEach((line, index) => {
        try {
            // Parse CSV line, handling quoted values with commas
            const cols = parseCSVLine(line);

            // Skip if essential data is missing
            if (!cols[3] || !cols[6] || cols[6].trim() === '') return;

            const performance = {
                // Basic identification
                id: `perf-${index + 1}`,
                performanceName: cleanString(cols[3]),
                performanceDate: cleanString(cols[6]),
                performanceType: cleanString(cols[7]) || 'Unknown',

                // Week tracking
                weekNumber: parseInt(cols[0]) || 0,
                weeksUntilPerformance: parseInt(cols[1]) || 0,
                performanceWeekStart: cleanString(cols[2]),

                // Sales data
                actualTotalTicketsSold: parseInt(cleanNumber(cols[8])) || 0,
                projectedSingleTickets: cleanNumber(cols[9]) === '#N/A' ? null : parseInt(cleanNumber(cols[9])),
                projectedTotalOccupancy: cleanNumber(cols[10]) === '#N/A' ? null : cleanNumber(cols[10]),

                // Revenue
                totalActualRevenue: parseFloat(cleanCurrency(cols[11])) || 0,
                totalBudget: parseFloat(cleanCurrency(cols[12])) || 0,
                actualVsBudgetPercent: parseFloat(cleanNumber(cols[13])) || 0,
                projectedVsBudgetPercent: cleanNumber(cols[14]) === '#N/A' ? null : parseFloat(cleanNumber(cols[14])),

                // Single ticket data
                actualSingleTicketsSold: parseInt(cleanNumber(cols[15])) || 0,
                targetSingleTicketsFor85Occupancy: parseInt(cleanNumber(cols[16])) || 0,
                projectedSingleTicketsSold: cleanNumber(cols[17]) === '#N/A' ? null : parseInt(cleanNumber(cols[17])),
                projectedSingleVsTarget: cleanNumber(cols[18]) === '#N/A' ? null : cleanNumber(cols[18]),

                // Single ticket revenue
                singleTicketRevenue: parseFloat(cleanCurrency(cols[19])) || 0,
                singleTicketBudget: parseFloat(cleanCurrency(cols[20])) || 0,
                singleActualVsBudgetPercent: parseFloat(cleanNumber(cols[21])) || 0,
                singleProjectedVsBudgetPercent: cleanNumber(cols[22]) === '#N/A' ? null : parseFloat(cleanNumber(cols[22])),

                // Subscription data
                actualSubTicketsSold: parseInt(cleanNumber(cols[23])) || 0,
                subTicketRevenue: parseFloat(cleanCurrency(cols[24])) || 0,
                subTicketBudget: parseFloat(cleanCurrency(cols[25])) || 0,
                subActualVsBudgetPercent: parseFloat(cleanNumber(cols[26])) || 0,

                // Venue data
                maxCapacity: parseInt(cleanNumber(cols[27])) || 0,
                actualOccupancyPercent: parseFloat(cleanNumber(cols[28])) || 0,
                averageTicketPrice: parseFloat(cleanCurrency(cols[29])) || 0,

                // Household data
                newHouseholds: parseInt(cleanNumber(cols[30])) || 0,
                returningHouseholds: parseInt(cleanNumber(cols[31])) || 0,
                totalHouseholds: parseInt(cleanNumber(cols[32])) || 0,

                // Week-over-week revenue change
                revenueLastWeek: parseFloat(cleanCurrency(cols[33])) || 0,
                weeklyRevenueIncrease: parseFloat(cleanCurrency(cols[34])) || 0
            };

            // Only add if we have meaningful data
            if (performance.performanceName && performance.performanceDate) {
                performances.push(performance);
            }

        } catch (error) {
            console.warn(`⚠️  Warning: Could not parse line ${index + 1}:`, error.message);
        }
    });

    console.log(`✅ Successfully processed ${performances.length} performances`);

    // Group by performance type for analysis
    const performancesByType = {};
    performances.forEach(perf => {
        const type = perf.performanceType;
        if (!performancesByType[type]) performancesByType[type] = [];
        performancesByType[type].push(perf);
    });

    console.log('📈 Performance types found:');
    Object.keys(performancesByType).forEach(type => {
        console.log(`   ${type}: ${performancesByType[type].length} performances`);
    });

    // Create dashboard-compatible format
    const dashboardData = {
        metadata: {
            reportDate: '2025-09-17',
            dataSource: 'KCS 25-26 Weekly Sales Report',
            totalPerformances: performances.length,
            seasonRange: '2025-2026',
            lastUpdated: new Date().toISOString()
        },
        summary: {
            totalRevenue: performances.reduce((sum, p) => sum + p.totalActualRevenue, 0),
            totalBudget: performances.reduce((sum, p) => sum + p.totalBudget, 0),
            totalTicketsSold: performances.reduce((sum, p) => sum + p.actualTotalTicketsSold, 0),
            averageOccupancy: performances.reduce((sum, p) => sum + p.actualOccupancyPercent, 0) / performances.length,
            performanceTypes: Object.keys(performancesByType)
        },
        performances: performances,
        performancesByType: performancesByType
    };

    // Write to data directory
    const outputPath = './data/dashboard.json';
    fs.writeFileSync(outputPath, JSON.stringify(dashboardData, null, 2));

    console.log(`🎉 Dashboard data written to: ${outputPath}`);
    console.log(`📊 Total Revenue: $${dashboardData.summary.totalRevenue.toLocaleString()}`);
    console.log(`💰 Total Budget: $${dashboardData.summary.totalBudget.toLocaleString()}`);
    console.log(`🎫 Total Tickets Sold: ${dashboardData.summary.totalTicketsSold.toLocaleString()}`);
    console.log(`🏟️  Average Occupancy: ${dashboardData.summary.averageOccupancy.toFixed(1)}%`);

    return dashboardData;
}

// Helper functions for data cleaning
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    result.push(current.trim());
    return result;
}

function cleanString(str) {
    if (!str) return '';
    return str.replace(/"/g, '').trim();
}

function cleanNumber(str) {
    if (!str) return '0';
    return str.replace(/[",\s]/g, '').trim();
}

function cleanCurrency(str) {
    if (!str) return '0';
    return str.replace(/[\$",\s]/g, '').trim();
}

// Run the transformation
if (require.main === module) {
    transformPerformancesCSV();
}

module.exports = { transformPerformancesCSV };