class AnnotationsManager {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = null;
        this.annotations = [];
        this.allTags = [];
        this.groupTitles = []; // production names for auto-tagging
        this.activeTagFilters = [];
        this.activeGroupFilter = '';
        this.activeScopeFilter = ''; // '', 'production', or 'global'
        this.editingId = null;
    }

    async init() {
        this.container = document.getElementById(this.containerId);
        if (!this.container) return;

        // Inject styles early so loading state is styled
        this.injectStyles();

        // Show loading state
        this.renderLoading();

        // Collect group titles from performances data
        await this.loadGroupTitles();

        await this.loadData();
        this.render();
    }

    renderLoading() {
        this.container.innerHTML = `
            <div class="anno-loading">
                <div class="anno-loading-icon">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                        <circle cx="24" cy="24" r="20" stroke="#e9ecef" stroke-width="3"/>
                        <path d="M24 4a20 20 0 0 1 20 20" stroke="#667eea" stroke-width="3" stroke-linecap="round" class="anno-loading-arc"/>
                        <g class="anno-loading-pencil">
                            <path d="M24 14v8" stroke="#667eea" stroke-width="2" stroke-linecap="round"/>
                            <path d="M24 14l-2 3h4l-2-3z" fill="#667eea"/>
                        </g>
                    </svg>
                </div>
                <p class="anno-loading-text">Loading annotations<span class="anno-loading-dots"></span></p>
            </div>
        `;
    }

    async loadGroupTitles() {
        const titles = new Set();
        // Try data table first (if already loaded)
        if (window.dataTable && window.dataTable.data && window.dataTable.data.length > 0) {
            window.dataTable.data.forEach(p => {
                if (p.title) titles.add(p.title);
            });
        } else {
            // Fetch directly from data service
            try {
                const result = await window.dataService.getPerformances();
                if (result && result.performances) {
                    result.performances.forEach(p => {
                        if (p.title) titles.add(p.title);
                    });
                }
            } catch (e) {
                console.warn('Could not fetch performances for group titles:', e.message);
            }
        }
        this.groupTitles = Array.from(titles).sort();
    }

    async loadData() {
        try {
            // Fetch production annotations and global annotations in parallel
            const [groupResults, globalAnnotations] = await Promise.all([
                Promise.allSettled(
                    this.groupTitles.map(title =>
                        window.dataService.getGroupAnnotations(title)
                    )
                ),
                window.dataService.getGlobalAnnotations()
            ]);

            const allAnnotations = [];
            groupResults.forEach((result, i) => {
                if (result.status === 'fulfilled' && Array.isArray(result.value)) {
                    allAnnotations.push(...result.value);
                } else {
                    console.warn(`Failed to fetch annotations for "${this.groupTitles[i]}":`, result.reason?.message);
                }
            });

            // Add global annotations (avoid duplicates by annotation_id)
            const existingIds = new Set(allAnnotations.map(a => a.annotation_id));
            globalAnnotations.forEach(ann => {
                if (!existingIds.has(ann.annotation_id)) {
                    allAnnotations.push(ann);
                }
            });

            this.annotations = allAnnotations;
            this.allTags = await window.dataService.getAllAnnotationTags();
        } catch (e) {
            console.warn('Error loading annotations:', e.message);
        }
    }

    render() {
        if (!this.container) return;
        this.container.innerHTML = '';

        const wrapper = document.createElement('div');
        wrapper.className = 'annotations-mgr';
        wrapper.innerHTML = `
            <div class="annotations-mgr-header">
                <h2>Annotations Manager</h2>
                <button class="anno-mgr-add-btn">+ New Annotation</button>
            </div>
            <div class="annotations-mgr-filters"></div>
            <div class="annotations-mgr-form-area"></div>
            <div class="annotations-mgr-table-wrap">
                <table class="annotations-mgr-table">
                    <thead>
                        <tr>
                            <th>Production</th>
                            <th>Type</th>
                            <th>Position</th>
                            <th>Label</th>
                            <th>Description</th>
                            <th>Tags</th>
                            <th>Color</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
        `;
        this.container.appendChild(wrapper);

        // Add button handler
        wrapper.querySelector('.anno-mgr-add-btn').addEventListener('click', () => {
            this.editingId = null;
            this.renderForm();
        });

        this.renderFilters();
        this.renderTableRows();
        this.injectStyles();
    }

    renderFilters() {
        const filtersEl = this.container.querySelector('.annotations-mgr-filters');
        if (!filtersEl) return;
        filtersEl.innerHTML = '';

        // Scope filter pills
        const scopeBar = document.createElement('div');
        scopeBar.className = 'anno-mgr-scope-bar';

        ['', 'production', 'global'].forEach(scopeVal => {
            const label = scopeVal === '' ? 'All' : scopeVal === 'production' ? 'Production' : 'Global';
            const pill = document.createElement('span');
            pill.className = `anno-mgr-scope-pill ${this.activeScopeFilter === scopeVal ? 'active' : ''}`;
            pill.textContent = label;
            pill.addEventListener('click', () => {
                this.activeScopeFilter = scopeVal;
                this.renderFilters();
                this.renderTableRows();
            });
            scopeBar.appendChild(pill);
        });
        filtersEl.appendChild(scopeBar);

        // Group filter dropdown
        const groupSelect = document.createElement('select');
        groupSelect.className = 'anno-mgr-group-filter';
        groupSelect.innerHTML = `<option value="">All Productions</option>`;
        this.groupTitles.forEach(t => {
            groupSelect.innerHTML += `<option value="${t}" ${this.activeGroupFilter === t ? 'selected' : ''}>${t}</option>`;
        });
        groupSelect.addEventListener('change', () => {
            this.activeGroupFilter = groupSelect.value;
            this.renderTableRows();
        });
        filtersEl.appendChild(groupSelect);

        // Tag filter pills
        const tagBar = document.createElement('div');
        tagBar.className = 'anno-mgr-tag-bar';

        if (this.allTags.length > 0) {
            const allPill = document.createElement('span');
            allPill.className = `anno-mgr-tag-pill ${this.activeTagFilters.length === 0 ? 'active' : ''}`;
            allPill.textContent = 'All';
            allPill.addEventListener('click', () => {
                this.activeTagFilters = [];
                this.renderFilters();
                this.renderTableRows();
            });
            tagBar.appendChild(allPill);

            this.allTags.forEach(tag => {
                const pill = document.createElement('span');
                const isActive = this.activeTagFilters.includes(tag);
                pill.className = `anno-mgr-tag-pill ${isActive ? 'active' : ''}`;
                if (this.groupTitles.includes(tag)) {
                    pill.classList.add('production-tag');
                }
                pill.textContent = tag;
                pill.addEventListener('click', () => {
                    if (isActive) {
                        this.activeTagFilters = this.activeTagFilters.filter(t => t !== tag);
                    } else {
                        this.activeTagFilters.push(tag);
                    }
                    this.renderFilters();
                    this.renderTableRows();
                });
                tagBar.appendChild(pill);
            });
        }

        filtersEl.appendChild(tagBar);
    }

    getFilteredAnnotations() {
        let filtered = this.annotations;

        if (this.activeScopeFilter) {
            filtered = filtered.filter(a => {
                const annScope = a.scope || 'production';
                return annScope === this.activeScopeFilter;
            });
        }

        if (this.activeGroupFilter) {
            filtered = filtered.filter(a => a.group_title === this.activeGroupFilter);
        }

        if (this.activeTagFilters.length > 0) {
            filtered = filtered.filter(a => {
                const tags = Array.isArray(a.tags) ? a.tags : [];
                return tags.some(t => this.activeTagFilters.includes(t));
            });
        }

        return filtered;
    }

    renderTableRows() {
        const tbody = this.container.querySelector('.annotations-mgr-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        const filtered = this.getFilteredAnnotations();

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#999;padding:20px;">No annotations found. Click "+ New Annotation" to create one.</td></tr>`;
            return;
        }

        filtered.forEach(ann => {
            const tr = document.createElement('tr');
            const tags = Array.isArray(ann.tags) ? ann.tags : [];
            const isGlobal = ann.scope === 'global';

            let position;
            if (isGlobal && ann.annotation_date) {
                position = ann.annotation_type === 'interval' && ann.annotation_end_date
                    ? `${ann.annotation_date} - ${ann.annotation_end_date}`
                    : ann.annotation_date;
            } else {
                position = ann.annotation_type === 'point'
                    ? `Week ${ann.week_number}`
                    : `Weeks ${ann.start_week}-${ann.end_week}`;
            }

            const groupDisplay = isGlobal
                ? '<span class="anno-scope-badge anno-scope-global">Global</span>'
                : this.escapeHtml(ann.group_title || '');

            const tagPills = tags.map(t => {
                const isProd = this.groupTitles.includes(t);
                return `<span class="tag-pill ${isProd ? 'production-tag' : ''}">${this.escapeHtml(t)}</span>`;
            }).join(' ');

            tr.innerHTML = `
                <td class="anno-cell-group">${groupDisplay}</td>
                <td><span class="anno-type-badge anno-type-${ann.annotation_type}">${ann.annotation_type}</span></td>
                <td>${position}</td>
                <td class="anno-cell-label">${this.escapeHtml(ann.label)}</td>
                <td class="anno-cell-desc">${this.escapeHtml(ann.description || '')}</td>
                <td class="anno-cell-tags">${tagPills}</td>
                <td><span class="anno-color-dot" style="background:${ann.color || '#e74c3c'}"></span></td>
                <td class="anno-cell-actions">
                    <button class="anno-edit-btn" data-id="${ann.annotation_id}">Edit</button>
                    <button class="anno-del-btn" data-id="${ann.annotation_id}">Del</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Wire up action buttons
        tbody.querySelectorAll('.anno-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const ann = this.annotations.find(a => a.annotation_id === btn.dataset.id);
                if (ann) {
                    this.editingId = ann.annotation_id;
                    this.renderForm(ann);
                }
            });
        });

        tbody.querySelectorAll('.anno-del-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Delete this annotation?')) return;
                try {
                    await window.dataService.deleteAnnotation(btn.dataset.id);
                    this.annotations = this.annotations.filter(a => a.annotation_id !== btn.dataset.id);
                    this.allTags = await window.dataService.getAllAnnotationTags();
                    this.renderFilters();
                    this.renderTableRows();
                } catch (e) {
                    alert('Error: ' + e.message);
                }
            });
        });
    }

    renderForm(existing = null) {
        const formArea = this.container.querySelector('.annotations-mgr-form-area');
        if (!formArea) return;
        formArea.innerHTML = '';

        const isEdit = !!existing;
        const form = document.createElement('div');
        form.className = 'anno-mgr-form';

        const currentType = existing ? existing.annotation_type : 'point';
        const currentScope = existing ? (existing.scope || 'production') : 'production';
        const isGlobal = currentScope === 'global';
        const existingTags = existing && Array.isArray(existing.tags) ? existing.tags : [];

        // Format date values for input fields
        const fmtDate = (val) => {
            if (!val) return '';
            // Handle BigQuery date objects or strings
            if (typeof val === 'object' && val.value) return val.value;
            return String(val).split('T')[0];
        };

        form.innerHTML = `
            <h3>${isEdit ? 'Edit' : 'New'} Annotation</h3>
            <div class="anno-form-grid">
                <div class="anno-form-field">
                    <label>Scope</label>
                    <div class="anno-form-radios">
                        <label><input type="radio" name="anno-mgr-scope" value="production" ${!isGlobal ? 'checked' : ''}> Production</label>
                        <label><input type="radio" name="anno-mgr-scope" value="global" ${isGlobal ? 'checked' : ''}> Global</label>
                    </div>
                </div>
                <div class="anno-form-field anno-production-group-field" style="display:${isGlobal ? 'none' : 'block'}">
                    <label>Production</label>
                    <select class="anno-form-group">
                        <option value="">Select production...</option>
                        ${this.groupTitles.map(t => `<option value="${this.escapeHtml(t)}" ${existing && existing.group_title === t ? 'selected' : ''}>${this.escapeHtml(t)}</option>`).join('')}
                    </select>
                </div>
                <div class="anno-form-field anno-global-group-field" style="display:${isGlobal ? 'block' : 'none'}">
                    <label>Production (optional)</label>
                    <select class="anno-form-group-optional">
                        <option value="">All productions</option>
                        ${this.groupTitles.map(t => `<option value="${this.escapeHtml(t)}" ${existing && existing.group_title === t ? 'selected' : ''}>${this.escapeHtml(t)}</option>`).join('')}
                    </select>
                </div>
                <div class="anno-form-field">
                    <label>Type</label>
                    <div class="anno-form-radios">
                        <label><input type="radio" name="anno-mgr-type" value="point" ${currentType === 'point' ? 'checked' : ''}> Point</label>
                        <label><input type="radio" name="anno-mgr-type" value="interval" ${currentType === 'interval' ? 'checked' : ''}> Interval</label>
                    </div>
                </div>
                <div class="anno-form-field anno-point-fields anno-week-input" style="display:${currentType === 'point' && !isGlobal ? 'block' : 'none'}">
                    <label>Week</label>
                    <input type="number" step="0.5" min="0" class="anno-form-week" value="${existing ? (existing.week_number || '') : ''}">
                </div>
                <div class="anno-form-field anno-interval-fields anno-week-input" style="display:${currentType === 'interval' && !isGlobal ? 'flex' : 'none'};gap:8px;">
                    <div><label>Start Week</label><input type="number" step="0.5" min="0" class="anno-form-start" value="${existing ? (existing.start_week || '') : ''}"></div>
                    <div><label>End Week</label><input type="number" step="0.5" min="0" class="anno-form-end" value="${existing ? (existing.end_week || '') : ''}"></div>
                </div>
                <div class="anno-form-field anno-date-point-field anno-date-input" style="display:${currentType === 'point' && isGlobal ? 'block' : 'none'}">
                    <label>Date</label>
                    <input type="date" class="anno-form-date" value="${fmtDate(existing ? existing.annotation_date : '')}">
                </div>
                <div class="anno-form-field anno-date-interval-field anno-date-input" style="display:${currentType === 'interval' && isGlobal ? 'flex' : 'none'};gap:8px;">
                    <div><label>Start Date</label><input type="date" class="anno-form-date-start" value="${fmtDate(existing ? existing.annotation_date : '')}"></div>
                    <div><label>End Date</label><input type="date" class="anno-form-date-end" value="${fmtDate(existing ? existing.annotation_end_date : '')}"></div>
                </div>
                <div class="anno-form-field">
                    <label>Label</label>
                    <input type="text" class="anno-form-label" placeholder="e.g. Email campaign" value="${existing ? this.escapeHtml(existing.label || '') : ''}">
                </div>
                <div class="anno-form-field">
                    <label>Description</label>
                    <input type="text" class="anno-form-desc" placeholder="Optional notes" value="${existing ? this.escapeHtml(existing.description || '') : ''}">
                </div>
                <div class="anno-form-field anno-form-tags-field">
                    <label>Tags</label>
                    <input type="text" class="anno-form-tags" placeholder="Comma-separated tags" value="${existingTags.join(', ')}">
                    <div class="anno-form-autocomplete"></div>
                </div>
                <div class="anno-form-field">
                    <label>Color</label>
                    <input type="color" class="anno-form-color" value="${existing ? (existing.color || '#e74c3c') : '#e74c3c'}">
                </div>
            </div>
            <div class="anno-form-actions">
                <button class="anno-form-cancel">Cancel</button>
                <button class="anno-form-save">${isEdit ? 'Update' : 'Save'}</button>
            </div>
        `;

        formArea.appendChild(form);

        // Helper to update position field visibility based on scope + type
        const updatePositionFields = () => {
            const scopeVal = form.querySelector('input[name="anno-mgr-scope"]:checked').value;
            const typeVal = form.querySelector('input[name="anno-mgr-type"]:checked').value;
            const isG = scopeVal === 'global';
            const isP = typeVal === 'point';

            // Show/hide production fields
            form.querySelector('.anno-production-group-field').style.display = isG ? 'none' : 'block';
            form.querySelector('.anno-global-group-field').style.display = isG ? 'block' : 'none';

            // Week inputs (production scope)
            form.querySelector('.anno-point-fields.anno-week-input').style.display = (!isG && isP) ? 'block' : 'none';
            form.querySelector('.anno-interval-fields.anno-week-input').style.display = (!isG && !isP) ? 'flex' : 'none';

            // Date inputs (global scope)
            form.querySelector('.anno-date-point-field').style.display = (isG && isP) ? 'block' : 'none';
            form.querySelector('.anno-date-interval-field').style.display = (isG && !isP) ? 'flex' : 'none';
        };

        // Scope radio toggle
        form.querySelectorAll('input[name="anno-mgr-scope"]').forEach(radio => {
            radio.addEventListener('change', updatePositionFields);
        });

        // Type radio toggle
        form.querySelectorAll('input[name="anno-mgr-type"]').forEach(radio => {
            radio.addEventListener('change', updatePositionFields);
        });

        // Auto-add production tag when group selected
        const groupSelect = form.querySelector('.anno-form-group');
        const tagsInput = form.querySelector('.anno-form-tags');
        groupSelect.addEventListener('change', () => {
            const prodName = groupSelect.value;
            if (!prodName) return;
            const currentTags = tagsInput.value.split(',').map(t => t.trim()).filter(t => t);
            if (!currentTags.includes(prodName)) {
                currentTags.push(prodName);
                tagsInput.value = currentTags.join(', ');
            }
        });

        // Tag autocomplete
        const autocomplete = form.querySelector('.anno-form-autocomplete');
        const allSuggestions = [...new Set([...this.allTags, ...this.groupTitles])].sort();

        tagsInput.addEventListener('input', () => {
            const val = tagsInput.value;
            const parts = val.split(',');
            const current = parts[parts.length - 1].trim().toLowerCase();

            if (!current) { autocomplete.style.display = 'none'; return; }

            const matches = allSuggestions.filter(t => t.toLowerCase().includes(current));
            if (matches.length === 0) { autocomplete.style.display = 'none'; return; }

            autocomplete.style.display = 'block';
            autocomplete.innerHTML = '';
            matches.slice(0, 8).forEach(match => {
                const opt = document.createElement('div');
                opt.className = 'anno-autocomplete-option';
                const isProd = this.groupTitles.includes(match);
                opt.innerHTML = `${this.escapeHtml(match)}${isProd ? ' <span class="prod-hint">production</span>' : ''}`;
                opt.addEventListener('mousedown', () => {
                    parts[parts.length - 1] = ' ' + match;
                    tagsInput.value = parts.join(',').replace(/^[\s,]+/, '') + ', ';
                    autocomplete.style.display = 'none';
                    tagsInput.focus();
                });
                autocomplete.appendChild(opt);
            });
        });

        tagsInput.addEventListener('blur', () => {
            setTimeout(() => { autocomplete.style.display = 'none'; }, 200);
        });

        // Cancel
        form.querySelector('.anno-form-cancel').addEventListener('click', () => {
            formArea.innerHTML = '';
            this.editingId = null;
        });

        // Save
        form.querySelector('.anno-form-save').addEventListener('click', async () => {
            const scopeVal = form.querySelector('input[name="anno-mgr-scope"]:checked').value;
            const isG = scopeVal === 'global';

            let groupTitle;
            if (isG) {
                groupTitle = form.querySelector('.anno-form-group-optional').value || null;
            } else {
                groupTitle = groupSelect.value;
                if (!groupTitle) { alert('Please select a production.'); return; }
            }

            const type = form.querySelector('input[name="anno-mgr-type"]:checked').value;
            const label = form.querySelector('.anno-form-label').value.trim();
            if (!label) { alert('Please enter a label.'); return; }

            const tagsArr = tagsInput.value.split(',').map(t => t.trim()).filter(t => t);

            const payload = {
                annotationType: type,
                label,
                description: form.querySelector('.anno-form-desc').value.trim(),
                color: form.querySelector('.anno-form-color').value,
                tags: tagsArr,
                scope: scopeVal
            };

            if (isG) {
                // Global: use date fields
                if (type === 'point') {
                    payload.annotationDate = form.querySelector('.anno-form-date').value;
                    if (!payload.annotationDate) { alert('Please select a date.'); return; }
                } else {
                    payload.annotationDate = form.querySelector('.anno-form-date-start').value;
                    payload.annotationEndDate = form.querySelector('.anno-form-date-end').value;
                    if (!payload.annotationDate || !payload.annotationEndDate) { alert('Please select start and end dates.'); return; }
                }
            } else {
                // Production: use week fields
                if (type === 'point') {
                    payload.weekNumber = parseFloat(form.querySelector('.anno-form-week').value);
                    if (isNaN(payload.weekNumber)) { alert('Enter a valid week number.'); return; }
                } else {
                    payload.startWeek = parseFloat(form.querySelector('.anno-form-start').value);
                    payload.endWeek = parseFloat(form.querySelector('.anno-form-end').value);
                    if (isNaN(payload.startWeek) || isNaN(payload.endWeek)) { alert('Enter valid start/end weeks.'); return; }
                }
            }

            try {
                if (isEdit) {
                    const updated = await window.dataService.updateAnnotation(existing.annotation_id, payload);
                    const idx = this.annotations.findIndex(a => a.annotation_id === existing.annotation_id);
                    if (idx >= 0) this.annotations[idx] = updated;
                } else {
                    const created = await window.dataService.createAnnotation(groupTitle, payload);
                    this.annotations.push(created);
                }

                this.allTags = await window.dataService.getAllAnnotationTags();
                formArea.innerHTML = '';
                this.editingId = null;
                this.renderFilters();
                this.renderTableRows();
            } catch (e) {
                alert('Error saving: ' + e.message);
            }
        });
    }

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    injectStyles() {
        if (document.getElementById('annotations-mgr-styles')) return;
        const style = document.createElement('style');
        style.id = 'annotations-mgr-styles';
        style.textContent = `
.annotations-mgr {
    padding: 20px;
}

.annotations-mgr-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
}

.annotations-mgr-header h2 {
    margin: 0;
    font-size: 18px;
    color: #333;
}

.anno-mgr-add-btn {
    background: #667eea;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    transition: background 0.2s;
}

.anno-mgr-add-btn:hover {
    background: #5a6fd6;
}

.annotations-mgr-filters {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    flex-wrap: wrap;
    margin-bottom: 16px;
}

.anno-mgr-group-filter {
    padding: 6px 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 13px;
    min-width: 200px;
}

.anno-mgr-tag-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    align-items: center;
}

.anno-mgr-tag-pill {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 11px;
    cursor: pointer;
    border: 1px solid #ddd;
    background: white;
    color: #666;
    transition: all 0.2s;
}

.anno-mgr-tag-pill:hover {
    border-color: #667eea;
    color: #667eea;
}

.anno-mgr-tag-pill.active {
    background: #667eea;
    color: white;
    border-color: #667eea;
}

.anno-mgr-scope-bar {
    display: flex;
    gap: 5px;
    align-items: center;
}

.anno-mgr-scope-pill {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 12px;
    cursor: pointer;
    border: 1px solid #ddd;
    background: white;
    color: #666;
    font-weight: 500;
    transition: all 0.2s;
}

.anno-mgr-scope-pill:hover {
    border-color: #667eea;
    color: #667eea;
}

.anno-mgr-scope-pill.active {
    background: #667eea;
    color: white;
    border-color: #667eea;
}

.anno-scope-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 3px;
    font-size: 11px;
    font-weight: 500;
}

