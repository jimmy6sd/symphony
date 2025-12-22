# Symphony Dashboard - Project Instructions

Production analytics dashboard for Kansas City Symphony ticket sales with BigQuery integration.

---

## 🌐 **DEPLOYMENT**

### **URLs**
- **Production**: https://kcsdashboard.netlify.app (main branch)
- **Preview/Staging**: https://next--kcsdashboard.netlify.app (next branch)
- **Local Development**: http://localhost:8888

### **Netlify Deploy Contexts**
- `main` branch → Production
- `next` branch → Preview/Staging
- `feature/*` branches → Deploy previews

---

## 🔒 **AUTHENTICATION**

### **Basic HTTP Authentication**
- **Method**: Netlify Basic Auth via `_headers` file
- **Protected**: All dashboard pages (`/*`)
- **Open**: Function endpoints (`/.netlify/functions/*`)
- **Credentials**: Username: `kcsdashboard`, Password: in Netlify env var `SITE_PASSWORD`

### **Why Basic Auth?**
- ✅ Dashboard protected with HTTP authentication
- ✅ Functions remain accessible for API integrations
- ✅ Scheduled tasks and webhooks work without auth
- ✅ Simple to implement and maintain

### **Local Development**
- No authentication required for `npm run dev`
- Makes development faster and easier

---

## 🚀 **DEVELOPMENT WORKFLOW**

### **⚠️ CRITICAL RULES**
**NEVER push to git without explicit user permission**
- Always ask before running `git push` on ANY branch
- Show what will be pushed and get confirmation
- User must explicitly approve each push operation

### **Git Branch Strategy**
```
main         → Production (live site)
next         → Preview/staging for testing
feature/*    → Individual feature branches
```

### **Daily Development**
```bash
# Start new feature
npm run feature:start feature/your-feature-name

# Develop locally
npm run dev  # Runs at http://localhost:8888

# Test & commit
git add .
git commit -m "feat: description"
git push origin HEAD  # (with user approval)

# Deploy preview
git checkout next
git merge feature/your-feature-name
git push origin next  # (with user approval)

# Deploy production (after testing)
git checkout main
git merge next
git push origin main  # (with user approval)
```

### **Commit Conventions**
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code restructuring
- `docs:` - Documentation
- `style:` - Formatting

---

## 🏗️ **ARCHITECTURE**

### **Current Stack**
- **Frontend**: Vanilla JavaScript, D3.js visualizations
- **Backend**: Netlify Serverless Functions
- **Database**: Google BigQuery
- **Deployment**: Netlify (auto-deploy on push)
- **Authentication**: Basic HTTP Auth via Netlify

### **Data Flow**
```
Source PDFs/Excel → scripts/active/ → BigQuery
                                          ↓
                            Netlify Functions (bigquery-snapshots.js)
                                          ↓
                          Frontend (index.html + src/)
```

### **Key Components**
- `index.html` - Main dashboard page
- `src/data-service.js` - Frontend data fetching
- `netlify/functions/bigquery-snapshots.js` - Main API (queries BigQuery)
- `scripts/active/` - Data processing scripts (PDF → BigQuery)
- `data/source-files/` - Original source documents (PDFs, Excel, CSV)

### **No Local Data Caching**
- ✅ All runtime data pulled from BigQuery via API
- ✅ No local JSON files loaded at runtime
- ✅ 2-hour in-memory cache in serverless function (acceptable)
- ✅ Source files preserved for re-processing only

---

## 📊 **DATA PIPELINE**

### **Source Data**
1. **PDFs**: Tessitura Performance Sales Summary reports
2. **Excel**: Weekly sales reports from staff
3. **CSV**: BigQuery exports and manual tracking

### **Processing Scripts**
Located in `scripts/active/`:
- `process-pdf-bucket.js` - Import PDFs to BigQuery
- `parse-csv-and-populate-metadata.js` - Process CSV data
- `extract-bigquery-data.js` - Query and extract BigQuery data

See `scripts/README.md` for full script documentation.

### **BigQuery Tables**
- `performances` - Performance metadata (title, date, venue, capacity, budget)
- `performance_sales_snapshots` - Historical sales snapshots (daily imports)
- `performance_comparisons` - User-created performance comparisons

### **API Endpoints**
Main endpoint: `/.netlify/functions/bigquery-snapshots`

Actions:
- `get-initial-load` - Dashboard initial load (performances + week-over-week)
- `get-performances` - Get all performances with latest snapshot
- `get-performance-history` - Get full history for one performance
- `get-all-week-over-week` - Get W/W changes for all performances

---

## 🔧 **ENVIRONMENT SETUP**

