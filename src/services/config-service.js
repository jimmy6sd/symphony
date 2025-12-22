/**
 * Configuration Service
 * Centralized configuration management with environment support and runtime updates
 */

class ConfigService extends SymphonyModule {
    constructor(framework) {
        super(framework);
        this.configData = null;
        this.watchers = new Map();
        this.environment = this.detectEnvironment();
    }

    async init(config) {
        await super.init(config);

        // Load configuration from multiple sources
        await this.loadConfiguration();

        this.log('info', `Configuration loaded for environment: ${this.environment}`);
    }

    /**
     * Load configuration from multiple sources in priority order
     */
    async loadConfiguration() {
        // 1. Start with default configuration
        this.configData = this.getDefaultConfig();

        // 2. Load environment-specific config
        const envConfig = await this.loadEnvironmentConfig();
        this.mergeConfig(envConfig);

        // 3. Load user/local overrides
        const localConfig = await this.loadLocalConfig();
        this.mergeConfig(localConfig);

        // 4. Apply runtime overrides
        const runtimeConfig = this.getRuntimeConfig();
        this.mergeConfig(runtimeConfig);

        // Validate final configuration
        this.validateConfig();
    }

    /**
     * Get configuration value by path
     * @param {string} path - Dot-separated path (e.g., 'charts.colors.primary')
     * @param {*} defaultValue - Default value if path not found
     * @returns {*} Configuration value
     */
    get(path, defaultValue = undefined) {
        if (!path) return this.configData;

        const keys = path.split('.');
        let current = this.configData;

        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                return defaultValue;
            }
        }

        return current;
    }

    /**
     * Set configuration value by path
     * @param {string} path - Dot-separated path
     * @param {*} value - Value to set
     * @param {boolean} persist - Whether to persist the change
     */
    set(path, value, persist = false) {
        if (!path) {
            throw new Error('Configuration path is required');
        }

        const keys = path.split('.');
        let current = this.configData;

        // Navigate to parent object
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }

        // Set the value
        const lastKey = keys[keys.length - 1];
        const oldValue = current[lastKey];
        current[lastKey] = value;

        // Notify watchers
        this.notifyWatchers(path, value, oldValue);

        // Persist if requested
        if (persist) {
            this.persistConfig(path, value);
        }

        this.log('debug', `Configuration updated: ${path} = ${JSON.stringify(value)}`);
    }

    /**
     * Watch for configuration changes
     * @param {string} path - Path to watch
     * @param {Function} callback - Callback function
     * @returns {Function} Unwatch function
     */
    watch(path, callback) {
        if (!this.watchers.has(path)) {
            this.watchers.set(path, []);
        }

        this.watchers.get(path).push(callback);

        // Return unwatch function
        return () => {
            const callbacks = this.watchers.get(path);
            if (callbacks) {
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
            }
        };
    }

    /**
     * Get environment-specific configuration
     * @param {string} environment - Environment name
     * @returns {Object} Environment configuration
     */
    getEnvironmentConfig(environment = this.environment) {
        const envConfigs = {
            development: {
                logging: {
                    level: 'debug',
                    console: true
                },
                api: {
                    mockDataEnabled: false,
                    refreshInterval: 30000,
                    timeout: 5000
                },
                performance: {
                    debugMode: true,
                    cacheTTL: 300000 // 5 minutes
                }
            },
            production: {
                logging: {
                    level: 'warn',
                    console: false
                },
                api: {
                    mockDataEnabled: false,
                    refreshInterval: 300000, // 5 minutes
                    timeout: 10000
                },
                performance: {
                    debugMode: false,
                    cacheTTL: 1800000 // 30 minutes
                }
            },
            testing: {
                logging: {
                    level: 'error',
                    console: true
                },
                api: {
                    mockDataEnabled: true,
                    refreshInterval: 0,
                    timeout: 1000
                },
                performance: {
                    debugMode: true,
                    cacheTTL: 0
                }
            }
        };

        return envConfigs[environment] || envConfigs.development;
    }

    /**
     * Get default configuration
     * @returns {Object} Default configuration
     */
    getDefaultConfig() {
        return {
            // Application metadata
            app: {
                name: 'Symphony Dashboard',
                version: '2.0.0',
                description: 'Kansas City Symphony Sales Analytics Dashboard'
            },

            // Framework configuration
            framework: {
                logging: {
                    level: 'info',
                    console: true
                },
                modules: {
                    autoStart: true,
                    loadTimeout: 10000
                },
                events: {
                    maxListeners: 100
                }
            },

            // Performance and budget goals
            performances: {
                defaultOccupancyGoal: 85,
                defaultBudgetGoal: 100000,
                performanceGoals: {}
            },

            // Sales curve configuration
            salesCurve: {
                expectedSalesProgression: [
                    { week: 1, percentage: 5 },
                    { week: 2, percentage: 12 },
                    { week: 3, percentage: 22 },
                    { week: 4, percentage: 35 },
                    { week: 5, percentage: 48 },
                    { week: 6, percentage: 62 },
                    { week: 7, percentage: 75 },
                    { week: 8, percentage: 87 },
                    { week: 9, percentage: 95 },
                    { week: 10, percentage: 100 }
                ],
                defaultModel: "expectedSalesProgression"
            },

            // Chart styling and configuration
            charts: {
                colors: {
                    singleTickets: "#1f77b4",
                    subscriptionTickets: "#ff7f0e",
                    onTrackLine: "#2ca02c",
                    actualSales: "#d62728",
                    budgetGoal: "#9467bd",
                    occupancyGoal: "#8c564b",
                    primary: "#667eea",
                    secondary: "#f093fb",
                    success: "#28a745",
                    warning: "#ffc107",
                    danger: "#dc3545",
                    info: "#17a2b8"
                },
                dimensions: {
                    margin: { top: 20, right: 30, bottom: 40, left: 50 },
                    defaultWidth: 800,
                    defaultHeight: 400,
                    minWidth: 300,
                    minHeight: 200
                },
                animation: {
                    duration: 750,
                    easing: 'ease-in-out'
                }
            },

            // Data configuration
            data: {
                sources: {
                    primary: 'tessitura',
                    fallback: 'csv'
                },
                refreshInterval: 300000, // 5 minutes
                cache: {
                    enabled: true,
                    ttl: 1800000, // 30 minutes
                    maxSize: 100
                },
                validation: {
                    enabled: true,
                    strictMode: false
                }
            },

            // API configuration
            api: {
                tessitura: {
                    baseUrl: '',
                    timeout: 10000,
                    retries: 3,
                    endpoints: {
                        performances: '/TXN/Performances/Search',
                        orders: '/TXN/Orders',
                        sales: '/TXN/Sales'
                    }
                },
                dashboard: {
                    dataEndpoint: '/api/dashboard-data',
                    refreshEndpoint: '/api/refresh-data'
                }
            },

            // UI configuration
            ui: {
                theme: 'default',
                responsive: {
                    enabled: true,
                    breakpoints: {
                        mobile: 768,
                        tablet: 1024,
                        desktop: 1200
                    }
                },
                animations: {
                    enabled: true,
                    duration: 300
                },
                accessibility: {
                    enabled: true,
                    focusVisible: true,
                    reducedMotion: false
                }
            },

            // Export configuration
            export: {
                formats: ['csv', 'xlsx', 'pdf'],
                defaultFormat: 'csv',
                includeCharts: true,
                maxRows: 10000
            },

            // Authentication configuration
            auth: {
                enabled: true,
                sessionTimeout: 3600000, // 1 hour
                rememberMe: true
            }
        };
    }

    /**
     * Detect current environment
     * @returns {string} Environment name
     */
    detectEnvironment() {
        // Check URL hostname
        const hostname = window.location.hostname;

        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'development';
        }

        if (hostname.includes('staging') || hostname.includes('test')) {
            return 'testing';
        }

        // Check for development indicators
        if (window.location.port || window.location.search.includes('debug=true')) {
            return 'development';
        }

        return 'production';
    }

    /**
     * Load environment-specific configuration
     */
    async loadEnvironmentConfig() {
        try {
            const envConfig = this.getEnvironmentConfig();
            this.log('debug', `Loaded ${this.environment} environment configuration`);
            return envConfig;
        } catch (error) {
            this.log('warn', 'Failed to load environment configuration:', error);
            return {};
        }
    }

    /**
     * Load local configuration overrides
     */
    async loadLocalConfig() {
        try {
            // Try to load from localStorage
            const stored = localStorage.getItem('symphony_config');
            if (stored) {
                const localConfig = JSON.parse(stored);
                this.log('debug', 'Loaded local configuration overrides');
                return localConfig;
            }
        } catch (error) {
            this.log('warn', 'Failed to load local configuration:', error);
        }
        return {};
    }

    /**
     * Get runtime configuration overrides
     */
    getRuntimeConfig() {
        const runtimeConfig = {};

        // Parse URL parameters for configuration overrides
        const urlParams = new URLSearchParams(window.location.search);

        if (urlParams.has('debug')) {
            runtimeConfig.logging = { level: 'debug', console: true };
        }

        if (urlParams.has('mock')) {
            runtimeConfig.api = { mockDataEnabled: true };
        }

        if (urlParams.has('theme')) {
            runtimeConfig.ui = { theme: urlParams.get('theme') };
        }

        return runtimeConfig;
    }

    /**
     * Merge configuration objects
     * @param {Object} source - Source configuration
     */
    mergeConfig(source) {
        if (!source || typeof source !== 'object') return;

        this.configData = this.deepMerge(this.configData, source);
    }

    /**
     * Deep merge two objects
     * @param {Object} target - Target object
     * @param {Object} source - Source object
     * @returns {Object} Merged object
     */
    deepMerge(target, source) {
        const result = { ...target };

        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    result[key] = this.deepMerge(result[key] || {}, source[key]);
                } else {
                    result[key] = source[key];
                }
            }
        }

        return result;
    }

    /**
     * Validate configuration
     */
    validateConfig() {
        const required = [
            'app.name',
            'charts.colors',
            'data.refreshInterval'
        ];

        for (const path of required) {
            if (this.get(path) === undefined) {
                throw new Error(`Required configuration missing: ${path}`);
            }
        }

        this.log('debug', 'Configuration validation passed');
    }

    /**
     * Notify configuration watchers
     * @param {string} path - Configuration path
     * @param {*} newValue - New value
     * @param {*} oldValue - Old value
     */
    notifyWatchers(path, newValue, oldValue) {
        // Notify exact path watchers
        const watchers = this.watchers.get(path);
        if (watchers) {
            for (const callback of watchers) {
                try {
                    callback(newValue, oldValue, path);
                } catch (error) {
                    this.log('error', `Configuration watcher error for '${path}':`, error);
                }
            }
        }

        // Notify parent path watchers
        const pathParts = path.split('.');
        for (let i = pathParts.length - 1; i > 0; i--) {
            const parentPath = pathParts.slice(0, i).join('.');
            const parentWatchers = this.watchers.get(parentPath);
            if (parentWatchers) {
                for (const callback of parentWatchers) {
                    try {
                        callback(this.get(parentPath), undefined, parentPath);
                    } catch (error) {
                        this.log('error', `Configuration watcher error for '${parentPath}':`, error);
                    }
                }
            }
        }
    }

    /**
     * Persist configuration change
     * @param {string} path - Configuration path
     * @param {*} value - Value to persist
     */
    persistConfig(path, value) {
        try {
            let stored = {};
            const existing = localStorage.getItem('symphony_config');
            if (existing) {
                stored = JSON.parse(existing);
            }

            // Set the value in stored config
            const keys = path.split('.');
            let current = stored;
            for (let i = 0; i < keys.length - 1; i++) {
                const key = keys[i];
                if (!current[key] || typeof current[key] !== 'object') {
                    current[key] = {};
                }
                current = current[key];
            }
            current[keys[keys.length - 1]] = value;

            localStorage.setItem('symphony_config', JSON.stringify(stored));
            this.log('debug', `Configuration persisted: ${path}`);
        } catch (error) {
            this.log('warn', 'Failed to persist configuration:', error);
        }
    }

    /**
     * Export current configuration
     * @returns {Object} Current configuration
     */
    exportConfig() {
        return JSON.parse(JSON.stringify(this.configData));
    }

    /**
     * Reset configuration to defaults
     */
    resetConfig() {
        this.configData = this.getDefaultConfig();
        localStorage.removeItem('symphony_config');
        this.log('info', 'Configuration reset to defaults');
    }
}

// Export for use in framework
window.ConfigService = ConfigService;