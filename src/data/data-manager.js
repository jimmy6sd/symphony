/**
 * Data Manager
 * Orchestrates data operations across multiple providers and transformers
 */

class DataManager extends SymphonyModule {
    constructor(framework) {
        super(framework);
        this.dependencies = ['configService'];
        this.providers = new Map();
        this.transformers = new Map();
        this.cache = new Map();
        this.config = null;
    }

    async init(config) {
        await super.init(config);

        const configService = this.getService('configService');
        this.config = configService.get('data');

        // Initialize cache if enabled
        if (this.config.cache.enabled) {
            this.initCache();
        }

        // Register default providers
        await this.registerDefaultProviders();

        // Register default transformers
        await this.registerDefaultTransformers();

        this.log('info', 'Data Manager initialized with cache enabled:', this.config.cache.enabled);
    }

    /**
     * Register a data provider
     * @param {string} name - Provider name
     * @param {Object} provider - Provider instance
     */
    registerProvider(name, provider) {
        this.providers.set(name, provider);
        this.log('debug', `Data provider registered: ${name}`);
        this.emit('provider:registered', { name, provider });
    }

    /**
     * Register a data transformer
     * @param {string} name - Transformer name
     * @param {Object} transformer - Transformer instance
     */
    registerTransformer(name, transformer) {
        this.transformers.set(name, transformer);
        this.log('debug', `Data transformer registered: ${name}`);
        this.emit('transformer:registered', { name, transformer });
    }

    /**
     * Get performance data with automatic provider selection and transformation
     * @param {Object} options - Query options
     * @returns {Array} Performance data
     */
    async getPerformances(options = {}) {
        const cacheKey = this.generateCacheKey('performances', options);

        // Check cache first
        if (this.config.cache.enabled) {
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                this.log('debug', 'Returning cached performance data');
                return cached;
            }
        }

