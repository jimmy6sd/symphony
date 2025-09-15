/**
 * Centralized error handling utility for Symphony Dashboard
 * Provides consistent error handling across the application
 */
class ErrorHandler {
    constructor() {
        this.errorQueue = [];
        this.retryAttempts = new Map();
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second base delay

        this.setupGlobalErrorHandling();
    }

    // Setup global error handlers
    setupGlobalErrorHandling() {
        // Unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            logger.error('Unhandled promise rejection:', event.reason);
            this.handleError(event.reason, 'Unhandled Promise Rejection');
            event.preventDefault();
        });

        // Global JavaScript errors
        window.addEventListener('error', (event) => {
            logger.error('Global JavaScript error:', event.error);
            this.handleError(event.error, 'JavaScript Error');
        });
    }

    // Main error handling method
    handleError(error, context = 'Unknown', options = {}) {
        const errorInfo = this.createErrorInfo(error, context, options);

        logger.error(`Error in ${context}:`, errorInfo);

        // Store error for potential retry
        this.errorQueue.push(errorInfo);

        // Show user-friendly message
        this.showUserMessage(errorInfo);

        return errorInfo;
    }

    // Create standardized error information
    createErrorInfo(error, context, options) {
        const now = new Date().toISOString();

        return {
            id: this.generateErrorId(),
            timestamp: now,
            context,
            message: error?.message || String(error),
            stack: error?.stack,
            type: error?.constructor?.name || 'Unknown',
            userAgent: navigator.userAgent,
            url: window.location.href,
            userId: this.getCurrentUserId(),
            ...options
        };
    }

    // Generate unique error ID
    generateErrorId() {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Get current user ID for error tracking
    getCurrentUserId() {
        try {
            const user = sessionStorage.getItem('symphony_user');
            return user ? JSON.parse(user).username : 'anonymous';
        } catch {
            return 'anonymous';
        }
    }

    // Show user-friendly error message
    showUserMessage(errorInfo) {
        // Don't overwhelm user with too many error messages
        const recentErrors = this.errorQueue.filter(
            e => Date.now() - new Date(e.timestamp).getTime() < 5000
        );

        if (recentErrors.length > 3) {
            return; // Too many recent errors, don't show more
        }

        const message = this.getUserFriendlyMessage(errorInfo);
        this.displayNotification(message, 'error');
    }

    // Convert technical errors to user-friendly messages
    getUserFriendlyMessage(errorInfo) {
        const { message, context } = errorInfo;

        // Authentication errors
        if (message.includes('401') || message.includes('unauthorized')) {
            return 'Your session has expired. Please log in again.';
        }

        // Network errors
        if (message.includes('fetch') || message.includes('network')) {
            return 'Network connection issue. Please check your internet connection and try again.';
        }

        // Data loading errors
        if (context.includes('data') || context.includes('API')) {
            return 'Unable to load data. Please try refreshing the page.';
        }

        // Chart rendering errors
        if (context.includes('chart') || context.includes('visualization')) {
            return 'There was an issue displaying the chart. Data may be incomplete.';
        }

        // Generic fallback
        return 'Something went wrong. Please try again or contact support if the problem persists.';
    }

    // Display notification to user
    displayNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;

        // Style the notification
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            max-width: 400px;
            padding: 1rem;
            background: ${type === 'error' ? '#dc3545' : '#007bff'};
            color: white;
            border-radius: 5px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        `;

        // Add CSS animation
        if (!document.getElementById('notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'notification-styles';
            styles.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                .notification-close {
                    background: none;
                    border: none;
                    color: white;
                    cursor: pointer;
                    float: right;
                    font-size: 1.2rem;
                    margin-left: 10px;
                }
                .notification-content {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
            `;
            document.head.appendChild(styles);
        }

        // Add to DOM
        document.body.appendChild(notification);

        // Setup close button
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            notification.remove();
        });

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    // Retry failed operations
    async retryOperation(operation, context = 'Operation', maxRetries = this.maxRetries) {
        let attempts = 0;
        let lastError;

        while (attempts < maxRetries) {
            try {
                return await operation();
            } catch (error) {
                attempts++;
                lastError = error;

                logger.warn(`Retry attempt ${attempts}/${maxRetries} failed for ${context}:`, error.message);

                if (attempts < maxRetries) {
                    // Exponential backoff
                    const delay = this.retryDelay * Math.pow(2, attempts - 1);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        // All retries failed
        throw this.handleError(lastError, `${context} (after ${maxRetries} retries)`);
    }

    // Get error statistics
    getErrorStats() {
        const last24h = Date.now() - 24 * 60 * 60 * 1000;
        const recentErrors = this.errorQueue.filter(
            e => new Date(e.timestamp).getTime() > last24h
        );

        const errorsByType = {};
        const errorsByContext = {};

        recentErrors.forEach(error => {
            errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
            errorsByContext[error.context] = (errorsByContext[error.context] || 0) + 1;
        });

        return {
            totalErrors: this.errorQueue.length,
            recentErrors: recentErrors.length,
            errorsByType,
            errorsByContext,
            mostRecentError: this.errorQueue[this.errorQueue.length - 1]
        };
    }

    // Clear error queue
    clearErrors() {
        this.errorQueue = [];
        this.retryAttempts.clear();
    }

    // Export error log for support
    exportErrorLog() {
        const errorData = {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            errors: this.errorQueue,
            stats: this.getErrorStats()
        };

        const blob = new Blob([JSON.stringify(errorData, null, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `symphony-dashboard-errors-${new Date().toISOString().split('T')[0]}.json`;
        link.click();

        URL.revokeObjectURL(url);
    }
}

// Create global error handler instance
const errorHandler = new ErrorHandler();

// Export for use throughout the application
if (typeof window !== 'undefined') {
    window.errorHandler = errorHandler;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = errorHandler;
}