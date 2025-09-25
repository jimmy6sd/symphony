/**
 * Symphony Dashboard Application
 * Modular application bootstrapper using the Symphony Framework
 */

class SymphonyApp {
    constructor() {
        this.framework = null;
        this.initialized = false;
        this.modules = [];
    }

    /**
     * Initialize and start the application
     */
    async init() {
        try {
            console.log('🎼 Starting Symphony Dashboard...');

            // Create framework instance
            this.framework = new SymphonyFramework();

            // Initialize framework
            await this.framework.init(this.getFrameworkConfig());

            // Register core services
            await this.registerCoreServices();

            // Register application modules
            await this.registerApplicationModules();

            // Start framework
            await this.framework.start();

            this.initialized = true;
            console.log('✅ Symphony Dashboard started successfully');

            // Emit application ready event
            window.dispatchEvent(new CustomEvent('symphony:ready', {
                detail: { app: this, framework: this.framework }
            }));

        } catch (error) {
            console.error('❌ Symphony Dashboard startup failed:', error);
            this.handleStartupError(error);
            throw error;
        }
    }

    /**
     * Get framework configuration
     * @returns {Object} Framework configuration
     */
    getFrameworkConfig() {
        return {
            logging: {
                level: this.getLogLevel(),
                console: true
            },
            modules: {
                autoStart: true,
                loadTimeout: 15000
            },
            events: {
                maxListeners: 200
            }
        };
    }

    /**
     * Register core services with the framework
     */
    async registerCoreServices() {
        console.log('🔧 Registering core services...');

        // Configuration Service
        this.framework.registerModule('configService', ConfigService, {
            priority: 1
        });

        // Data Manager
        this.framework.registerModule('dataManager', DataManager, {
            priority: 2
        });

        // Chart Framework
        this.framework.registerModule('chartFramework', ChartFramework, {
            priority: 3
        });

        console.log('✅ Core services registered');
    }

    /**
     * Register application modules
     */
    async registerApplicationModules() {
        console.log('📊 Registering application modules...');

        // Data Providers
        this.framework.registerModule('csvProvider', CSVDataProvider, {
            enabled: true
        });

        // Data Transformers
        this.framework.registerModule('kcsTransformer', KCSTransformer, {
            enabled: true
        });

        // Chart Components (will be registered when loaded)
        this.modules.push(
            'performance-chart',
            'sales-curve-chart',
            'data-table-chart',
            'ticket-type-chart'
        );

        // UI Components
        if (window.DashboardUI) {
            this.framework.registerModule('dashboardUI', window.DashboardUI, {
                containerSelector: '.dashboard-content'
            });
        }

        // Authentication Module
        if (window.AuthModule) {
            this.framework.registerModule('auth', window.AuthModule, {
                enabled: true
            });
        }

        console.log('✅ Application modules registered');
    }

    /**
     * Stop the application
     */
    async stop() {
        if (this.framework) {
            await this.framework.stop();
        }
        console.log('🛑 Symphony Dashboard stopped');
    }

    /**
     * Destroy the application
     */
    async destroy() {
        if (this.framework) {
            await this.framework.destroy();
        }
        this.initialized = false;
        console.log('💥 Symphony Dashboard destroyed');
    }

    /**
     * Get a service from the framework
     * @param {string} name - Service name
     * @returns {Object} Service instance
     */
    getService(name) {
        if (!this.framework) {
            throw new Error('Framework not initialized');
        }
        return this.framework.getService(name);
    }

    /**
     * Get a module from the framework
     * @param {string} name - Module name
     * @returns {Object} Module instance
     */
    getModule(name) {
        if (!this.framework) {
            throw new Error('Framework not initialized');
        }
        return this.framework.getModule(name);
    }

    /**
     * Get performance data
     * @param {Object} options - Query options
     * @returns {Array} Performance data
     */
    async getPerformances(options = {}) {
        const dataManager = this.getService('dataManager');
        return await dataManager.getPerformances(options);
    }

    /**
     * Get sales data for a performance
     * @param {string} performanceId - Performance ID
     * @param {Object} options - Query options
     * @returns {Object} Sales data
     */
    async getSalesData(performanceId, options = {}) {
        const dataManager = this.getService('dataManager');
        return await dataManager.getSalesData(performanceId, options);
    }

    /**
     * Create a chart
     * @param {string} type - Chart type
     * @param {string|HTMLElement} container - Container
     * @param {Object} config - Chart configuration
     * @returns {Object} Chart instance
     */
    createChart(type, container, config = {}) {
        const chartFramework = this.getService('chartFramework');
        return chartFramework.createChart(type, container, config);
    }

