/**
 * Simple client-side router for clean URL navigation
 * Handles /performance/:code, /charts/:type, etc.
 *
 * @example
 * const router = new Router();
 * router.register('/performance/:code', (params) => {
 *   console.log('Performance:', params.code);
 * });
 * router.navigate('/performance/250903E');
 */
class Router {
  constructor() {
    this.routes = new Map();
    this.currentRoute = null;
    this.beforeNavigate = null;

    // Listen for browser back/forward
    window.addEventListener('popstate', () => {
      this.handleRoute(false); // Don't add to history on popstate
    });

    // Intercept link clicks with data-route attribute
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[data-route]');
      if (link) {
        e.preventDefault();
        const href = link.getAttribute('href');
        this.navigate(href);
      }
    });
  }

  /**
   * Register a route pattern with handler
   * @param {string} pattern - e.g., '/performance/:code'
   * @param {function} handler - Callback when route matches (receives params object)
   */
  register(pattern, handler) {
    const regex = this.patternToRegex(pattern);
    this.routes.set(pattern, { regex, handler, pattern });
  }

  /**
   * Convert route pattern to regex
   * /performance/:code -> /^\/performance\/([^\/]+)$/
   * /performance/:code/:view -> /^\/performance\/([^\/]+)\/([^\/]+)$/
   */
  patternToRegex(pattern) {
    const regexPattern = pattern
      .replace(/\//g, '\\/')              // Escape forward slashes
      .replace(/:([^\/]+)/g, '([^\\/]+)') // Named parameters
      .replace(/\*/g, '.*');               // Wildcards
    return new RegExp(`^${regexPattern}$`);
  }

  /**
   * Navigate to a new route (updates URL and triggers handler)
   * @param {string} path - Path to navigate to
   * @param {boolean} addToHistory - Whether to add to browser history (default: true)
   */
  navigate(path, addToHistory = true) {
    // Call beforeNavigate hook if set
    if (this.beforeNavigate) {
      const shouldContinue = this.beforeNavigate(path);
      if (shouldContinue === false) return;
    }

    if (addToHistory) {
      window.history.pushState({}, '', path);
    }
    this.handleRoute(addToHistory);
  }

  /**
   * Check current URL and execute matching route handler
   * @param {boolean} addToHistory - Whether this is from a navigation or popstate
   */
  handleRoute(addToHistory = true) {
    const path = window.location.pathname;

    // Try to match against registered routes
    for (const [pattern, route] of this.routes) {
      const match = path.match(route.regex);
      if (match) {
        const params = this.extractParams(pattern, match);
        this.currentRoute = { pattern, params, path };

        // Execute route handler
        try {
          route.handler(params);
        } catch (error) {
          console.error('Router: Error in route handler', error);
        }
        return;
      }
    }

    // No match - handle 404
    this.handleNotFound(path);
  }

  /**
   * Extract named parameters from regex match
   * Pattern: /performance/:code/:view
   * Match: ['/performance/250903E/sales-curve', '250903E', 'sales-curve']
   * Result: { code: '250903E', view: 'sales-curve' }
   */
  extractParams(pattern, match) {
    const paramNames = (pattern.match(/:([^\/]+)/g) || [])
      .map(p => p.substring(1)); // Remove the : prefix

    const params = {};
    paramNames.forEach((name, index) => {
      params[name] = match[index + 1];
    });

    return params;
  }

  /**
   * Handle 404 / not found
   * Default behavior: redirect to home
   */
  handleNotFound(path) {
    console.warn(`Router: No route found for ${path}, redirecting to home`);

    // Check if home route exists
    const homeRoute = this.routes.get('/');
    if (homeRoute) {
      // Navigate to home without adding to history (avoid loop)
      window.history.replaceState({}, '', '/');
      homeRoute.handler({});
    }
  }

  /**
   * Get current route info
   * @returns {object} Current route with pattern, params, path
   */
  getCurrentRoute() {
    return this.currentRoute;
  }

  /**
   * Set a hook to run before navigation
   * @param {function} fn - Function that receives path, returns false to cancel
   */
  setBeforeNavigate(fn) {
    this.beforeNavigate = fn;
  }

  /**
   * Generate a URL from pattern and params
   * @param {string} pattern - Route pattern like '/performance/:code'
   * @param {object} params - Parameters like { code: '250903E' }
   * @returns {string} Complete URL like '/performance/250903E'
   */
  buildURL(pattern, params) {
    let url = pattern;
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`:${key}`, value);
    });
    return url;
  }
}

// Create global router instance
if (typeof window !== 'undefined') {
  window.router = new Router();
}
