# Symphony Dashboard Architecture

## Overview

The Symphony Dashboard has been reorganized into a modern, maintainable architecture that follows best practices for vanilla JavaScript applications while preserving the lightweight, framework-free approach.

## Directory Structure

```
symphony-dashboard/
├── src/                          # Organized source code
│   ├── core/                     # Core application classes
│   │   ├── app.js               # Main application orchestrator
│   │   └── base-component.js    # Base class for all components
│   ├── config/                  # Configuration management
│   │   └── app-config.js        # Centralized configuration
│   ├── utils/                   # Utility functions and helpers
│   │   ├── logger.js           # Centralized logging system
│   │   ├── error-handler.js    # Global error handling
│   │   └── validators.js       # Data validation utilities
│   └── main.js                 # Application bootstrap and loader
├── js/                         # Legacy components (gradually migrating)
│   ├── auth.js                # Authentication manager
│   ├── data-service.js        # Data fetching and caching
│   ├── charts/                # D3.js chart components
│   │   ├── performance-chart.js
│   │   ├── sales-curve-chart.js
│   │   ├── ticket-type-chart.js
│   │   └── data-table.js
│   └── [other legacy files]
├── netlify/functions/          # Serverless backend
│   ├── auth.js                # JWT authentication
│   ├── verify-token.js        # Token validation
│   └── dashboard-data.js      # Secure data API
├── styles/                    # CSS stylesheets
├── data/                      # Data files and cache
└── docs/                      # Documentation
```

## Architecture Principles

### 1. **Separation of Concerns**
- **Core**: Application lifecycle and orchestration
- **Utils**: Reusable utility functions
- **Config**: Environment-specific configuration
- **Components**: UI components and charts
- **Services**: Data fetching and business logic

### 2. **Progressive Loading**
Scripts are loaded in a specific order to ensure dependencies are available:
1. **Utilities** (logger, error handler, validators)
2. **Configuration** (app config)
3. **Core** (base classes)
4. **Legacy Components** (existing js/ files)
5. **Application** (main orchestrator)

### 3. **Error Handling**
- Global error handling with user-friendly messages
- Centralized logging with multiple levels
- Automatic error reporting and retry mechanisms
- Graceful degradation on failures

### 4. **Configuration Management**
- Environment-aware configuration (dev/staging/prod)
- Centralized settings with dot notation access
- Runtime configuration updates
- Validation of configuration integrity

## Core Classes

### SymphonyApp
Main application orchestrator that:
- Manages component lifecycle
- Handles authentication
- Coordinates data loading
- Manages application state
- Provides event system

### BaseComponent
Base class for all components providing:
- Consistent lifecycle (init, render, destroy)
- Event system (on, off, emit)
- Error handling integration
- State management
- Hook system for extensibility

### Logger
Centralized logging system with:
- Multiple log levels (ERROR, WARN, INFO, DEBUG)
- Console output with timestamps
- In-memory log storage
- Export functionality for debugging

### ErrorHandler
Global error management providing:
- Unhandled error catching
- User-friendly error messages
- Retry mechanisms with exponential backoff
- Error statistics and reporting
- Notification system

### Validators
Data validation utilities for:
- Authentication tokens
- Performance data structures
- API responses
- Chart data
- XSS protection

## Component System

### Legacy Integration
The architecture maintains compatibility with existing components while providing a migration path:

```javascript
// Legacy component (existing)
class PerformanceChart {
    constructor(containerId) { /* ... */ }
    async init() { /* ... */ }
    render() { /* ... */ }
}

// Future component (extends BaseComponent)
class ModernChart extends BaseComponent {
    constructor(options) {
        super(options);
    }

    async initialize() { /* ... */ }
    async renderContent(data) { /* ... */ }
}
```

### Component Registration
Components are automatically discovered and managed by the main application:

```javascript
// Components are registered with the app
this.components.set('performanceChart', performanceChart);

// Access components
const chart = this.components.get('performanceChart');
```

## Data Flow

### Authentication Flow
1. Page loads → Check authentication status
2. If not authenticated → Redirect to login
3. Login → Generate JWT token
4. Store token → Load dashboard
5. API requests → Include Bearer token
6. Token expires → Auto-logout