    /**
     * Get configuration value
     * @param {string} path - Configuration path
     * @param {*} defaultValue - Default value
     * @returns {*} Configuration value
     */
    getConfig(path, defaultValue) {
        const configService = this.getService('configService');
        return configService.get(path, defaultValue);
    }

    /**
     * Set configuration value
     * @param {string} path - Configuration path
     * @param {*} value - Value to set
     * @param {boolean} persist - Whether to persist
     */
    setConfig(path, value, persist = false) {
        const configService = this.getService('configService');
        configService.set(path, value, persist);
    }

    /**
     * Refresh all data
     */
    async refreshData() {
        const dataManager = this.getService('dataManager');
        return await dataManager.refreshData();
    }

    /**
     * Get application statistics
     * @returns {Object} Application statistics
     */
    getStats() {
        if (!this.framework) {
            return { initialized: false };
        }

        const dataManager = this.getService('dataManager');
        const chartFramework = this.getService('chartFramework');

        return {
            initialized: this.initialized,
            framework: {
                modules: this.framework.modules.size,
                services: this.framework.services.size,
                state: this.framework.state
            },
            data: dataManager ? {
                providers: dataManager.getProviders().length,
                transformers: dataManager.getTransformers().length,
                cache: dataManager.getCacheStats()
            } : null,
            charts: chartFramework ? chartFramework.getStats() : null
        };
    }

    /**
     * Get log level based on environment
     * @returns {string} Log level
     */
    getLogLevel() {
        const hostname = window.location.hostname;
        const search = window.location.search;

        if (search.includes('debug=true')) return 'debug';
        if (hostname === 'localhost' || hostname === '127.0.0.1') return 'debug';
        if (hostname.includes('staging') || hostname.includes('test')) return 'info';

        return 'warn';
    }

    /**
     * Handle startup errors
     * @param {Error} error - Startup error
     */
    handleStartupError(error) {
        // Show user-friendly error message
        const errorContainer = document.getElementById('error-container');
        if (errorContainer) {
            errorContainer.innerHTML = `
                <div class="error-message">
                    <h3>Application Startup Failed</h3>
                    <p>The Symphony Dashboard could not start properly.</p>
                    <details>
                        <summary>Technical Details</summary>
                        <pre>${error.stack || error.message}</pre>
                    </details>
                    <button onclick="window.location.reload()">Retry</button>
                </div>
            `;
            errorContainer.style.display = 'block';
        }

        // Hide loading indicator
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    }

    /**
     * Register chart component when it becomes available
     * @param {string} name - Chart name
     * @param {Function} chartClass - Chart class
     * @param {Object} metadata - Chart metadata
     */
    registerChart(name, chartClass, metadata = {}) {
        if (this.framework) {
            const chartFramework = this.getService('chartFramework');
            chartFramework.registerChartType(name, chartClass, metadata);
        }
    }

    /**
     * Setup error handling
     */
    setupErrorHandling() {
        // Global error handler
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            // Could send to monitoring service
        });

        // Unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            // Could send to monitoring service
        });
    }

    /**
     * Setup development helpers
     */
    setupDevelopmentHelpers() {
        if (this.getLogLevel() === 'debug') {
            // Expose app instance globally for debugging
            window.symphonyApp = this;
            window.symphonyFramework = this.framework;

            // Add debug commands
            window.debug = {
                stats: () => this.getStats(),
                config: (path, value) => {
                    if (value !== undefined) {
                        this.setConfig(path, value);
                    }
                    return this.getConfig(path);
                },
                refresh: () => this.refreshData(),
                restart: async () => {
                    await this.stop();
                    await this.init();
                }
            };

            console.log('🐛 Development helpers available at window.debug');
        }
    }
}

/**
 * Application bootstrapper
 */
async function startSymphonyApp() {
    try {
        // Check for required dependencies
        if (typeof SymphonyFramework === 'undefined') {
            throw new Error('Symphony Framework not loaded');
        }

        if (typeof d3 === 'undefined') {
            throw new Error('D3.js library not loaded');
        }

        // Create and start application
        const app = new SymphonyApp();
        app.setupErrorHandling();

        await app.init();

        app.setupDevelopmentHelpers();

        // Store globally for access
        window.symphonyApp = app;

        return app;

    } catch (error) {
        console.error('❌ Failed to start Symphony Dashboard:', error);
        throw error;
    }
}

// Auto-start when DOM is ready and all scripts are loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Small delay to ensure all scripts are loaded
        setTimeout(startSymphonyApp, 100);
    });
} else {
    // DOM already loaded
    setTimeout(startSymphonyApp, 100);
}

// Export for manual initialization if needed
window.SymphonyApp = SymphonyApp;
window.startSymphonyApp = startSymphonyApp;