.anno-scope-global {
    background: #e8f5e9;
    color: #2e7d32;
}

.anno-mgr-tag-pill.production-tag {
    border-style: dashed;
}

.anno-mgr-tag-pill.production-tag.active {
    background: #764ba2;
    border-color: #764ba2;
    border-style: solid;
}

.tag-pill.production-tag {
    background: #f3e5f5;
    color: #7b1fa2;
    border: 1px dashed #ce93d8;
}

/* Table */
.annotations-mgr-table-wrap {
    overflow-x: auto;
}

.annotations-mgr-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
}

.annotations-mgr-table th {
    background: #f8f9fa;
    padding: 8px 10px;
    text-align: left;
    font-weight: 600;
    color: #495057;
    border-bottom: 2px solid #dee2e6;
    font-size: 12px;
    white-space: nowrap;
}

.annotations-mgr-table td {
    padding: 8px 10px;
    border-bottom: 1px solid #eee;
    vertical-align: middle;
}

.annotations-mgr-table tr:hover {
    background: #f8f9fa;
}

.anno-cell-group {
    font-weight: 500;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.anno-cell-label {
    font-weight: 500;
}

.anno-cell-desc {
    color: #666;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.anno-cell-tags {
    max-width: 250px;
}

.anno-cell-tags .tag-pill {
    margin: 1px 2px;
}

.anno-type-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 3px;
    font-size: 11px;
    font-weight: 500;
}