### **Required Environment Variables**
```bash
# BigQuery - ALWAYS use kcsymphony project
GOOGLE_APPLICATION_CREDENTIALS=./symphony-bigquery-key.json  # (or JSON string)
GOOGLE_CLOUD_PROJECT_ID=kcsymphony
BIGQUERY_DATASET=symphony_dashboard

# ⚠️ CRITICAL: When running bq commands, ALWAYS specify the full table path:
# `kcsymphony.symphony_dashboard.table_name`

# Authentication
SITE_PASSWORD=<secure-password>  # For Basic Auth

# JWT (if using token-based endpoints)
JWT_SECRET=<random-secret>
```

### **Local Setup**
1. Clone repository
2. `npm install`
3. Create `.env` file with variables above
4. Place `symphony-bigquery-key.json` in project root
5. `npm run dev`

### **Netlify Setup**
1. Set environment variables in Netlify dashboard
2. Set deploy contexts (Production, Deploy Previews, Branch deploys)
3. Configure build command: `# no build needed`
4. Configure publish directory: `./`

---

## 📁 **PROJECT STRUCTURE**

```
symphony-dashboard/
├── index.html                      # Main dashboard page
├── login.html                      # Authentication page
├── src/                            # Frontend source code
│   ├── data-service.js            # Data fetching service
│   ├── components/                # UI components
│   └── charts/                    # D3.js chart components
├── styles/main.css                 # Styling
├── netlify/functions/              # Serverless backend
│   ├── bigquery-snapshots.js      # Main API (BigQuery queries)
│   ├── performance-comparisons.js # Comparisons API
│   └── auth.js                    # Authentication
├── scripts/                        # Data processing scripts
│   ├── active/                    # Currently used scripts
│   ├── archive/                   # Deprecated scripts
│   ├── diagnostic/                # Debugging tools
│   └── README.md                  # Script documentation
├── data/                           # Data storage
│   ├── source-files/              # Original PDFs, Excel, CSV
│   │   ├── pdfs/
│   │   ├── excel/
│   │   └── csv/
│   └── archive/                   # Archived runtime cache
├── docs/                           # Documentation
│   ├── ARCHITECTURE.md            # System architecture
│   ├── DEPLOYMENT.md              # Deployment guide
│   ├── DATA-FLOW-EXPLANATION.md   # Data flow details
│   └── archive/                   # Historical docs
├── CLAUDE.md                       # This file
└── README.md                       # Project README
```

---

## 🧪 **TESTING & DEBUGGING**

### **Test Dashboard Locally**
```bash
npm run dev
# Open http://localhost:8888
# Login with credentials (check with team)
```

### **Test BigQuery Connection**
```bash
node scripts/diagnostic/check-bigquery-status.js
```

### **Verify Data Quality**
```bash
node scripts/diagnostic/verify-all-snapshots.js
```

### **Common Issues**
1. **Dashboard not loading data** → Check BigQuery credentials in `.env`
2. **API errors** → Check Netlify function logs
3. **Missing performances** → Run `process-pdf-bucket.js` to import PDFs
4. **Stale data** → Call API with `?nocache=true` to bypass cache

---

## 📖 **ADDITIONAL DOCUMENTATION**

### **Active Documentation**
- `README.md` - Project overview and quick start
- `docs/ARCHITECTURE.md` - Detailed system architecture
- `docs/DEPLOYMENT.md` - Deployment procedures
- `docs/DATA-FLOW-EXPLANATION.md` - How data flows through system
- `docs/BIGQUERY-DATA-STRATEGY.md` - BigQuery design and strategy
- `docs/LONGITUDINAL-SALES-TRACKING.md` - Sales tracking implementation
- `docs/METADATA-MANAGEMENT.md` - Performance metadata management
- `docs/HISTORICAL-PDF-IMPORT-GUIDE.md` - How to import historical PDFs
- `scripts/README.md` - Script usage guide

### **Archived Documentation**
- `docs/archive/CLAUDE-historical-2024-11.md` - Historical project instructions
- `docs/archive/` - Implementation completion docs, bug fixes, planning docs

---

## 🎯 **QUICK REFERENCE**

### **Start Development**
```bash
npm run dev
```

### **Import New PDF Data**
```bash
node scripts/active/process-pdf-bucket.js
```

### **Check Data Status**
```bash
node scripts/diagnostic/check-bigquery-status.js
```

### **Deploy to Preview**
```bash
git checkout next
git merge feature/your-feature
git push origin next  # (with user approval)
```

### **Deploy to Production**
```bash
git checkout main
git merge next
git push origin main  # (with user approval)
```

---

## 💡 **CODING GUIDELINES**

- Do not add extra console logging unless absolutely necessary
- Always prefer editing existing files over creating new ones
- NEVER commit without user permission
- Use environment variables for all secrets
- Follow existing code style and patterns
- Add comments only where logic isn't self-evident
- Keep solutions simple and focused

---

## 📞 **SUPPORT**

For issues or questions:
1. Check `docs/` directory for detailed documentation
2. Review `scripts/README.md` for script usage
3. Check Netlify function logs for API errors
4. Review BigQuery console for data issues

---
