/**
 * Symphony Dashboard - Main Entry Point
 * Orchestrates the loading and initialization of the entire application
 */

(function() {
    'use strict';

    // Application instance
    let symphonyApp = null;

    // Loading order configuration
    const LOAD_ORDER = {
        // Core utilities (loaded first)
        utilities: [
            '/src/utils/logger.js',
            '/src/utils/error-handler.js',
            '/src/utils/validators.js'
        ],

        // Configuration
        config: [
            '/src/config.js'
        ],

        // Core classes
        core: [
            '/src/core/base-component.js'
        ],

        // Application modules (migrated from js/ to src/)
        modules: [
            '/src/auth.js',
            '/src/tessitura-config.js',
            '/src/tessitura-api.js',
            '/src/data-service.js',
            '/src/charts/performance-chart.js',
            '/src/charts/sales-curve-chart.js',
            '/src/charts/ticket-type-chart.js',
            '/src/charts/data-table.js',
            '/src/admin-panel.js'
        ],

        // Components
        components: [
            '/src/components/dashboard-ui.js'
        ],

        // Application orchestrator
        app: [
            '/src/core/app.js'
        ]
    };

    // Script loading utility
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            // Check if script is already loaded
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.async = false; // Maintain execution order

            script.onload = () => {
                console.debug(`✅ Loaded: ${src}`);
                resolve();
            };

            script.onerror = (error) => {
                console.error(`❌ Failed to load: ${src}`, error);
                reject(new Error(`Failed to load script: ${src}`));
            };

            document.head.appendChild(script);
        });
    }

    // Load scripts in sequence
    async function loadScripts(scripts) {
        for (const script of scripts) {
            await loadScript(script);
        }
    }

    // Load all script groups in order
    async function loadAllScripts() {
        console.log('🚀 Loading Symphony Dashboard Application...');

        try {
            // Load each group in sequence
            for (const [group, scripts] of Object.entries(LOAD_ORDER)) {
                console.log(`📦 Loading ${group} scripts...`);
                await loadScripts(scripts);
            }

            console.log('✅ All scripts loaded successfully');
        } catch (error) {
            console.error('❌ Failed to load scripts:', error);
            throw error;
        }
    }

    // Initialize the application
    async function initializeApplication() {
        try {
            console.log('🎯 Initializing Symphony Dashboard Application...');

            // Create application instance
            if (window.SymphonyApp) {
                symphonyApp = new window.SymphonyApp();
                await symphonyApp.init();

                // Make available globally for debugging
                window.symphonyApp = symphonyApp;
                window.app = symphonyApp; // Shorter alias

                console.log('🎉 Symphony Dashboard Application initialized successfully!');
            } else {
                throw new Error('SymphonyApp class not available');
            }
        } catch (error) {
            console.error('❌ Application initialization failed:', error);
            showInitializationError(error);
        }
    }

    // Show initialization error to user
    function showInitializationError(error) {
        const errorHtml = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: #f8f9fa;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            ">
                <div style="
                    background: white;
                    padding: 2rem;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    text-align: center;
                    max-width: 500px;
                ">
                    <h2 style="color: #dc3545; margin-bottom: 1rem;">
                        🚫 Application Failed to Load
                    </h2>
                    <p style="color: #666; margin-bottom: 1rem;">
                        The Symphony Dashboard failed to initialize properly.
                    </p>
                    <details style="text-align: left; margin-bottom: 1rem;">
                        <summary style="cursor: pointer; color: #007bff;">
                            Technical Details
                        </summary>
                        <pre style="
                            background: #f8f9fa;
                            padding: 1rem;
                            border-radius: 4px;
                            margin-top: 0.5rem;
                            overflow: auto;
                            font-size: 0.9rem;
                        ">${error.message}</pre>
                    </details>
                    <button onclick="window.location.reload()" style="
                        background: #007bff;
                        color: white;
                        border: none;
                        padding: 0.5rem 1rem;
                        border-radius: 4px;
                        cursor: pointer;
                    ">
                        Reload Page
                    </button>
                </div>
            </div>
        `;

        document.body.innerHTML = errorHtml;
    }

    // Show loading indicator
    function showLoadingIndicator() {
        const loadingHtml = `
            <div id="app-loading" style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            ">
                <div style="text-align: center; color: white;">
                    <div style="
                        width: 50px;
                        height: 50px;
                        border: 3px solid rgba(255,255,255,0.3);
                        border-top: 3px solid white;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 1rem;
                    "></div>
                    <h2 style="margin: 0 0 0.5rem 0;">Symphony Dashboard</h2>
                    <p style="margin: 0; opacity: 0.8;">Loading application...</p>
                </div>
                <style>
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            </div>
        `;

        document.body.insertAdjacentHTML('afterbegin', loadingHtml);
    }

    // Remove loading indicator
    function hideLoadingIndicator() {
        const loading = document.getElementById('app-loading');
        if (loading) {
            loading.remove();
        }
    }

    // Main bootstrap function
    async function bootstrap() {
        try {
            // Show loading indicator
            showLoadingIndicator();

            // Load all scripts
            await loadAllScripts();

            // Initialize application
            await initializeApplication();

            // Hide loading indicator
            hideLoadingIndicator();

        } catch (error) {
            console.error('❌ Bootstrap failed:', error);
            hideLoadingIndicator();
            showInitializationError(error);
        }
    }

    // Global API for debugging and external access
    window.Symphony = {
        // Get application instance
        getApp: () => symphonyApp,

        // Reload application
        reload: () => window.location.reload(),

        // Get debug information
        debug: () => {
            if (symphonyApp) {
                return symphonyApp.getDebugInfo();
            }
            return { status: 'not_initialized' };
        },

        // Manual initialization (for debugging)
        init: bootstrap,

        // Export data
        exportData: (format) => {
            if (symphonyApp) {
                return symphonyApp.exportData(format);
            }
        },

        // Refresh data
        refresh: () => {
            if (symphonyApp) {
                return symphonyApp.refreshData();
            }
        }
    };

    // Start the application when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        // DOM is already ready
        bootstrap();
    }

    // Handle page unload
    window.addEventListener('beforeunload', () => {
        if (symphonyApp) {
            console.log('🔄 Application shutting down');
        }
    });

})();