.anno-type-point {
    background: #e3f2fd;
    color: #1565c0;
}

.anno-type-interval {
    background: #f3e5f5;
    color: #7b1fa2;
}

.anno-color-dot {
    display: inline-block;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 1px solid rgba(0,0,0,0.1);
}

.anno-cell-actions {
    white-space: nowrap;
}

.anno-edit-btn, .anno-del-btn {
    background: none;
    border: 1px solid #ddd;
    padding: 3px 10px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 11px;
    margin-right: 4px;
    transition: all 0.2s;
}

.anno-edit-btn:hover {
    border-color: #667eea;
    color: #667eea;
}

.anno-del-btn {
    color: #dc3545;
    border-color: #f5c6cb;
}

.anno-del-btn:hover {
    background: #dc3545;
    color: white;
    border-color: #dc3545;
}

/* Form */
.anno-mgr-form {
    background: #f8f9fa;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
}

.anno-mgr-form h3 {
    margin: 0 0 12px;
    font-size: 15px;
    color: #333;
}

.anno-form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
    margin-bottom: 12px;
}

.anno-form-field label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: #666;
    margin-bottom: 4px;
}

.anno-form-field input[type="text"],
.anno-form-field input[type="number"],
.anno-form-field input[type="date"],
.anno-form-field select {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 13px;
    box-sizing: border-box;
}

