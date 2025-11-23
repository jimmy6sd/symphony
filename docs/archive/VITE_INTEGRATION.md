# Vite Integration Guide for Symphony Dashboard

## Overview

This guide documents how to integrate Vite into the Symphony Dashboard while maintaining Netlify Functions compatibility.

## Key Learning: Use Netlify CLI, Not Vite Directly

**The critical insight:** When using `@netlify/vite-plugin`, you must run the development server through Netlify CLI, not Vite directly.

### Why?

- Running `npm run dev` (which runs `vite`) causes the Netlify plugin's middleware to intercept requests BEFORE Vite can transform them
- This results in the browser receiving raw JavaScript with bare imports like `import * as d3 from 'd3'`
- Browsers cannot resolve bare module specifiers, causing: `Failed to resolve module specifier "d3"`

### The Solution

Run `npm run dev:netlify` (which runs `netlify dev`) instead:
- Netlify CLI starts Vite as a child process on port 5173
- Netlify wraps it with its dev server on port 8888
- This properly coordinates Vite's module transformation with Netlify's middleware
- You get both Vite HMR AND Netlify Functions working correctly

## Implementation Steps

### 1. Install Dependencies

```bash
npm install vite @netlify/vite-plugin --save-dev
```

### 2. Create `vite.config.mjs`

```javascript
import { defineConfig } from 'vite';
import path from 'path';
import netlify from '@netlify/vite-plugin';

export default defineConfig({
  plugins: [netlify()],
  server: {
    port: 5173,
    strictPort: true,
  },
  optimizeDeps: {
    include: ['d3'],
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        login: path.resolve(__dirname, 'login.html'),
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@js': path.resolve(__dirname, './js'),
      '@styles': path.resolve(__dirname, './styles'),
    }
  }
});
```

### 3. Update `package.json` Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "dev:netlify": "netlify dev",
    "build": "vite build",
    "preview": "vite preview",
    "start": "vite"
  }
}
```

### 4. Update `src/main.js` to Use ES6 Imports

Change from dynamic script loading to static ES6 imports:

```javascript
/**
 * Symphony Dashboard - Main Entry Point (Vite Version)
 * Modern ES6 module system with Vite bundling
 */

// Import D3 first and make it globally available
import * as d3 from 'd3';
window.d3 = d3;

// Import utilities
import './utils/logger.js';
import './utils/error-handler.js';
import './utils/validators.js';
import './utils/router.js';

// Import configuration
import './config.js';

// Import core
import './core/base-component.js';

// Import application modules
import './data-service.js';
import './utils/sales-projections.js';

// Import charts
import './charts/performance-chart.js';
import './charts/sales-curve-chart.js';
import './charts/ticket-type-chart.js';
import './charts/data-table.js';

// Import components
import './components/pipeline-status.js';
import './components/dashboard-ui.js';

// Import app orchestrator
import './core/app.js';

// Initialize application
(async () => {
    let symphonyApp = null;

    // ... rest of initialization code
})();
```

### 5. Update `index.html`

Change the script tag to use `type="module"`:

```html
<!-- Symphony Dashboard - Vite Module Entry Point -->
<script type="module" src="/src/main.js"></script>
```

## Development Workflow

### Local Development

```bash
npm run dev:netlify
```

Access the app at: **http://localhost:8888**

**Important:**
- Do NOT use `npm run dev` (runs Vite directly)
- Always use `npm run dev:netlify` (runs through Netlify CLI)

### Building for Production

```bash
npm run build
```

Output will be in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## What NOT to Do

### ❌ Don't Run Vite Directly in Development

```bash
npm run dev  # ❌ This will cause module resolution errors
```

The `@netlify/vite-plugin` middleware will intercept requests before Vite transforms them, breaking module imports.

### ❌ Don't Disable the Netlify Plugin Middleware

You might be tempted to add `middleware: false` to the plugin config. **Don't do this.**

```javascript
// ❌ DON'T DO THIS
plugins: [netlify({ middleware: false })],
```

This breaks Netlify Functions access, which you need for BigQuery integration.

### ❌ Don't Add Individual D3 Imports to Chart Files

The legacy chart files use global `d3` from `window.d3`. You don't need to add `import * as d3 from 'd3'` to each chart file.

The single import in `main.js` that sets `window.d3 = d3` is sufficient.

## Common Issues

### Issue: "Failed to resolve module specifier 'd3'"

**Cause:** You're running `npm run dev` instead of `npm run dev:netlify`

**Solution:** Use `npm run dev:netlify` to run through Netlify CLI

### Issue: BigQuery Functions Not Working

**Cause:** The Netlify middleware is disabled

**Solution:** Ensure your `vite.config.mjs` has `plugins: [netlify()]` with no `middleware: false` option

### Issue: Port Already in Use

**Cause:** Multiple dev servers running

**Solution:**
```bash
npx kill-port 5173 8888
npm run dev:netlify
```

## Architecture Notes

### Why This Works

1. **Netlify CLI** starts on port 8888
2. It spawns **Vite** as a child process on port 5173
3. Netlify CLI proxies requests to Vite
4. Vite transforms ES6 modules and bare imports
5. Netlify middleware then adds its features (functions, redirects, etc.)
6. Browser receives properly transformed code

### File Structure

```
symphony-dashboard/
├── index.html              # Entry HTML (loads /src/main.js as module)
├── vite.config.mjs         # Vite configuration
├── netlify.toml            # Netlify configuration (unchanged)
├── package.json            # Updated with Vite scripts
├── src/
│   ├── main.js            # ES6 module entry point (uses imports)
│   ├── config.js          # App configuration
│   ├── data-service.js    # Data fetching
│   ├── charts/            # Chart components (use global d3)
│   ├── components/        # UI components
│   ├── core/              # Core application logic
│   └── utils/             # Utility functions
└── netlify/
    └── functions/         # Serverless functions (for BigQuery)
```

## Reference

- [Vite on Netlify Official Docs](https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/)
- [@netlify/vite-plugin on npm](https://www.npmjs.com/package/@netlify/vite-plugin)

## Summary

The key to Vite integration with Netlify is simple:

**Always use `npm run dev:netlify` for development, never `npm run dev`.**

This ensures proper coordination between Vite's module transformation and Netlify's platform features.
