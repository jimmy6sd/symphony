# How Dashboard Data is Combined

## Current Data Flow (as of October 2025)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DATA SOURCES                                      │
└─────────────────────────────────────────────────────────────────────┘

1. Tessitura API (Production)                2. PDF Performance Sales Report
   ├── Performance metadata                     ├── Weekly sales progression
   ├── Venue information                        ├── Single vs subscription breakdown
   ├── Series assignments                       ├── Revenue data
   ├── Season data                              ├── Budget percentages
   └── Basic capacity info                      └── Actual ticket counts

             ↓                                              ↓

┌─────────────────────────────────────────────────────────────────────┐
│                    MERGING PROCESS                                   │
└─────────────────────────────────────────────────────────────────────┘

                          data/dashboard.json
                    (118 performances, manually created)

   Each performance has:
   ┌────────────────────────────────────────────────────────┐
   │ {                                                       │
   │   "id": "250903E",              ← Performance code     │
   │   "performanceId": 24090,       ← Tessitura API ID     │
   │   "title": "Morgan Freeman...", ← Tessitura API        │
   │   "series": "Special Event",    ← Tessitura API        │
   │   "date": "2025-09-03",         ← Tessitura API        │
   │   "venue": "HELZBERG HALL",     ← Tessitura API        │
   │   "season": "25-26 Special",    ← Tessitura API        │
   │   "capacity": 1419,             ← Tessitura API        │
   │                                                         │
   │   "singleTicketsSold": 942,     ← PDF Sales Report     │
   │   "subscriptionTicketsSold": 6, ← PDF Sales Report     │
   │   "totalRevenue": 113051,       ← PDF Sales Report     │
   │   "budgetGoal": 124780,         ← PDF Sales Report     │
   │   "capacityPercent": 66.8,      ← PDF Sales Report     │
   │   "budgetPercent": 90.6,        ← PDF Sales Report     │
   │                                                         │
   │   "hasSalesData": true,         ← Indicates merge      │
   │   "dataSources": [                                      │
   │     "tessitura_api",            ← Source 1             │
   │     "sales_file"                ← Source 2 (PDF)       │
   │   ],                                                    │
   │                                                         │
   │   "weeklySales": [              ← Generated/Calculated │
   │     { "week": 1, "ticketsSold": 180, ... },            │
   │     { "week": 2, "ticketsSold": 341, ... },            │
   │     ...                                                 │
   │   ]                                                     │
   │ }                                                       │
   └────────────────────────────────────────────────────────┘

             ↓

┌─────────────────────────────────────────────────────────────────────┐
│                  CURRENT STATE (Oct 2025)                            │
└─────────────────────────────────────────────────────────────────────┘

data/dashboard.json contains:
├── 118 total performances (Sept 2025 - June 2026)
├── 60 performances WITH sales data
│   ├── Have "tessitura_api" + "sales_file" in dataSources
│   ├── Include actual sales numbers from PDF
│   └── Include weekly sales progression
└── 58 performances WITHOUT sales data
    ├── Have only "tessitura_api" in dataSources
    ├── Sales numbers are 0 or estimated
    └── No weekly sales progression

```

## How The Data Gets Combined

### Method 1: Manual Script (Current Approach)

The `dashboard.json` file was **manually created** by running scripts that:

1. **Fetch from Tessitura API** → Get all performances for season 25-26
2. **Parse PDF Report** → Extract sales data from "FY26 Performance Sales Summary_1126300.pdf"
3. **Match by Performance Code** → Link Tessitura performance (e.g., "250903E") with PDF sales data
4. **Merge Fields** → Combine metadata from API with sales from PDF
5. **Save to `data/dashboard.json`** → Store final merged result

**Key Files Involved:**
- Currently: No automated merge script exists
- The file was created through manual data processing
- PDF webhook exists but doesn't update `dashboard.json`

### Method 2: PDF Webhook (For BigQuery)

There's a **webhook system** for processing PDFs:

```
PDF Email → Make.com → Netlify Function (pdf-webhook.js) → BigQuery
                              ↓
                       Parses PDF
                       Extracts sales data
                       Updates BigQuery performances table
```

**This webhook does NOT update `data/dashboard.json`** - it only updates BigQuery!

## The Problem: No Live Sync

### Current Issues:

1. **`dashboard.json` is static** - manually created, not auto-updated
2. **PDF webhook → BigQuery** but doesn't touch local JSON file
3. **No automated merge script** that combines:
   - Latest Tessitura API data
   - Latest PDF sales report
   - Outputs to `data/dashboard.json`

### What Performances Look Like:

**Performance WITH sales data (60 total):**
```json
{
  "id": "250903E",
  "hasSalesData": true,
  "dataSources": ["tessitura_api", "sales_file"],
  "singleTicketsSold": 942,
  "totalRevenue": 113051,
  "weeklySales": [/* 10 weeks of data */]
}
```

**Performance WITHOUT sales data (58 total):**
```json
{
  "id": "250902E",
  "hasSalesData": false,
  "dataSources": ["tessitura_api"],
  "singleTicketsSold": 0,
  "totalRevenue": 0,
  "weeklySales": []
}
```

## What Needs to Happen

To automate the data combining process:

1. **Create a merge script** that:
   - Fetches latest performances from Tessitura API
   - Parses the latest PDF sales report
   - Matches by performance code
   - Merges data intelligently
   - Writes to `data/dashboard.json`

2. **Connect webhook to dashboard** so when PDF arrives:
   - Updates BigQuery (already works)
   - Also updates `data/dashboard.json`
   - Triggers dashboard refresh

3. **Or: Read directly from BigQuery** instead of JSON file
   - Dashboard fetches from BigQuery API
   - No need for `dashboard.json` file
   - Always shows latest data

## Summary

**Right now:** `dashboard.json` is a **snapshot** created manually by combining:
- Tessitura API metadata (performance info, series, venues)
- PDF sales report data (ticket sales, revenue, weekly progression)

**The "dataSources" field tells you:**
- `["tessitura_api"]` = Only has API metadata, no sales yet
- `["tessitura_api", "sales_file"]` = Has both API metadata AND PDF sales data

**BigQuery has its own copy** that gets updated via webhook, but the local JSON file does not auto-update.