.anno-form-field input:focus,
.anno-form-field select:focus {
    outline: none;
    border-color: #667eea;
}

.anno-form-radios {
    display: flex;
    gap: 12px;
}

.anno-form-radios label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    font-weight: normal;
    cursor: pointer;
}

.anno-form-tags-field {
    position: relative;
}

.anno-form-autocomplete {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    border: 1px solid #ddd;
    border-radius: 0 0 4px 4px;
    max-height: 150px;
    overflow-y: auto;
    z-index: 10;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.anno-autocomplete-option {
    padding: 6px 10px;
    cursor: pointer;
    font-size: 12px;
    border-bottom: 1px solid #f0f0f0;
}

.anno-autocomplete-option:hover {
    background: #f0f0f0;
}

.prod-hint {
    font-size: 10px;
    color: #7b1fa2;
    font-style: italic;
    margin-left: 4px;
}

.anno-form-field input[type="color"] {
    width: 50px;
    height: 30px;
    padding: 2px;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
}

.anno-form-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
}

.anno-form-cancel {
    background: #e9ecef;
    border: none;
    padding: 7px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
}

.anno-form-save {
    background: #667eea;
    color: white;
    border: none;
    padding: 7px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
}

.anno-form-save:hover {
    background: #5a6fd6;
}

