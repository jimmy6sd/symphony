/**
 * Symphony Dashboard - Main Entry Point (ES6 Module Version)
 * Simplified loader with parallel script loading
 */

// Import ES6 utilities (loaded in parallel by browser)
import logger from './utils/logger.js';
import errorHandler from './utils/error-handler.js';
import Validators from './utils/validators.js';

// Make utilities available globally for backward compatibility
window.logger = logger;
window.errorHandler = errorHandler;
window.Validators = Validators;

// Scripts to load (non-ES6 modules for now)
const SCRIPTS_TO_LOAD = [
    '/src/utils/router.js',
    '/src/config.js',
    '/src/core/base-component.js',
    '/src/tessitura-config.js',
    '/src/tessitura-api.js',
    '/src/data-service.js',
    '/src/utils/sales-projections.js',
    '/src/charts/performance-chart.js',
    '/src/charts/sales-curve-chart.js',
    '/src/charts/ticket-type-chart.js',
    '/src/charts/data-table.js',
    '/src/admin-panel.js',
    '/src/components/pipeline-status.js',
    '/src/components/dashboard-ui.js',
    '/src/core/app.js'
];

// Helper: Load single script
function loadScript(src) {
    return new Promise((resolve, reject) => {
        // Check if already loaded
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.async = false; // Maintain order
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Failed to load: ${src}`));
        document.head.appendChild(script);
    });
}

// Helper: Load scripts in parallel groups
async function loadScriptsInParallel() {
    logger.info('Loading application scripts...');

    try {
        // Load all scripts in parallel (much faster than sequential)
        await Promise.all(SCRIPTS_TO_LOAD.map(loadScript));
        logger.info('All scripts loaded successfully');
    } catch (error) {
        logger.error('Failed to load scripts:', error);
        throw error;
    }
}

// Initialize application
async function initializeApp() {
    try {
        logger.info('Initializing Symphony Dashboard...');

        // Load scripts
        await loadScriptsInParallel();

        // Initialize app (if SymphonyApp class is available)
        if (window.SymphonyApp) {
            const app = new window.SymphonyApp();
            await app.init();
            window.symphonyApp = app;
            window.app = app;
            logger.info('Symphony Dashboard initialized successfully!');
        } else {
            logger.info('Dashboard UI is handling initialization');
        }

        // Hide loading indicator
        hideLoadingIndicator();

    } catch (error) {
        logger.error('Application initialization failed:', error);
        errorHandler.handleError(error, 'Application Initialization');
        hideLoadingIndicator();
        showInitializationError(error);
    }
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
                <h2 style="margin: 0 0 0.5rem 0;">Kansas City Symphony</h2>
                <p style="margin: 0; opacity: 0.8;">Loading dashboard...</p>
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

// Hide loading indicator
function hideLoadingIndicator() {
    const loading = document.getElementById('app-loading');
    if (loading) {
        loading.remove();
    }
}

// Show initialization error
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
                <h2 style="color: #dc3545; margin-bottom: 1rem;">Application Failed to Load</h2>
                <p style="color: #666; margin-bottom: 1rem;">
                    The Symphony Dashboard failed to initialize properly.
                </p>
                <details style="text-align: left; margin-bottom: 1rem;">
                    <summary style="cursor: pointer; color: #007bff;">Technical Details</summary>
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
                ">Reload Page</button>
            </div>
        </div>
    `;
    document.body.innerHTML = errorHtml;
}

// Global API for debugging
window.Symphony = {
    getApp: () => window.symphonyApp,
    reload: () => window.location.reload(),
    debug: () => window.symphonyApp?.getDebugInfo() || { status: 'not_initialized' },
    init: initializeApp,
    exportData: (format) => window.symphonyApp?.exportData(format),
    refresh: () => window.symphonyApp?.refreshData()
};

// Bootstrap on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        showLoadingIndicator();
        initializeApp();
    });
} else {
    showLoadingIndicator();
    initializeApp();
}
