/**
 * Subscription Table Component
 * Displays subscription/package sales data with collapsible category groups
 */
class SubscriptionTable {
    constructor(containerId = 'subscription-table') {
        this.containerId = containerId;
        this.container = null;
        this.data = [];
        this.dayOverDayData = {};
        this.collapsedCategories = new Set();
        this.initialized = false;

        // Category order for display
        this.categoryOrder = ['Classical', 'Pops', 'Flex', 'Family'];

        // Categories that support sales curve charts
        this.chartCategories = ['Classical', 'Pops'];

        // Store chart instances
        this.charts = new Map();
    }

    async init() {
        this.container = document.getElementById(this.containerId);
        if (!this.container) {
            console.warn(`SubscriptionTable: Container #${this.containerId} not found`);
            return;
        }

        this.showLoading();

        try {
            await this.loadData();
            this.render();
            this.initialized = true;
            console.log('SubscriptionTable initialized with', this.data.length, 'packages');
        } catch (error) {
            console.error('SubscriptionTable init error:', error);
            this.showError(error.message);
        }
    }

    async loadData() {
        const response = await fetch('/.netlify/functions/bigquery-snapshots?action=get-subscription-data');
        if (!response.ok) {
            throw new Error(`Failed to load subscription data: ${response.status}`);
        }

        const result = await response.json();
        // Filter out packages with 'mini' in the type
        this.data = (result.data || []).filter(pkg =>
            !pkg.package_type || !pkg.package_type.toLowerCase().includes('mini')
        );
        this.dayOverDayData = result.dayOverDay || {};
        this.categoryProjections = result.categoryProjections || { status: 'awaiting_data', categories: {} };
    }

    showLoading() {
        this.container.innerHTML = `
            <div class="loading" style="padding: 40px; text-align: center;">
                <div>Loading subscription data...</div>
            </div>
        `;
    }

    showError(message) {
        this.container.innerHTML = `
            <div class="error" style="padding: 40px; text-align: center;">
                <div>Error loading subscription data</div>
                <div style="font-size: 0.9em; margin-top: 8px;">${message}</div>
            </div>
        `;
    }