### Data Loading Flow
1. App initializes → Check authentication
2. Load services (data service, etc.)
3. Initialize components → Components request data
4. Data service → Make authenticated API calls
5. API functions → Fetch from Tessitura (server-side)
6. Return data → Update components
7. Render visualizations

## Security Architecture

### Token-Based Authentication
- JWT tokens with expiration
- Server-side credential management
- Rate limiting on login attempts
- Automatic token refresh

### API Security
- All Tessitura credentials server-side only
- CORS protection
- Input validation and sanitization
- Content Security Policy headers

### Client-Side Security
- XSS protection through validation
- Secure token storage (sessionStorage)
- Automatic logout on token expiration
- No sensitive data in client code

## Configuration System

### Environment Detection
```javascript
// Automatic environment detection
const env = appConfig.getEnvironment(); // 'development', 'staging', 'production'

// Environment-specific settings
if (appConfig.isDevelopment()) {
    logger.setLevel('DEBUG');
}
```

### Configuration Access
```javascript
// Dot notation access
const apiTimeout = appConfig.get('api.timeout', 30000);
const chartColors = appConfig.get('charts.colors');

// Runtime updates
appConfig.set('features.enableDataExport', true);
```

## Event System

### Application Events
```javascript
// Listen for application events
symphonyApp.on('stateChange', (data) => {
    console.log('App state changed:', data);
});

// Emit custom events
symphonyApp.emit('dataRefresh', { timestamp: Date.now() });
```

### Component Events
```javascript
// Component lifecycle events
component.on('rendered', () => {
    console.log('Component rendered');
});

// Global event bus (future enhancement)
window.eventBus.emit('userAction', { action: 'export', format: 'csv' });
```

## Performance Optimizations

### Lazy Loading
- Components initialized only when needed
- Data table loaded only when tab is activated
- Scripts loaded asynchronously with proper ordering

### Caching
- API response caching with TTL
- Component state caching
- Configuration caching

### Error Recovery
- Automatic retry with exponential backoff
- Graceful degradation on failures
- Fallback to cached data when possible

## Development Guidelines

### Adding New Components

1. **Extend BaseComponent** (recommended):
```javascript
class NewComponent extends BaseComponent {
    async initialize() {
        // Component-specific initialization
    }

    async renderContent(data) {
        // Rendering logic
    }
}
```

2. **Register with Application**:
```javascript
// In app.js
const newComponent = new NewComponent({ containerId: 'new-container' });
await newComponent.init();
this.components.set('newComponent', newComponent);
```

### Adding New Utilities

1. **Create utility file** in `src/utils/`
2. **Export for global use**:
```javascript
// Export patterns
if (typeof window !== 'undefined') {
    window.MyUtility = MyUtility;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MyUtility;
}
```

3. **Add to load order** in `src/main.js`

### Configuration Changes

1. **Update base configuration** in `src/config/app-config.js`
2. **Add environment-specific overrides** if needed
3. **Use validation** to ensure configuration integrity

## Migration Path

### Phase 1: Core Infrastructure ✅ COMPLETE
- Utilities (logging, error handling, validation)
- Configuration system
- Base component class
- Application orchestrator

### Phase 2: Component Migration (Future)
- Migrate chart components to extend BaseComponent
- Add component-specific error handling
- Implement component state management

### Phase 3: Advanced Features (Future)
- Real-time data updates
- Advanced analytics features
- User preferences and customization
- Performance monitoring

## Debugging and Monitoring

### Debug Access
```javascript
// Global debug access
window.Symphony.debug(); // Get application state
window.Symphony.getApp(); // Get app instance
window.logger.getRecentLogs(); // Get recent logs
window.errorHandler.getErrorStats(); // Get error statistics
```

### Performance Monitoring
```javascript
// Enable performance metrics
appConfig.set('development.showPerformanceMetrics', true);

// Monitor component performance
performance.mark('component-init-start');
await component.init();
performance.mark('component-init-end');
```

This architecture provides a solid foundation for scaling the Symphony Dashboard while maintaining the benefits of a lightweight, framework-free approach.