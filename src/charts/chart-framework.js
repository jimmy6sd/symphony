/**
 * Chart Framework
 * Standardized framework for chart components with common functionality
 */

class ChartFramework extends SymphonyModule {
    constructor(framework) {
        super(framework);
        this.charts = new Map();
        this.chartTypes = new Map();
        this.globalConfig = null;
    }

    async init(config) {
        await super.init(config);

        const configService = this.getService('configService');
        this.globalConfig = configService.get('charts');

        // Register default chart types
        this.registerDefaultChartTypes();

        this.log('info', 'Chart Framework initialized');
    }

    /**
     * Register a chart type
     * @param {string} name - Chart type name
     * @param {Function} chartClass - Chart class constructor
     * @param {Object} metadata - Chart metadata
     */
    registerChartType(name, chartClass, metadata = {}) {
        this.chartTypes.set(name, {
            name,
            chartClass,
            metadata: {
                description: '',
                dataTypes: [],
                capabilities: [],
                ...metadata
            }
        });

        this.log('debug', `Chart type registered: ${name}`);
        this.emit('chart-type:registered', { name, metadata });
    }

    /**
     * Create a chart instance
     * @param {string} type - Chart type name
     * @param {string|HTMLElement} container - Container element or selector
     * @param {Object} config - Chart configuration
     * @returns {Object} Chart instance
     */
    createChart(type, container, config = {}) {
        const chartType = this.chartTypes.get(type);
        if (!chartType) {
            throw new Error(`Unknown chart type: ${type}`);
        }

        // Resolve container element
        const containerElement = typeof container === 'string'
            ? document.querySelector(container)
            : container;

        if (!containerElement) {
            throw new Error('Chart container not found');
        }

        // Merge global and local configuration
        const finalConfig = this.mergeConfig(config, type);

        // Create chart instance
        const ChartClass = chartType.chartClass;
        const chart = new ChartClass(containerElement, finalConfig, this);

        // Generate unique ID
        const chartId = this.generateChartId(type);
        chart.id = chartId;

        // Register chart instance
        this.charts.set(chartId, chart);

        this.log('debug', `Chart created: ${type} (${chartId})`);
        this.emit('chart:created', { id: chartId, type, chart });

        return chart;
    }

    /**
     * Get a chart instance by ID
     * @param {string} id - Chart ID
     * @returns {Object} Chart instance
     */
    getChart(id) {
        return this.charts.get(id);
    }

    /**
     * Destroy a chart instance
     * @param {string} id - Chart ID
     */
    destroyChart(id) {
        const chart = this.charts.get(id);
        if (chart) {
            if (typeof chart.destroy === 'function') {
                chart.destroy();
            }
            this.charts.delete(id);
            this.log('debug', `Chart destroyed: ${id}`);
            this.emit('chart:destroyed', { id });
        }
    }

    /**
     * Get available chart types
     * @returns {Array} Chart type information
     */
    getChartTypes() {
        return Array.from(this.chartTypes.values()).map(({ name, metadata }) => ({
            name,
            ...metadata
        }));
    }

    /**
     * Find chart types that can handle specific data
     * @param {Array} data - Data to analyze
     * @returns {Array} Compatible chart types
     */
    findCompatibleChartTypes(data) {
        if (!Array.isArray(data) || data.length === 0) {
            return [];
        }

        const dataStructure = this.analyzeDataStructure(data);
        const compatible = [];

        for (const [name, { metadata }] of this.chartTypes) {
            if (this.isCompatible(dataStructure, metadata.dataTypes)) {
                compatible.push({ name, ...metadata });
            }
        }

        return compatible;
    }

    /**
     * Register default chart types
     */
    registerDefaultChartTypes() {
        // Chart types will be registered by individual chart modules
        this.on('chart-type:register-request', () => {
            this.emit('chart-types:available');
        });
    }

