/**
 * Base component class for Symphony Dashboard
 * Provides common functionality for all components
 */
class BaseComponent {
    constructor(options = {}) {
        this.id = options.id || this.generateId();
        this.container = options.container;
        this.containerId = options.containerId;
        this.initialized = false;
        this.destroyed = false;

        // Event system
        this.events = new Map();

        // Lifecycle hooks
        this.hooks = {
            beforeInit: [],
            afterInit: [],
            beforeRender: [],
            afterRender: [],
            beforeDestroy: [],
            afterDestroy: []
        };

        // Setup error handling
        this.setupErrorHandling();

        // Auto-initialize if container is provided
        if (this.container || this.containerId) {
            this.init();
        }
    }

    generateId() {
        return `component-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    setupErrorHandling() {
        this.handleError = (error, context = 'Component Operation') => {
            if (window.errorHandler) {
                return window.errorHandler.handleError(error, `${this.constructor.name}: ${context}`);
            } else {
                console.error(`${this.constructor.name} Error:`, error);
                throw error;
            }
        };
    }

    // Lifecycle methods (to be overridden by subclasses)
    async init() {
        if (this.initialized || this.destroyed) {
            return this;
        }

        try {
            await this.runHooks('beforeInit');

            this.log('info', 'Initializing component');

            // Resolve container
            this.resolveContainer();

            // Initialize component
            await this.initialize();

            this.initialized = true;
            await this.runHooks('afterInit');

            this.log('info', 'Component initialized successfully');

            return this;
        } catch (error) {
            this.handleError(error, 'Initialization');
        }
    }

    async initialize() {
        // Override in subclasses
    }

    resolveContainer() {
        if (this.container) {
            return;
        }

        if (this.containerId) {
            const element = document.getElementById(this.containerId);
            if (!element) {
                throw new Error(`Container element with id "${this.containerId}" not found`);
            }
            this.container = element;
        } else {
            throw new Error('No container specified for component');
        }
    }

    async render(data = null) {
        if (!this.initialized || this.destroyed) {
            throw new Error('Component must be initialized before rendering');
        }

        try {
            await this.runHooks('beforeRender');

            this.log('debug', 'Rendering component', { data });

            // Actual rendering logic (override in subclasses)
            await this.renderContent(data);

            await this.runHooks('afterRender');

            this.log('debug', 'Component rendered successfully');

            return this;
        } catch (error) {
            this.handleError(error, 'Rendering');
        }
    }

    async renderContent(data) {
        // Override in subclasses
    }

    async destroy() {
        if (this.destroyed) {
            return;
        }

        try {
            await this.runHooks('beforeDestroy');

            this.log('info', 'Destroying component');

            // Remove event listeners
            this.removeAllEventListeners();

            // Clear container
            if (this.container) {
                this.container.innerHTML = '';
            }

            // Component-specific cleanup
            await this.cleanup();

            this.destroyed = true;
            this.initialized = false;

            await this.runHooks('afterDestroy');

            this.log('info', 'Component destroyed successfully');
        } catch (error) {
            this.handleError(error, 'Destruction');
        }
    }

    async cleanup() {
        // Override in subclasses for custom cleanup
    }

    // Hook system
    addHook(lifecycle, callback) {
        if (this.hooks[lifecycle]) {
            this.hooks[lifecycle].push(callback);
        }
    }

    async runHooks(lifecycle) {
        if (this.hooks[lifecycle]) {
            for (const callback of this.hooks[lifecycle]) {
                try {
                    await callback.call(this);
                } catch (error) {
                    this.log('error', `Hook ${lifecycle} failed:`, error);
                }
            }
        }
    }

    // Event system
    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event).push(callback);
    }

    off(event, callback) {
        if (this.events.has(event)) {
            const callbacks = this.events.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    emit(event, data = null) {
        if (this.events.has(event)) {
            const callbacks = this.events.get(event);
            callbacks.forEach(callback => {
                try {
                    callback.call(this, data);
                } catch (error) {
                    this.log('error', `Event callback for "${event}" failed:`, error);
                }
            });
        }
    }

    removeAllEventListeners() {
        this.events.clear();
    }

    // Utility methods
    log(level, message, ...args) {
        if (window.logger) {
            window.logger[level](`[${this.constructor.name}:${this.id}] ${message}`, ...args);
        } else {
            console[level](`[${this.constructor.name}:${this.id}] ${message}`, ...args);
        }
    }

    // DOM utilities
    createElement(tag, attributes = {}, content = '') {
        const element = document.createElement(tag);

        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'innerHTML') {
                element.innerHTML = value;
            } else if (key.startsWith('on')) {
                // Event listeners
                const eventName = key.substring(2).toLowerCase();
                element.addEventListener(eventName, value);
            } else {
                element.setAttribute(key, value);
            }
        });

        if (content) {
            element.innerHTML = content;
        }

        return element;
    }

    // State management
    setState(newState) {
        const oldState = this.state || {};
        this.state = { ...oldState, ...newState };
        this.emit('stateChange', { oldState, newState: this.state });
    }

    getState() {
        return this.state || {};
    }

    // Configuration access
    getConfig(path, defaultValue = null) {
        if (window.appConfig) {
            return window.appConfig.get(path, defaultValue);
        }
        return defaultValue;
    }

    // Validation helper
    validate(data, validator) {
        if (window.Validators && typeof window.Validators[validator] === 'function') {
            return window.Validators[validator](data);
        }
        return { valid: true };
    }

    // Async operation with error handling and retry
    async withErrorHandling(operation, context = 'Operation', maxRetries = 3) {
        if (window.errorHandler) {
            return window.errorHandler.retryOperation(operation, context, maxRetries);
        } else {
            return operation();
        }
    }

    // Check if component is ready
    isReady() {
        return this.initialized && !this.destroyed;
    }

    // Get component info for debugging
    getDebugInfo() {
        return {
            id: this.id,
            className: this.constructor.name,
            initialized: this.initialized,
            destroyed: this.destroyed,
            state: this.getState(),
            eventListeners: Array.from(this.events.keys()),
            container: this.container ? this.container.id || 'unnamed' : null
        };
    }
}

// Export for use throughout the application
if (typeof window !== 'undefined') {
    window.BaseComponent = BaseComponent;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BaseComponent;
}