/**
 * Main application configuration for Symphony Dashboard
 * Centralized configuration management with environment-specific settings
 */
class AppConfig {
    constructor() {
        this.environment = this.detectEnvironment();
        this.config = this.buildConfig();
    }

    detectEnvironment() {
        // Check if we're in development
        if (window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.port === '8888') {
            return 'development';
        }

        // Check if it's a Netlify preview
        if (window.location.hostname.includes('deploy-preview') ||
            window.location.hostname.includes('branch-deploy')) {
            return 'staging';
        }

        return 'production';
    }

    buildConfig() {
        const baseConfig = {
            // Application metadata
            app: {
                name: 'Symphony Dashboard',
                version: '2.0.0',
                description: 'Advanced analytics dashboard for symphony ticket sales',
                author: 'Symphony Organization'
            },

            // Performance and budget goals
            performance: {
                defaultOccupancyGoal: 85, // percentage
                defaultBudgetGoal: 100000, // dollars
                defaultCapacity: 2500,

                // Performance-specific goals (can be overridden per performance)
                goals: new Map(),

                // KPI thresholds
                thresholds: {
                    excellent: 95,
                    good: 85,
                    warning: 70,
                    critical: 50
                }
            },

            // Sales curve analytics
            salesCurve: {
                // Expected sales progression over time (weeks before performance)
                expectedProgression: [
                    { week: 10, percentage: 5 },
                    { week: 9, percentage: 8 },
                    { week: 8, percentage: 12 },
                    { week: 7, percentage: 18 },
                    { week: 6, percentage: 25 },
                    { week: 5, percentage: 35 },
                    { week: 4, percentage: 48 },
                    { week: 3, percentage: 62 },
                    { week: 2, percentage: 78 },
                    { week: 1, percentage: 90 },
                    { week: 0, percentage: 100 }
                ],
                historicalProgression: [
                    {week: 6, percentage: 27},
                    {week: 5, percentage: 30},
                    {week: 4, percentage: 33},
                    {week: 3, percentage: 39},
                    {week: 2, percentage: 46},
                    {week: 1, percentage: 59},
                    {week: 0, percentage: 100}
                ],

                // Alternative progression models
                models: {
                    conservative: 'expectedProgression',
                    aggressive: 'aggressiveProgression',
                    seasonal: 'seasonalProgression'
                },

                defaultModel: 'expectedProgression'
            },

            // Chart styling and dimensions
            charts: {
                colors: {
                    // Primary colors
                    primary: '#667eea',
                    secondary: '#764ba2',

                    // Data visualization colors
                    singleTickets: '#1f77b4',
                    subscriptionTickets: '#ff7f0e',
                    onTrackLine: '#2ca02c',
                    actualSales: '#d62728',
                    budgetGoal: '#9467bd',
                    occupancyGoal: '#8c564b',

                    // Status colors
                    success: '#28a745',
                    warning: '#ffc107',
                    danger: '#dc3545',
                    info: '#17a2b8',

                    // Chart palette
                    palette: [
                        '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728',
                        '#9467bd', '#8c564b', '#e377c2', '#7f7f7f',
                        '#bcbd22', '#17becf'
                    ]
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
                    easing: 'd3.easeQuadInOut'
                },

                responsive: {
                    enabled: true,
                    breakpoints: {
                        mobile: 768,
                        tablet: 1024,
                        desktop: 1200
                    }
                }
            },

            // API configuration
            api: {
                endpoints: {
                    auth: '/.netlify/functions/auth',
                    verifyToken: '/.netlify/functions/verify-token',
                    dashboardData: '/.netlify/functions/dashboard-data',
                    refreshData: '/.netlify/functions/refresh-data'
                },

                timeout: 30000, // 30 seconds
                retries: 3,
                retryDelay: 1000,

                cache: {
                    enabled: true,
                    ttl: 300000, // 5 minutes
                    maxSize: 100
                },

                rateLimit: {
                    requests: 100,
                    window: 60000 // 1 minute
                }
            },

            // User interface settings
            ui: {
                theme: {
                    primary: '#667eea',
                    secondary: '#764ba2',
                    background: '#f8f9fa',
                    surface: '#ffffff',
                    text: '#333333',
                    textSecondary: '#666666'
                },

                animations: {
                    enabled: true,
                    duration: {
                        short: 200,
                        medium: 500,
                        long: 1000
                    }
                },

                notifications: {
                    duration: 5000,
                    position: 'top-right',
                    maxVisible: 3
                },

                tables: {
                    pageSize: 25,
                    pageSizes: [10, 25, 50, 100],
                    sortable: true,
                    filterable: true
                }
            },

            // Security settings
            security: {
                tokenExpiry: 24 * 60 * 60 * 1000, // 24 hours
                sessionTimeout: 30 * 60 * 1000,   // 30 minutes
                maxLoginAttempts: 5,
                lockoutDuration: 15 * 60 * 1000,  // 15 minutes

                contentSecurityPolicy: {
                    enabled: true,
                    directives: {
                        'default-src': ["'self'"],
                        'script-src': ["'self'", "'unsafe-inline'", 'https://d3js.org'],
                        'style-src': ["'self'", "'unsafe-inline'"],
                        'img-src': ["'self'", 'data:'],
                        'connect-src': ["'self'", '/.netlify/functions/']
                    }
                }
            },

            // Feature flags
            features: {
                enableDataExport: true,
                enableRealTimeUpdates: false,
                enableAdvancedAnalytics: true,
                enableUserPreferences: true,
                enableErrorReporting: true,
                enablePerformanceMonitoring: true
            },

            // Development settings
            development: {
                enableDebugMode: false,
                enableMockData: false, // Try real API first
                showPerformanceMetrics: false,
                logLevel: 'info'
            },

            // API settings
            api: {
                mockDataEnabled: false, // Try real data first, fallback to mock
                timeout: 30000,
                retries: 3
            }
        };

        // Environment-specific overrides
        const envConfig = this.getEnvironmentConfig();
        return this.mergeConfigs(baseConfig, envConfig);
    }

