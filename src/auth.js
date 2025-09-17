// Authentication and authorization manager
class AuthManager {
    constructor() {
        this.token = null;
        this.user = null;
        this.tokenExpiry = null;
    }

    // Check if user is authenticated
    isAuthenticated() {
        this.loadTokenFromStorage();

        if (!this.token || !this.tokenExpiry) {
            return false;
        }

        // Check if token is expired
        const now = new Date();
        const expiry = new Date(this.tokenExpiry);

        if (now >= expiry) {
            this.logout();
            return false;
        }

        return true;
    }

    // Load token from session storage
    loadTokenFromStorage() {
        this.token = sessionStorage.getItem('symphony_auth_token');
        this.tokenExpiry = sessionStorage.getItem('symphony_auth_expires');

        const userStr = sessionStorage.getItem('symphony_user');
        if (userStr) {
            try {
                this.user = JSON.parse(userStr);
            } catch (e) {
                console.error('Error parsing user data:', e);
            }
        }
    }

    // Get current user info
    getCurrentUser() {
        this.loadTokenFromStorage();
        return this.user;
    }

    // Get auth header for API requests
    getAuthHeader() {
        this.loadTokenFromStorage();
        if (!this.token) {
            return null;
        }
        return `Bearer ${this.token}`;
    }

    // Verify token with server
    async verifyToken() {
        if (!this.token) {
            return false;
        }

        try {
            const response = await fetch('/.netlify/functions/verify-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token: this.token })
            });

            const data = await response.json();
            return data.valid;
        } catch (error) {
            console.error('Token verification failed:', error);
            return false;
        }
    }

    // Logout user
    logout() {
        // Clear all auth data
        sessionStorage.removeItem('symphony_auth_token');
        sessionStorage.removeItem('symphony_auth_expires');
        sessionStorage.removeItem('symphony_user');

        this.token = null;
        this.user = null;
        this.tokenExpiry = null;

        // Redirect to login
        window.location.href = '/login.html';
    }

    // Redirect to login if not authenticated
    requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = '/login.html';
            return false;
        }
        return true;
    }

    // Make authenticated API request
    async apiRequest(url, options = {}) {
        const authHeader = this.getAuthHeader();

        if (!authHeader) {
            throw new Error('No authentication token available');
        }

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
            ...options.headers
        };

        const response = await fetch(url, {
            ...options,
            headers
        });

        // Handle auth errors
        if (response.status === 401) {
            console.warn('Authentication failed, redirecting to login');
            this.logout();
            throw new Error('Authentication expired');
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
            throw new Error(errorData.message || `Request failed with status ${response.status}`);
        }

        return response.json();
    }

    // Initialize auth check for protected pages
    init() {
        // Only run on dashboard pages (not login page)
        if (window.location.pathname.includes('login.html')) {
            return;
        }

        // Require authentication for dashboard
        if (!this.requireAuth()) {
            return;
        }

        // Verify token periodically
        this.startTokenVerification();

        // Add logout functionality to UI if needed
        this.setupLogoutHandlers();
    }

    // Start periodic token verification
    startTokenVerification() {
        // Verify token every 5 minutes
        setInterval(async () => {
            const isValid = await this.verifyToken();
            if (!isValid) {
                console.warn('Token verification failed, logging out');
                this.logout();
            }
        }, 5 * 60 * 1000);
    }

    // Setup logout handlers
    setupLogoutHandlers() {
        // Add logout button to header if it doesn't exist
        const header = document.querySelector('.dashboard-header');
        if (header && !document.getElementById('logout-button')) {
            const logoutButton = document.createElement('button');
            logoutButton.id = 'logout-button';
            logoutButton.className = 'logout-button';
            logoutButton.innerHTML = '🔓 Logout';
            logoutButton.style.cssText = `
                position: absolute;
                top: 1rem;
                right: 1rem;
                background: rgba(255, 255, 255, 0.2);
                color: white;
                border: 1px solid rgba(255, 255, 255, 0.3);
                padding: 0.5rem 1rem;
                border-radius: 5px;
                cursor: pointer;
                font-size: 0.9rem;
                transition: background-color 0.2s ease;
            `;

            logoutButton.addEventListener('mouseover', () => {
                logoutButton.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
            });

            logoutButton.addEventListener('mouseout', () => {
                logoutButton.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            });

            logoutButton.addEventListener('click', () => {
                if (confirm('Are you sure you want to logout?')) {
                    this.logout();
                }
            });

            header.style.position = 'relative';
            header.appendChild(logoutButton);
        }

        // Handle browser back/forward navigation
        window.addEventListener('pageshow', () => {
            if (!this.isAuthenticated()) {
                this.logout();
            }
        });
    }
}

// Create global auth manager instance
const authManager = new AuthManager();

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    authManager.init();
});

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.authManager = authManager;
}