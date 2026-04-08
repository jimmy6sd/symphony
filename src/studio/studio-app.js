/**
 * Studio App - Main orchestrator for the Studio planning view
 * Manages plan state, coordinates sidebar and chart, handles navigation
 */
class StudioApp {
    constructor() {
        this.currentPlan = null;
        this.plans = [];
        this.performances = [];  // all performances for comp library
        this.selectedComps = new Map();  // performanceCode -> { data, isTarget, progression }
        this.activities = [];
        this.chart = null;
        this.compColorIndex = 0;
        this.currentPerfProgression = null;  // live sales for target perf
        this.projectionModifier = 0;         // percentage adjustment to projection line
        this.historicalComps = [];           // available historical comps
        this.selectedHistoricalComps = new Map(); // comparisonId -> { data, color }
        this._templates = [];
        this._selectedTemplateId = null;

        this.API_BASE = '/.netlify/functions/studio-plans';
        this.SNAPSHOTS_API = '/.netlify/functions/bigquery-snapshots';

        this.init();
    }

    async init() {
        this.bindEvents();
        this.populateActivityWeeks();

        // Check URL for direct plan link: /studio?plan=<planId>
        const params = new URLSearchParams(window.location.search);
        const planId = params.get('plan');
        if (planId && planId !== 'undefined' && planId !== 'null') {
            await this.openPlan(planId);
        } else {
            if (planId) history.replaceState(null, '', '/studio'); // clean up bad URL
            await this.loadPlans();
        }
    }

    // ═══════════════════════════════════════════
    // Event Binding
    // ═══════════════════════════════════════════

    bindEvents() {
        // Navigation
        document.getElementById('btn-my-plans')?.addEventListener('click', () => this.showPlansView());
        document.getElementById('btn-new-plan')?.addEventListener('click', () => this.showNewPlanModal());
        document.getElementById('btn-templates')?.addEventListener('click', () => this.showTemplates());
        document.getElementById('btn-delete-plan')?.addEventListener('click', () => this.deletePlan());

        // Modal
        document.getElementById('modal-close')?.addEventListener('click', () => this.hideNewPlanModal());
        document.getElementById('modal-cancel')?.addEventListener('click', () => this.hideNewPlanModal());
        document.getElementById('modal-create')?.addEventListener('click', () => this.createPlan());

        // Close modal on overlay click
        document.getElementById('new-plan-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'new-plan-modal') this.hideNewPlanModal();
        });

        // Comp library filters
        document.getElementById('filter-series')?.addEventListener('change', () => this.filterComps());
        document.getElementById('filter-season')?.addEventListener('change', () => this.filterComps());

        // Activities
        document.getElementById('btn-add-activity')?.addEventListener('click', () => this.showActivityForm());
        document.getElementById('btn-save-activity')?.addEventListener('click', () => this.saveActivity());
        document.getElementById('btn-cancel-activity')?.addEventListener('click', () => this.hideActivityForm());

        // Activity style toggle (point vs range)
        document.getElementById('style-point')?.addEventListener('click', () => this.setActivityStyle('point'));
        document.getElementById('style-range')?.addEventListener('click', () => this.setActivityStyle('range'));

        // Tags autocomplete
        const tagsInput = document.getElementById('activity-tags');
        const autocomplete = document.getElementById('activity-tags-autocomplete');
        const tagSuggestions = ['Email', 'Social', 'Groups', 'Radio', 'PR', 'Event', 'Sale', 'Note'];

        tagsInput?.addEventListener('input', () => {
            const parts = tagsInput.value.split(',');
            const current = parts[parts.length - 1].trim().toLowerCase();
            if (!current) { autocomplete.style.display = 'none'; return; }

            const existing = parts.slice(0, -1).map(t => t.trim().toLowerCase());
            const matches = tagSuggestions.filter(t => t.toLowerCase().includes(current) && !existing.includes(t.toLowerCase()));
            if (matches.length === 0) { autocomplete.style.display = 'none'; return; }

            autocomplete.style.display = 'block';
            autocomplete.innerHTML = matches.map(m => `<div class="studio-autocomplete-option">${m}</div>`).join('');
            autocomplete.querySelectorAll('.studio-autocomplete-option').forEach(opt => {
                opt.addEventListener('mousedown', () => {
                    parts[parts.length - 1] = ' ' + opt.textContent;
                    tagsInput.value = parts.join(',').replace(/^[\s,]+/, '') + ', ';
                    autocomplete.style.display = 'none';
                    tagsInput.focus();
                });
            });
        });

        tagsInput?.addEventListener('blur', () => {
            setTimeout(() => { autocomplete.style.display = 'none'; }, 200);
        });

        // Footer
        document.getElementById('btn-save-plan')?.addEventListener('click', () => this.savePlan());
        document.getElementById('btn-export-pdf')?.addEventListener('click', () => window.print());

