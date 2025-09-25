/**
 * Symphony Dashboard Framework
 * Core framework for modular architecture with dependency injection and lifecycle management
 */

class SymphonyFramework {
    constructor() {
        this.modules = new Map();
        this.services = new Map();
        this.state = 'uninitialized';
        this.config = null;
        this.eventBus = null;
        this.registry = null;

        // Lifecycle hooks
        this.hooks = {
            beforeInit: [],
            afterInit: [],
            beforeStart: [],
            afterStart: [],
            beforeStop: [],
            afterStop: [],
            beforeDestroy: [],
            afterDestroy: []
        };
    }

    /**
     * Initialize the framework
     * @param {Object} config - Framework configuration
     */
    async init(config = {}) {
        if (this.state !== 'uninitialized') {
            throw new Error(`Framework already initialized (state: ${this.state})`);
        }

        this.config = {
            // Default configuration
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
            },
            ...config
        };

        try {
            await this.runHooks('beforeInit');

            // Initialize core services
            await this.initEventBus();
            await this.initRegistry();
            await this.initLogger();

            this.state = 'initialized';
            this.log('info', 'Framework initialized successfully');

            await this.runHooks('afterInit');

        } catch (error) {
            this.state = 'error';
            this.log('error', 'Framework initialization failed:', error);
            throw error;
        }
    }

    /**
     * Register a module with the framework
     * @param {string} name - Module name
     * @param {Function|Object} moduleClass - Module class or instance
     * @param {Object} config - Module configuration
     */
    registerModule(name, moduleClass, config = {}) {
        if (this.modules.has(name)) {
            throw new Error(`Module '${name}' already registered`);
        }

        const moduleInfo = {
            name,
            moduleClass,
            config,
            instance: null,
            state: 'registered',
            dependencies: []
        };

        this.modules.set(name, moduleInfo);
        this.log('debug', `Module '${name}' registered`);

        // Emit event for module registration
        if (this.eventBus) {
            this.eventBus.emit('module:registered', { name, config });
        }
    }

    /**
     * Register a service with the framework
     * @param {string} name - Service name
     * @param {Object} service - Service instance
     */
    registerService(name, service) {
        if (this.services.has(name)) {
            throw new Error(`Service '${name}' already registered`);
        }

        this.services.set(name, service);
        this.log('debug', `Service '${name}' registered`);

        if (this.eventBus) {
            this.eventBus.emit('service:registered', { name });
        }
    }

    /**
     * Get a registered service
     * @param {string} name - Service name
     * @returns {Object} Service instance
     */
    getService(name) {
        const service = this.services.get(name);
        if (!service) {
            throw new Error(`Service '${name}' not found`);
        }
        return service;
    }

    /**
     * Get a registered module
     * @param {string} name - Module name
     * @returns {Object} Module instance
     */
    getModule(name) {
        const moduleInfo = this.modules.get(name);
        if (!moduleInfo) {
            throw new Error(`Module '${name}' not found`);
        }
        return moduleInfo.instance;
    }

    /**
     * Load and initialize all registered modules
     */
    async loadModules() {
        this.log('info', 'Loading modules...');

        // Sort modules by dependency order
        const loadOrder = this.resolveDependencies();

        for (const moduleName of loadOrder) {
            await this.loadModule(moduleName);
        }

        this.log('info', `Loaded ${loadOrder.length} modules`);
    }

    /**
     * Load and initialize a specific module
     * @param {string} name - Module name
     */
    async loadModule(name) {
        const moduleInfo = this.modules.get(name);
        if (!moduleInfo) {
            throw new Error(`Module '${name}' not registered`);
        }

        if (moduleInfo.state === 'loaded') {
            this.log('debug', `Module '${name}' already loaded`);
            return moduleInfo.instance;
        }

        try {
            this.log('debug', `Loading module '${name}'...`);

            // Create module instance
            const ModuleClass = moduleInfo.moduleClass;
            const instance = typeof ModuleClass === 'function'
                ? new ModuleClass(this)
                : ModuleClass;

            // Store instance
            moduleInfo.instance = instance;

            // Initialize module
            if (typeof instance.init === 'function') {
                await instance.init(moduleInfo.config);
            }

            moduleInfo.state = 'loaded';
            this.log('debug', `Module '${name}' loaded successfully`);

            if (this.eventBus) {
                this.eventBus.emit('module:loaded', { name });
            }

            return instance;

        } catch (error) {
            moduleInfo.state = 'error';
            this.log('error', `Failed to load module '${name}':`, error);
            throw error;
        }
    }

    /**
     * Start all loaded modules
     */
    async start() {
        if (this.state !== 'initialized') {
            throw new Error(`Framework not initialized (state: ${this.state})`);
        }

        try {
            await this.runHooks('beforeStart');

            // Load modules if not already loaded
            await this.loadModules();

            // Start modules
            for (const [name, moduleInfo] of this.modules) {
                if (moduleInfo.instance && typeof moduleInfo.instance.start === 'function') {
                    this.log('debug', `Starting module '${name}'...`);
                    await moduleInfo.instance.start();
                    moduleInfo.state = 'started';
                }
            }

            this.state = 'started';
            this.log('info', 'Framework started successfully');

            await this.runHooks('afterStart');

        } catch (error) {
            this.state = 'error';
            this.log('error', 'Framework start failed:', error);
            throw error;
        }
    }

    /**
     * Stop the framework and all modules
     */
    async stop() {
        if (this.state !== 'started') {
            this.log('warn', `Framework not started (state: ${this.state})`);
            return;
        }

        try {
            await this.runHooks('beforeStop');

            // Stop modules in reverse order
            const moduleNames = Array.from(this.modules.keys()).reverse();
            for (const name of moduleNames) {
                const moduleInfo = this.modules.get(name);
                if (moduleInfo.instance && typeof moduleInfo.instance.stop === 'function') {
                    this.log('debug', `Stopping module '${name}'...`);
                    await moduleInfo.instance.stop();
                    moduleInfo.state = 'stopped';
                }
            }

            this.state = 'stopped';
            this.log('info', 'Framework stopped');

            await this.runHooks('afterStop');

        } catch (error) {
            this.log('error', 'Framework stop failed:', error);
            throw error;
        }
    }

    /**
     * Destroy the framework and cleanup resources
     */
    async destroy() {
        try {
            await this.runHooks('beforeDestroy');

            if (this.state === 'started') {
                await this.stop();
            }

            // Destroy modules
            for (const [name, moduleInfo] of this.modules) {
                if (moduleInfo.instance && typeof moduleInfo.instance.destroy === 'function') {
                    this.log('debug', `Destroying module '${name}'...`);
                    await moduleInfo.instance.destroy();
                }
            }

            // Clear registrations
            this.modules.clear();
            this.services.clear();

            this.state = 'destroyed';
            this.log('info', 'Framework destroyed');

            await this.runHooks('afterDestroy');

        } catch (error) {
            this.log('error', 'Framework destroy failed:', error);
            throw error;
        }
    }

    /**
     * Add lifecycle hook
     * @param {string} hook - Hook name
     * @param {Function} callback - Hook callback
     */
    addHook(hook, callback) {
        if (!this.hooks[hook]) {
            throw new Error(`Unknown hook: ${hook}`);
        }
        this.hooks[hook].push(callback);
    }

    /**
     * Run lifecycle hooks
     * @param {string} hook - Hook name
     */
    async runHooks(hook) {
        if (!this.hooks[hook]) return;

        for (const callback of this.hooks[hook]) {
            try {
                await callback(this);
            } catch (error) {
                this.log('error', `Hook '${hook}' failed:`, error);
            }
        }
    }

    /**
     * Resolve module dependencies and return load order
     * @returns {Array} Module names in dependency order
     */
    resolveDependencies() {
        const resolved = [];
        const visiting = new Set();
        const visited = new Set();

        const visit = (name) => {
            if (visited.has(name)) return;
            if (visiting.has(name)) {
                throw new Error(`Circular dependency detected involving module '${name}'`);
            }

            visiting.add(name);

            const moduleInfo = this.modules.get(name);
            if (moduleInfo && moduleInfo.dependencies) {
                for (const dep of moduleInfo.dependencies) {
                    if (!this.modules.has(dep)) {
                        throw new Error(`Module '${name}' depends on unregistered module '${dep}'`);
                    }
                    visit(dep);
                }
            }

            visiting.delete(name);
            visited.add(name);
            resolved.push(name);
        };

        for (const name of this.modules.keys()) {
            visit(name);
        }

        return resolved;
    }

    /**
     * Initialize EventBus
     */
    async initEventBus() {
        this.eventBus = new SymphonyEventBus(this.config.events);
        this.registerService('eventBus', this.eventBus);
    }

    /**
     * Initialize Registry
     */
    async initRegistry() {
        this.registry = new SymphonyRegistry(this);
        this.registerService('registry', this.registry);
    }

    /**
     * Initialize Logger
     */
    async initLogger() {
        // Use existing logger if available, or create basic one
        if (window.Logger) {
            this.registerService('logger', window.Logger);
        } else {
            this.registerService('logger', console);
        }
    }

    /**
     * Log message
     * @param {string} level - Log level
     * @param {string} message - Message
     * @param {...any} args - Additional arguments
     */
    log(level, message, ...args) {
        const logger = this.services.get('logger') || console;
        const logMethod = logger[level] || logger.log;
        logMethod.call(logger, `[Framework] ${message}`, ...args);
    }
}