    /**
     * Merge configuration objects
     * @param {Object} config - Local configuration
     * @param {string} chartType - Chart type for defaults
     * @returns {Object} Merged configuration
     */
    mergeConfig(config, chartType) {
        const globalConfig = this.globalConfig || {};
        const typeDefaults = this.getTypeDefaults(chartType);

        return {
            ...globalConfig,
            ...typeDefaults,
            ...config,
            colors: {
                ...globalConfig.colors,
                ...typeDefaults.colors,
                ...config.colors
            },
            dimensions: {
                ...globalConfig.dimensions,
                ...typeDefaults.dimensions,
                ...config.dimensions
            }
        };
    }

    /**
     * Get default configuration for chart type
     * @param {string} chartType - Chart type name
     * @returns {Object} Default configuration
     */
    getTypeDefaults(chartType) {
        const defaults = {
            'performance-chart': {
                colors: {
                    primary: this.globalConfig?.colors?.singleTickets || '#1f77b4',
                    secondary: this.globalConfig?.colors?.subscriptionTickets || '#ff7f0e'
                },
                showLegend: true,
                showTooltips: true
            },
            'sales-curve-chart': {
                colors: {
                    actual: this.globalConfig?.colors?.actualSales || '#d62728',
                    target: this.globalConfig?.colors?.onTrackLine || '#2ca02c'
                },
                showProjection: true,
                animateEntry: true
            },
            'data-table': {
                pageSize: 50,
                sortable: true,
                filterable: true,
                exportable: true
            }
        };

        return defaults[chartType] || {};
    }

    /**
     * Generate unique chart ID
     * @param {string} type - Chart type
     * @returns {string} Unique ID
     */
    generateChartId(type) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 5);
        return `${type}-${timestamp}-${random}`;
    }

    /**
     * Analyze data structure
     * @param {Array} data - Data to analyze
     * @returns {Object} Data structure information
     */
    analyzeDataStructure(data) {
        if (!Array.isArray(data) || data.length === 0) {
            return { fields: [], types: [], count: 0 };
        }

        const sample = data[0];
        const fields = Object.keys(sample);
        const types = {};

        for (const field of fields) {
            const value = sample[field];
            if (typeof value === 'number') {
                types[field] = 'numeric';
            } else if (value instanceof Date || /^\d{4}-\d{2}-\d{2}/.test(value)) {
                types[field] = 'date';
            } else if (typeof value === 'string') {
                types[field] = 'categorical';
            } else if (typeof value === 'boolean') {
                types[field] = 'boolean';
            } else {
                types[field] = 'unknown';
            }
        }

        return {
            fields,
            types,
            count: data.length,
            hasNumericData: Object.values(types).includes('numeric'),
            hasDateData: Object.values(types).includes('date'),
            hasCategoricalData: Object.values(types).includes('categorical')
        };
    }

    /**
     * Check if data structure is compatible with chart requirements
     * @param {Object} dataStructure - Data structure
     * @param {Array} requirements - Chart data requirements
     * @returns {boolean} Is compatible
     */
    isCompatible(dataStructure, requirements = []) {
        if (requirements.length === 0) return true;

        return requirements.some(req => {
            switch (req) {
                case 'numeric':
                    return dataStructure.hasNumericData;
                case 'date':
                    return dataStructure.hasDateData;
                case 'categorical':
                    return dataStructure.hasCategoricalData;
                case 'timeseries':
                    return dataStructure.hasDateData && dataStructure.hasNumericData;
                default:
                    return dataStructure.fields.includes(req);
            }
        });
    }

    /**
     * Get chart framework statistics
     * @returns {Object} Framework statistics
     */
    getStats() {
        return {
            chartTypes: this.chartTypes.size,
            activeCharts: this.charts.size,
            chartInstances: Array.from(this.charts.keys())
        };
    }
}

/**
 * Base Chart Component
 * Standard interface and common functionality for all charts
 */
