# Symphony Dashboard - Project Instructions

KC Symphony ticket sales analytics dashboard. Netlify-hosted, BigQuery-backed, vanilla JS + D3.js frontend.

## CRITICAL RULES

- **NEVER push to git without explicit user permission**
- **NEVER commit without user permission**
- When running `bq` CLI commands, ALWAYS use full table path: `kcsymphony.symphony_dashboard.<table>`
- Do not add unnecessary console logging
- Prefer editing existing files over creating new ones
- Use environment variables for all secrets
- Follow existing code style and patterns

## DEPLOYMENT

- **Production**: https://kcsdashboard.netlify.app (`main` branch)
- **Staging**: https://next--kcsdashboard.netlify.app (`next` branch)
- **Local**: http://localhost:8888 (`npm run dev`)
- `feature/*` branches get Netlify deploy previews
- No build step — publish directory is `./`

## AUTHENTICATION

JWT-based auth via `/.netlify/functions/auth` with `login.html`.

- User submits credentials → auth function validates → returns JWT (24hr expiry)
- Token stored in sessionStorage, verified by `/.netlify/functions/verify-token`
- Protected routes configured via redirect rules in `netlify.toml`
- Local dev: no auth required

## PAGES & ROUTING

Routes defined in `netlify.toml`:

| Route | File | Purpose |
|---|---|---|
| `/` | `index.html` | Main dashboard (single tickets, subscriptions, annotations tabs) |
| `/login` | `login.html` | Auth gate |
| `/dashboard` | `dashboard.html` | Board presentation view (protected) |
| `/admin/edit/*` | `admin-edit.html` | Performance metadata editor |
| `/year-to-date` | `ytd-comparison.html` | YTD fiscal year comparison |
| `/excel.html` | `excel.html` | Excel export view |

`index.html` also handles client-side routes: `/subscriptions`, `/annotations`, `/performance/*`, `/p/*`, `/charts/*`, `/table/*`

## DATA FLOW

```
Tessitura PDF reports → Make.com automations → GCP Cloud Functions → BigQuery
                                                                        ↓
                                                        Netlify Functions (API layer)
                                                                        ↓
                                                          Frontend (D3.js dashboards)
```

### Cloud Functions (`cloud-functions/`)

Three GCP Cloud Functions receive webhooks from Make.com. Each has its own `package.json` and deploys independently:

- `pdf-webhook/` — Parses daily Tessitura PDF sales reports, backs up to GCS, inserts into BigQuery
- `subscription-webhook/` — Parses subscription/renewal PDFs (auto-detects legacy vs renewal format)
- `pdf-webhook-ptc/` — Processes Parker Ticket Center PDFs

### Netlify Functions (`netlify/functions/`)

| Function | Purpose |
|---|---|
| `auth.js` | JWT login (POST credentials → token) |
| `verify-token.js` | JWT validation |
| `bigquery-snapshots.js` | Main read API (initial load, performances, history, week-over-week, subscriptions) |
| `bigquery-data.js` | Performance data queries |
| `performance-annotations.js` | CRUD for performance annotations |
| `performance-comparisons.js` | Year-over-year comparison data |
| `update-performance-metadata.js` | Update title, series, venue, capacity, cancelled status |
| `update-metadata.js` | Legacy metadata updates |
| `performance-update.js` | Update performance records |
| `refresh-data.js` | Trigger data refresh |

## BIGQUERY

- **Project**: `kcsymphony`
- **Dataset**: `symphony_dashboard`

Key tables:
- `performances` — Performance metadata (title, date, venue, capacity, budget)
- `performance_sales_snapshots` — Daily single-ticket sales snapshots
- `subscription_sales_snapshots` — Subscription sales snapshots (legacy format)
- `subscription_renewal_snapshots` — Subscription renewal data (current format)
- `performance_comparisons` — User-created comparisons
- `performance_annotations` — User annotations on performances

## ENVIRONMENT VARIABLES

```bash
# BigQuery (JSON key file path OR inline JSON string)
GOOGLE_APPLICATION_CREDENTIALS=./symphony-bigquery-key.json
GOOGLE_CLOUD_PROJECT_ID=kcsymphony
BIGQUERY_DATASET=symphony_dashboard

# Auth
JWT_SECRET=<secret>
DASHBOARD_AUTH_USERNAME=<username>
DASHBOARD_AUTH_PASSWORD=<password>
```

## FRONTEND ARCHITECTURE

Vanilla JS with ES6 modules, no build step, no framework.

- `src/main.js` — Entry point, parallel script loading
- `src/data-service.js` — Central data fetching with request deduplication
- `src/config.js` — Colors, goals, API endpoints
- `src/components/` — UI components (dashboard-ui, annotations-manager, pipeline-status)
- `src/charts/` — D3.js visualizations (sales curves, data tables, subscription charts, YTD)
- `src/utils/` — Router, error handling, logging, sales projections
- `src/core/` — App framework and base component
- `lib/xlsx.full.min.js` — Vendored xlsx library for Excel export

## DEVELOPMENT

```bash
npm run dev                # Local dev server (port 8888)
```

### Commit conventions
`feat:` / `fix:` / `refactor:` / `docs:` / `style:`

### Branch strategy
`main` → production, `next` → staging, `feature/*` → dev branches

### Data processing scripts
Located in `scripts/active/` — see `scripts/README.md` for usage.
Key scripts: `process-pdf-bucket.js`, `import-comps.js`, `process-subscription-pdfs.js`

## DOCUMENTATION

See `docs/` for detailed guides:
- `ARCHITECTURE.md` — System design
- `DEPLOYMENT.md` — Deploy procedures
- `DATA-FLOW-EXPLANATION.md` — Full data pipeline
- `BIGQUERY-DATA-STRATEGY.md` — BigQuery design decisions
- `PDF-PARSING-RULES.md` — How PDFs are parsed (critical for webhook functions)
- `COMP-IMPORT-GUIDE.md` — Comp ticket import process
- `EXCEL-VIEW-COLUMNS.md` — Excel export column definitions
- `METADATA-MANAGEMENT.md` — Performance metadata workflows
- `HISTORICAL-PDF-IMPORT-GUIDE.md` — Historical PDF backfill
- `scripts/README.md` — Script usage guide
