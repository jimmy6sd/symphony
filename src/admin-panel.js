class AdminPanel {
    constructor() {
        this.isVisible = false;
        this.tessituraConfig = tessituraConfig;
        this.init();
    }

    init() {
        this.createAdminPanel();
        this.attachKeyboardShortcut();
    }

    createAdminPanel() {
        const panel = document.createElement('div');
        panel.id = 'admin-panel';
        panel.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 400px;
            max-height: 600px;
            background: white;
            border: 2px solid #667eea;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            z-index: 9999;
            display: none;
            overflow-y: auto;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        panel.innerHTML = this.getPanelHTML();
        document.body.appendChild(panel);

        this.attachEventListeners();
    }

    getPanelHTML() {
        const config = this.tessituraConfig.getConfig();
        const validation = this.tessituraConfig.isValid();

        return `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; color: #667eea;">🎼 Symphony Dashboard Admin</h3>
                <button id="close-admin-panel" style="background: none; border: none; font-size: 18px; cursor: pointer;">✕</button>
            </div>

            <!-- Connection Status -->
            <div style="margin-bottom: 20px; padding: 10px; border-radius: 4px; ${validation.valid ? 'background: #d4edda; color: #155724;' : 'background: #f8d7da; color: #721c24;'}">
                <strong>Status:</strong> ${validation.valid ? '✓ Configuration Valid' : '⚠ ' + validation.error}
            </div>

            <!-- Data Source Toggle -->
            <div style="margin-bottom: 20px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" id="mock-data-toggle" ${CONFIG.api.mockDataEnabled ? 'checked' : ''}>
                    <span>Use Mock Data (unchecked = live Tessitura data)</span>
                </label>
            </div>

            <!-- Tessitura Configuration -->
            <div style="margin-bottom: 20px;">
                <h4 style="margin: 10px 0; color: #495057;">Tessitura API Configuration</h4>

                <label style="display: block; margin-bottom: 10px;">
                    <strong>Base URL:</strong>
                    <input type="text" id="tessitura-url" value="${config.baseUrl}"
                           placeholder="https://your-tessitura.com/api"
                           style="width: 100%; padding: 6px; margin-top: 4px; border: 1px solid #ddd; border-radius: 4px;">
                </label>

                <label style="display: block; margin-bottom: 10px;">
                    <strong>Authentication Method:</strong>
                    <select id="auth-method" style="width: 100%; padding: 6px; margin-top: 4px; border: 1px solid #ddd; border-radius: 4px;">
                        <option value="token" ${config.authentication.method === 'token' ? 'selected' : ''}>Bearer Token</option>
                        <option value="basic" ${config.authentication.method === 'basic' ? 'selected' : ''}>Basic Auth</option>
                        <option value="apikey" ${config.authentication.method === 'apikey' ? 'selected' : ''}>API Key</option>
                    </select>
                </label>

                <div id="auth-fields">
                    ${this.getAuthFieldsHTML(config.authentication)}
                </div>

                <label style="display: block; margin-bottom: 10px;">
                    <strong>User Group:</strong>
                    <input type="text" id="tessitura-usergroup" value="${config.userGroup}"
                           placeholder="Your Tessitura user group"
                           style="width: 100%; padding: 6px; margin-top: 4px; border: 1px solid #ddd; border-radius: 4px;">
                </label>

                <label style="display: block; margin-bottom: 10px;">
                    <strong>Machine Location:</strong>
                    <input type="text" id="tessitura-machinelocation" value="${config.machineLocation}"
                           placeholder="Your Tessitura machine location"
                           style="width: 100%; padding: 6px; margin-top: 4px; border: 1px solid #ddd; border-radius: 4px;">
                </label>
            </div>

            <!-- Actions -->
            <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                <button id="test-connection"
                        style="flex: 1; padding: 8px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Test Connection
                </button>
                <button id="save-config"
                        style="flex: 1; padding: 8px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Save Config
                </button>
            </div>

            <!-- Cache Management -->
            <div style="margin-bottom: 20px;">
                <h4 style="margin: 10px 0; color: #495057;">Cache Management</h4>
                <div style="display: flex; gap: 10px;">
                    <button id="clear-cache"
                            style="flex: 1; padding: 6px; background: #ffc107; color: black; border: none; border-radius: 4px; cursor: pointer;">
                        Clear Cache
                    </button>
                    <button id="refresh-data"
                            style="flex: 1; padding: 6px; background: #17a2b8; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Refresh Data
                    </button>
                </div>
            </div>

            <!-- Debug Info -->
            <div id="debug-info" style="margin-top: 20px; padding: 10px; background: #f8f9fa; border-radius: 4px; font-size: 12px;">
                <strong>Debug Info:</strong><br>
                Mock Data: ${CONFIG.api.mockDataEnabled ? 'Enabled' : 'Disabled'}<br>
                Cache Enabled: ${config.cache.enabled ? 'Yes' : 'No'}<br>
                Rate Limiting: ${config.rateLimiting.enabled ? 'Yes' : 'No'}
            </div>

            <div style="margin-top: 15px; text-align: center; font-size: 12px; color: #6c757d;">
                Press Ctrl+Shift+A to toggle this panel
            </div>
        `;
    }

    getAuthFieldsHTML(auth) {
        switch (auth.method) {
            case 'token':
                return `
                    <label style="display: block; margin-bottom: 10px;">
                        <strong>Bearer Token:</strong>
                        <input type="password" id="auth-token" value="${auth.token || ''}"
                               placeholder="Your bearer token"
                               style="width: 100%; padding: 6px; margin-top: 4px; border: 1px solid #ddd; border-radius: 4px;">
                    </label>
                `;

            case 'basic':
                return `
                    <label style="display: block; margin-bottom: 10px;">
                        <strong>Username:</strong>
                        <input type="text" id="auth-username" value="${auth.username || ''}"
                               placeholder="Your username"
                               style="width: 100%; padding: 6px; margin-top: 4px; border: 1px solid #ddd; border-radius: 4px;">
                    </label>
                    <label style="display: block; margin-bottom: 10px;">
                        <strong>Password:</strong>
                        <input type="password" id="auth-password" value="${auth.password || ''}"
                               placeholder="Your password"
                               style="width: 100%; padding: 6px; margin-top: 4px; border: 1px solid #ddd; border-radius: 4px;">
                    </label>
                `;

            case 'apikey':
                return `
                    <label style="display: block; margin-bottom: 10px;">
                        <strong>API Key:</strong>
                        <input type="password" id="auth-apikey" value="${auth.apiKey || ''}"
                               placeholder="Your API key"
                               style="width: 100%; padding: 6px; margin-top: 4px; border: 1px solid #ddd; border-radius: 4px;">
                    </label>
                `;

            default:
                return '';
        }
    }

    attachEventListeners() {
        // Close panel
        document.getElementById('close-admin-panel').onclick = () => this.hide();

        // Auth method change
        document.getElementById('auth-method').onchange = (e) => {
            const authFields = document.getElementById('auth-fields');
            const mockAuth = { method: e.target.value };
            authFields.innerHTML = this.getAuthFieldsHTML(mockAuth);
        };

        // Mock data toggle
        document.getElementById('mock-data-toggle').onchange = (e) => {
            CONFIG.api.mockDataEnabled = e.target.checked;
            dataService.mockDataEnabled = e.target.checked;
            this.updateDebugInfo();
            dashboard.refreshData();
        };

        // Test connection
        document.getElementById('test-connection').onclick = async () => {
            const button = document.getElementById('test-connection');
            const originalText = button.textContent;
            button.textContent = 'Testing...';
            button.disabled = true;

            try {
                // Make sure config is saved first
                this.saveCurrentConfig();

                // Force reload configuration to make sure it's current
                tessituraConfig.reloadConfiguration();

                console.log('🔧 Current config after reload:', tessituraConfig.getConfig());

                const result = await dataService.testTessituraConnection();

                alert(result.success ?
                    '✓ Connection successful!\n' + JSON.stringify(result.data, null, 2) :
                    '✗ Connection failed: ' + result.message);
            } catch (error) {
                alert('✗ Connection test failed: ' + error.message);
            }

            button.textContent = originalText;
            button.disabled = false;
        };

        // Save config
        document.getElementById('save-config').onclick = () => {
            this.saveCurrentConfig();
            alert('Configuration saved!');
            this.updateDebugInfo();
        };

        // Clear cache
        document.getElementById('clear-cache').onclick = () => {
            tessituraAPI.clearCache();
            localStorage.removeItem('tessitura_config');
            alert('Cache cleared!');
        };

        // Refresh data
        document.getElementById('refresh-data').onclick = () => {
            dashboard.refreshData();
            alert('Data refresh initiated!');
        };
    }

    saveCurrentConfig() {
        const newConfig = {
            baseUrl: document.getElementById('tessitura-url').value,
            userGroup: document.getElementById('tessitura-usergroup').value,
            machineLocation: document.getElementById('tessitura-machinelocation').value,
            authentication: {
                method: document.getElementById('auth-method').value
            }
        };

        // Get auth fields based on method
        const authMethod = newConfig.authentication.method;
        switch (authMethod) {
            case 'token':
                newConfig.authentication.token = document.getElementById('auth-token')?.value || '';
                break;
            case 'basic':
                newConfig.authentication.username = document.getElementById('auth-username')?.value || '';
                newConfig.authentication.password = document.getElementById('auth-password')?.value || '';
                break;
            case 'apikey':
                newConfig.authentication.apiKey = document.getElementById('auth-apikey')?.value || '';
                break;
        }

        this.tessituraConfig.updateConfig(newConfig);
    }

    updateDebugInfo() {
        const debugInfo = document.getElementById('debug-info');
        if (debugInfo) {
            const config = this.tessituraConfig.getConfig();
            debugInfo.innerHTML = `
                <strong>Debug Info:</strong><br>
                Mock Data: ${CONFIG.api.mockDataEnabled ? 'Enabled' : 'Disabled'}<br>
                Cache Enabled: ${config.cache.enabled ? 'Yes' : 'No'}<br>
                Rate Limiting: ${config.rateLimiting.enabled ? 'Yes' : 'No'}
            `;
        }
    }

    attachKeyboardShortcut() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'A') {
                e.preventDefault();
                this.toggle();
            }
        });
    }

    show() {
        document.getElementById('admin-panel').style.display = 'block';
        this.isVisible = true;
    }

    hide() {
        document.getElementById('admin-panel').style.display = 'none';
        this.isVisible = false;
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
}

// Initialize admin panel when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    window.adminPanel = new AdminPanel();
});