        // Templates
        document.getElementById('btn-apply-template')?.addEventListener('click', () => this.showTemplates());
        document.getElementById('btn-save-as-template')?.addEventListener('click', () => this.showSaveTemplateModal());
        document.getElementById('template-modal-close')?.addEventListener('click', () => this.hideTemplateModal());
        document.getElementById('template-modal-cancel')?.addEventListener('click', () => this.hideTemplateModal());
        document.getElementById('template-modal-apply')?.addEventListener('click', () => this.applySelectedTemplate());
        document.getElementById('template-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'template-modal') this.hideTemplateModal();
        });
        document.getElementById('save-template-modal-close')?.addEventListener('click', () => this.hideSaveTemplateModal());
        document.getElementById('save-template-cancel')?.addEventListener('click', () => this.hideSaveTemplateModal());
        document.getElementById('save-template-confirm')?.addEventListener('click', () => this.saveAsTemplate());
        document.getElementById('save-template-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'save-template-modal') this.hideSaveTemplateModal();
        });

        // Resize chart on container size change
        const chartContainer = document.getElementById('studio-chart');
        if (chartContainer) {
            let resizeTimeout;
            new ResizeObserver(() => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => this.renderChart(), 150);
            }).observe(chartContainer);
        }
    }

    populateActivityWeeks() {
        for (const id of ['activity-week', 'activity-end-week']) {
            const select = document.getElementById(id);
            if (!select) continue;
            for (let w = -1; w >= -30; w--) {
                const opt = document.createElement('option');
                opt.value = w;
                opt.textContent = `Wk ${w}`;
                select.appendChild(opt);
            }
        }
        this.activityStyle = 'point';
    }

    setActivityStyle(style) {
        this.activityStyle = style;
        document.getElementById('style-point').classList.toggle('active', style === 'point');
        document.getElementById('style-range').classList.toggle('active', style === 'range');
        document.getElementById('end-week-row').style.display = style === 'range' ? 'block' : 'none';
        document.getElementById('week-label').textContent = style === 'range' ? 'Start Week' : 'Week';
    }

    // ═══════════════════════════════════════════
    // API Helpers
    // ═══════════════════════════════════════════

    static COMP_COLORS = ['#2d3436', '#0984e3', '#6c5ce7', '#00b894', '#d63031'];
    static TARGET_COLOR = '#e67e22';

    async api(action, params = {}, body = null) {
        const qs = new URLSearchParams({ action, ...params }).toString();
        const opts = body
            ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
            : {};
        const res = await fetch(`${this.API_BASE}?${qs}`, opts);
        return res.json();
    }

    // Resolve any performance code to its group's representative code
    resolveToGroup(code) {
        for (const perf of this.performances) {
            if (perf.performanceCode === code) return code;
            if (perf.performanceCodes && perf.performanceCodes.includes(code)) {
                return perf.performanceCode; // return group representative
            }
        }
        return code; // not found, return as-is
    }

    assignCompColor(isTarget) {
        if (isTarget) return StudioApp.TARGET_COLOR;
        const color = StudioApp.COMP_COLORS[this.compColorIndex % StudioApp.COMP_COLORS.length];
        this.compColorIndex++;
        return color;
    }

    // ═══════════════════════════════════════════
    // Plans View
    // ═══════════════════════════════════════════

    async loadPlans() {
        this.showLoading(true);
        try {
            const [plans, templates] = await Promise.all([
                this.api('get-plans'),
                this.api('get-templates')
            ]);
            this.plans = plans;
            this._templates = templates;
            this.renderPlansGrid();
            this.renderTemplatesGrid();
        } catch (err) {
            console.error('Failed to load plans:', err);
            this.plans = [];
            this._templates = [];
            this.renderPlansGrid();
            this.renderTemplatesGrid();
        }
        this.showLoading(false);
    }

    renderPlansGrid() {
        const grid = document.getElementById('plans-grid');
        const empty = document.getElementById('plans-empty');
        if (!grid) return;

        if (this.plans.length === 0) {
            grid.style.display = 'none';
            if (empty) empty.style.display = 'block';
            return;
        }

        grid.style.display = 'grid';
        if (empty) empty.style.display = 'none';

        grid.innerHTML = this.plans.map(plan => `
            <div class="plan-card" data-plan-id="${plan.plan_id}">
                <div class="plan-card-title">${this.escapeHtml(plan.plan_name)}</div>
                <div class="plan-card-meta">${[plan.series, plan.venue].filter(Boolean).join(' | ')}</div>
                <div class="plan-card-stats">
                    ${plan.capacity ? `Capacity: ${plan.capacity.toLocaleString()}` : ''}
                    ${plan.budget_goal ? ` | Budget: $${plan.budget_goal.toLocaleString()}` : ''}
                </div>
            </div>
        `).join('');

        grid.querySelectorAll('.plan-card').forEach(card => {
            card.addEventListener('click', () => this.openPlan(card.dataset.planId));
        });
    }

    renderTemplatesGrid() {
        const section = document.getElementById('templates-section');
        const grid = document.getElementById('templates-grid');
        if (!section || !grid) return;

        const templates = this._templates || [];
        if (templates.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        grid.innerHTML = templates.map(t => `
            <div class="plan-card template-card" data-template-id="${t.plan_id}">
                <div class="plan-card-title">${this.escapeHtml(t.plan_name)}</div>
                <div class="plan-card-meta">${[t.series, t.venue].filter(Boolean).join(' | ')}</div>
                <div class="plan-card-stats">${t.activity_count || 0} annotations</div>
                <div class="template-card-actions">
                    <button class="template-card-action rename" data-id="${t.plan_id}">Rename</button>
                    <button class="template-card-action delete" data-id="${t.plan_id}">Delete</button>
                </div>
            </div>
        `).join('');

        grid.querySelectorAll('.template-card-action.delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteTemplate(btn.dataset.id);
            });
        });

        grid.querySelectorAll('.template-card-action.rename').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.renameTemplate(btn.dataset.id);
            });
        });
    }

    async deleteTemplate(templateId) {
        const template = (this._templates || []).find(t => t.plan_id === templateId);
        const name = template?.plan_name || 'this template';
        if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

        try {
            await this.api('delete-plan', { planId: templateId });
            this._templates = (this._templates || []).filter(t => t.plan_id !== templateId);
            this.renderTemplatesGrid();
        } catch (err) {
            console.error('Failed to delete template:', err);
        }
    }

    async renameTemplate(templateId) {
        const template = (this._templates || []).find(t => t.plan_id === templateId);
        if (!template) return;

        const newName = prompt('Rename template:', template.plan_name);
        if (!newName || newName.trim() === template.plan_name) return;

        try {
            await this.api('update-plan', { planId: templateId }, { planName: newName.trim() });
            template.plan_name = newName.trim();
            this.renderTemplatesGrid();
        } catch (err) {
            console.error('Failed to rename template:', err);
        }
    }

    showPlansView() {
        document.getElementById('plans-view').style.display = 'block';
        document.getElementById('studio-workspace').style.display = 'none';
        document.getElementById('plan-bar').style.display = 'none';
        document.getElementById('btn-delete-plan').style.display = 'none';
        document.getElementById('btn-save-plan').style.display = 'none';
        document.getElementById('btn-export-pdf').style.display = 'none';
        this.currentPlan = null;
        this.selectedHistoricalComps.clear();
        this.historicalComps = [];
        this.currentPerfProgression = null;
        history.replaceState(null, '', '/studio');
        this.loadPlans();
    }

    // ═══════════════════════════════════════════
    // Open Plan (Workspace)
    // ═══════════════════════════════════════════

    async openPlan(planId) {
        this.showLoading(true);
        try {
            const plan = await this.api('get-plan', { planId });
            if (!plan || plan.error) {
                console.error('Plan not found:', planId);
                history.replaceState(null, '', '/studio');
                this.showLoading(false);
                await this.loadPlans();
                return;
            }
            history.replaceState(null, '', `/studio?plan=${planId}`);
            this.currentPlan = plan;
            this.activities = plan.activities || [];

            // Load comp library first so we can resolve codes to groups
            await this.loadCompLibrary();

            // Load selected comps, resolving saved codes to group representative codes
            this.selectedComps.clear();
            this.compColorIndex = 0;
            if (plan.comps) {
                for (const comp of plan.comps) {
                    const resolvedCode = this.resolveToGroup(comp.performance_code);
                    if (this.selectedComps.has(resolvedCode)) continue; // skip duplicate group
                    const perf = this.performances.find(p => p.performanceCode === resolvedCode);
                    this.selectedComps.set(resolvedCode, {
                        data: { ...comp, ...(perf || {}), id: comp.id },
                        isTarget: comp.is_target,
                        progression: null,
                        color: this.assignCompColor(comp.is_target)
                    });
                }
            }

            // Switch to workspace view
            document.getElementById('plans-view').style.display = 'none';
            document.getElementById('studio-workspace').style.display = 'flex';
            document.getElementById('plan-bar').style.display = 'flex';
            document.getElementById('btn-delete-plan').style.display = 'inline-block';
            document.getElementById('btn-save-plan').style.display = 'inline-block';
            document.getElementById('btn-export-pdf').style.display = 'inline-block';

            // Populate topbar header
            document.getElementById('plan-title').textContent = plan.plan_name;
            document.getElementById('plan-series').textContent = plan.series || '';
            document.getElementById('plan-venue').textContent = plan.venue || '';
            document.getElementById('plan-capacity').textContent = plan.capacity ? plan.capacity.toLocaleString() : '—';
            document.getElementById('plan-budget').textContent = plan.budget_goal ? `$${plan.budget_goal.toLocaleString()}` : '—';

            // Populate chart title and current performance panel
            this.renderCurrentPerfPanel();

            // Default comp library filter to plan's series
            if (this.currentPlan?.series) {
                const seriesSelect = document.getElementById('filter-series');
                if (seriesSelect) seriesSelect.value = this.currentPlan.series;
            }

            // Render sidebar (comp library already loaded above)
            this.renderCompList();
            this.renderActivities();
            this.updateFooterStats();

            // Show chart loading state while progressions fetch
            const chartEl = document.getElementById('studio-chart');
            if (chartEl && this.selectedComps.size > 0) {
                chartEl.innerHTML = '<div class="studio-chart-loading">Loading sales curves...</div>';
            }

            // Fetch progressions, current line, and historical comps in parallel
            await Promise.all([this.loadSelectedProgressions(), this.loadCurrentPerfProgression(), this.loadHistoricalComps()]);
            this.renderHistoricalCompList();
            this.renderCurrentPerfPanel(); // re-render with live stats
            this.renderChart();
        } catch (err) {
            console.error('Failed to open plan:', err);
            history.replaceState(null, '', '/studio');
            await this.loadPlans();
        }
        this.showLoading(false);
    }

    // ═══════════════════════════════════════════
    // Comp Library
    // ═══════════════════════════════════════════

    async loadCompLibrary() {
        if (this.performances.length > 0) return; // already loaded

        try {
            const res = await fetch(`${this.SNAPSHOTS_API}?action=get-initial-load`);
            const data = await res.json();

            // Group individual performances by production title
            // Each title (e.g., "CS08 Saint-Saens & Strauss") may have multiple nights
            // Normalize series: CS01-CS14 → Classical, PS1-PS5 → Pops, FS1-FS3 → Family
            const normalizeSeries = (s) => {
                if (!s) return s;
                if (/^CS\d/i.test(s)) return 'Classical';
                if (/^PS\d/i.test(s)) return 'Pops';
                if (/^FS\d/i.test(s)) return 'Family';
                return s;
            };

            const groupMap = new Map();
            for (const p of (data.performances || [])) {
                const title = p.title;
                if (!title) continue;
                if (!groupMap.has(title)) {
                    groupMap.set(title, {
                        title,
                        series: normalizeSeries(p.series),
                        venue: p.venue || 'Helzberg Hall',
                        capacity: p.capacity,
                        season: p.season,
                        performanceDate: p.date || p.performance_date,
                        lastPerformanceDate: p.date || p.performance_date,
                        // Track all perf codes in this group for fetching progressions
                        performanceCodes: [],
                        // Aggregate stats across nights
                        totalTicketsSold: 0,
                        totalCapacity: 0
                    });
                }
                const group = groupMap.get(title);
                const code = p.id || p.performance_code;
                group.performanceCodes.push(code);
                group.totalTicketsSold += (p.totalTicketsSold || p.total_tickets_sold || 0);
                group.totalCapacity += (p.capacity || 0);
                // Track earliest and latest dates across nights
                const pDate = p.date || p.performance_date;
                if (pDate) {
                    if (!group.performanceDate || pDate < group.performanceDate) group.performanceDate = pDate;
                    if (!group.lastPerformanceDate || pDate > group.lastPerformanceDate) group.lastPerformanceDate = pDate;
                }
            }

            // Build grouped list -- use first perf code as the representative
            this.performances = [...groupMap.values()].map(g => ({
                performanceCode: g.performanceCodes[0],
                performanceCodes: g.performanceCodes,
                title: g.title,
                series: g.series,
                venue: g.venue,
                capacity: g.capacity,
                season: g.season,
                totalTicketsSold: Math.round(g.totalTicketsSold / g.performanceCodes.length),
                occupancyPercent: g.totalCapacity > 0 ? Math.round((g.totalTicketsSold / g.totalCapacity) * 100) : 0,
                performanceDate: g.performanceDate,
                lastPerformanceDate: g.lastPerformanceDate,
                nightCount: g.performanceCodes.length
            }));

            this.populateFilters();
        } catch (err) {
            console.error('Failed to load performances:', err);
        }
    }

    populateFilters() {
        const seriesSet = new Set(this.performances.map(p => p.series).filter(Boolean));
        const seasonSet = new Set(this.performances.map(p => p.season).filter(Boolean));

        const seriesSelect = document.getElementById('filter-series');
        const seasonSelect = document.getElementById('filter-season');

        if (seriesSelect) {
            [...seriesSet].sort().forEach(s => {
                const opt = document.createElement('option');
                opt.value = s;
                opt.textContent = s;
                seriesSelect.appendChild(opt);
            });
            // Pre-select plan's series if set
            if (this.currentPlan?.series) {
                seriesSelect.value = this.currentPlan.series;
            }
        }

        if (seasonSelect) {
            [...seasonSet].sort().reverse().forEach(s => {
                const opt = document.createElement('option');
                opt.value = s;
                opt.textContent = s;
                seasonSelect.appendChild(opt);
            });
        }
    }

    getFilteredComps() {
        const series = document.getElementById('filter-series')?.value || '';
        const season = document.getElementById('filter-season')?.value || '';

        return this.performances.filter(p => {
            if (series && p.series !== series) return false;
            if (season && p.season !== season) return false;
            return true;
        });
    }

    filterComps() {
        this.renderCompList();
    }

    renderCompList() {
        const list = document.getElementById('comp-list');
        const countEl = document.getElementById('comp-count');
        if (!list) return;

        const filtered = this.getFilteredComps();
        if (countEl) {
            countEl.textContent = `${this.selectedComps.size} selected of ${filtered.length}`;
        }

        // Pin selected comps to top
        const selected = filtered.filter(p => this.selectedComps.has(p.performanceCode));
        const unselected = filtered.filter(p => !this.selectedComps.has(p.performanceCode));
        const sorted = [...selected, ...unselected];

        list.innerHTML = sorted.map(p => {
            const comp = this.selectedComps.get(p.performanceCode);
            const isSelected = !!comp;
            const isTarget = comp?.isTarget || false;
            const isLoading = comp?.loading || false;
            const classes = ['comp-card'];
            if (isTarget) classes.push('target');
            else if (isSelected) classes.push('selected');
            if (isLoading) classes.push('loading');

            const nights = p.nightCount > 1 ? ` (${p.nightCount} nights)` : '';

            const targetToggle = isSelected && !isLoading ? `
                <label class="comp-target-toggle" title="Set as target">
                    <input type="checkbox" class="target-checkbox" data-code="${p.performanceCode}" ${isTarget ? 'checked' : ''}>
                    <span class="target-slider"></span>
                    <span class="target-label">${isTarget ? 'TARGET' : 'Target'}</span>
                </label>
            ` : '';

            const compColor = comp?.color || '';
            const checkboxStyle = isSelected && compColor
                ? `background:${compColor};border-color:${compColor};`
                : '';

            return `
                <div class="${classes.join(' ')}" data-code="${p.performanceCode}" ${compColor ? `style="border-left: 3px solid ${compColor};"` : ''}>
                    <div class="comp-checkbox" ${checkboxStyle ? `style="${checkboxStyle}"` : ''}>
                        ${isLoading
                            ? '<div class="comp-spinner"></div>'
                            : '<svg viewBox="0 0 12 12" fill="none" stroke="white" stroke-width="2"><polyline points="2,6 5,9 10,3"/></svg>'}
                    </div>
                    <div class="comp-info">
                        <div class="comp-name">${this.escapeHtml(p.title || p.performanceCode)}${p.season ? ` <span class="comp-season">'${p.season}</span>` : ''}</div>
                        <div class="comp-details">${p.venue} | ${p.totalTicketsSold.toLocaleString()} sold | ${Math.round(p.occupancyPercent)}%${nights}</div>
                        ${targetToggle}
                    </div>
                </div>
            `;
        }).join('');

        // Bind click events
        list.querySelectorAll('.comp-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't toggle comp if clicking the target switch
                if (e.target.closest('.comp-target-toggle')) return;
                this.toggleComp(card.dataset.code);
            });
        });

        // Bind target toggle switches
        list.querySelectorAll('.target-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                e.stopPropagation();
                this.setTarget(cb.dataset.code);
            });
        });
    }

    async toggleComp(performanceCode) {
        if (this.selectedComps.has(performanceCode)) {
            // Remove comp -- instant
            const comp = this.selectedComps.get(performanceCode);
            this.selectedComps.delete(performanceCode);
            this.renderCompList();
            this.renderChart();
            this.updateFooterStats();

            // Fire-and-forget API cleanup
            if (comp.data?.id) {
                this.api('remove-plan-comp', { compId: comp.data.id }).catch(() => {});
            }
        } else {
            // Add comp -- optimistic UI first, then load data
            const perf = this.performances.find(p => p.performanceCode === performanceCode);
            if (!perf) return;

            // Immediately show as selected with loading state
            this.selectedComps.set(performanceCode, {
                data: { ...perf, id: null },
                isTarget: false,
                progression: null,
                loading: true,
                color: this.assignCompColor(false)
            });
            this.renderCompList();
            this.updateFooterStats();

            // Fire-and-forget the API save -- don't block UI on it
            this.api('add-plan-comp', {}, {
                planId: this.currentPlan.plan_id,
                performanceCode,
                isTarget: false
            }).then(result => {
                // Backfill the server-generated ID
                const comp = this.selectedComps.get(performanceCode);
                if (comp) comp.data.id = result.id;
            }).catch(() => {});

            // Only await the progression data (needed for chart)
            let progression = [];
            try {
                const res = await fetch(`${this.SNAPSHOTS_API}?action=get-sales-progression&performanceCode=${performanceCode}`);
                const data = await res.json();
                progression = data.progression || [];
            } catch (err) {
                console.error('Failed to load progression:', err);
            }

            // Update with real data and render chart
            const comp = this.selectedComps.get(performanceCode);
            if (comp) {
                comp.progression = progression;
                comp.loading = false;
            }
            this.renderCompList();
            this.renderChart();
            this.updateFooterStats();
        }
    }

    async setTarget(performanceCode) {
        if (!this.selectedComps.has(performanceCode)) {
            await this.toggleComp(performanceCode);
        }

        // Toggle target: if already target, unset; otherwise set
        const comp = this.selectedComps.get(performanceCode);
        const wasTarget = comp.isTarget;

        // Unset all targets and reassign colors
        this.compColorIndex = 0;
        for (const [, c] of this.selectedComps) {
            c.isTarget = false;
        }

        // Set new target (unless toggling off)
        if (!wasTarget) {
            comp.isTarget = true;
        }

        // Reassign colors: target gets orange, others get comp colors
        for (const [, c] of this.selectedComps) {
            c.color = this.assignCompColor(c.isTarget);
        }

        // Persist to API
        if (!wasTarget && comp.data?.id) {
            this.api('set-target-comp', {
                planId: this.currentPlan.plan_id,
                compId: comp.data.id
            }).catch(() => {});
        }

        this.renderCompList();
        this.renderChart();
    }

    async loadSelectedProgressions() {
        const promises = [];
        for (const [code, comp] of this.selectedComps) {
            if (!comp.progression) {
                promises.push(
                    fetch(`${this.SNAPSHOTS_API}?action=get-sales-progression&performanceCode=${code}`)
                        .then(r => r.json())
                        .then(data => { comp.progression = data.progression || []; })
                        .catch(() => { comp.progression = []; })
                );
            }
        }
        await Promise.all(promises);
    }

    async loadCurrentPerfProgression() {
        if (!this.currentPlan?.target_perf_code) {
            this.currentPerfProgression = null;
            return;
        }
        try {
            const res = await fetch(`${this.SNAPSHOTS_API}?action=get-sales-progression&performanceCode=${this.currentPlan.target_perf_code}`);
            const data = await res.json();
            this.currentPerfProgression = data.progression || [];
        } catch (err) {
            console.error('Failed to load current perf progression:', err);
            this.currentPerfProgression = [];
        }
    }

    async loadHistoricalComps() {
        if (!this.currentPlan?.target_perf_code) {
            this.historicalComps = [];
            return;
        }
        try {
            const res = await fetch(`/.netlify/functions/performance-comparisons?performanceId=${this.currentPlan.target_perf_code}`);
            const data = await res.json();
            this.historicalComps = Array.isArray(data) ? data : [];
        } catch (err) {
            console.error('Failed to load historical comps:', err);
            this.historicalComps = [];
        }
    }

    renderHistoricalCompList() {
        const list = document.getElementById('historical-comp-list');
        const header = document.getElementById('historical-comps-header');
        if (!list) return;

        if (this.historicalComps.length === 0) {
            if (header) header.style.display = 'none';
            list.innerHTML = '';
            return;
        }

        if (header) header.style.display = 'block';

        list.innerHTML = this.historicalComps.map(c => {
            const isSelected = this.selectedHistoricalComps.has(c.comparison_id);
            const hComp = this.selectedHistoricalComps.get(c.comparison_id);
            const compColor = hComp?.color || '';
            const classes = ['comp-card'];
            if (isSelected) classes.push('selected');

            const checkboxStyle = isSelected && compColor
                ? `background:${compColor};border-color:${compColor};`
                : '';

            const meta = [
                c.capacity ? `Cap: ${c.capacity.toLocaleString()}` : '',
                c.occupancy_percent ? `${Math.round(c.occupancy_percent)}%` : '',
                c.atp ? `ATP: $${c.atp.toFixed(0)}` : ''
            ].filter(Boolean).join(' | ');

            return `
                <div class="${classes.join(' ')}" data-comp-id="${c.comparison_id}" ${compColor ? `style="border-left: 3px solid ${compColor};"` : ''}>
                    <div class="comp-checkbox" ${checkboxStyle ? `style="${checkboxStyle}"` : ''}>
                        <svg viewBox="0 0 12 12" fill="none" stroke="white" stroke-width="2"><polyline points="2,6 5,9 10,3"/></svg>
                    </div>
                    <div class="comp-info">
                        <div class="comp-name">${this.escapeHtml(c.comparison_name)}</div>
                        ${meta ? `<div class="comp-details">${meta}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.comp-card').forEach(card => {
            card.addEventListener('click', () => this.toggleHistoricalComp(card.dataset.compId));
        });
    }

    toggleHistoricalComp(comparisonId) {
        if (this.selectedHistoricalComps.has(comparisonId)) {
            this.selectedHistoricalComps.delete(comparisonId);
        } else {
            const comp = this.historicalComps.find(c => c.comparison_id === comparisonId);
            if (!comp) return;
            this.selectedHistoricalComps.set(comparisonId, {
                data: comp,
                color: this.assignCompColor(false)
            });
        }
        this.renderHistoricalCompList();
        this.renderChart();
        this.updateFooterStats();
    }

    renderCurrentPerfPanel() {
        const container = document.getElementById('current-perf-info');
        const chartTitle = document.getElementById('chart-title');
        if (!container) return;

        // Determine what to show: linked upcoming performance, or fall back to target comp
        const perfCode = this.currentPlan?.target_perf_code;
        const targetComp = [...this.selectedComps.values()].find(c => c.isTarget);
        const targetCompCode = targetComp ? [...this.selectedComps.entries()].find(([,v]) => v === targetComp)?.[0] : null;

        // Use linked performance if set, otherwise use target comp
        const displayCode = perfCode || targetCompCode;
        const prog = perfCode ? (this.currentPerfProgression || []) : (targetComp?.progression || []);
        const isLive = !!perfCode; // true = live upcoming show, false = using comp as reference

        if (!displayCode && !targetComp) {
            container.innerHTML = '<p class="current-perf-empty">Select a target comp to get started</p>';
            if (chartTitle) chartTitle.textContent = this.currentPlan?.plan_name || '';
            return;
        }

        const perf = this.performances.find(p =>
            p.performanceCode === displayCode || (p.performanceCodes && p.performanceCodes.includes(displayCode))
        );
        const title = perf?.title || displayCode || this.currentPlan?.plan_name || '';

        // Chart title
        if (chartTitle) chartTitle.textContent = title;

        // Get latest sales data
        const latest = prog.length > 0 ? prog.filter(d => d.weeksOut >= 0).reduce((a, b) => a.weeksOut < b.weeksOut ? a : b, prog[0]) : null;
        const capacity = this.currentPlan?.capacity || perf?.capacity || 0;

        if (!latest) {
            container.innerHTML = `
                <div class="current-perf-box">
                    <div class="current-perf-box-header">${this.escapeHtml(title)}</div>
                    <div class="current-perf-section-label">${isLive ? 'No sales data yet' : 'Loading...'}</div>
                </div>
            `;
            return;
        }

        const currentTickets = latest.ticketsSold;
        const weeksOut = Math.round(latest.weeksOut);
        const pctCap = capacity > 0 ? Math.round((currentTickets / capacity) * 100) : 0;

        // For comp-as-reference: show final stats from the comp
        const finalTickets = prog.length > 0
            ? prog.filter(d => d.weeksOut >= 0).reduce((best, d) => d.weeksOut < best.weeksOut ? d : best, prog[0]).ticketsSold
            : currentTickets;

        const currentRevenue = latest.revenue || 0;
        const currentStr = currentRevenue > 0
            ? `${currentTickets.toLocaleString()} · $${(currentRevenue / 1000).toFixed(0)}k`
            : currentTickets.toLocaleString();

        if (isLive) {
            // Live upcoming show — show tracking status with variance
            let variance = 0;
            let projectedFinal = currentTickets;
            let targetCompName = '';

            if (targetComp?.progression?.length > 0) {
                targetCompName = this.performances.find(p => p.performanceCode === targetCompCode)?.title || '';
                const targetData = targetComp.progression.filter(d => d.weeksOut >= 0).sort((a, b) => b.weeksOut - a.weeksOut);
                const targetAtWeek = this._interpolateTargetAtWeek(targetData, latest.weeksOut);
                variance = currentTickets - targetAtWeek;
                const targetAtZero = this._interpolateTargetAtWeek(targetData, 0);
                projectedFinal = Math.max(currentTickets, targetAtZero + variance);
            }

            const status = variance > 20 ? 'Ahead' : variance < -20 ? 'Behind' : 'On Track';
            const badgeClass = variance > 20 ? 'ahead' : variance < -20 ? 'behind' : 'on-track';
            const varianceStr = `${status} ${variance >= 0 ? '+' : ''}${Math.round(variance).toLocaleString()}`;

            container.innerHTML = `
                <div class="current-perf-box">
                    <div class="current-perf-box-header">${this.escapeHtml(title)}</div>
                    ${targetComp ? `<span class="current-perf-badge ${badgeClass}">${varianceStr}</span>` : ''}
                    <div class="current-perf-section-label">CURRENT · ${weeksOut}w out</div>
                    <div class="current-perf-section-value">${currentStr}</div>
                    ${targetComp ? `
                        <hr class="current-perf-divider">
                        <div class="current-perf-section-label">PROJECTED FINAL</div>
                        <div class="current-perf-section-value">${projectedFinal.toLocaleString()}</div>
                        <div class="current-perf-basis">Based on ${this.escapeHtml(targetCompName)}</div>
                    ` : ''}
                </div>
                ${this._renderModificationsSection()}
            `;
        } else {
            // No linked show — show target comp as reference
            const modifiedTickets = capacity > 0
                ? Math.min(capacity, Math.round(finalTickets * (1 + this.projectionModifier / 100)))
                : Math.round(finalTickets * (1 + this.projectionModifier / 100));
            container.innerHTML = `
                <div class="current-perf-box">
                    <div class="current-perf-box-header">${this.escapeHtml(title)}</div>
                    <div class="current-perf-section-label">TARGET COMP · Final</div>
                    <div class="current-perf-section-value">${finalTickets.toLocaleString()}</div>
                    ${this.projectionModifier !== 0 ? `
                        <hr class="current-perf-divider">
                        <div class="current-perf-section-label">MODIFIED PROJECTION</div>
                        <div class="current-perf-section-value">${modifiedTickets.toLocaleString()}</div>
                    ` : ''}
                    <hr class="current-perf-divider">
                    <div class="current-perf-section-label">CAPACITY</div>
                    <div class="current-perf-section-value">${capacity > 0 ? `${pctCap}%` : '—'}</div>
                    <div class="current-perf-basis">${capacity > 0 ? `${finalTickets.toLocaleString()} of ${capacity.toLocaleString()}` : 'No capacity set'}</div>
                </div>
                ${this._renderModificationsSection()}
            `;
        }

        // Bind modifier input
        const modInput = container.querySelector('#projection-modifier');
        if (modInput) {
            modInput.addEventListener('input', (e) => {
                const val = parseInt(e.target.value) || 0;
                this.projectionModifier = val;
                const label = container.querySelector('#modifier-label');
                if (label) label.textContent = `${val >= 0 ? '+' : ''}${val}%`;
                this.renderChart();
                // Update the modified projection value if visible
                this.renderCurrentPerfPanel();
            });
        }
    }

    _renderModificationsSection() {
        const activitiesWithDelta = this.activities.filter(a => a.ticket_delta && a.ticket_delta !== 0);
        const totalDelta = activitiesWithDelta.reduce((sum, a) => sum + (a.ticket_delta || 0), 0);

        return `
            <div class="current-perf-modifications">
                <div class="modifications-header">MODIFICATIONS</div>
                <div class="modifications-row">
                    <label class="modifications-label">Projection</label>
                    <div class="modifications-control">
                        <input type="range" id="projection-modifier" class="modifier-slider"
                            min="-50" max="50" step="5" value="${this.projectionModifier}">
                        <span id="modifier-label" class="modifier-value">${this.projectionModifier >= 0 ? '+' : ''}${this.projectionModifier}%</span>
                    </div>
                </div>
            </div>
            ${activitiesWithDelta.length > 0 ? `
                <div class="current-perf-modifications">
                    <div class="modifications-header">ACTIVITY IMPACTS</div>
                    ${activitiesWithDelta.map(a => `
                        <div class="modifications-row activity-impact-row">
                            <span class="activity-impact-dot" style="background:${a.color || '#95a5a6'}"></span>
                            <span class="activity-impact-label">${this.escapeHtml(a.label)}</span>
                            <span class="activity-impact-delta ${a.ticket_delta > 0 ? 'positive' : 'negative'}">${a.ticket_delta > 0 ? '+' : ''}${a.ticket_delta.toLocaleString()}</span>
                        </div>
                    `).join('')}
                    <div class="modifications-row activity-impact-total">
                        <span class="activity-impact-label">Net impact</span>
                        <span class="activity-impact-delta ${totalDelta >= 0 ? 'positive' : 'negative'}">${totalDelta >= 0 ? '+' : ''}${totalDelta.toLocaleString()}</span>
                    </div>
                </div>
            ` : ''}
        `;
    }

    // ═══════════════════════════════════════════
    // Chart
    // ═══════════════════════════════════════════

    renderChart() {
        const container = document.getElementById('studio-chart');
        if (!container) return;

        // Clear existing
        container.innerHTML = '';
        document.getElementById('chart-legend').innerHTML = '';
        this._adjustedTargetData = null;
        this._hasProjection = false;
        this._projectionData = null;

        if (this.selectedComps.size === 0) {
            container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:var(--font-size-lg);">Select comps from the library to see sales curves</div>';
            return;
        }

        const rect = container.getBoundingClientRect();
        const width = rect.width || 800;
        const height = Math.max(rect.height, 300);
        const margin = { top: 20, right: 30, bottom: 110, left: 55 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Collect all data points to determine scales
        let maxWeeks = 0;
        const capacity = this.currentPlan?.capacity || 1800;

        const compEntries = [];
        for (const [code, comp] of this.selectedComps) {
            // Filter to only pre-performance data (weeksOut >= 0)
            const progression = (comp.progression || []).filter(d => d.weeksOut >= 0);
            if (progression.length === 0) continue;

            const weekMax = Math.max(...progression.map(d => d.weeksOut || 0));
            if (weekMax > maxWeeks) maxWeeks = weekMax;

            compEntries.push({
                code,
                comp,
                progression,
                color: comp.color || (comp.isTarget ? StudioApp.TARGET_COLOR : '#2d3436'),
                isTarget: comp.isTarget
            });
        }

        // Add current performance line (live sales for target perf)
        if (this.currentPerfProgression && this.currentPerfProgression.length > 0) {
            const progression = this.currentPerfProgression.filter(d => d.weeksOut >= 0);
            if (progression.length > 0) {
                const weekMax = Math.max(...progression.map(d => d.weeksOut || 0));
                if (weekMax > maxWeeks) maxWeeks = weekMax;
                compEntries.push({
                    code: this.currentPlan.target_perf_code,
                    comp: null,
                    progression,
                    color: '#0984e3',
                    isTarget: false,
                    isCurrent: true
                });
            }
        }

        // Add historical comps (from performance_sales_comparisons table)
        for (const [compId, hComp] of this.selectedHistoricalComps) {
            const weeksArray = hComp.data.weeksArray;
            if (!weeksArray || weeksArray.length === 0) continue;

            // weeksArray[0] = farthest week, weeksArray[N-1] = show day (week 0)
            const numWeeks = weeksArray.length;
            const progression = weeksArray.map((tickets, i) => ({
                weeksOut: numWeeks - 1 - i,
                ticketsSold: tickets
            }));

            const weekMax = numWeeks - 1;
            if (weekMax > maxWeeks) maxWeeks = weekMax;

            compEntries.push({
                code: `hist-${compId}`,
                comp: hComp,
                progression,
                color: hComp.color,
                isTarget: false,
                isHistorical: true
            });
        }

        // Y-axis based on capacity; x-axis fits the data
        maxWeeks = Math.max(maxWeeks, 20);
        const maxTickets = Math.round(capacity * 1.15);

        // Scales
        const xScale = d3.scaleLinear()
            .domain([maxWeeks, 0])
            .range([0, innerWidth]);

        const yScale = d3.scaleLinear()
            .domain([0, maxTickets])
            .range([innerHeight, 0]);

        // Grid
        g.append('g')
            .attr('class', 'grid')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(d3.axisBottom(xScale).tickSize(-innerHeight).tickFormat(''))
            .selectAll('line').attr('stroke', '#f0f0f0').attr('stroke-width', 0.5);

        g.append('g')
            .attr('class', 'grid')
            .call(d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat(''))
            .selectAll('line').attr('stroke', '#f0f0f0').attr('stroke-width', 0.5);

        // Remove domain lines from grid
        g.selectAll('.grid .domain').remove();

        // Axes
        g.append('g')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(d3.axisBottom(xScale).ticks(10).tickFormat(d => d === 0 ? 'Performance' : `${d}w before`))
            .selectAll('text').attr('font-size', '11px');

        g.append('g')
            .attr('transform', `translate(0,${innerHeight})`)
            .append('text')
            .attr('x', innerWidth / 2)
            .attr('y', 35)
            .attr('fill', 'var(--text-secondary)')
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .text('Weeks Before Performance');

        g.append('g')
            .call(d3.axisLeft(yScale).ticks(8).tickFormat(d3.format(',')))
            .append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -innerHeight / 2)
            .attr('y', -45)
            .attr('fill', 'var(--text-secondary)')
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .text('Cumulative Tickets Sold');

        // Total Capacity line (gray, solid — matches main dashboard)
        if (capacity > 0) {
            g.append('line')
                .attr('x1', 0).attr('x2', innerWidth)
                .attr('y1', yScale(capacity)).attr('y2', yScale(capacity))
                .attr('stroke', '#ccc')
                .attr('stroke-width', 2);

            g.append('text')
                .attr('x', 5)
                .attr('y', yScale(capacity) - 5)
                .attr('fill', '#999')
                .attr('font-size', '12px')
                .attr('font-weight', '600')
                .text(`Total Capacity (${capacity.toLocaleString()})`);
        }

        // Budget goal line (purple, solid — like Available Single Tickets)
        if (capacity > 0) {
            const budgetTickets = Math.round(capacity * 0.85);
            g.append('line')
                .attr('x1', 0).attr('x2', innerWidth)
                .attr('y1', yScale(budgetTickets)).attr('y2', yScale(budgetTickets))
                .attr('stroke', '#9b59b6')
                .attr('stroke-width', 2);

            const budgetLabel = this.currentPlan?.budget_goal
                ? `Budget Goal ($${this.currentPlan.budget_goal.toLocaleString()})`
                : `Budget Goal (${budgetTickets.toLocaleString()})`;
            g.append('text')
                .attr('x', 5)
                .attr('y', yScale(budgetTickets) + 15)
                .attr('fill', '#9b59b6')
                .attr('font-size', '12px')
                .attr('font-weight', '600')
                .text(budgetLabel);
        }

        // Line generator -- clamp tickets to chart range to avoid outlier spikes
        const line = d3.line()
            .x(d => xScale(d.weeksOut))
            .y(d => yScale(Math.min(d.ticketsSold, maxTickets)))
            .curve(d3.curveMonotoneX);

        // Draw comp lines: comps first, then current, then target on top
        const sortedEntries = [...compEntries].sort((a, b) => {
            if (a.isTarget !== b.isTarget) return a.isTarget - b.isTarget;
            if (a.isCurrent !== b.isCurrent) return (a.isCurrent ? 1 : 0) - (b.isCurrent ? 1 : 0);
            return 0;
        });

        sortedEntries.forEach(entry => {
            // Filter out bad data: any snapshot with tickets > 2x capacity is corrupt
            const saneProgression = entry.progression.filter(d =>
                d.ticketsSold <= capacity * 2
            );

            // Group by week: take the LAST snapshot per week (most recent, not max)
            const weekMap = new Map();
            saneProgression.forEach(d => {
                const week = d.weeksOut;
                if (!weekMap.has(week) || d.date > weekMap.get(week).date) {
                    weekMap.set(week, d);
                }
            });
            // Sort by weeks descending (far out → performance)
            const rawWeekly = [...weekMap.values()].sort((a, b) => b.weeksOut - a.weeksOut);

            // Enforce monotonic increase: cumulative sales should only go up
            let runningMax = 0;
            const weeklyData = rawWeekly.map(d => {
                runningMax = Math.max(runningMax, d.ticketsSold);
                return { ...d, ticketsSold: runningMax };
            });

            if (weeklyData.length < 2) return;

            // Store smoothed data for tooltip reuse
            entry.smoothedWeekly = weeklyData;

            if (entry.isCurrent) {
                // Current line: blue solid for actuals
                g.append('path')
                    .datum(weeklyData)
                    .attr('d', line)
                    .attr('fill', 'none')
                    .attr('stroke', '#0984e3')
                    .attr('stroke-width', 3)
                    .attr('opacity', 1);
                // Projection handled after this loop (needs target comp data)
            } else {
                g.append('path')
                    .datum(weeklyData)
                    .attr('d', line)
                    .attr('fill', 'none')
                    .attr('stroke', entry.color)
                    .attr('stroke-width', entry.isTarget ? 3.5 : 2.5)
                    .attr('stroke-dasharray', entry.isTarget ? null : '10,5')
                    .attr('opacity', entry.isTarget ? 1 : 0.75);
            }
        });

        // Projection line: green dashed
        const currentEntry = sortedEntries.find(e => e.isCurrent);
        const targetEntryForProjection = sortedEntries.find(e => e.isTarget);

        if (currentEntry?.smoothedWeekly?.length > 0 && targetEntryForProjection?.smoothedWeekly?.length > 0) {
            // Has actuals: project from last actual to week 0 following target comp's shape
            const currentData = currentEntry.smoothedWeekly;
            const targetData = targetEntryForProjection.smoothedWeekly;
            const lastActual = currentData[currentData.length - 1];

            if (lastActual.weeksOut > 0) {
                const targetAtLastWeek = this._interpolateTargetAtWeek(targetData, lastActual.weeksOut);
                const variance = lastActual.ticketsSold - targetAtLastWeek;

                const mod = 1 + (this.projectionModifier || 0) / 100;
                const cap = capacity > 0 ? capacity : Infinity;
                const projectionData = [{ weeksOut: lastActual.weeksOut, ticketsSold: lastActual.ticketsSold }];
                const futureTargetWeeks = targetData.filter(d => d.weeksOut < lastActual.weeksOut);
                for (const d of futureTargetWeeks) {
                    projectionData.push({
                        weeksOut: d.weeksOut,
                        ticketsSold: Math.min(cap, Math.round(Math.max(lastActual.ticketsSold, (d.ticketsSold + variance) * mod + this._activityDeltaAtWeek(d.weeksOut))))
                    });
                }
                if (projectionData[projectionData.length - 1]?.weeksOut > 0) {
                    const targetAtZero = this._interpolateTargetAtWeek(targetData, 0);
                    projectionData.push({
                        weeksOut: 0,
                        ticketsSold: Math.min(cap, Math.round(Math.max(lastActual.ticketsSold, (targetAtZero + variance) * mod + this._activityDeltaAtWeek(0))))
                    });
                }

                if (projectionData.length >= 2) {
                    currentEntry.projectionData = projectionData;
                    this._hasProjection = true;
                    this._projectionData = projectionData;

                    g.append('path')
                        .datum(projectionData)
                        .attr('d', line)
                        .attr('fill', 'none')
                        .attr('stroke', '#27ae60')
                        .attr('stroke-width', 2.5)
                        .attr('stroke-dasharray', '8,5')
                        .attr('opacity', 0.85);
                }
            }
        } else if (!currentEntry && targetEntryForProjection?.smoothedWeekly?.length > 0) {
            // No linked performance: draw target comp's curve as green dashed "projection/plan" line
            const mod = 1 + (this.projectionModifier || 0) / 100;
            const cap = capacity > 0 ? capacity : Infinity;
            const projectionData = targetEntryForProjection.smoothedWeekly.map(d => ({
                ...d, ticketsSold: Math.min(cap, Math.round(d.ticketsSold * mod + this._activityDeltaAtWeek(d.weeksOut)))
            }));
            this._hasProjection = true;
            this._projectionData = projectionData;

            g.append('path')
                .datum(projectionData)
                .attr('d', line)
                .attr('fill', 'none')
                .attr('stroke', '#27ae60')
                .attr('stroke-width', 2.5)
                .attr('stroke-dasharray', '8,5')
                .attr('opacity', 0.85);
        }

        // Annotation markers (points and ranges)
        this.activities.forEach(activity => {
            const startWeek = Math.abs(activity.week_number);
            const endWeek = activity.end_week != null ? Math.abs(activity.end_week) : null;
            const color = activity.color || '#95a5a6';
            const isRange = endWeek != null;

            if (isRange) {
                // Range: shaded band + label centered
                const x1 = xScale(startWeek);
                const x2 = xScale(endWeek);
                const left = Math.min(x1, x2);
                const width = Math.abs(x2 - x1);
                const midX = left + width / 2;

                g.append('rect')
                    .attr('x', left)
                    .attr('y', 0)
                    .attr('width', width)
                    .attr('height', innerHeight)
                    .attr('fill', color)
                    .attr('opacity', 0.08);

                // Left and right edge lines
                [x1, x2].forEach(x => {
                    g.append('line')
                        .attr('x1', x).attr('x2', x)
                        .attr('y1', 0).attr('y2', innerHeight)
                        .attr('stroke', color)
                        .attr('stroke-dasharray', '4,3')
                        .attr('stroke-width', 1)
                        .attr('opacity', 0.4);
                });

                // Bar indicator below axis
                g.append('rect')
                    .attr('x', left)
                    .attr('y', innerHeight + 38)
                    .attr('width', width)
                    .attr('height', 14)
                    .attr('rx', 7)
                    .attr('fill', color)
                    .attr('opacity', 0.8);

                g.append('text')
                    .attr('x', midX)
                    .attr('y', innerHeight + 48)
                    .attr('fill', 'white')
                    .attr('font-size', '8px')
                    .attr('font-weight', 'bold')
                    .attr('text-anchor', 'middle')
                    .text(activity.activity_type?.[0] || '?');

                g.append('text')
                    .attr('x', midX)
                    .attr('y', innerHeight + 63)
                    .attr('fill', 'var(--text-secondary)')
                    .attr('font-size', '9px')
                    .attr('text-anchor', 'middle')
                    .text(activity.label);
            } else {
                // Point: vertical dashed line + circle
                const x = xScale(startWeek);

                g.append('line')
                    .attr('x1', x).attr('x2', x)
                    .attr('y1', 0).attr('y2', innerHeight)
                    .attr('stroke', color)
                    .attr('stroke-dasharray', '4,3')
                    .attr('stroke-width', 1)
                    .attr('opacity', 0.6);

                g.append('circle')
                    .attr('cx', x)
                    .attr('cy', innerHeight + 44)
                    .attr('r', 8)
                    .attr('fill', color)
                    .attr('opacity', 0.9);

                g.append('text')
                    .attr('x', x)
                    .attr('y', innerHeight + 48)
                    .attr('fill', 'white')
                    .attr('font-size', '8px')
                    .attr('font-weight', 'bold')
                    .attr('text-anchor', 'middle')
                    .text(activity.activity_type?.[0] || '?');

                g.append('text')
                    .attr('x', x)
                    .attr('y', innerHeight + 63)
                    .attr('fill', 'var(--text-secondary)')
                    .attr('font-size', '9px')
                    .attr('text-anchor', 'middle')
                    .text(activity.label);
            }
        });

        // ── Hover tooltip (vertical crosshair snapping to nearest week) ──
        // Build a lookup from the same smoothed data used for drawing lines
        const weekLookup = new Map();
        sortedEntries.forEach(entry => {
            if (!entry.smoothedWeekly) return;
            const perf = this.performances.find(p => p.performanceCode === entry.code);
            let name = entry.isHistorical ? (entry.comp?.data?.comparison_name || entry.code) : (perf?.title || entry.code);
            for (const d of entry.smoothedWeekly) {
                if (!weekLookup.has(d.weeksOut)) weekLookup.set(d.weeksOut, []);
                weekLookup.get(d.weeksOut).push({ name: entry.isCurrent ? `Current: ${name}` : name, color: entry.color, tickets: d.ticketsSold, isTarget: entry.isTarget });
            }
        });

        // Add projection to tooltip
        if (this._projectionData) {
            for (const d of this._projectionData) {
                if (!weekLookup.has(d.weeksOut)) weekLookup.set(d.weeksOut, []);
                weekLookup.get(d.weeksOut).push({ name: 'Projected', color: '#27ae60', tickets: Math.round(d.ticketsSold), isTarget: false });
            }
        }

        const availableWeeks = [...weekLookup.keys()].sort((a, b) => a - b);

        // Tooltip elements
        const hoverLine = g.append('line')
            .attr('y1', 0).attr('y2', innerHeight)
            .attr('stroke', 'var(--text-muted)')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '3,3')
            .style('opacity', 0)
            .style('pointer-events', 'none');

        const tooltipDots = g.append('g').style('pointer-events', 'none');

        let tooltip = d3.select(container).select('.studio-tooltip');
        if (tooltip.empty()) {
            tooltip = d3.select(container).append('div').attr('class', 'studio-tooltip');
        }
        tooltip.style('opacity', 0);

        // Invisible overlay for mouse tracking
        g.append('rect')
            .attr('width', innerWidth)
            .attr('height', innerHeight)
            .attr('fill', 'transparent')
            .on('mousemove', (event) => {
                const [mx] = d3.pointer(event);
                const hoveredWeek = xScale.invert(mx);

                // Snap to nearest available week
                let nearestWeek = availableWeeks[0] || 0;
                let minDist = Infinity;
                for (const w of availableWeeks) {
                    const dist = Math.abs(w - hoveredWeek);
                    if (dist < minDist) { minDist = dist; nearestWeek = w; }
                }

                const entries = weekLookup.get(nearestWeek);
                if (!entries || entries.length === 0) return;

                const x = xScale(nearestWeek);
                hoverLine.attr('x1', x).attr('x2', x).style('opacity', 1);

                // Draw dots on each line at this week
                tooltipDots.selectAll('*').remove();
                entries.forEach(e => {
                    const y = yScale(Math.min(e.tickets, maxTickets));
                    tooltipDots.append('circle')
                        .attr('cx', x).attr('cy', y)
                        .attr('r', 4)
                        .attr('fill', e.color)
                        .attr('stroke', 'white')
                        .attr('stroke-width', 1.5);
                });

                // Build tooltip HTML
                const lines = entries.map(e => {
                    const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${e.color};margin-right:4px;"></span>`;
                    return `${dot}${this.escapeHtml(e.name)}: <strong>${e.tickets.toLocaleString()}</strong>`;
                });
                const html = `<div style="margin-bottom:4px;font-weight:600;">Week -${nearestWeek}</div>${lines.join('<br>')}`;

                // Position tooltip
                const containerRect = container.getBoundingClientRect();
                let tooltipX = margin.left + x + 12;
                tooltip.html(html).style('opacity', 1);
                const tooltipWidth = tooltip.node().offsetWidth || 160;
                if (tooltipX + tooltipWidth > containerRect.width - 10) {
                    tooltipX = margin.left + x - tooltipWidth - 12;
                }
                tooltip
                    .style('left', tooltipX + 'px')
                    .style('top', (margin.top + yScale(Math.min(entries[0].tickets, maxTickets)) - 10) + 'px');
            })
            .on('mouseleave', () => {
                hoverLine.style('opacity', 0);
                tooltipDots.selectAll('*').remove();
                tooltip.style('opacity', 0);
            });

        // Legend
        this.renderLegend(compEntries);
    }

    renderLegend(entries) {
        const legend = document.getElementById('chart-legend');
        if (!legend) return;

        legend.innerHTML = entries.map(entry => {
            const perf = this.performances.find(p => p.performanceCode === entry.code);
            const name = entry.isHistorical ? (entry.comp?.data?.comparison_name || entry.code) : (perf?.title || entry.code);
            let style, label;
            if (entry.isCurrent) {
                style = `background:${entry.color}; width:24px; height:3px; border-radius:2px;`;
                label = `Current: ${this.escapeHtml(name)}`;
            } else if (entry.isTarget) {
                style = `background:${entry.color}; width:24px; height:3px; border-radius:2px;`;
                label = `Target: ${this.escapeHtml(name)}`;
            } else {
                style = `background: repeating-linear-gradient(to right, ${entry.color} 0, ${entry.color} 6px, transparent 6px, transparent 10px); width:24px; height:2px;`;
                label = this.escapeHtml(name);
            }

            return `
                <div class="legend-item">
                    <span style="${style} display:inline-block;"></span>
                    <span>${label}</span>
                </div>
            `;
        }).join('');

        // Projection legend entry
        if (this._hasProjection) {
            const projStyle = `background: repeating-linear-gradient(to right, #27ae60 0, #27ae60 6px, transparent 6px, transparent 10px); width:24px; height:2px;`;
            legend.innerHTML += `
                <div class="legend-item">
                    <span style="${projStyle} display:inline-block;"></span>
                    <span>Projected</span>
                </div>
            `;
        }

        if (this.activities.length > 0) {
            legend.innerHTML += `
                <div class="legend-item">
                    <span class="legend-dot" style="background:#9b59b6;"></span>
                    <span>Annotation</span>
                </div>
            `;
        }
    }

    // Interpolate target comp value at a given weeksOut
    _interpolateTargetAtWeek(targetData, week) {
        // targetData sorted descending by weeksOut (far out → show)
        if (!targetData || targetData.length === 0) return 0;
        if (week >= targetData[0].weeksOut) return targetData[0].ticketsSold;
        if (week <= targetData[targetData.length - 1].weeksOut) return targetData[targetData.length - 1].ticketsSold;
        // Find surrounding points and interpolate
        for (let i = 0; i < targetData.length - 1; i++) {
            const a = targetData[i], b = targetData[i + 1];
            if (week <= a.weeksOut && week >= b.weeksOut) {
                const t = (a.weeksOut - week) / (a.weeksOut - b.weeksOut);
                return a.ticketsSold + t * (b.ticketsSold - a.ticketsSold);
            }
        }
        return targetData[targetData.length - 1].ticketsSold;
    }

    // ═══════════════════════════════════════════
    // Adjustments (Aspiration Modeling)
    // ═══════════════════════════════════════════

    _activityDeltaAtWeek(weeksOut) {
        let totalAdj = 0;
        for (const activity of this.activities) {
            if (!activity.ticket_delta || activity.ticket_delta === 0) continue;
            const startWeek = Math.abs(activity.week_number);
            const spread = Math.max(1, activity.spread_weeks || 1);
            if (weeksOut <= startWeek) {
                const endWeek = startWeek - spread;
                const weeksElapsed = Math.min(spread, startWeek - Math.max(weeksOut, endWeek));
                totalAdj += (activity.ticket_delta / spread) * weeksElapsed;
            }
        }
        return totalAdj;
    }

    computeAdjustedTarget(targetWeeklyData) {
        const activitiesWithDelta = this.activities.filter(a => a.ticket_delta && a.ticket_delta !== 0);
        if (activitiesWithDelta.length === 0 || !targetWeeklyData || targetWeeklyData.length === 0) {
            return null;
        }

        const cap = (this.currentPlan?.capacity || 0) > 0 ? this.currentPlan.capacity : Infinity;
        return targetWeeklyData.map(d => {
            const delta = this._activityDeltaAtWeek(d.weeksOut);
            return { weeksOut: d.weeksOut, ticketsSold: Math.min(cap, Math.max(0, d.ticketsSold + delta)) };
        });
    }

    // ═══════════════════════════════════════════
    // Annotations
    // ═══════════════════════════════════════════

    showActivityForm(activity = null) {
        this._editingActivityId = activity ? activity.activity_id : null;
        document.getElementById('activity-form').style.display = 'block';
        document.getElementById('btn-add-activity').style.display = 'none';

        const saveBtn = document.getElementById('btn-save-activity');
        saveBtn.textContent = activity ? 'Update' : 'Add';

        if (activity) {
            document.getElementById('activity-week').value = activity.week_number;
            document.getElementById('activity-name').value = activity.label || '';
            document.getElementById('activity-tags').value = activity.activity_type || '';
            document.getElementById('activity-ticket-delta').value = activity.ticket_delta || '';
            document.getElementById('activity-spread-weeks').value = activity.spread_weeks || '1';

            const isRange = activity.end_week != null;
            this.activityStyle = isRange ? 'range' : 'point';
            document.getElementById('style-point').classList.toggle('active', !isRange);
            document.getElementById('style-range').classList.toggle('active', isRange);
            document.getElementById('end-week-row').style.display = isRange ? '' : 'none';
            if (isRange) document.getElementById('activity-end-week').value = activity.end_week;
        }

        document.getElementById('activity-name').focus();
    }

    hideActivityForm() {
        this._editingActivityId = null;
        document.getElementById('activity-form').style.display = 'none';
        document.getElementById('btn-add-activity').style.display = 'block';
        document.getElementById('btn-save-activity').textContent = 'Add';
        document.getElementById('activity-name').value = '';
        document.getElementById('activity-tags').value = '';
        document.getElementById('activity-ticket-delta').value = '';
        document.getElementById('activity-spread-weeks').value = '1';
    }

    async saveActivity() {
        const weekNumber = parseInt(document.getElementById('activity-week').value);
        const label = document.getElementById('activity-name').value.trim();
        const activityType = document.getElementById('activity-tags').value.split(',').map(t => t.trim()).filter(t => t).join(', ') || 'Other';
        const endWeek = this.activityStyle === 'range'
            ? parseInt(document.getElementById('activity-end-week').value)
            : null;
        const ticketDeltaVal = document.getElementById('activity-ticket-delta').value;
        const ticketDelta = ticketDeltaVal ? parseInt(ticketDeltaVal) : null;
        const spreadWeeksVal = document.getElementById('activity-spread-weeks').value;
        const spreadWeeks = ticketDelta ? (parseInt(spreadWeeksVal) || 1) : null;

        if (!label) return;

        const defaultColors = { email: '#3498db', social: '#e74c3c', groups: '#f39c12', radio: '#9b59b6', pr: '#1abc9c', event: '#e84393', sale: '#00b894', note: '#636e72', other: '#95a5a6' };
        const firstTag = activityType.split(',')[0].trim().toLowerCase();

        try {
            if (this._editingActivityId) {
                // Update existing activity
                const existing = this.activities.find(a => a.activity_id === this._editingActivityId);
                await this.api('update-activity', { activityId: this._editingActivityId }, {
                    weekNumber,
                    endWeek,
                    label,
                    activityType,
                    ticketDelta,
                    spreadWeeks
                });
                if (existing) {
                    existing.week_number = weekNumber;
                    existing.end_week = endWeek;
                    existing.label = label;
                    existing.activity_type = activityType;
                    existing.ticket_delta = ticketDelta;
                    existing.spread_weeks = spreadWeeks;
                }
            } else {
                // Create new activity
                const result = await this.api('add-activity', {}, {
                    planId: this.currentPlan.plan_id,
                    weekNumber,
                    endWeek,
                    label,
                    activityType,
                    color: defaultColors[firstTag] || '#95a5a6',
                    ticketDelta,
                    spreadWeeks
                });

                this.activities.push({
                    activity_id: result.activityId,
                    plan_id: this.currentPlan.plan_id,
                    week_number: weekNumber,
                    end_week: endWeek,
                    label,
                    activity_type: activityType,
                    color: defaultColors[firstTag] || '#95a5a6',
                    ticket_delta: ticketDelta,
                    spread_weeks: spreadWeeks
                });
            }

            this.hideActivityForm();
            this.renderActivities();
            this.renderCurrentPerfPanel();
            this.renderChart();
            this.updateFooterStats();
        } catch (err) {
            console.error('Failed to add activity:', err);
        }
    }

    renderActivities() {
        const list = document.getElementById('activity-list');
        if (!list) return;

        const sorted = [...this.activities].sort((a, b) => b.week_number - a.week_number);

        list.innerHTML = sorted.map(a => {
            const isRange = a.end_week != null;
            const weekLabel = isRange ? `Wk ${a.week_number} → ${a.end_week}` : `Wk ${a.week_number}`;
            const color = a.color || '#95a5a6';
            return `
                <div class="activity-item" data-id="${a.activity_id}">
                    <label class="activity-color-picker" title="Change color">
                        <input type="color" class="color-input" data-id="${a.activity_id}" value="${color}">
                        <span class="activity-dot${isRange ? ' activity-bar' : ''}" style="background:${color}"></span>
                    </label>
                    <div class="activity-content">
                        <div class="activity-row-top">
                            <span class="activity-week">${weekLabel}</span>
                            <span class="activity-label">${this.escapeHtml(a.label)}</span>
                            ${a.ticket_delta ? `<span class="activity-delta">${a.ticket_delta > 0 ? '+' : ''}${a.ticket_delta} / ${a.spread_weeks || 1}wk</span>` : ''}
                            <button class="activity-delete" title="Remove">&times;</button>
                        </div>
                        <div class="activity-row-tags">${(a.activity_type || '').split(',').map(t => t.trim()).filter(t => t).map(t => `<span class="activity-tag-pill">${this.escapeHtml(t)}</span>`).join('')}</div>
                    </div>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.activity-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = btn.closest('.activity-item');
                this.deleteActivity(item.dataset.id);
            });
        });

        list.querySelectorAll('.color-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const id = input.dataset.id;
                const newColor = e.target.value;
                const activity = this.activities.find(a => a.activity_id === id);
                if (activity) {
                    activity.color = newColor;
                    // Update the dot preview immediately
                    const dot = input.parentElement.querySelector('.activity-dot');
                    if (dot) dot.style.background = newColor;
                    this.renderChart();
                }
            });
            // Persist on close
            input.addEventListener('change', (e) => {
                const id = input.dataset.id;
                this.api('update-activity', { activityId: id }, { color: e.target.value }).catch(() => {});
            });
        });

        // Click-to-edit
        list.querySelectorAll('.activity-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.activity-delete') || e.target.closest('.activity-color-picker')) return;
                const activity = this.activities.find(a => a.activity_id === item.dataset.id);
                if (activity) this.showActivityForm(activity);
            });
        });
    }

    deleteActivity(activityId) {
        // Update UI immediately, delete from BigQuery in background
        this.activities = this.activities.filter(a => a.activity_id !== activityId);
        this.renderActivities();
        this.renderCurrentPerfPanel();
        this.renderChart();
        this.updateFooterStats();
        this.api('delete-activity', { activityId }).catch(err => {
            console.error('Failed to delete activity:', err);
        });
    }

    // ═══════════════════════════════════════════
    // Plan CRUD
    // ═══════════════════════════════════════════

    async showNewPlanModal() {
        document.getElementById('new-plan-modal').style.display = 'flex';

        if (this.performances.length === 0) await this.loadCompLibrary();

        const today = new Date().toISOString().split('T')[0];
        const perfSelect = document.getElementById('new-plan-perf-code');
        const compSelect = document.getElementById('new-plan-target-comp');
        const compSearch = document.getElementById('new-plan-comp-search');
        const seriesSelect = document.getElementById('new-plan-series');

        // All performances are valid comps
        this._modalPastPerfs = [...this.performances]
            .sort((a, b) => (b.performanceDate || '').localeCompare(a.performanceDate || ''));

        // Fetch historical comps from comparisons table
        if (!this._modalHistoricalComps) {
            try {
                const res = await fetch('/.netlify/functions/performance-comparisons?all=true');
                this._modalHistoricalComps = await res.json();
            } catch (err) {
                this._modalHistoricalComps = [];
            }
        }

        // Populate target performance dropdown (upcoming performances only)
        if (perfSelect && perfSelect.options.length <= 1) {
            const upcoming = [...this.performances]
                .filter(p => p.performanceDate && p.performanceDate >= today)
                .sort((a, b) => (a.performanceDate || '').localeCompare(b.performanceDate || ''));
            for (const p of upcoming) {
                const opt = document.createElement('option');
                opt.value = p.performanceCode;
                opt.textContent = `${p.title}${p.season ? ` '${p.season}` : ''}${p.nightCount > 1 ? ` (${p.nightCount} nights)` : ''}`;
                perfSelect.appendChild(opt);
            }
        }

        // Initial comp list populate
        this._populateCompDropdown();

        // Series filter updates the comp dropdown
        seriesSelect.onchange = () => {
            this._populateCompDropdown();
        };

        // Search input filters the comp dropdown
        compSearch.oninput = () => {
            this._populateCompDropdown();
        };

        // Auto-fill fields when target comp is selected
        compSelect.onchange = () => {
            const val = compSelect.value;
            if (val.startsWith('hist:')) {
                const compId = val.slice(5);
                const hc = (this._modalHistoricalComps || []).find(c => c.comparison_id === compId);
                if (hc?.capacity) document.getElementById('new-plan-capacity').value = hc.capacity;
            } else {
                const comp = this.performances.find(p => p.performanceCode === val);
                if (comp) {
                    if (!seriesSelect.value) seriesSelect.value = comp.series || '';
                    document.getElementById('new-plan-venue').value = comp.venue || 'Helzberg Hall';
                    document.getElementById('new-plan-capacity').value = comp.capacity || 1607;
                }
            }
            this._updatePlanName();
        };

        // Update name when performance is selected too
        perfSelect.onchange = () => this._updatePlanName();
    }

    _populateCompDropdown() {
        const compSelect = document.getElementById('new-plan-target-comp');
        const seriesFilter = document.getElementById('new-plan-series').value;
        const searchText = (document.getElementById('new-plan-comp-search').value || '').toLowerCase();
        const currentVal = compSelect.value;

        // Clear and rebuild
        compSelect.innerHTML = '<option value="">Select a comp...</option>';

        // Current season performances grouped by season
        let filtered = this._modalPastPerfs || [];
        if (seriesFilter) filtered = filtered.filter(p => p.series === seriesFilter);
        if (searchText) filtered = filtered.filter(p => (p.title || '').toLowerCase().includes(searchText));

        // Group by season
        const seasonGroups = new Map();
        for (const p of filtered) {
            const season = p.season || 'Unknown';
            if (!seasonGroups.has(season)) seasonGroups.set(season, []);
            seasonGroups.get(season).push(p);
        }

        // Render each season as an optgroup (newest first)
        const sortedSeasons = [...seasonGroups.keys()].sort().reverse();
        for (const season of sortedSeasons) {
            const group = document.createElement('optgroup');
            group.label = `Season ${season}`;
            for (const p of seasonGroups.get(season)) {
                const opt = document.createElement('option');
                opt.value = p.performanceCode;
                opt.textContent = `${p.title} — ${p.totalTicketsSold.toLocaleString()} sold (${p.occupancyPercent}%)`;
                group.appendChild(opt);
            }
            compSelect.appendChild(group);
        }

        // Historical comps from comparisons table
        let historicals = this._modalHistoricalComps || [];
        if (searchText) historicals = historicals.filter(c => (c.comparison_name || '').toLowerCase().includes(searchText));
        if (historicals.length > 0) {
            const group = document.createElement('optgroup');
            group.label = 'Historical Comps';
            for (const c of historicals) {
                const opt = document.createElement('option');
                opt.value = `hist:${c.comparison_id}`;
                const meta = [
                    c.capacity ? `Cap: ${c.capacity.toLocaleString()}` : '',
                    c.occupancy_percent ? `${Math.round(c.occupancy_percent)}%` : '',
                    c.atp ? `ATP: $${c.atp.toFixed(0)}` : ''
                ].filter(Boolean).join(', ');
                opt.textContent = `${c.comparison_name}${meta ? ` — ${meta}` : ''}`;
                group.appendChild(opt);
            }
            compSelect.appendChild(group);
        }

        // Restore selection if still in list
        if (currentVal) compSelect.value = currentVal;
    }

    _getSelectedCompName() {
        const val = document.getElementById('new-plan-target-comp').value;
        if (!val) return null;
        if (val.startsWith('hist:')) {
            const compId = val.slice(5);
            const hc = (this._modalHistoricalComps || []).find(c => c.comparison_id === compId);
            return hc?.comparison_name || 'Historical Comp';
        }
        const p = this.performances.find(p => p.performanceCode === val);
        return p?.title || null;
    }

    _updatePlanName() {
        const perfSelect = document.getElementById('new-plan-perf-code');
        const nameInput = document.getElementById('new-plan-name');

        const perf = this.performances.find(p => p.performanceCode === perfSelect.value);
        const compName = this._getSelectedCompName();

        if (perf && compName) {
            nameInput.value = `${perf.title} (vs ${compName})`;
        } else if (perf) {
            nameInput.value = perf.title;
        } else if (compName) {
            nameInput.value = `Plan based on ${compName}`;
        }
    }

    hideNewPlanModal() {
        document.getElementById('new-plan-modal').style.display = 'none';
        // Reset form
        document.getElementById('new-plan-name').value = '';
        document.getElementById('new-plan-series').value = '';
        document.getElementById('new-plan-comp-search').value = '';
        document.getElementById('new-plan-venue').value = 'Helzberg Hall';
        document.getElementById('new-plan-capacity').value = '1607';
        document.getElementById('new-plan-budget').value = '';
        document.getElementById('new-plan-perf-code').value = '';
        document.getElementById('new-plan-target-comp').value = '';
    }

    async createPlan() {
        const targetCompVal = document.getElementById('new-plan-target-comp').value;
        const targetPerfCode = document.getElementById('new-plan-perf-code').value || null;

        if (!targetCompVal) {
            alert('Please select a target comp.');
            return;
        }

        const planName = document.getElementById('new-plan-name').value.trim() || 'Untitled Plan';
        const series = document.getElementById('new-plan-series').value || null;
        const venue = document.getElementById('new-plan-venue').value.trim();
        const capacity = parseInt(document.getElementById('new-plan-capacity').value) || null;
        const budgetGoal = parseFloat(document.getElementById('new-plan-budget').value) || null;
        const isHistorical = targetCompVal.startsWith('hist:');

        try {
            // Create plan via API — we'll build state client-side to avoid BigQuery read latency
            const result = await this.api('create-plan', {}, { planName, series, venue, capacity, budgetGoal, targetPerfCode });
            const planId = result.planId;
            if (!planId) {
                alert('Failed to create plan. Please try again.');
                return;
            }

            // Also save the comp (fire-and-forget)
            if (!isHistorical) {
                this.api('add-plan-comp', {}, {
                    planId,
                    performanceCode: targetCompVal,
                    isTarget: true
                }).catch(() => {});
            }

            this.hideNewPlanModal();

            // Build plan state client-side instead of re-fetching from BigQuery
            this.currentPlan = {
                plan_id: planId,
                plan_name: planName,
                series,
                venue,
                capacity,
                budget_goal: budgetGoal,
                target_perf_code: targetPerfCode,
                comps: [],
                activities: []
            };
            this.activities = [];
            this.selectedComps.clear();
            this.selectedHistoricalComps.clear();
            this.compColorIndex = 0;

            // Load comp library if needed
            await this.loadCompLibrary();

            // Switch to workspace view
            document.getElementById('plans-view').style.display = 'none';
            document.getElementById('studio-workspace').style.display = 'flex';
            document.getElementById('plan-bar').style.display = 'flex';
            document.getElementById('btn-delete-plan').style.display = 'inline-block';
            document.getElementById('btn-save-plan').style.display = 'inline-block';
            document.getElementById('btn-export-pdf').style.display = 'inline-block';

            // Populate header
            document.getElementById('plan-title').textContent = planName;
            document.getElementById('plan-series').textContent = series || '';
            document.getElementById('plan-venue').textContent = venue || '';
            document.getElementById('plan-capacity').textContent = capacity ? capacity.toLocaleString() : '—';
            document.getElementById('plan-budget').textContent = budgetGoal ? `$${budgetGoal.toLocaleString()}` : '—';

            history.replaceState(null, '', `/studio?plan=${planId}`);

            // Add target comp directly
            if (isHistorical) {
                const compId = targetCompVal.slice(5);
                const hc = (this._modalHistoricalComps || []).find(c => c.comparison_id === compId);
                if (hc) {
                    this.selectedHistoricalComps.set(hc.comparison_id, {
                        data: hc,
                        color: this.assignCompColor(true)
                    });
                }
            } else {
                const resolvedCode = this.resolveToGroup(targetCompVal);
                const perf = this.performances.find(p => p.performanceCode === resolvedCode);
                this.selectedComps.set(resolvedCode, {
                    data: { ...perf, id: null },
                    isTarget: true,
                    progression: null,
                    loading: true,
                    color: this.assignCompColor(true)
                });
            }

            // Render sidebar
            this.renderCompList();
            this.renderHistoricalCompList();
            this.renderActivities();
            this.renderCurrentPerfPanel();
            this.updateFooterStats();

            // Show loading in chart
            const chartEl = document.getElementById('studio-chart');
            if (chartEl) chartEl.innerHTML = '<div class="studio-chart-loading">Loading sales curves...</div>';

            // Fetch all data in parallel
            const fetches = [this.loadCurrentPerfProgression(), this.loadHistoricalComps()];

            // Fetch target comp progression
            if (!isHistorical) {
                const resolvedCode = this.resolveToGroup(targetCompVal);
                fetches.push(
                    fetch(`${this.SNAPSHOTS_API}?action=get-sales-progression&performanceCode=${resolvedCode}`)
                        .then(r => r.json())
                        .then(data => {
                            const comp = this.selectedComps.get(resolvedCode);
                            if (comp) { comp.progression = data.progression || []; comp.loading = false; }
                        })
                        .catch(() => {
                            const comp = this.selectedComps.get(resolvedCode);
                            if (comp) { comp.progression = []; comp.loading = false; }
                        })
                );
            }

            await Promise.all(fetches);

            // Final render
            this.renderCompList();
            this.renderHistoricalCompList();
            this.renderCurrentPerfPanel();
            this.renderChart();
            this.updateFooterStats();
        } catch (err) {
            console.error('Failed to create plan:', err);
        }
    }

    async savePlan() {
        if (!this.currentPlan) return;

        try {
            await this.api('update-plan', { planId: this.currentPlan.plan_id }, {
                planName: this.currentPlan.plan_name,
                series: this.currentPlan.series,
                venue: this.currentPlan.venue,
                capacity: this.currentPlan.capacity,
                budgetGoal: this.currentPlan.budget_goal
            });

            const btn = document.getElementById('btn-save-plan');
            const original = btn.textContent;
            btn.textContent = 'Saved!';
            setTimeout(() => { btn.textContent = original; }, 1500);
        } catch (err) {
            console.error('Failed to save plan:', err);
        }
    }

    async deletePlan() {
        if (!this.currentPlan) return;
        if (!confirm(`Delete "${this.currentPlan.plan_name}"? This cannot be undone.`)) return;

        try {
            await this.api('delete-plan', { planId: this.currentPlan.plan_id });
            this.showPlansView();
        } catch (err) {
            console.error('Failed to delete plan:', err);
        }
    }

    // ═══════════════════════════════════════════
    // Templates
    // ═══════════════════════════════════════════

    async showTemplates() {
        const modal = document.getElementById('template-modal');
        const list = document.getElementById('template-list');
        const empty = document.getElementById('template-empty');
        const warning = document.getElementById('template-warning');
        const applyBtn = document.getElementById('template-modal-apply');

        this._selectedTemplateId = null;
        applyBtn.disabled = true;
        modal.style.display = 'flex';

        if (warning) {
            warning.style.display = this.activities.length > 0 ? 'block' : 'none';
        }

        list.innerHTML = '<div class="template-empty">Loading...</div>';
        try {
            const templates = await this.api('get-templates');
            if (templates.length === 0) {
                list.style.display = 'none';
                empty.style.display = 'block';
                return;
            }
            list.style.display = 'flex';
            empty.style.display = 'none';

            list.innerHTML = templates.map(t => `
                <div class="template-item" data-template-id="${t.plan_id}">
                    <div class="template-item-icon">&#9776;</div>
                    <div class="template-item-info">
                        <div class="template-item-name">${this.escapeHtml(t.plan_name)}</div>
                        <div class="template-item-meta">
                            ${t.activity_count || 0} annotations${t.series ? ' &middot; ' + this.escapeHtml(t.series) : ''}
                        </div>
                    </div>
                </div>
            `).join('');

            list.querySelectorAll('.template-item').forEach(item => {
                item.addEventListener('click', () => {
                    list.querySelectorAll('.template-item').forEach(i => i.classList.remove('selected'));
                    item.classList.add('selected');
                    this._selectedTemplateId = item.dataset.templateId;
                    applyBtn.disabled = false;
                });
            });
        } catch (err) {
            console.error('Failed to load templates:', err);
            list.innerHTML = '<div class="template-empty">Failed to load templates.</div>';
        }
    }

    hideTemplateModal() {
        document.getElementById('template-modal').style.display = 'none';
        this._selectedTemplateId = null;
    }

    async applySelectedTemplate() {
        if (!this._selectedTemplateId || !this.currentPlan) return;

        const applyBtn = document.getElementById('template-modal-apply');
        applyBtn.disabled = true;
        applyBtn.textContent = 'Applying...';

        try {
            await this.api('apply-template', {
                planId: this.currentPlan.plan_id,
                templateId: this._selectedTemplateId
            });

            const activities = await this.api('get-plan-activities', { planId: this.currentPlan.plan_id });
            this.activities = activities;
            this.hideTemplateModal();
            this.renderActivities();
            this.renderChart();
            this.updateFooterStats();
        } catch (err) {
            console.error('Failed to apply template:', err);
            alert('Failed to apply template. Please try again.');
        } finally {
            applyBtn.textContent = 'Apply Template';
            applyBtn.disabled = false;
        }
    }

    showSaveTemplateModal() {
        if (!this.currentPlan) return;
        if (this.activities.length === 0) {
            alert('Add annotations to your plan before saving as a template.');
            return;
        }

        const nameInput = document.getElementById('save-template-name');
        nameInput.value = `Template: ${this.currentPlan.plan_name}`;
        document.getElementById('save-template-modal').style.display = 'flex';
        nameInput.focus();
        nameInput.select();
    }

    hideSaveTemplateModal() {
        document.getElementById('save-template-modal').style.display = 'none';
    }

    async saveAsTemplate() {
        const nameInput = document.getElementById('save-template-name');
        const templateName = nameInput.value.trim();
        if (!templateName) return;

        const confirmBtn = document.getElementById('save-template-confirm');
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Saving...';

        try {
            await this.api('save-as-template', {}, {
                sourcePlanId: this.currentPlan.plan_id,
                templateName
            });

            this.hideSaveTemplateModal();

            const btn = document.getElementById('btn-save-as-template');
            const original = btn.textContent;
            btn.textContent = 'Template Saved!';
            setTimeout(() => { btn.textContent = original; }, 2000);
        } catch (err) {
            console.error('Failed to save as template:', err);
            alert('Failed to save template. Please try again.');
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Save Template';
        }
    }

    // ═══════════════════════════════════════════
    // Footer Stats
    // ═══════════════════════════════════════════

    updateFooterStats() {
        const comps = [...this.selectedComps.values()];
        const avgTickets = comps.length > 0
            ? Math.round(comps.reduce((s, c) => s + (c.data?.totalTicketsSold || 0), 0) / comps.length)
            : 0;
        const avgOccupancy = comps.length > 0
            ? Math.round(comps.reduce((s, c) => s + (c.data?.occupancyPercent || 0), 0) / comps.length)
            : 0;

        const totalComps = comps.length + this.selectedHistoricalComps.size;
        document.getElementById('stat-comps').innerHTML = `<strong>${totalComps}</strong> comps selected`;
        document.getElementById('stat-avg-tickets').innerHTML = `<strong>${avgTickets.toLocaleString()}</strong> avg final tickets`;
        document.getElementById('stat-avg-occupancy').innerHTML = `<strong>${avgOccupancy}%</strong> avg occupancy`;
        document.getElementById('stat-activities').innerHTML = `<strong>${this.activities.length}</strong> annotations`;
    }

    // ═══════════════════════════════════════════
    // Utilities
    // ═══════════════════════════════════════════

    showLoading(show) {
        const el = document.getElementById('loading-indicator');
        if (el) el.style.display = show ? 'flex' : 'none';
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    window.studioApp = new StudioApp();
});
