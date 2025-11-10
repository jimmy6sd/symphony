/**
 * Data validation utilities for Symphony Dashboard
 * Provides consistent validation across the application
 */
class Validators {
    // Validate authentication token
    static isValidToken(token) {
        if (!token || typeof token !== 'string') {
            return false;
        }

        // JWT tokens have 3 parts separated by dots
        const parts = token.split('.');
        if (parts.length !== 3) {
            return false;
        }

        try {
            // Try to decode the payload (basic validation)
            const payload = JSON.parse(atob(parts[1]));
            return payload.exp && payload.iat;
        } catch {
            return false;
        }
    }

    // Validate performance data structure
    static isValidPerformanceData(data) {
        if (!data || typeof data !== 'object') {
            return { valid: false, error: 'Performance data must be an object' };
        }

        const requiredFields = ['id', 'title', 'date'];
        const missingFields = requiredFields.filter(field => !data[field]);

        if (missingFields.length > 0) {
            return {
                valid: false,
                error: `Missing required fields: ${missingFields.join(', ')}`
            };
        }

        // Validate date format
        if (!this.isValidDate(data.date)) {
            return {
                valid: false,
                error: 'Invalid date format'
            };
        }

        // Validate numeric fields if present
        const numericFields = ['capacity', 'singleTicketsSold', 'subscriptionTicketsSold', 'totalRevenue'];
        for (const field of numericFields) {
            if (data[field] !== undefined && !this.isValidNumber(data[field])) {
                return {
                    valid: false,
                    error: `Invalid ${field}: must be a non-negative number`
                };
            }
        }

        return { valid: true };
    }

    // Validate date string
    static isValidDate(dateString) {
        if (!dateString || typeof dateString !== 'string') {
            return false;
        }

        const date = new Date(dateString);
        return !isNaN(date.getTime()) && date.getTime() > 0;
    }

    // Validate number (must be non-negative)
    static isValidNumber(value) {
        return typeof value === 'number' &&
               !isNaN(value) &&
               isFinite(value) &&
               value >= 0;
    }

    // Validate percentage (0-100)
    static isValidPercentage(value) {
        return this.isValidNumber(value) && value >= 0 && value <= 100;
    }

    // Validate email address
    static isValidEmail(email) {
        if (!email || typeof email !== 'string') {
            return false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Validate username (alphanumeric + underscore, 3-50 chars)
    static isValidUsername(username) {
        if (!username || typeof username !== 'string') {
            return false;
        }

        const usernameRegex = /^[a-zA-Z0-9_]{3,50}$/;
        return usernameRegex.test(username);
    }

    // Validate password strength
    static validatePassword(password) {
        if (!password || typeof password !== 'string') {
            return { valid: false, error: 'Password is required' };
        }

        if (password.length < 8) {
            return { valid: false, error: 'Password must be at least 8 characters long' };
        }

        if (password.length > 128) {
            return { valid: false, error: 'Password must be less than 128 characters' };
        }

        const hasLowercase = /[a-z]/.test(password);
        const hasUppercase = /[A-Z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

        const criteriaMet = [hasLowercase, hasUppercase, hasNumbers, hasSpecialChar].filter(Boolean).length;

        if (criteriaMet < 2) {
            return {
                valid: false,
                error: 'Password must contain at least 2 of: lowercase, uppercase, numbers, special characters'
            };
        }

        return { valid: true };
    }

    // Validate configuration object
    static validateConfig(config) {
        if (!config || typeof config !== 'object') {
            return { valid: false, error: 'Configuration must be an object' };
        }

        // Check required sections
        const requiredSections = ['api', 'charts', 'performances'];
        const missingSections = requiredSections.filter(section => !config[section]);

        if (missingSections.length > 0) {
            return {
                valid: false,
                error: `Missing configuration sections: ${missingSections.join(', ')}`
            };
        }

        return { valid: true };
    }

    // Validate API response structure
    static validateApiResponse(response) {
        if (!response || typeof response !== 'object') {
            return { valid: false, error: 'Response must be an object' };
        }

        if (response.error) {
            return { valid: false, error: response.error };
        }

        return { valid: true };
    }

    // Validate chart data
    static validateChartData(data, chartType) {
        if (!Array.isArray(data)) {
            return { valid: false, error: 'Chart data must be an array' };
        }

        if (data.length === 0) {
            return { valid: false, error: 'Chart data cannot be empty' };
        }

        // Validate based on chart type
        switch (chartType) {
            case 'performance':
                return this.validatePerformanceChartData(data);
            case 'sales-curve':
                return this.validateSalesCurveData(data);
            case 'ticket-type':
                return this.validateTicketTypeData(data);
            default:
                return { valid: true }; // Generic validation passed
        }
    }

    // Validate performance chart data
    static validatePerformanceChartData(data) {
        for (const item of data) {
            const validation = this.isValidPerformanceData(item);
            if (!validation.valid) {
                return validation;
            }
        }
        return { valid: true };
    }

    // Validate sales curve data
    static validateSalesCurveData(data) {
        for (const item of data) {
            if (!item.weeklySales || !Array.isArray(item.weeklySales)) {
                return { valid: false, error: 'Each item must have weeklySales array' };
            }

            for (const weekData of item.weeklySales) {
                if (!this.isValidNumber(weekData.week) || !this.isValidNumber(weekData.sales)) {
                    return { valid: false, error: 'Invalid week or sales data' };
                }
            }
        }
        return { valid: true };
    }

    // Validate ticket type data
    static validateTicketTypeData(data) {
        for (const item of data) {
            if (!this.isValidNumber(item.singleTicketsSold) ||
                !this.isValidNumber(item.subscriptionTicketsSold)) {
                return { valid: false, error: 'Invalid ticket sales data' };
            }
        }
        return { valid: true };
    }

    // Sanitize HTML to prevent XSS
    static sanitizeHtml(str) {
        if (!str || typeof str !== 'string') {
            return '';
        }

        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Sanitize and validate URL
    static sanitizeUrl(url) {
        if (!url || typeof url !== 'string') {
            return null;
        }

        try {
            const urlObj = new URL(url);
            // Only allow http/https protocols
            if (!['http:', 'https:'].includes(urlObj.protocol)) {
                return null;
            }
            return urlObj.toString();
        } catch {
            return null;
        }
    }
}

// Backward compatibility - keep window assignment for non-module scripts
if (typeof window !== 'undefined') {
    window.Validators = Validators;
}

// ES6 module export
export { Validators };
export default Validators;