/**
 * Event Bus for inter-module communication
 */
class SymphonyEventBus {
    constructor(config = {}) {
        this.events = new Map();
        this.maxListeners = config.maxListeners || 100;
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     */
    on(event, handler) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }

        const handlers = this.events.get(event);
        if (handlers.length >= this.maxListeners) {
            console.warn(`Event '${event}' has reached max listeners (${this.maxListeners})`);
        }

        handlers.push(handler);
    }

    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     */
    off(event, handler) {
        const handlers = this.events.get(event);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    emit(event, data) {
        const handlers = this.events.get(event);
        if (handlers) {
            for (const handler of handlers) {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Event handler error for '${event}':`, error);
                }
            }
        }
    }

    /**
     * Subscribe to an event once
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     */
    once(event, handler) {
        const onceHandler = (data) => {
            handler(data);
            this.off(event, onceHandler);
        };
        this.on(event, onceHandler);
    }
}

/**
 * Registry for service and module discovery
 */
class SymphonyRegistry {
    constructor(framework) {
        this.framework = framework;
    }

    /**
     * Find services by interface or capability
     * @param {string|Function} criteria - Search criteria
     * @returns {Array} Matching services
     */
    findServices(criteria) {
        const matches = [];
        for (const [name, service] of this.framework.services) {
            if (this.matches(service, criteria)) {
                matches.push({ name, service });
            }
        }
        return matches;
    }

    /**
     * Find modules by capability
     * @param {string|Function} criteria - Search criteria
     * @returns {Array} Matching modules
     */
    findModules(criteria) {
        const matches = [];
        for (const [name, moduleInfo] of this.framework.modules) {
            if (moduleInfo.instance && this.matches(moduleInfo.instance, criteria)) {
                matches.push({ name, module: moduleInfo.instance });
            }
        }
        return matches;
    }

    /**
     * Check if service/module matches criteria
     * @param {Object} target - Target to check
     * @param {string|Function} criteria - Criteria to match
     * @returns {boolean} Whether it matches
     */
    matches(target, criteria) {
        if (typeof criteria === 'string') {
            return target.constructor.name.includes(criteria) ||
                   (target.capabilities && target.capabilities.includes(criteria));
        }
        if (typeof criteria === 'function') {
            return criteria(target);
        }
        return false;
    }
}

/**
 * Base Module class for standardized module interface
 */
class SymphonyModule {
    constructor(framework) {
        this.framework = framework;
        this.config = null;
        this.state = 'uninitialized';
        this.dependencies = [];
    }

    // Lifecycle methods (to be overridden by subclasses)
    async init(config) {
        this.config = config;
        this.state = 'initialized';
    }

    async start() {
        this.state = 'started';
    }

    async stop() {
        this.state = 'stopped';
    }

    async destroy() {
        this.state = 'destroyed';
    }

    // Dependency management
    getDependencies() {
        return this.dependencies;
    }

    // Service access
    getService(name) {
        return this.framework.getService(name);
    }

    // Module access
    getModule(name) {
        return this.framework.getModule(name);
    }

    // Event handling
    emit(event, data) {
        const eventBus = this.getService('eventBus');
        eventBus.emit(event, data);
    }

    on(event, handler) {
        const eventBus = this.getService('eventBus');
        eventBus.on(event, handler);
    }

    off(event, handler) {
        const eventBus = this.getService('eventBus');
        eventBus.off(event, handler);
    }

    // Logging
    log(level, message, ...args) {
        const logger = this.getService('logger');
        const logMethod = logger[level] || logger.log;
        logMethod.call(logger, `[${this.constructor.name}] ${message}`, ...args);
    }
}

// Export classes for global access
window.SymphonyFramework = SymphonyFramework;
window.SymphonyModule = SymphonyModule;
window.SymphonyEventBus = SymphonyEventBus;
window.SymphonyRegistry = SymphonyRegistry;