class BaseChart {
    constructor(container, config = {}, framework = null) {
        this.container = container;
        this.config = config;
        this.framework = framework;
        this.id = null;
        this.data = null;
        this.svg = null;
        this.state = 'uninitialized';
        this.eventHandlers = new Map();

        // Chart dimensions
        this.width = 0;
        this.height = 0;
        this.margin = config.dimensions?.margin || { top: 20, right: 30, bottom: 40, left: 50 };

        // Setup container
        this.setupContainer();

        // Initialize chart
        this.init();
    }

    /**
     * Initialize chart
     */
    init() {
        this.calculateDimensions();
        this.createSVG();
        this.setupEventListeners();
        this.state = 'initialized';
        this.emit('chart:initialized');
    }

    /**
     * Render chart with data
     * @param {Array} data - Data to render
     */
    async render(data) {
        this.data = data;
        this.state = 'rendering';
        this.emit('chart:render-start', { data });

        try {
            await this.renderChart(data);
            this.state = 'rendered';
            this.emit('chart:rendered', { data });
        } catch (error) {
            this.state = 'error';
            this.emit('chart:error', { error });
            throw error;
        }
    }

    /**
     * Update chart with new data
     * @param {Array} data - New data
     */
    async update(data) {
        this.data = data;
        this.emit('chart:update-start', { data });

        try {
            await this.updateChart(data);
            this.emit('chart:updated', { data });
        } catch (error) {
            this.emit('chart:error', { error });
            throw error;
        }
    }

    /**
     * Resize chart
     */
    resize() {
        this.calculateDimensions();
        this.resizeChart();
        this.emit('chart:resized');
    }

    /**
     * Destroy chart and cleanup
     */
    destroy() {
        this.removeEventListeners();
        if (this.svg) {
            this.svg.remove();
        }
        this.state = 'destroyed';
        this.emit('chart:destroyed');
    }

    /**
     * Setup container element
     */
    setupContainer() {
        if (!this.container) {
            throw new Error('Chart container is required');
        }

        // Add chart container class
        this.container.classList.add('symphony-chart');

        // Clear existing content
        this.container.innerHTML = '';
    }

    /**
     * Calculate chart dimensions
     */
    calculateDimensions() {
        const containerRect = this.container.getBoundingClientRect();

        this.width = Math.max(
            this.config.dimensions?.width || containerRect.width,
            this.config.dimensions?.minWidth || 300
        ) - this.margin.left - this.margin.right;

        this.height = Math.max(
            this.config.dimensions?.height || containerRect.height,
            this.config.dimensions?.minHeight || 200
        ) - this.margin.top - this.margin.bottom;
    }

    /**
     * Create SVG element
     */
    createSVG() {
        this.svg = d3.select(this.container)
            .append('svg')
            .attr('width', this.width + this.margin.left + this.margin.right)
            .attr('height', this.height + this.margin.top + this.margin.bottom)
            .append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Window resize handler
        this.resizeHandler = () => this.resize();
        window.addEventListener('resize', this.resizeHandler);
    }

    /**
     * Remove event listeners
     */
    removeEventListeners() {
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }
    }

    /**
     * Add event listener
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     */
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }

    /**
     * Remove event listener
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     */
    off(event, handler) {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    /**
     * Emit event
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    emit(event, data) {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            for (const handler of handlers) {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Chart event handler error for '${event}':`, error);
                }
            }
        }

        // Also emit to framework if available
        if (this.framework) {
            this.framework.emit(`chart:${event}`, { chartId: this.id, ...data });
        }
    }

    /**
     * Get chart configuration
     * @returns {Object} Current configuration
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Update chart configuration
     * @param {Object} newConfig - New configuration
     */
    setConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.emit('chart:config-updated', { config: this.config });
    }

    // Abstract methods to be implemented by subclasses
    async renderChart(data) {
        throw new Error('renderChart method must be implemented by subclass');
    }

    async updateChart(data) {
        throw new Error('updateChart method must be implemented by subclass');
    }

    resizeChart() {
        throw new Error('resizeChart method must be implemented by subclass');
    }
}

// Export classes for global access
window.ChartFramework = ChartFramework;
window.BaseChart = BaseChart;