    getEnvironmentConfig() {
        switch (this.environment) {
            case 'development':
                return {
                    development: {
                        enableDebugMode: true,
                        logLevel: 'debug',
                        showPerformanceMetrics: true
                    },
                    api: {
                        timeout: 10000,
                        cache: {
                            ttl: 10000 // 10 seconds for development
                        }
                    }
                };

            case 'staging':
                return {
                    development: {
                        enableDebugMode: true,
                        logLevel: 'info'
                    }
                };

            case 'production':
                return {
                    development: {
                        enableDebugMode: false,
                        logLevel: 'warn'
                    },
                    security: {
                        contentSecurityPolicy: {
                            enabled: true
                        }
                    }
                };

            default:
                return {};
        }
    }

    mergeConfigs(base, override) {
        const result = { ...base };

        for (const [key, value] of Object.entries(override)) {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                result[key] = this.mergeConfigs(result[key] || {}, value);
            } else {
                result[key] = value;
            }
        }

        return result;
    }

    // Get configuration value with dot notation
    get(path, defaultValue = null) {
        const keys = path.split('.');
        let current = this.config;

        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                return defaultValue;
            }
        }

        return current;
    }

    // Set configuration value
    set(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let current = this.config;

        for (const key of keys) {
            if (!(key in current)) {
                current[key] = {};
            }
            current = current[key];
        }

        current[lastKey] = value;
    }

    // Update performance goals for specific performance
    setPerformanceGoal(performanceId, goals) {
        this.config.performance.goals.set(performanceId, goals);
    }

    getPerformanceGoal(performanceId) {
        return this.config.performance.goals.get(performanceId) || {
            occupancyGoal: this.config.performance.defaultOccupancyGoal,
            budgetGoal: this.config.performance.defaultBudgetGoal
        };
    }

    // Get environment info
    getEnvironment() {
        return this.environment;
    }

    isProduction() {
        return this.environment === 'production';
    }

    isDevelopment() {
        return this.environment === 'development';
    }

    // Export configuration for debugging
    exportConfig() {
        return JSON.parse(JSON.stringify(this.config));
    }

    // Validate configuration
    validate() {
        const errors = [];

        // Check required sections
        const requiredSections = ['app', 'performance', 'charts', 'api'];
        for (const section of requiredSections) {
            if (!this.config[section]) {
                errors.push(`Missing required configuration section: ${section}`);
            }
        }

        // Validate numeric values
        if (this.config.performance?.defaultOccupancyGoal < 0 ||
            this.config.performance?.defaultOccupancyGoal > 100) {
            errors.push('defaultOccupancyGoal must be between 0 and 100');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}

// Create and export global configuration instance
const appConfig = new AppConfig();

// Validate configuration on startup
const validation = appConfig.validate();
if (!validation.valid) {
    console.error('Configuration validation failed:', validation.errors);
}

// Export for global use
if (typeof window !== 'undefined') {
    window.CONFIG = appConfig.config;
    window.appConfig = appConfig;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = appConfig;
}