/**
 * Centralized logging utility for Symphony Dashboard
 * Provides consistent logging across the application with different levels
 */
class Logger {
    constructor() {
        this.levels = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            DEBUG: 3
        };

        this.currentLevel = this.levels.INFO;
        this.enableConsole = true;
        this.logs = [];
        this.maxLogs = 1000;
    }

    setLevel(level) {
        if (typeof level === 'string') {
            this.currentLevel = this.levels[level.toUpperCase()] ?? this.levels.INFO;
        } else {
            this.currentLevel = level;
        }
    }

    _log(level, message, ...args) {
        if (level > this.currentLevel) return;

        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level: Object.keys(this.levels)[level],
            message,
            args
        };

        // Store in memory (limited)
        this.logs.push(logEntry);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        // Console output
        if (this.enableConsole) {
            const prefix = `[${timestamp}] [${logEntry.level}]`;
            switch (level) {
                case this.levels.ERROR:
                    console.error(prefix, message, ...args);
                    break;
                case this.levels.WARN:
                    console.warn(prefix, message, ...args);
                    break;
                case this.levels.INFO:
                    console.info(prefix, message, ...args);
                    break;
                case this.levels.DEBUG:
                    console.debug(prefix, message, ...args);
                    break;
            }
        }
    }

    error(message, ...args) {
        this._log(this.levels.ERROR, message, ...args);
    }

    warn(message, ...args) {
        this._log(this.levels.WARN, message, ...args);
    }

    info(message, ...args) {
        this._log(this.levels.INFO, message, ...args);
    }

    debug(message, ...args) {
        this._log(this.levels.DEBUG, message, ...args);
    }

    // Get recent logs for debugging
    getRecentLogs(count = 50) {
        return this.logs.slice(-count);
    }

    // Clear all logs
    clear() {
        this.logs = [];
    }

    // Export logs (for debugging or support)
    exportLogs() {
        const blob = new Blob([JSON.stringify(this.logs, null, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `symphony-dashboard-logs-${new Date().toISOString().split('T')[0]}.json`;
        link.click();

        URL.revokeObjectURL(url);
    }
}

// Create global logger instance
const logger = new Logger();

// Set level based on environment
if (typeof process !== 'undefined' && process.env) {
    const level = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
    logger.setLevel(level);
} else if (localStorage.getItem('debug') === 'true') {
    logger.setLevel('DEBUG');
}

// Export for use throughout the application
if (typeof window !== 'undefined') {
    window.logger = logger;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = logger;
}