        try {
            // Get data from primary provider
            let data = await this.fetchFromProvider(this.config.sources.primary, 'performances', options);

            // If primary fails, try fallback
            if (!data && this.config.sources.fallback) {
                this.log('warn', 'Primary provider failed, trying fallback');
                data = await this.fetchFromProvider(this.config.sources.fallback, 'performances', options);
            }

            if (!data) {
                throw new Error('All data providers failed');
            }

            // Transform data to standard format
            const transformed = await this.transformData(data, 'performance');

            // Validate data if enabled
            if (this.config.validation.enabled) {
                this.validatePerformanceData(transformed);
            }

            // Cache the result
            if (this.config.cache.enabled) {
                this.setToCache(cacheKey, transformed);
            }

            this.emit('data:loaded', { type: 'performances', count: transformed.length });
            return transformed;

        } catch (error) {
            this.log('error', 'Failed to get performance data:', error);
            this.emit('data:error', { type: 'performances', error });
            throw error;
        }
    }

    /**
     * Get sales data for a specific performance
     * @param {string} performanceId - Performance ID
     * @param {Object} options - Query options
     * @returns {Object} Sales data
     */
    async getSalesData(performanceId, options = {}) {
        const cacheKey = this.generateCacheKey('sales', { performanceId, ...options });

        if (this.config.cache.enabled) {
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                this.log('debug', `Returning cached sales data for performance ${performanceId}`);
                return cached;
            }
        }

        try {
            const queryOptions = { performanceId, ...options };
            let data = await this.fetchFromProvider(this.config.sources.primary, 'sales', queryOptions);

            if (!data && this.config.sources.fallback) {
                data = await this.fetchFromProvider(this.config.sources.fallback, 'sales', queryOptions);
            }

            if (!data) {
                throw new Error(`No sales data found for performance ${performanceId}`);
            }

            // Transform sales data
            const transformed = await this.transformData(data, 'sales');

            if (this.config.cache.enabled) {
                this.setToCache(cacheKey, transformed);
            }

            this.emit('data:loaded', { type: 'sales', performanceId });
            return transformed;

        } catch (error) {
            this.log('error', `Failed to get sales data for performance ${performanceId}:`, error);
            this.emit('data:error', { type: 'sales', performanceId, error });
            throw error;
        }
    }

    /**
     * Refresh all cached data
     */
    async refreshData() {
        this.log('info', 'Refreshing all data...');

        try {
            // Clear cache
            if (this.config.cache.enabled) {
                this.clearCache();
            }

            // Refresh performance data
            const performances = await this.getPerformances({ forceRefresh: true });

            this.emit('data:refreshed', {
                type: 'all',
                performanceCount: performances.length
            });

            this.log('info', `Data refresh complete: ${performances.length} performances loaded`);
            return { performances };

        } catch (error) {
            this.log('error', 'Data refresh failed:', error);
            this.emit('data:refresh-error', { error });
            throw error;
        }
    }

    /**
     * Fetch data from a specific provider
     * @param {string} providerName - Provider name
     * @param {string} dataType - Type of data to fetch
     * @param {Object} options - Query options
     * @returns {*} Raw data from provider
     */
    async fetchFromProvider(providerName, dataType, options = {}) {
        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new Error(`Data provider not found: ${providerName}`);
        }

        this.log('debug', `Fetching ${dataType} from ${providerName} provider`);

        try {
            // Connect to provider if needed
            if (typeof provider.connect === 'function' && !provider.connected) {
                await provider.connect();
            }

            // Fetch data
            const data = await provider.fetch(dataType, options);

            this.log('debug', `Successfully fetched ${dataType} from ${providerName}`);
            return data;

        } catch (error) {
            this.log('warn', `Provider ${providerName} failed to fetch ${dataType}:`, error);
            return null;
        }
    }

    /**
     * Transform data using registered transformers
     * @param {*} data - Raw data
     * @param {string} dataType - Type of data
     * @returns {*} Transformed data
     */
    async transformData(data, dataType) {
        // Detect data format
        const format = this.detectDataFormat(data);
        const transformerKey = `${format}-${dataType}`;

        const transformer = this.transformers.get(transformerKey);
        if (!transformer) {
            this.log('warn', `No transformer found for ${transformerKey}, returning raw data`);
            return data;
        }

        this.log('debug', `Transforming data with ${transformerKey} transformer`);

        try {
            const transformed = await transformer.transform(data);
            this.log('debug', `Data transformation completed: ${transformerKey}`);
            return transformed;
        } catch (error) {
            this.log('error', `Data transformation failed: ${transformerKey}`, error);
            throw error;
        }
    }

    /**
     * Detect data format from structure
     * @param {*} data - Data to analyze
     * @returns {string} Detected format
     */
    detectDataFormat(data) {
        if (!data) return 'unknown';

        // KCS CSV format detection
        if (data.performances && Array.isArray(data.performances) && data.metadata) {
            return 'kcs-csv';
        }

        // Tessitura API format detection
        if (Array.isArray(data) && data.length > 0 && data[0].PerformanceId) {
            return 'tessitura';
        }

        // Dashboard format detection
        if (Array.isArray(data) && data.length > 0 && data[0].singleTicketsSold !== undefined) {
            return 'dashboard';
        }

        // Mock data format
        if (Array.isArray(data) && data.length > 0 && data[0].mockData === true) {
            return 'mock';
        }

        return 'unknown';
    }

    /**
     * Validate performance data
     * @param {Array} data - Performance data to validate
     */
    validatePerformanceData(data) {
        if (!Array.isArray(data)) {
            throw new Error('Performance data must be an array');
        }

        for (const [index, performance] of data.entries()) {
            const required = ['id', 'title', 'date', 'capacity'];
            for (const field of required) {
                if (performance[field] === undefined || performance[field] === null) {
                    const error = `Performance ${index} missing required field: ${field}`;
                    if (this.config.validation.strictMode) {
                        throw new Error(error);
                    } else {
                        this.log('warn', error);
                    }
                }
            }
        }

        this.log('debug', `Validated ${data.length} performances`);
    }

    /**
     * Initialize cache system
     */
    initCache() {
        this.cache = new Map();
        this.cacheMetadata = new Map();

        // Set up cache cleanup interval
        setInterval(() => {
            this.cleanupExpiredCache();
        }, 300000); // Clean up every 5 minutes

        this.log('debug', 'Cache system initialized');
    }

    /**
     * Generate cache key
     * @param {string} type - Data type
     * @param {Object} options - Query options
     * @returns {string} Cache key
     */
    generateCacheKey(type, options = {}) {
        const key = `${type}:${JSON.stringify(options)}`;
        return key.replace(/[^a-zA-Z0-9:_-]/g, '_');
    }

    /**
     * Get data from cache
     * @param {string} key - Cache key
     * @returns {*} Cached data or null
     */
    getFromCache(key) {
        if (!this.cache.has(key)) return null;

        const metadata = this.cacheMetadata.get(key);
        if (metadata && Date.now() > metadata.expires) {
            this.cache.delete(key);
            this.cacheMetadata.delete(key);
            return null;
        }

        return this.cache.get(key);
    }

    /**
     * Set data to cache
     * @param {string} key - Cache key
     * @param {*} data - Data to cache
     */
    setToCache(key, data) {
        const now = Date.now();
        const expires = now + this.config.cache.ttl;

        this.cache.set(key, data);
        this.cacheMetadata.set(key, {
            created: now,
            expires: expires,
            size: JSON.stringify(data).length
        });

        // Check cache size limit
        if (this.cache.size > this.config.cache.maxSize) {
            this.evictOldestCacheEntries();
        }
    }

    /**
     * Clear all cached data
     */
    clearCache() {
        this.cache.clear();
        this.cacheMetadata.clear();
        this.log('debug', 'Cache cleared');
    }

    /**
     * Clean up expired cache entries
     */
    cleanupExpiredCache() {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, metadata] of this.cacheMetadata) {
            if (now > metadata.expires) {
                this.cache.delete(key);
                this.cacheMetadata.delete(key);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            this.log('debug', `Cleaned up ${cleaned} expired cache entries`);
        }
    }

    /**
     * Evict oldest cache entries to maintain size limit
     */
    evictOldestCacheEntries() {
        const entries = Array.from(this.cacheMetadata.entries())
            .sort((a, b) => a[1].created - b[1].created);

        const toRemove = entries.slice(0, entries.length - this.config.cache.maxSize + 1);

        for (const [key] of toRemove) {
            this.cache.delete(key);
            this.cacheMetadata.delete(key);
        }

        this.log('debug', `Evicted ${toRemove.length} cache entries to maintain size limit`);
    }

    /**
     * Register default data providers
     */
    async registerDefaultProviders() {
        // Register providers when they become available
        this.on('provider:available', (data) => {
            this.registerProvider(data.name, data.provider);
        });

        // Request provider registration from modules
        this.emit('providers:request');
    }

    /**
     * Register default transformers
     */
    async registerDefaultTransformers() {
        // Register transformers when they become available
        this.on('transformer:available', (data) => {
            this.registerTransformer(data.name, data.transformer);
        });

        // Request transformer registration from modules
        this.emit('transformers:request');
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getCacheStats() {
        let totalSize = 0;
        let expiredCount = 0;
        const now = Date.now();

        for (const [key, metadata] of this.cacheMetadata) {
            totalSize += metadata.size;
            if (now > metadata.expires) {
                expiredCount++;
            }
        }

        return {
            entryCount: this.cache.size,
            totalSize,
            expiredCount,
            maxSize: this.config.cache.maxSize,
            ttl: this.config.cache.ttl
        };
    }

    /**
     * Get available providers
     * @returns {Array} Provider information
     */
    getProviders() {
        return Array.from(this.providers.entries()).map(([name, provider]) => ({
            name,
            connected: provider.connected || false,
            capabilities: provider.getCapabilities ? provider.getCapabilities() : []
        }));
    }

    /**
     * Get available transformers
     * @returns {Array} Transformer information
     */
    getTransformers() {
        return Array.from(this.transformers.keys());
    }
}

// Export for use in framework
window.DataManager = DataManager;