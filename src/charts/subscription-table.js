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
        this.data = result.data || [];
        this.dayOverDayData = result.dayOverDay || {};
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
        if (!this.data || this.data.length === 0) {
            this.container.innerHTML = `
                <div class="subscription-table-wrapper" style="padding: 60px; text-align: center;">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" style="margin-bottom: 16px;">
                        <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>
                        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                    </svg>
                    <div style="color: var(--text-muted); font-size: 1.1rem;">No subscription data available</div>
                </div>
            `;
            return;
        }

        // Group data by category
        const groupedData = this.groupByCategory(this.data);

        // Calculate totals
        const totals = this.calculateTotals(this.data);

        // Build HTML
        let html = `
            <div class="subscription-table-wrapper">
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
                    if (categoryData.length === 0) return '';

                    const categoryTotals = this.calculateTotals(categoryData);
                    const isCollapsed = this.collapsedCategories.has(category);

                    return `
                        <div class="subscription-category" data-category="${category}">
                            <div class="subscription-category-header ${isCollapsed ? 'collapsed' : ''}"
                                 onclick="window.subscriptionTable.toggleCategory('${category}')">
                                <div class="subscription-category-title">
                                    <span class="expand-icon">${isCollapsed ? '▸' : '▾'}</span>
                                    <span class="category-badge ${category.toLowerCase()}">${category}</span>
                                    <span style="color: var(--text-secondary); font-weight: 400;">${categoryData.length} packages</span>
                                </div>
                                <div class="subscription-category-stats">
                                    <div class="subscription-stat">
                                        <div class="subscription-stat-value">${categoryTotals.totalPackages.toLocaleString()}</div>
                                        <div class="subscription-stat-label">Pkg Seats</div>
                                    </div>
                                    <div class="subscription-stat">
                                        <div class="subscription-stat-value">$${this.formatCurrency(categoryTotals.totalRevenue)}</div>
                                        <div class="subscription-stat-label">Revenue</div>
                                    </div>
                                </div>
                            </div>
                            <div class="subscription-category-content" style="${isCollapsed ? 'display: none;' : ''}">
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
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        this.container.innerHTML = html;
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
        if (this.collapsedCategories.has(category)) {
            this.collapsedCategories.delete(category);
        } else {
            this.collapsedCategories.add(category);
        }
        this.render();
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