/* Loading State */
.anno-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 20px;
    gap: 20px;
}

.anno-loading-icon {
    animation: anno-loading-pulse 2s ease-in-out infinite;
}

.anno-loading-arc {
    transform-origin: 24px 24px;
    animation: anno-loading-spin 1.2s linear infinite;
}

.anno-loading-pencil {
    transform-origin: 24px 18px;
    animation: anno-loading-write 1.5s ease-in-out infinite;
}

.anno-loading-text {
    font-size: 14px;
    color: #666;
    margin: 0;
    font-weight: 500;
}

.anno-loading-dots::after {
    content: '...';
    display: inline-block;
    width: 0;
    overflow: hidden;
    vertical-align: bottom;
    animation: anno-loading-dots-anim 1.5s steps(4, end) infinite;
}

@keyframes anno-loading-spin {
    to { transform: rotate(360deg); }
}

@keyframes anno-loading-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.05); opacity: 0.8; }
}

@keyframes anno-loading-write {
    0%, 100% { transform: rotate(0deg); }
    25% { transform: rotate(12deg); }
    75% { transform: rotate(-12deg); }
}

@keyframes anno-loading-dots-anim {
    0%   { width: 0; }
    25%  { width: 0.4em; }
    50%  { width: 0.8em; }
    75%  { width: 1.2em; }
}

@media (max-width: 768px) {
    .annotations-mgr {
        padding: 12px;
    }

    .anno-form-grid {
        grid-template-columns: 1fr;
    }

    .annotations-mgr-table {
        font-size: 12px;
    }

    .anno-cell-desc, .anno-cell-group {
        max-width: 120px;
    }
}
        `;
        document.head.appendChild(style);
    }
}

// Export to global scope
if (typeof window !== 'undefined') {
    window.AnnotationsManager = AnnotationsManager;
}
