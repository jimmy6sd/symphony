// Pipeline Status and Data Freshness Component
// Shows last update time, data source, and pipeline health

class PipelineStatus {
    constructor() {
        this.container = null;
        this.updateInterval = null;
        this.lastUpdateTime = null;
        this.dataSource = 'unknown';
        this.pipelineHealth = 'unknown';
    }

    async initialize(containerId = 'pipeline-status') {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            // Create container if it doesn't exist
            this.container = this.createStatusContainer();
            this.insertIntoHeader();
        }

        await this.loadPipelineStatus();
        this.startPeriodicUpdates();
        console.log('📊 Pipeline status component initialized');
    }

    createStatusContainer() {
        const container = document.createElement('div');
        container.id = 'pipeline-status';
        container.className = 'pipeline-status';
        container.innerHTML = `
            <div class="pipeline-status-content">
                <div class="status-item data-freshness">
                    <span class="status-icon">⏰</span>
                    <span class="status-label">Last Update:</span>
                    <span class="status-value" id="last-update-time">Loading...</span>
                </div>
                <div class="status-item data-source">
                    <span class="status-icon">📊</span>
                    <span class="status-label">Source:</span>
                    <span class="status-value" id="data-source">Loading...</span>
                </div>
                <div class="status-item pipeline-health">
                    <span class="status-icon" id="health-icon">🔄</span>
                    <span class="status-label">Pipeline:</span>
                    <span class="status-value" id="pipeline-health">Loading...</span>
                </div>
                <div class="status-item refresh-control">
                    <button id="manual-refresh-btn" class="refresh-btn" title="Check for updates">
                        🔄 Refresh
                    </button>
                </div>
            </div>
        `;

        // Add styles
        this.addStatusStyles();
        this.attachEventListeners(container);

        return container;
    }

    insertIntoHeader() {
        // Insert after the main title or in the header area
        const headerArea = document.querySelector('.header') ||
                          document.querySelector('h1') ||
                          document.body.firstChild;

        if (headerArea && headerArea.parentNode) {
            headerArea.parentNode.insertBefore(this.container, headerArea.nextSibling);
        } else {
            document.body.insertBefore(this.container, document.body.firstChild);
        }
    }

    addStatusStyles() {
        if (document.getElementById('pipeline-status-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'pipeline-status-styles';
        styles.textContent = `
            .pipeline-status {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 12px 20px;
                margin: 10px 0;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .pipeline-status-content {
                display: flex;
                align-items: center;
                gap: 20px;
                flex-wrap: wrap;
                font-size: 14px;
            }

            .status-item {
                display: flex;
                align-items: center;
                gap: 5px;
                background: rgba(255,255,255,0.15);
                padding: 6px 12px;
                border-radius: 20px;
                transition: all 0.2s ease;
            }

            .status-item:hover {
                background: rgba(255,255,255,0.25);
                transform: translateY(-1px);
            }

            .status-icon {
                font-size: 16px;
            }

            .status-label {
                font-weight: 500;
                opacity: 0.9;
            }

            .status-value {
                font-weight: 600;
                color: #ffffff;
            }

            .refresh-btn {
                background: rgba(255,255,255,0.2);
                border: 1px solid rgba(255,255,255,0.3);
                color: white;
                padding: 6px 12px;
                border-radius: 20px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 500;
                transition: all 0.2s ease;
            }

            .refresh-btn:hover {
                background: rgba(255,255,255,0.3);
                transform: translateY(-1px);
            }

            .refresh-btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }

            .freshness-fresh { color: #4ade80; }
            .freshness-moderate { color: #fbbf24; }
            .freshness-stale { color: #f87171; }

            .health-healthy { color: #4ade80; }
            .health-warning { color: #fbbf24; }
            .health-error { color: #f87171; }

            @media (max-width: 768px) {
                .pipeline-status-content {
                    flex-direction: column;
                    align-items: stretch;
                    gap: 10px;
                }

                .status-item {
                    justify-content: space-between;
                }
            }
        `;

        document.head.appendChild(styles);
    }

    attachEventListeners(container) {
        const refreshBtn = container.querySelector('#manual-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.manualRefresh());
        }
    }

    async loadPipelineStatus() {
        try {
            // Get actual performance data and pipeline health
            const [performancesData, healthData] = await Promise.all([
                this.getPerformancesData(),
                this.getPipelineHealth()
            ]);

            this.updateStatusDisplay(performancesData, healthData);

        } catch (error) {
            console.error('Error loading pipeline status:', error);
            this.showError('Failed to load pipeline status');
        }
    }

    async getPerformancesData() {
        try {
            const response = await fetch('/.netlify/functions/bigquery-data?action=get-performances');
            if (!response.ok) throw new Error('Failed to fetch performances data');
            const performances = await response.json();

            // Create snapshot-like object from actual data
            if (performances && performances.length > 0) {
                // Try to get pipeline health for actual timestamp
                try {
                    const healthResponse = await fetch('/.netlify/functions/bigquery-data?action=get-pipeline-health');
                    if (healthResponse.ok) {
                        const healthData = await healthResponse.json();
                        if (healthData.lastExecution && healthData.lastExecution.end_time) {
                            const timestamp = healthData.lastExecution.end_time.value || healthData.lastExecution.end_time;
                            return {
                                performance_count: performances.length,
                                processing_timestamp: timestamp,
                                source_type: 'bigquery'
                            };
                        }
                    }
                } catch (e) {
                    console.warn('Could not fetch pipeline health for timestamp:', e);
                }

                // Fallback: use current time if no pipeline execution data
                return {
                    performance_count: performances.length,
                    processing_timestamp: new Date().toISOString(),
                    source_type: 'bigquery'
                };
            }
            return null;
        } catch (error) {
            console.error('Error fetching performances data:', error);
            return null;
        }
    }

    async getPipelineHealth() {
        try {
            const response = await fetch('/.netlify/functions/bigquery-data?action=get-pipeline-health');
            if (!response.ok) throw new Error('Failed to fetch pipeline health');
            return await response.json();
        } catch (error) {
            console.error('Error fetching pipeline health:', error);
            return { status: 'unknown', lastExecution: null };
        }
    }

    updateStatusDisplay(performancesData, healthData) {
        // Update last update time
        const lastUpdateEl = document.getElementById('last-update-time');
        if (lastUpdateEl) {
            if (performancesData && performancesData.processing_timestamp) {
                const updateTime = new Date(performancesData.processing_timestamp);
                const timeAgo = this.getTimeAgo(updateTime);
                const freshness = this.getFreshnessLevel(updateTime);

                lastUpdateEl.textContent = timeAgo;
                lastUpdateEl.className = `status-value freshness-${freshness}`;
                this.lastUpdateTime = updateTime;
            } else {
                lastUpdateEl.textContent = 'No data';
                lastUpdateEl.className = 'status-value freshness-stale';
            }
        }

        // Update data source - show actual count
        const dataSourceEl = document.getElementById('data-source');
        if (dataSourceEl) {
            if (performancesData) {
                const count = performancesData.performance_count || 0;
                dataSourceEl.textContent = `BigQuery (${count} performances)`;
                this.dataSource = 'bigquery';
            } else {
                dataSourceEl.textContent = 'No data';
                this.dataSource = 'unknown';
            }
        }

        // Update pipeline health
        const healthEl = document.getElementById('pipeline-health');
        const healthIcon = document.getElementById('health-icon');
        if (healthEl && healthIcon) {
            const health = healthData.status || 'unknown';
            const healthText = this.getHealthDisplayText(health);
            const healthIcon_text = this.getHealthIcon(health);

            healthEl.textContent = healthText;
            healthEl.className = `status-value health-${health}`;
            healthIcon.textContent = healthIcon_text;
            this.pipelineHealth = health;
        }
    }

    getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }

    getFreshnessLevel(date) {
        const now = new Date();
        const diffHours = (now - date) / 3600000;

        if (diffHours <= 24) return 'fresh';
        if (diffHours <= 168) return 'moderate'; // 7 days
        return 'stale';
    }

    getSourceDisplayText(sourceType) {
        const sourceMap = {
            'pdf_tessitura': 'PDF (Tessitura)',
            'api_tessitura': 'API (Tessitura)',
            'manual': 'Manual Upload',
            'local': 'Local JSON',
            'unknown': 'Unknown'
        };
        return sourceMap[sourceType] || sourceType;
    }

    getHealthDisplayText(health) {
        const healthMap = {
            'healthy': 'Healthy',
            'warning': 'Warning',
            'error': 'Error',
            'unknown': 'Unknown'
        };
        return healthMap[health] || health;
    }

    getHealthIcon(health) {
        const iconMap = {
            'healthy': '✅',
            'warning': '⚠️',
            'error': '❌',
            'unknown': '❓'
        };
        return iconMap[health] || '🔄';
    }

    async manualRefresh() {
        const refreshBtn = document.getElementById('manual-refresh-btn');
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.textContent = '🔄 Refreshing...';
        }

        try {
            await this.loadPipelineStatus();

            // Also refresh the main dashboard data if available
            if (window.dataService && typeof window.dataService.loadDashboardData === 'function') {
                await window.dataService.loadDashboardData();
            }

            // Show success feedback
            this.showSuccessMessage('Status updated successfully');

        } catch (error) {
            console.error('Manual refresh failed:', error);
            this.showError('Refresh failed');
        } finally {
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.textContent = '🔄 Refresh';
            }
        }
    }

    showSuccessMessage(message) {
        // Brief success indicator
        const refreshBtn = document.getElementById('manual-refresh-btn');
        if (refreshBtn) {
            const originalText = refreshBtn.textContent;
            refreshBtn.textContent = '✅ Updated';
            refreshBtn.style.background = 'rgba(74, 222, 128, 0.3)';

            setTimeout(() => {
                refreshBtn.textContent = originalText;
                refreshBtn.style.background = '';
            }, 2000);
        }
    }

    showError(message) {
        console.error('Pipeline status error:', message);
        // Could add toast notification here
    }

    startPeriodicUpdates() {
        // Update every 5 minutes
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        this.updateInterval = setInterval(() => {
            this.loadPipelineStatus();
        }, 5 * 60 * 1000);
    }

    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.PipelineStatus = PipelineStatus;
}

// Auto-initialize if in browser environment
if (typeof window !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.pipelineStatus = new PipelineStatus();
        window.pipelineStatus.initialize();
    });
} else if (typeof window !== 'undefined') {
    // DOM already loaded
    window.pipelineStatus = new PipelineStatus();
    window.pipelineStatus.initialize();
}