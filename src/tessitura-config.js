class TessituraConfig {
    constructor() {
        // Check if we're in a Node.js environment for server-side credentials
        this.isServerSide = typeof process !== 'undefined' && process.env;

        console.log('🚀 TessituraConfig constructor - checking CONFIG:', typeof CONFIG !== 'undefined' ? CONFIG : 'CONFIG not available yet');

        // Client-side configuration (populated from server or local config)
        this.config = {
            baseUrl: '',
            authentication: {
                method: 'basic', // 'token', 'basic', 'oauth'
                token: '',
                username: '',
                password: '',
                apiKey: ''
            },
            // Required Tessitura parameters
            userGroup: '',
            machineLocation: '',
            endpoints: {
                // System endpoints for testing - correct path for your API
                diagnostics: '/Diagnostics/Status',

                // Future endpoints - not used until diagnostics works
                performanceSearch: '/TXN/Performances/Search',
                performanceDetails: '/TXN/Performances/{id}',
                orders: '/TXN/Orders',
                constituents: '/CRM/Constituents/{id}'
            },
            cache: {
                enabled: true,
                duration: 300000, // 5 minutes
                keys: {
                    performances: 'tessitura_performances',
                    sales: 'tessitura_sales',
                    revenue: 'tessitura_revenue'
                }
            },
            rateLimiting: {
                enabled: true,
                maxRequests: 100,
                windowMs: 60000 // 1 minute
            },
            retryConfig: {
                maxRetries: 3,
                retryDelay: 1000,
                backoffMultiplier: 2
            }
        };

        this.loadConfiguration();
    }

    loadConfiguration() {
        // Try to load from environment variables (server-side)
        if (this.isServerSide) {
            this.loadFromEnvironment();
        }

        // Try to load from localStorage (client-side persistence)
        this.loadFromLocalStorage();

        // Load from global config if available
        this.loadFromGlobalConfig();
    }

    loadFromEnvironment() {
        if (!this.isServerSide) return;

        const env = process.env;

        if (env.TESSITURA_BASE_URL) {
            this.config.baseUrl = env.TESSITURA_BASE_URL;
        }

        if (env.TESSITURA_TOKEN) {
            this.config.authentication.method = 'token';
            this.config.authentication.token = env.TESSITURA_TOKEN;
        } else if (env.TESSITURA_USERNAME && env.TESSITURA_PASSWORD) {
            this.config.authentication.method = 'basic';
            this.config.authentication.username = env.TESSITURA_USERNAME;
            this.config.authentication.password = env.TESSITURA_PASSWORD;
        }

        if (env.TESSITURA_API_KEY) {
            this.config.authentication.apiKey = env.TESSITURA_API_KEY;
        }

        if (env.TESSITURA_USERGROUP) {
            this.config.userGroup = env.TESSITURA_USERGROUP;
        }

        if (env.TESSITURA_LOCATION) {
            this.config.machineLocation = env.TESSITURA_LOCATION;
        }

        if (env.CACHE_DURATION) {
            this.config.cache.duration = parseInt(env.CACHE_DURATION, 10);
        }

        if (env.TESSITURA_RATE_LIMIT) {
            this.config.rateLimiting.maxRequests = parseInt(env.TESSITURA_RATE_LIMIT, 10);
        }
    }

    loadFromLocalStorage() {
        if (typeof localStorage === 'undefined') return;

        try {
            const stored = localStorage.getItem('tessitura_config');
            if (stored) {
                const parsed = JSON.parse(stored);
                Object.assign(this.config, parsed);
            }
        } catch (error) {
            console.warn('Failed to load Tessitura config from localStorage:', error);
        }
    }

    loadFromGlobalConfig() {
        // Integration with existing CONFIG object
        console.log('🔍 loadFromGlobalConfig called');
        console.log('📋 CONFIG available:', typeof CONFIG !== 'undefined');
        console.log('🎯 CONFIG.tessitura available:', typeof CONFIG !== 'undefined' && CONFIG.tessitura);

        if (typeof CONFIG !== 'undefined' && CONFIG.tessitura) {
            console.log('📥 Loading Tessitura config from global CONFIG:', CONFIG.tessitura);

            // Update base configuration
            this.config.baseUrl = CONFIG.tessitura.baseUrl || this.config.baseUrl;
            this.config.userGroup = CONFIG.tessitura.userGroup || this.config.userGroup;
            this.config.machineLocation = CONFIG.tessitura.machineLocation || this.config.machineLocation;

            // Update authentication
            if (CONFIG.tessitura.authentication) {
                Object.assign(this.config.authentication, CONFIG.tessitura.authentication);
            }

            console.log('✅ Configuration loaded:', {
                baseUrl: this.config.baseUrl,
                userGroup: this.config.userGroup,
                machineLocation: this.config.machineLocation,
                authMethod: this.config.authentication.method,
                hasUsername: !!this.config.authentication.username,
                hasPassword: !!this.config.authentication.password
            });
        } else {
            console.log('⚠️ CONFIG or CONFIG.tessitura not available, using defaults');
        }
    }

    // Method to manually reload configuration (for debugging)
    reloadConfiguration() {
        console.log('🔄 Manually reloading configuration...');
        this.loadConfiguration();
        return this.config;
    }

    // Method to update configuration (for admin interface)
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
        this.saveToLocalStorage();
        return this.config;
    }

    saveToLocalStorage() {
        if (typeof localStorage === 'undefined') return;

        try {
            // Don't save sensitive credentials to localStorage in production
            const safeConfig = { ...this.config };
            if (this.config.authentication.method !== 'token') {
                delete safeConfig.authentication.password;
            }

            localStorage.setItem('tessitura_config', JSON.stringify(safeConfig));
        } catch (error) {
            console.warn('Failed to save Tessitura config to localStorage:', error);
        }
    }

    // Get configuration for API calls
    getConfig() {
        return { ...this.config };
    }

    // Get authentication headers - Tessitura specific format
    getAuthHeaders() {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        // Tessitura uses Basic Auth with Username:UserGroup:MachineLocation:Password format
        if (this.config.authentication.username && this.config.authentication.password &&
            this.config.userGroup && this.config.machineLocation) {

            const tessituraAuth = `${this.config.authentication.username}:${this.config.userGroup}:${this.config.machineLocation}:${this.config.authentication.password}`;
            const credentials = btoa(tessituraAuth);
            headers['Authorization'] = `Basic ${credentials}`;
        }

        return headers;
    }

    // Build full URL for endpoint
    buildUrl(endpoint, params = {}) {
        let url = `${this.config.baseUrl}${endpoint}`;

        // Replace path parameters
        Object.keys(params).forEach(key => {
            url = url.replace(`{${key}}`, params[key]);
        });

        return url;
    }

    // Validate configuration
    isValid() {
        if (!this.config.baseUrl) {
            return { valid: false, error: 'Base URL is required' };
        }

        if (!this.config.userGroup) {
            return { valid: false, error: 'UserGroup is required for Tessitura API' };
        }

        if (!this.config.machineLocation) {
            return { valid: false, error: 'MachineLocation is required for Tessitura API' };
        }

        switch (this.config.authentication.method) {
            case 'token':
                if (!this.config.authentication.token) {
                    return { valid: false, error: 'Token is required for token authentication' };
                }
                break;

            case 'basic':
                if (!this.config.authentication.username || !this.config.authentication.password) {
                    return { valid: false, error: 'Username and password are required for basic authentication' };
                }
                break;

            case 'apikey':
                if (!this.config.authentication.apiKey) {
                    return { valid: false, error: 'API key is required for API key authentication' };
                }
                break;
        }

        return { valid: true };
    }

    // Test connection to Tessitura
    async testConnection() {
        console.log('🔍 Testing Tessitura connection...');

        try {
            const validation = this.isValid();
            if (!validation.valid) {
                console.error('❌ Configuration validation failed:', validation.error);
                throw new Error(validation.error);
            }

            const testUrl = this.buildUrl(this.config.endpoints.diagnostics);
            const headers = this.getAuthHeaders();

            // Show exact auth string for debugging
            const authString = `${this.config.authentication.username}:${this.config.userGroup}:${this.config.machineLocation}:${this.config.authentication.password}`;
            const encodedAuth = btoa(authString);

            console.log('🔗 Test URL:', testUrl);
            console.log('🔐 Auth string:', authString);
            console.log('🔒 Base64 encoded:', encodedAuth);
            console.log('📋 Full headers:', headers);
            console.log('📤 Making single test call to Diagnostics/Status...');

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(testUrl, {
                method: 'GET',
                headers: headers,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            console.log('📥 Response status:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unable to read error response');
                console.error('❌ API call failed:', {
                    status: response.status,
                    statusText: response.statusText,
                    errorBody: errorText
                });
                throw new Error(`HTTP ${response.status}: ${response.statusText}\n${errorText}`);
            }

            const responseData = await response.json().catch(async () => {
                const text = await response.text();
                console.log('📄 Non-JSON response:', text);
                return { rawResponse: text };
            });

            console.log('✅ Connection successful!');
            console.log('📊 Response data:', responseData);

            return {
                success: true,
                message: 'Successfully connected to Tessitura API',
                status: response.status,
                data: responseData,
                url: testUrl
            };
        } catch (error) {
            console.error('💥 Connection test failed:', error);
            return {
                success: false,
                message: `Connection failed: ${error.message}`,
                error: error.message,
                stack: error.stack
            };
        }
    }
}

// Global instance
const tessituraConfig = new TessituraConfig();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TessituraConfig, tessituraConfig };
}