    render() {
        // Group data by category (may be empty)
        const groupedData = this.data && this.data.length > 0 ? this.groupByCategory(this.data) : {};

        // Calculate totals
        const totals = this.data && this.data.length > 0 ? this.calculateTotals(this.data) : {
            totalPackages: 0,
            totalPerf: 0,
            totalRevenue: 0,
            totalOrders: 0
        };

        // Always show chart categories even if no package data
        const hasPackageData = this.data && this.data.length > 0;

        // Build HTML
        let html = `
            <div class="subscription-table-wrapper">
                <!-- Season Label -->
                <div class="subscription-season-label">2026-27 Season</div>

                <!-- Summary Header -->
                <div class="subscription-summary">
                    <div class="subscription-summary-item">
                        <div class="subscription-summary-value">${totals.totalPackages.toLocaleString()}</div>
                        <div class="subscription-summary-label">Package Seats</div>
                    </div>
                    <div class="subscription-summary-item">
                        <div class="subscription-summary-value">${totals.totalPerf.toLocaleString()}</div>
                        <div class="subscription-summary-label">Perf Seats</div>
                    </div>
                    <div class="subscription-summary-item">
                        <div class="subscription-summary-value">$${this.formatCurrency(totals.totalRevenue)}</div>
                        <div class="subscription-summary-label">Total Revenue</div>
                    </div>
                    <div class="subscription-summary-item">
                        <div class="subscription-summary-value">${totals.totalOrders.toLocaleString()}</div>
                        <div class="subscription-summary-label">Orders</div>
                    </div>
                </div>

                <!-- Categories -->
                ${this.categoryOrder.map(category => {
                    const categoryData = groupedData[category] || [];
                    const hasChart = this.chartCategories.includes(category);

                    // Skip categories with no data AND no chart
                    if (categoryData.length === 0 && !hasChart) return '';

                    const categoryTotals = categoryData.length > 0 ? this.calculateTotals(categoryData) : { totalPackages: 0, totalRevenue: 0 };
                    const isCollapsed = this.collapsedCategories.has(category);
                    const projection = this.categoryProjections?.categories?.[category];

                    return `
                        <div class="subscription-category" data-category="${category}">
                            <div class="subscription-category-header ${isCollapsed ? 'collapsed' : ''}"
                                 onclick="window.subscriptionTable.toggleCategory('${category}')">
                                <div class="subscription-category-title">
                                    <span class="expand-icon">${isCollapsed ? '▸' : '▾'}</span>
                                    <span class="category-badge ${category.toLowerCase()}">${category}</span>
                                    <span style="color: var(--text-secondary); font-weight: 400;">${hasChart ? 'Sales Curve' : ''}${categoryData.length > 0 ? (hasChart ? ' + ' : '') + categoryData.length + ' packages' : ''}</span>
                                </div>
                            </div>
                            ${this.renderCategoryMetrics(category, projection, categoryTotals)}
                            <div class="subscription-category-content" style="${isCollapsed ? 'display: none;' : ''}">
                                ${hasChart ? `
                                <div class="subscription-category-chart" id="sub-chart-${category.toLowerCase()}">
                                    <div class="chart-loading">Loading sales curve...</div>
                                </div>
                                ` : ''}
                                ${categoryData.length > 0 ? `
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Package</th>
                                            <th>Type</th>
                                            <th>Pkg Seats</th>
                                            <th>Perf Seats</th>
                                            <th>Revenue</th>
                                            <th>Orders</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${categoryData.map(pkg => this.renderPackageRow(pkg)).join('')}
                                    </tbody>
                                </table>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        this.container.innerHTML = html;

        // Initialize charts for expanded categories
        this.initializeCharts();
    }

    // Initialize sales curve charts for expanded categories
    async initializeCharts() {
        for (const category of this.chartCategories) {
            const isCollapsed = this.collapsedCategories.has(category);
            const containerId = `sub-chart-${category.toLowerCase()}`;
            const container = document.getElementById(containerId);

            if (!isCollapsed && container && !this.charts.has(category)) {
                // Initialize chart for this category
                try {
                    const chart = new window.SubscriptionSalesCurve(containerId, { series: category });
                    this.charts.set(category, chart);
                    await chart.init();
                } catch (error) {
                    console.error(`Error initializing chart for ${category}:`, error);
                    container.innerHTML = `<div class="chart-error">Error loading chart</div>`;
                }
            } else if (isCollapsed && this.charts.has(category)) {
                // Destroy chart when collapsed
                const chart = this.charts.get(category);
                if (chart && chart.destroy) {
                    chart.destroy();
                }
                this.charts.delete(category);
            }
        }
    }

    renderPackageRow(pkg) {
        const ddData = this.dayOverDayData[pkg.package_name] || {};

        return `
            <tr>
                <td>${pkg.package_name.trim()}</td>
                <td class="package-type">${pkg.package_type}</td>
                <td>${pkg.package_seats.toLocaleString()}${this.renderDDChange(ddData.package_seats_change)}</td>
                <td>${pkg.perf_seats.toLocaleString()}</td>
                <td>$${this.formatCurrency(pkg.total_amount)}${this.renderDDChange(ddData.revenue_change, true)}</td>
                <td>${pkg.orders.toLocaleString()}</td>
            </tr>
        `;
    }

    renderDDChange(change, isCurrency = false) {
        if (change === undefined || change === null || change === 0) {
            return '';
        }

        const isPositive = change > 0;
        const cssClass = isPositive ? 'positive' : 'negative';
        const prefix = isPositive ? '+' : '';
        const value = isCurrency ? `$${Math.abs(change).toLocaleString()}` : Math.abs(change).toLocaleString();

        return `<span class="dd-change ${cssClass}">${prefix}${isPositive ? '' : '-'}${value}</span>`;
    }

    renderCategoryMetrics(category, projection, categoryTotals) {
        // Check if we're awaiting data (no current season data yet)
        if (this.categoryProjections?.status === 'awaiting_data') {
            return `
                <div class="subscription-rollup-table awaiting-data">
                    <div class="subscription-metrics-placeholder">
                        ${this.categoryProjections.message || 'Awaiting subscription data'}
                    </div>
                </div>
            `;
        }

        // Only show metrics for Classical and Pops (they have projections)
        if (!projection) {
            // Fallback to simple stats for Flex/Family
            if (categoryTotals.totalPackages > 0) {
                return `
                    <table class="subscription-rollup-table simple">
                        <thead>
                            <tr>
                                <th>Packages Sold</th>
                                <th>Actual Revenue</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr class="rollup-row">
                                <td>${categoryTotals.totalPackages.toLocaleString()}</td>
                                <td>$${this.formatCurrency(categoryTotals.totalRevenue)}</td>
                            </tr>
                        </tbody>
                    </table>
                `;
            }
            return '';
        }

        // Full metrics table for Classical/Pops with projections
        const { current, targetAtDate, targetFinal, projected, variance } = projection;
        const targetSeason = this.categoryProjections?.targetSeason || '25-26';

        // Variance status classes
        const packagesVsDateStatus = variance.vsDatePackages >= 0 ? 'good' : 'poor';
        const packagesVsDateSign = variance.vsDatePackages >= 0 ? '+' : '';
        const revenueVsDateStatus = variance.vsDateRevenue >= 0 ? 'good' : 'poor';
        const revenueVsDateSign = variance.vsDateRevenue >= 0 ? '+' : '-';
        const projectedStatus = variance.vsTargetPackages >= 0 ? 'good' : 'poor';
        const projectedSign = variance.vsTargetPackages >= 0 ? '+' : '';
        const projectedRevStatus = variance.vsTargetRevenue >= 0 ? 'good' : 'poor';
        const projectedRevSign = variance.vsTargetRevenue >= 0 ? '+' : '-';

        return `
            <table class="subscription-rollup-table">
                <thead>
                    <tr>
                        <th>
                            <div style="text-align: center;">Packages Sold<br><span class="th-sub">(vs ${targetSeason})</span></div>
                        </th>
                        <th>
                            <div style="text-align: center;">Actual Revenue<br><span class="th-sub">(vs ${targetSeason})</span></div>
                        </th>
                        <th>
                            <div style="text-align: center;">Projected Pkgs<br><span class="th-sub">(vs Target)</span></div>
                        </th>
                        <th>
                            <div style="text-align: center;">Projected Revenue<br><span class="th-sub">(vs Target)</span></div>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr class="rollup-row">
                        <td>
                            <div class="projection-cell">
                                <div class="projection-value">${current.packages.toLocaleString()}</div>
                                <div class="projection-variance projection-${packagesVsDateStatus}">${packagesVsDateSign}${variance.vsDatePackages.toLocaleString()}</div>
                            </div>
                        </td>
                        <td>
                            <div class="projection-cell">
                                <div class="projection-value">$${this.formatCurrency(current.revenue)}</div>
                                <div class="projection-variance projection-${revenueVsDateStatus}">${revenueVsDateSign}$${this.formatCurrency(Math.abs(variance.vsDateRevenue))}</div>
                            </div>
                        </td>
                        <td>
                            <div class="projection-cell">
                                <div class="projection-value">${projected.packages.toLocaleString()}</div>
                                <div class="projection-variance projection-${projectedStatus}">${projectedSign}${variance.vsTargetPackages.toLocaleString()} (${projectedSign}${variance.vsTargetPercent}%)</div>
                            </div>
                        </td>
                        <td>
                            <div class="projection-cell">
                                <div class="projection-value">$${this.formatCurrency(projected.revenue)}</div>
                                <div class="projection-variance projection-${projectedRevStatus}">${projectedRevSign}$${this.formatCurrency(Math.abs(variance.vsTargetRevenue))}</div>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        `;
    }

    groupByCategory(data) {
        const grouped = {};
        for (const pkg of data) {
            const category = pkg.category || 'Unknown';
            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push(pkg);
        }

        // Sort packages within each category by package_name
        for (const category of Object.keys(grouped)) {
            grouped[category].sort((a, b) => a.package_name.localeCompare(b.package_name));
        }

        return grouped;
    }

    calculateTotals(data) {
        return {
            totalPackages: data.reduce((sum, p) => sum + (p.package_seats || 0), 0),
            totalPerf: data.reduce((sum, p) => sum + (p.perf_seats || 0), 0),
            totalRevenue: data.reduce((sum, p) => sum + (p.total_amount || 0), 0),
            totalOrders: data.reduce((sum, p) => sum + (p.orders || 0), 0)
        };
    }

    formatCurrency(amount) {
        if (amount >= 1000000) {
            return (amount / 1000000).toFixed(2) + 'M';
        } else if (amount >= 1000) {
            return (amount / 1000).toFixed(1) + 'K';
        }
        return amount.toFixed(0);
    }

    toggleCategory(category) {
        const categoryEl = this.container.querySelector(`.subscription-category[data-category="${category}"]`);
        if (!categoryEl) return;

        const header = categoryEl.querySelector('.subscription-category-header');
        const content = categoryEl.querySelector('.subscription-category-content');
        const expandIcon = categoryEl.querySelector('.expand-icon');

        if (this.collapsedCategories.has(category)) {
            // Expanding
            this.collapsedCategories.delete(category);
            header.classList.remove('collapsed');
            content.style.display = '';
            expandIcon.textContent = '▾';

            // Initialize chart if this category supports it
            if (this.chartCategories.includes(category) && !this.charts.has(category)) {
                const containerId = `sub-chart-${category.toLowerCase()}`;
                const container = document.getElementById(containerId);
                if (container) {
                    const chart = new window.SubscriptionSalesCurve(containerId, { series: category });
                    this.charts.set(category, chart);
                    chart.init().catch(err => {
                        console.error(`Error initializing chart for ${category}:`, err);
                        container.innerHTML = `<div class="chart-error">Error loading chart</div>`;
                    });
                }
            }
        } else {
            // Collapsing
            this.collapsedCategories.add(category);
            header.classList.add('collapsed');
            content.style.display = 'none';
            expandIcon.textContent = '▸';

            // Destroy chart when collapsed to free memory
            if (this.charts.has(category)) {
                const chart = this.charts.get(category);
                if (chart && chart.destroy) {
                    chart.destroy();
                }
                this.charts.delete(category);
            }
        }
    }

    async refresh() {
        await this.loadData();
        this.render();
    }
}

// Create global instance
window.SubscriptionTable = SubscriptionTable;
window.subscriptionTable = null;  // Will be instantiated when tab is activated

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SubscriptionTable;
}
