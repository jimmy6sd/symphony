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
        this.categoryOrder = ['Classical', 'Pops', 'Flex', 'Family', 'Specials'];

        // Categories that support sales curve charts
        this.chartCategories = ['Classical', 'Pops'];

        // Store chart instances
        this.charts = new Map();

        // Annotation state per category
        this.annotationData = new Map();   // category -> annotations[]
        this.annotationActiveTags = new Map(); // category -> string[]
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
                                <div class="sub-annotation-panel" id="sub-anno-panel-${category.toLowerCase()}" data-category="${category}">
                                    <div class="sub-anno-toggle" onclick="window.subscriptionTable.toggleAnnotationPanel('${category}')">
                                        <span class="sub-anno-toggle-icon">▸</span> Annotations
                                    </div>
                                    <div class="sub-anno-body" style="display:none">
                                        <div class="sub-anno-tag-filter" id="sub-anno-tags-${category.toLowerCase()}"></div>
                                        <div class="sub-anno-header">
                                            <button class="add-annotation-btn" onclick="window.subscriptionTable.showAnnotationForm('${category}')">+ Add Annotation</button>
                                        </div>
                                        <div class="sub-anno-form-container" id="sub-anno-form-${category.toLowerCase()}"></div>
                                        <div class="sub-anno-list" id="sub-anno-list-${category.toLowerCase()}">
                                            <div class="sub-anno-empty">No annotations yet. Click "+ Add Annotation" to create one.</div>
                                        </div>
                                    </div>
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

                    // Load annotations for this chart
                    await this.loadAnnotations(category);
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
                    chart.init().then(() => this.loadAnnotations(category)).catch(err => {
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

    toggleAnnotationPanel(category) {
        const key = category.toLowerCase();
        const panel = document.getElementById(`sub-anno-panel-${key}`);
        if (!panel) return;
        const body = panel.querySelector('.sub-anno-body');
        const icon = panel.querySelector('.sub-anno-toggle-icon');
        if (!body) return;
        const isHidden = body.style.display === 'none';
        body.style.display = isHidden ? '' : 'none';
        if (icon) icon.textContent = isHidden ? '▾' : '▸';
    }

    async loadAnnotations(category) {
        try {
            const annotations = await window.dataService.getAnnotationsForChart(category, 'subscription');
            this.annotationData.set(category, annotations);
            this.annotationActiveTags.set(category, []);

            const chart = this.charts.get(category);
            if (chart) chart.updateAnnotations(annotations);

            this.renderAnnotationList(category);
            this.renderTagFilter(category);
        } catch (e) {
            console.warn(`Could not load annotations for ${category}:`, e.message);
        }
    }

    renderAnnotationList(category) {
        const key = category.toLowerCase();
        const listEl = document.getElementById(`sub-anno-list-${key}`);
        if (!listEl) return;

        const annotations = this.annotationData.get(category) || [];
        const activeTags = this.annotationActiveTags.get(category) || [];

        const filtered = activeTags.length > 0
            ? annotations.filter(a => {
                const tags = Array.isArray(a.tags) ? a.tags : [];
                return tags.some(t => activeTags.includes(t));
            })
            : annotations;

        if (filtered.length === 0) {
            listEl.innerHTML = `<div class="sub-anno-empty">${annotations.length === 0 ? 'No annotations yet. Click "+ Add Annotation" to create one.' : 'No annotations match the selected tags.'}</div>`;
            return;
        }

        const fmtD = (v) => v && typeof v === 'object' && v.value ? v.value : String(v || '').split('T')[0];

        listEl.innerHTML = filtered.map(ann => {
            const tags = Array.isArray(ann.tags) ? ann.tags : [];
            let dateInfo;
            if (ann.annotation_date) {
                dateInfo = ann.annotation_type === 'interval' && ann.annotation_end_date
                    ? `${fmtD(ann.annotation_date)} — ${fmtD(ann.annotation_end_date)}`
                    : fmtD(ann.annotation_date);
            } else {
                dateInfo = '';
            }

            const isGlobal = ann.scope === 'global';
            const scopeLabel = isGlobal ? 'All Subs' : '';

            return `
                <div class="sub-anno-item">
                    <div class="sub-anno-item-left">
                        <span class="sub-anno-dot" style="background:${ann.color || '#e74c3c'}"></span>
                        <span class="sub-anno-type-badge ${ann.annotation_type}">${ann.annotation_type}</span>
                        ${isGlobal ? '<span class="sub-anno-scope-badge">All Subs</span>' : ''}
                    </div>
                    <div class="sub-anno-item-content">
                        <div class="sub-anno-label">${this.escapeHtml(ann.label)}</div>
                        ${ann.description ? `<div class="sub-anno-desc">${this.escapeHtml(ann.description)}</div>` : ''}
                        ${dateInfo ? `<div class="sub-anno-date">${dateInfo}</div>` : ''}
                        ${tags.length > 0 ? `<div class="sub-anno-tags">${tags.map(t => `<span class="tag-pill">${this.escapeHtml(t)}</span>`).join('')}</div>` : ''}
                    </div>
                    <div class="sub-anno-item-actions">
                        <button class="sub-anno-edit-btn" onclick="window.subscriptionTable.showAnnotationForm('${category}', '${ann.annotation_id}')">Edit</button>
                        <button class="sub-anno-del-btn" onclick="window.subscriptionTable.deleteAnnotation('${category}', '${ann.annotation_id}')">Del</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderTagFilter(category) {
        const key = category.toLowerCase();
        const container = document.getElementById(`sub-anno-tags-${key}`);
        if (!container) return;

        const annotations = this.annotationData.get(category) || [];
        const activeTags = this.annotationActiveTags.get(category) || [];

        const allTags = new Set();
        annotations.forEach(a => {
            (Array.isArray(a.tags) ? a.tags : []).forEach(t => allTags.add(t));
        });

        if (allTags.size === 0) {
            container.innerHTML = '';
            return;
        }

        let html = '<span class="sub-anno-filter-label">Filter by tag:</span>';
        html += `<span class="tag-pill-filter ${activeTags.length === 0 ? 'active' : ''}" onclick="window.subscriptionTable.filterAnnotationTags('${category}', null)">All</span>`;
        Array.from(allTags).sort().forEach(tag => {
            const isActive = activeTags.includes(tag);
            html += `<span class="tag-pill-filter ${isActive ? 'active' : ''}" onclick="window.subscriptionTable.filterAnnotationTags('${category}', '${this.escapeHtml(tag)}')">${this.escapeHtml(tag)}</span>`;
        });
        container.innerHTML = html;
    }

    filterAnnotationTags(category, tag) {
        let activeTags = this.annotationActiveTags.get(category) || [];
        if (tag === null) {
            activeTags = [];
        } else if (activeTags.includes(tag)) {
            activeTags = activeTags.filter(t => t !== tag);
        } else {
            activeTags = [...activeTags, tag];
        }
        this.annotationActiveTags.set(category, activeTags);

        const chart = this.charts.get(category);
        if (chart) chart.setTagFilter(activeTags.length > 0 ? activeTags : null);

        this.renderTagFilter(category);
        this.renderAnnotationList(category);
    }

    showAnnotationForm(category, editId = null) {
        const key = category.toLowerCase();
        const formContainer = document.getElementById(`sub-anno-form-${key}`);
        if (!formContainer) return;

        const annotations = this.annotationData.get(category) || [];
        const existing = editId ? annotations.find(a => a.annotation_id === editId) : null;
        const isEdit = !!existing;

        const fmtD = (v) => v && typeof v === 'object' && v.value ? v.value : String(v || '').split('T')[0];
        const currentType = existing ? existing.annotation_type : 'point';
        const existingTags = existing && Array.isArray(existing.tags) ? existing.tags.join(', ') : '';
        const existingDate = existing && existing.annotation_date ? fmtD(existing.annotation_date) : '';
        const existingEndDate = existing && existing.annotation_end_date ? fmtD(existing.annotation_end_date) : '';

        const currentScope = existing ? (existing.scope === 'global' ? 'global' : 'series') : 'series';

        formContainer.innerHTML = `
            <div class="sub-anno-form">
                <div class="sub-anno-form-title">${isEdit ? 'Edit Annotation' : 'Add Annotation'}</div>
                <div class="sub-anno-form-row">
                    <label>Scope:</label>
                    <label class="sub-anno-radio"><input type="radio" name="sub-anno-scope-${key}" value="series" ${currentScope === 'series' ? 'checked' : ''}> ${category} only</label>
                    <label class="sub-anno-radio"><input type="radio" name="sub-anno-scope-${key}" value="global" ${currentScope === 'global' ? 'checked' : ''}> All subscriptions</label>
                </div>
                <div class="sub-anno-form-row">
                    <label>Type:</label>
                    <label class="sub-anno-radio"><input type="radio" name="sub-anno-type-${key}" value="point" ${currentType === 'point' ? 'checked' : ''} onchange="document.getElementById('sub-anno-point-${key}').style.display='flex'; document.getElementById('sub-anno-interval-${key}').style.display='none'"> Point</label>
                    <label class="sub-anno-radio"><input type="radio" name="sub-anno-type-${key}" value="interval" ${currentType === 'interval' ? 'checked' : ''} onchange="document.getElementById('sub-anno-point-${key}').style.display='none'; document.getElementById('sub-anno-interval-${key}').style.display='flex'"> Interval</label>
                </div>
                <div class="sub-anno-form-row" id="sub-anno-point-${key}" style="display:${currentType === 'point' ? 'flex' : 'none'}">
                    <label>Date:</label>
                    <input type="date" id="sub-anno-date-${key}" value="${existingDate}">
                </div>
                <div class="sub-anno-form-row" id="sub-anno-interval-${key}" style="display:${currentType === 'interval' ? 'flex' : 'none'}">
                    <label>Start:</label>
                    <input type="date" id="sub-anno-start-${key}" value="${existingDate}">
                    <label>End:</label>
                    <input type="date" id="sub-anno-end-${key}" value="${existingEndDate}">
                </div>
                <div class="sub-anno-form-row">
                    <label>Label:</label>
                    <input type="text" id="sub-anno-label-${key}" placeholder="e.g. Email campaign" value="${existing ? this.escapeHtml(existing.label || '') : ''}">
                </div>
                <div class="sub-anno-form-row">
                    <label>Notes:</label>
                    <input type="text" id="sub-anno-desc-${key}" placeholder="Optional description" value="${existing ? this.escapeHtml(existing.description || '') : ''}">
                </div>
                <div class="sub-anno-form-row">
                    <label>Tags:</label>
                    <input type="text" id="sub-anno-tags-input-${key}" placeholder="Comma-separated tags" value="${existingTags}">
                </div>
                <div class="sub-anno-form-row">
                    <label>Color:</label>
                    <input type="color" id="sub-anno-color-${key}" value="${existing ? (existing.color || '#e74c3c') : '#e74c3c'}">
                </div>
                <div class="sub-anno-form-buttons">
                    <button class="sub-anno-cancel-btn" onclick="document.getElementById('sub-anno-form-${key}').innerHTML=''">Cancel</button>
                    <button class="sub-anno-save-btn" onclick="window.subscriptionTable.saveAnnotation('${category}', ${editId ? `'${editId}'` : 'null'})">${isEdit ? 'Update' : 'Save'}</button>
                </div>
            </div>
        `;
    }

    async saveAnnotation(category, editId) {
        const key = category.toLowerCase();
        const typeEl = document.querySelector(`input[name="sub-anno-type-${key}"]:checked`);
        const selectedType = typeEl ? typeEl.value : 'point';
        const scopeEl = document.querySelector(`input[name="sub-anno-scope-${key}"]:checked`);
        const selectedScope = scopeEl ? scopeEl.value : 'series';
        const isGlobal = selectedScope === 'global';

        const label = document.getElementById(`sub-anno-label-${key}`)?.value?.trim();
        if (!label) { alert('Please enter a label.'); return; }

        const description = document.getElementById(`sub-anno-desc-${key}`)?.value?.trim() || '';
        const tagsStr = document.getElementById(`sub-anno-tags-input-${key}`)?.value || '';
        const tagsArr = tagsStr.split(',').map(t => t.trim()).filter(t => t.length > 0);
        const color = document.getElementById(`sub-anno-color-${key}`)?.value || '#e74c3c';

        const payload = {
            annotationType: selectedType,
            label,
            description,
            color,
            tags: tagsArr,
            context: 'subscription',
            scope: isGlobal ? 'global' : 'production'
        };

        if (selectedType === 'point') {
            const dateVal = document.getElementById(`sub-anno-date-${key}`)?.value;
            if (!dateVal) { alert('Please select a date.'); return; }
            payload.annotationDate = dateVal;
        } else {
            const startVal = document.getElementById(`sub-anno-start-${key}`)?.value;
            const endVal = document.getElementById(`sub-anno-end-${key}`)?.value;
            if (!startVal || !endVal) { alert('Please select start and end dates.'); return; }
            payload.annotationDate = startVal;
            payload.annotationEndDate = endVal;
        }

        try {
            const groupTitle = isGlobal ? null : category;
            if (editId) {
                if (isGlobal) payload.groupTitle = null;
                await window.dataService.updateAnnotation(editId, payload);
            } else {
                await window.dataService.createAnnotation(groupTitle, payload);
            }
            // Clear form
            const formContainer = document.getElementById(`sub-anno-form-${key}`);
            if (formContainer) formContainer.innerHTML = '';

            // Global annotations affect all charts, so reload all
            if (isGlobal) {
                window.dataService.annotationCache.clear();
                for (const cat of this.chartCategories) {
                    if (this.charts.has(cat)) {
                        await this.loadAnnotations(cat);
                    }
                }
            } else {
                window.dataService.annotationCache.delete(`chart:subscription:${category}`);
                await this.loadAnnotations(category);
            }
        } catch (e) {
            alert('Error saving annotation: ' + e.message);
        }
    }

    async deleteAnnotation(category, annotationId) {
        if (!confirm('Delete this annotation?')) return;
        try {
            const annotations = this.annotationData.get(category) || [];
            const ann = annotations.find(a => a.annotation_id === annotationId);
            const wasGlobal = ann && ann.scope === 'global';

            await window.dataService.deleteAnnotation(annotationId);

            if (wasGlobal) {
                window.dataService.annotationCache.clear();
                for (const cat of this.chartCategories) {
                    if (this.charts.has(cat)) {
                        await this.loadAnnotations(cat);
                    }
                }
            } else {
                window.dataService.annotationCache.delete(`chart:subscription:${category}`);
                await this.loadAnnotations(category);
            }
        } catch (e) {
            alert('Error deleting annotation: ' + e.message);
        }
    }

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
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
