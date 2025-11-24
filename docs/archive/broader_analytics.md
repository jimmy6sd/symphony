# Broader Analytics Strategy: From Individual Performance to Holistic Season Intelligence

> **Goal**: Transform the Symphony Dashboard from granular performance tracking to strategic season-level analytics that answer: **"Are we on track for revenue and occupancy goals?"**

---

## 📊 Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Season Strategy Dashboard (Quick Wins)](#season-strategy-dashboard-quick-wins)
3. [Future Analytics Opportunities](#future-analytics-opportunities)
4. [Technical Implementation Details](#technical-implementation-details)
5. [Business Intelligence Questions](#business-intelligence-questions)
6. [Roadmap & Timeline](#roadmap--timeline)

---

## Current State Analysis

### Today's Analytics Capabilities

The Symphony Dashboard currently provides **granular, individual performance analytics**:

**Current Views:**
- **Data Table View**: All 118 performances with sortable columns for detailed review
- **Performance Detail Modal**: Deep dive into a single performance's 10-week sales curve
- **Performance Chart**: Top 12 performances by revenue (single vs subscription split)
- **Sales Curve Chart**: 10-week sales progression for selected performance with budget projection
- **Ticket Type Chart**: Aggregate single vs subscription split across all performances

**Current Metrics Tracked Per Performance:**
- Total revenue vs budget goal (% achievement)
- Occupancy % vs 85% goal
- Single vs subscription ticket breakdown
- Weekly sales progression (10-week window)
- Risk indicators (occupancy status, budget pacing)

### Available Data Sources

**Data Currently Being Used:**
- **File**: `data/dashboard.json` (118 real performances from 2025-2026 season)
- **Data Fields Per Performance**: 25+ fields including performance ID, title, series, date, venue, sales by ticket type, occupancy, capacity, budgets, ATP, weekly progression

**Tessitura API Endpoints Available (Configured):**
- `POST /TXN/Performances/Search` - Performance data with filters
- `GET /TXN/Performances/{id}` - Individual performance details
- `POST /TXN/Orders` - Sales/order data (currently untested)
- `GET /CRM/Constituents/{id}` - Customer information (not integrated)

**Performance Categories in Database:**
- **Classical Series**: CS01-CS14 (14 concerts)
- **Pops Series**: PS1-PS5 (5 concerts)
- **Family Series**: FS1-FS4 (4 concerts)
- **Special Events**: Film concerts, holiday shows, guest artists

### Data Aggregations Currently Available

**Already Calculated:**
- Weekly sales progression (from final sales to create 10-week trajectory)
- Ticket mix percentages (single vs subscription)
- Revenue per ticket type
- Occupancy % (tickets sold / capacity × 100)
- Budget achievement % (revenue / goal × 100)

**NOT Currently Available (Data Gaps):**
- Series-level summaries (total Classical revenue vs goal)
- Cumulative season progress (revenue trend line)
- At-risk show identification
- Performance outlier detection
- Historical comparisons (previous seasons)
- Customer segment analysis
- Predictive forecasting

---

## Season Strategy Dashboard (Quick Wins)

### Why This Approach?

Current dashboard requires **scrolling through 118 performances individually** to answer basic questions:
- "Are we on track for season revenue goals?" ❌ Hard to answer
- "Which series needs attention?" ❌ Hard to answer
- "How many shows are at-risk?" ❌ Hard to answer

**Solution**: Add 4 new strategic tabs that provide **bird's-eye view** of season health while keeping detailed performance view intact.

### Tab 1: Season Health Overview ⭐ HIGHEST PRIORITY

**Purpose**: Single-screen executive summary answering "Are we on track?"

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│  SYMPHONY SEASON 2025-2026 HEALTH OVERVIEW                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Season Revenue          Season Occupancy      At-Risk Shows│
│  ┌──────────────┐       ┌──────────────┐      ┌──────────┐ │
│  │ $2.4M / $3M │       │  87% / 85%   │      │  17 Shows│ │
│  │ 80% ████████        │ 102% ████████       │  (14.7%) │ │
│  │   ↑ on track│       │   ✅ Above target   │  🔴 Alert│ │
│  └──────────────┘       └──────────────┘      └──────────┘ │
│                                                             │
│  STRONG PERFORMERS           AT-RISK WATCH LIST            │
│  ┌──────────────────────┐  ┌──────────────────────────────┐│
│  │ 1. Chris Thile      │  │ Performance        Rev%  Occ% ││
│  │    $156K (105%)      │  │ -----------        ----  ---- ││
│  │ 2. Harry Potter      │  │ Brahms Sym #4      78%   71% ││
│  │    $142K (98%)       │  │ Farrenc Dvorak     72%   68% ││
│  │ 3. Billy Joel        │  │ Strauss Mahler     81%   75% ││
│  │    $138K (103%)      │  │ ...more shows...   ...   ...  ││
│  │ 4. Family Concert    │  │                              ││
│  │    $94K (112%)       │  │ [View Full Watch List →]     ││
│  │ 5. Holiday Messiah   │  └──────────────────────────────┘│
│  │    $87K (108%)       │                                   │
│  └──────────────────────┘                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key Metrics Displayed:**
- **Season Revenue**: Total revenue to date vs annual goal (with % and progress bar)
- **Season Occupancy**: Average occupancy % vs 85% target goal
- **At-Risk Count**: Number of shows below 75% occupancy (with visual alert)
- **Top 5 Performers**: Highest revenue shows with % above/below budget
- **At-Risk Watch List**: Shows below revenue or occupancy targets (sortable)

**Color Coding:**
- 🟢 Green: On-track (>90% of goal or >85% occupancy)
- 🟡 Yellow: Watch (75-90% of goal or 75-85% occupancy)
- 🔴 Red: Intervention needed (<75% of goal or <75% occupancy)

**Interactive Elements:**
- Click "View Full Watch List" → Tab 3 (Risk Matrix)
- Click any show name → Drill into that performance's detail view
- Sortable columns: revenue miss $, occupancy gap %, days until event

---

### Tab 2: Series Performance Comparison

**Purpose**: Compare how different series (Classical, Pops, Family, Special) are performing

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│  SERIES PERFORMANCE COMPARISON                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  SERIES CARDS                    COMPARISON CHART           │
│  ┌──────────────────┐                                       │
│  │ Classical Series │  Classical vs Pops vs Family vs Special│
│  │ 14 Shows         │            Revenue Achievement        │
│  │ Revenue: $1.2M   │                                       │
│  │ Budget:  $1.45M  │  Classical  ████████████ $1.2M (83%) │
│  │ Status:  83%     │  Pops       ██████ $680K (95%)       │
│  │ Avg Occ: 86%     │  Family     ████████████ $420K (87%) │
│  │ Trend:   ↗ up    │  Special    ███████ $120K (80%)      │
│  │ [Details] [View] │                                       │
│  └──────────────────┘  SERIES INSIGHTS                     │
│                        • Classical tracking slightly under  │
│  ┌──────────────────┐  • Pops strongest series (95%)       │
│  │ Pops Series      │  • Family Series steady (87%)        │
│  │ 5 Shows          │  • Special Events need attention     │
│  │ Revenue: $680K   │                                       │
│  │ Budget:  $715K   │                                       │
│  │ Status:  95% ✅  │                                       │
│  │ Avg Occ: 89%     │                                       │
│  │ Trend:   ↗ up    │                                       │
│  │ [Details] [View] │                                       │
│  └──────────────────┘                                       │
│                      ... Family and Special series cards ... │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Series Card Components:**
- Series name and show count
- Total revenue vs budget goal
- Budget achievement % with color coding
- Average occupancy across series
- Trend indicator (↗ up, → stable, ↘ down)
- "Details" link to see all shows in that series
- "View Shows" to filter data table to just that series

**Comparison Chart:**
- Side-by-side bar chart: Budget goal vs actual revenue per series
- Color-coded: Green (above), Gray (goal line), Red (below)
- Hover tooltip: "Classical Series: $1.2M of $1.45M goal (83%)"

**Series Insights Box:**
- Auto-generated summaries: "Pops series is outperforming, Classical needs 15% more revenue to hit goal"
- Trend analysis: "Classical series trend is improving, Pops remaining steady"

---

### Tab 3: Performance Risk Matrix

**Purpose**: Visualize all 118 performances on a 2D risk chart to identify at-risk shows

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│  PERFORMANCE RISK MATRIX                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Revenue % of Goal                                          │
│  ↑ 120%+  ┌─────────────────────────────────────────────┐ │
│  │        │         🟢 HEALTHY PERFORMERS               │ │
│  │        │    (many green dots clustered here)          │ │
│  │ 100%   ├─────────────────────────────────────────────┤ │
│  │        │  🟡 WATCH ZONE (yellow dots)                │ │
│  │ 85%    ├─────────────────────────────────────────────┤ │
│  │        │     🔴 AT-RISK (red dots)  Billy Joel       │ │
│  │ 70%    │         Harry Potter      Brahms Sym        │ │
│  │        └─────────────────────────────────────────────┘ │
│  └────────┴─────────────────────────────────────────────→ │
│          60%      75%      85%      90%      100%          │
│                    Occupancy %                              │
│                                                             │
│  WATCH LIST (Performances Below Thresholds)                 │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Performance        Date    Revenue% Occ% Series    Days ││
│  │ ─────────────────────────────────────────────────────  ││
│  │ Brahms Sym #4      1/8/26   78%     71% Classical   30  ││
│  │ Farrenc/Dvorak/Sc  4/3/26   72%     68% Classical   115 ││
│  │ Strauss/Mahler     3/11/26  81%     75% Classical   83  ││
│  │ Saint-Saëns        3/5/26   74%     69% Classical   75  ││
│  │ ... 13 more at-risk shows ...                          ││
│  │                                                         ││
│  │ Total At-Risk: 17 shows (14.7%)                        ││
│  │ [Sort: by Revenue Miss | Occupancy Gap | Days Until]   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  LEGEND: 🟢 Healthy (>85% Rev, >85% Occ)                 │
│          🟡 Watch (70-85% Rev, 70-85% Occ)               │
│          🔴 At-Risk (<70% Rev, <70% Occ)                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Risk Matrix (Scatter Plot):**
- **X-axis**: Occupancy % (60% to 110%)
- **Y-axis**: Revenue % of Budget Goal (60% to 120%)
- **Data Points**: Each dot = one performance
- **Color Coding**:
  - 🟢 Green: Healthy performers (right/top quadrant)
  - 🟡 Yellow: Watch zone (middle)
  - 🔴 Red: At-risk performers (left/bottom quadrant)
- **Interactive**: Hover → show performance name + exact metrics
- **Click**: Navigate to that performance's detail view

**Watch List Table:**
- Sortable by: revenue gap $, occupancy gap %, days until event
- Shows only performances below thresholds (customizable)
- Quick actions: View details, add note, flag for marketing intervention

**Summary Stats:**
- "17 shows at-risk (14.7%)"
- "42 shows in watch zone (36.2%)"
- "59 shows healthy (51.1%)"

---

### Tab 4: Weekly Season Progression

**Purpose**: Track cumulative progress toward season revenue and occupancy goals over time

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│  SEASON PROGRESSION TRACKING                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  CUMULATIVE REVENUE PROGRESS        OCCUPANCY TREND         │
│  $                                                          │
│  3M  ╱─────────                    100%  ──────────────     │
│  2.5M│     Goal Line ─── ─── ─    87%   ╱ Current (87%)   │
│  2M  │                ╱            80%   │                 │
│  1.5M│           ╱ Current        75%   │ Target (85%)    │
│  1M  │        ╱                   70%   │                 │
│  500K│     ╱                       65%   │                 │
│  0   └────────────────────────→    60%   └────────────────→│
│      Aug  Sep  Oct  Nov  Dec  Jan        Aug  Sep  Oct  Nov │
│                                                             │
│  KEY INSIGHTS                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ • Season Revenue: $2.4M of $3M goal (80%)              ││
│  │   Status: 📊 At current pace, will achieve 82-86% of  ││
│  │   goal by end of season                                ││
│  │                                                         ││
│  │ • Occupancy Trend: 87% average (↗ improving)           ││
│  │   Status: ✅ ABOVE target of 85%                       ││
│  │   This indicates venue sizing is optimal               ││
│  │                                                         ││
│  │ • Revenue Trend: Flat for last 3 weeks                 ││
│  │   Action: Monitor sales velocity, may need marketing   ││
│  │   push or pricing adjustments                          ││
│  │                                                         ││
│  │ • Projection: If current pace continues, season will   ││
│  │   end at ~$2.65M (88% of $3M goal)                     ││
│  │                                                         ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  WEEKLY BREAKDOWN                                           │
│  Week    Revenue Sold  Occupancy  Status    Notes           │
│  ─────────────────────────────────────────────────────────  │
│  Aug1-7  $156K (5%)    84%        🟡 Slow start           │
│  Aug8-14 $198K (7%)    86%        🟢 Good momentum        │
│  Aug15-21 $201K (8%)   87%        🟢 Strong              │
│  ... continuing through season ...                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Revenue Progression Chart:**
- **X-axis**: Week/Month timeline (August through June)
- **Y-axis**: Cumulative revenue dollars
- **Two lines**:
  - Actual cumulative revenue (trending)
  - Goal projection line (where we should be)
- **Visual gap**: If behind, gap shows revenue shortfall
- **Color zones**: Green when ahead, Red when behind

**Occupancy Trend Chart:**
- **Line**: Average occupancy % trending over time
- **Reference lines**: 85% goal line, 90% stretch line
- **Shows**: Are we improving, stable, or declining?

**Projection Card:**
- "At current pace: $2.65M projected (88% of $3M goal)"
- Confidence interval: "Likely range: $2.5M - $2.8M"
- What-if scenarios: "If we hit 90% on remaining shows: $2.9M total"

**Weekly Breakdown Table:**
- Each week's performance: revenue added, occupancy %, status indicator
- Compare week-to-week trends
- Identify when revenue velocity changed

---

## Future Analytics Opportunities

### Phase 2: Advanced Forecasting (2-3 weeks effort)

**Objective**: Replace heuristic pacing with data-driven revenue projections

**Capabilities to Add:**
- **Predictive Revenue Model**: Using historical performance patterns + current sales data
- **Confidence Intervals**: "95% likely to achieve $2.4M - $2.7M"
- **What-If Analysis**: "If we hold special promotion on 5 underperforming shows..."
- **Performance Benchmarking**: "This classical concert is tracking 8% below similar classical concerts"
- **Early Warning System**: Flag shows that deviate from predicted trajectory

**Data Sources Needed:**
- Historical performance data (previous 3-5 seasons)
- Sales data by day (not just weekly aggregates)
- Marketing spend correlation (if available)
- Competitor performance (external data)

**Technical Implementation:**
- Build regression model on historical data
- Calculate rolling forecasts as sales progress
- Create confidence bands around projections
- Store daily snapshots for trend analysis

---

### Phase 3: Customer Intelligence (3-4 weeks effort)

**Objective**: Understand audience composition and purchasing patterns

**Capabilities to Add:**
- **Customer Segmentation**:
  - Loyal subscribers vs single ticket buyers
  - Price-sensitive vs premium buyers
  - Local vs visiting audiences

- **Lifetime Value Analysis**:
  - How much does average subscriber spend annually?
  - What's the retention rate?
  - What's the acquisition cost?

- **Marketing Attribution**:
  - Which campaigns drive ticket sales?
  - What's the ROI per marketing channel?
  - How do early buyers differ from last-minute buyers?

- **Demand Elasticity**:
  - Price sensitivity by show type
  - Optimal pricing recommendations
  - Discount effectiveness analysis

**Data Sources Needed:**
- Tessitura CRM data (constituent information)
- Tessitura Orders API (detailed transaction history)
- Marketing platform integration (campaign attribution)
- External demographic data (optional but valuable)

**Technical Implementation:**
- Query Tessitura /CRM/Constituents endpoint for buyer profiles
- Query /TXN/Orders for detailed purchase history
- Build customer cohorts and calculate LTV
- Create segment-specific analytics views

---

### Phase 4: Historical Benchmarking & Trend Analysis (2-3 weeks effort)

**Objective**: Compare current season to historical patterns and identify trends

**Capabilities to Add:**
- **Year-over-Year Comparison**:
  - How is 2025-26 season comparing to 2024-25?
  - Which shows performed better/worse vs similar shows last year?
  - Are we growing or declining?

- **Series Trend Analysis**:
  - How has Classical series performance trended over 5 years?
  - Which series is growing in popularity?
  - Any seasonal patterns (holiday shows always strong, etc.)?

- **Outlier Detection**:
  - Which shows are unusually strong or weak?
  - Is this performance an outlier or new normal?
  - Should we replicate successful programming?

- **Audience Growth Tracking**:
  - Total unique attendees year-over-year
  - New subscriber acquisition rate
  - Churn/lapsed customer analysis

**Data Sources Needed:**
- Historical database (5+ seasons of performance data)
- Performance-to-performance mapping (same show different years)
- Customer transaction history (for attendee tracking)

**Technical Implementation:**
- Archive current season data for future reference
- Create historical data warehouse
- Build year-over-year comparison views
- Implement trend analysis algorithms

---

## Technical Implementation Details

### Architecture Overview

**New Components to Create:**

```
src/
├── components/
│   ├── season-dashboard.js          # Main tab container
│   ├── tabs/
│   │   ├── health-overview.js       # Tab 1: Season Health
│   │   ├── series-comparison.js     # Tab 2: Series Performance
│   │   ├── risk-matrix.js           # Tab 3: Risk Matrix
│   │   └── season-progression.js    # Tab 4: Progression Tracking
│   └── ...existing components...
│
├── services/
│   ├── analytics-aggregator.js      # Calculate season-level metrics
│   ├── risk-calculator.js           # Identify at-risk shows
│   ├── series-analyzer.js           # Series-level summaries
│   └── ...existing services...
│
└── utils/
    ├── metrics.js                   # Metric calculation helpers
    └── ...existing utilities...
```

### Data Aggregation Functions

**Season-level Aggregations Needed:**

```javascript
// Analytics Aggregator Service
{
  // Season totals
  getSeasonRevenue() -> { total: $, goal: $, percent: % }
  getSeasonOccupancy() -> { avg: %, goal: %, status: 'on-track' | 'below' | 'above' }
  getAtRiskCount() -> { count: N, percent: X%, shows: [...] }

  // Series aggregations
  getSeriesPerformance(seriesName) -> {
    shows: N,
    revenue: $,
    goal: $,
    percent: %,
    avgOccupancy: %,
    trend: 'up' | 'stable' | 'down'
  }

  // Risk scoring
  calculateRiskScore(performance) -> { revenue: %, occupancy: %, status: 'green'|'yellow'|'red' }
  getAtRiskShows(threshold) -> [...]

  // Progression tracking
  getWeeklyProgression() -> [
    { week: 1, revenue: $, occupancy: %, trend: direction }
  ]

  // Projection
  projectSeasonOutcome() -> {
    projected: $,
    confidence: 'low'|'medium'|'high',
    range: { low: $, high: $ }
  }
}
```

### Chart Specifications

**Tab 1 - Health Overview:**
- Progress bars (HTML5 `<progress>` or CSS)
- Color-coded cards (CSS grid)
- Sortable data table (existing component pattern)

**Tab 2 - Series Comparison:**
- Bar chart: D3.js with grouping
- Card grid: CSS flexbox
- Sparklines for trend mini-charts

**Tab 3 - Risk Matrix:**
- Scatter plot: D3.js scatterplot
- Tooltip: D3 tooltip library
- Filterable data table: existing component pattern

**Tab 4 - Season Progression:**
- Line chart: D3.js line chart
- Area fill: For visual emphasis
- Reference lines: Static lines for goals

### Performance Considerations

**With 118 Performances:**
- All aggregations should pre-calculate (not on every page load)
- Cache aggregated metrics (update when data changes)
- Lazy-load chart details (visible tabs render first)
- Use requestAnimationFrame for smooth D3 animations

**Data Update Strategy:**
- Pre-calculate all metrics once on app load
- Store in memory: `state.seasonAnalytics`
- Update on data refresh or manual refresh button
- Consider service worker caching for offline performance

---

## Business Intelligence Questions

### Questions Answered by Tab 1: Season Health Overview

**Question**: "Are we on track for revenue goals?"
- **Answer**: Revenue progress card shows $2.4M of $3M (80% achieved)
- **Additional context**: At current pace, will achieve 82-86% by season end
- **Action**: If below acceptable threshold, trigger marketing strategy review

**Question**: "What's our occupancy status?"
- **Answer**: Occupancy card shows 87% average vs 85% goal
- **Context**: Above target indicates good venue utilization
- **Action**: Continue current pricing/marketing strategy

**Question**: "How many shows need immediate help?"
- **Answer**: At-Risk count shows 17 shows (14.7%)
- **Action items**: Click to see watch list, drill into problematic shows

---

### Questions Answered by Tab 2: Series Comparison

**Question**: "Which series is our strongest performer?"
- **Answer**: Pops series at 95% of goal (vs Classical at 83%)
- **Insight**: Pops programming resonates more strongly with audience
- **Strategic Question**: Should we increase Pops concerts in 2026-27?

**Question**: "Which series needs intervention?"
- **Answer**: Classical series at 83%, Special Events at 80%
- **Root cause analysis**: Is it pricing? Programming? Marketing?
- **Options**: Discount underperforming classical shows, adjust next year's programming

**Question**: "Are there trends we should be aware of?"
- **Answer**: Trend indicators show which series gaining/losing momentum
- **Example**: "Classical series trend is ↗ improving, may recover by year-end"

---

### Questions Answered by Tab 3: Risk Matrix

**Question**: "Which shows should we be worried about?"
- **Answer**: All red/yellow dots on matrix, sorted by watch list
- **Details**: Specific revenue miss ($XX away from goal), occupancy gap (YY% below target)

**Question**: "Which shows can we intervene on?"
- **Answer**: Shows with "Days Until Event" > 30 (enough time for intervention)
- **Intervention options**: Discount, targeted marketing, bundle with stronger shows

**Question**: "Is the problem systemic or isolated?"
- **Answer**: Percentage of at-risk shows
- **If <10%**: Normal variation, isolated issues
- **If 20%+**: Systemic problem (pricing too high, programming weak, external factors)

---

### Questions Answered by Tab 4: Season Progression

**Question**: "Are we ahead, on-track, or behind?"
- **Answer**: Cumulative revenue line vs goal projection line
- **Gap size**: Visual indication of how far off pace

**Question**: "Are things improving or getting worse?"
- **Answer**: Slope of trend line
- **Flat/downward**: Sales velocity declining, needs action
- **Steep upward**: Strong momentum, maintain strategy

**Question**: "What's our realistic season outcome?"
- **Answer**: Projection card with confidence range
- **Example**: "95% likely to achieve $2.4M - $2.7M at season end"

**Question**: "When did things change?"
- **Answer**: Weekly breakdown shows when momentum shifted
- **Example**: "Revenue velocity dropped in week of Nov 15-21"
- **Action**: Correlate with external events (holiday, competitor activity, etc.)

---

## Roadmap & Timeline

### Phase 1: Foundation (Days 1-2) ⚡ IMMEDIATE
- [ ] Create new tab navigation in dashboard UI
- [ ] Build `analytics-aggregator.js` service with all calculation functions
- [ ] Create sample aggregations from `data/dashboard.json`
- [ ] Test calculations against raw data
- [ ] Basic layout and styling

**Deliverable**: Working aggregation service, tab navigation ready

**Risk**: Low | **Effort**: 2-3 hours

---

### Phase 2: Season Health Overview Tab (Days 3-4) ⭐ START HERE
- [ ] Build progress cards (revenue, occupancy, at-risk count)
- [ ] Create Top 5 performers card
- [ ] Create At-Risk watch list (sortable table)
- [ ] Add color coding and visual indicators
- [ ] Responsive design for mobile
- [ ] Link clicks to detail views

**Deliverable**: Fully functional executive summary screen

**Risk**: Low | **Effort**: 4-5 hours

---

### Phase 3: Series Comparison Tab (Days 5-6)
- [ ] Extract series-level aggregations
- [ ] Build series card components
- [ ] Create series comparison bar chart (D3.js)
- [ ] Add trend indicators
- [ ] Build series insights text generator
- [ ] Link to filter main data table by series

**Deliverable**: Series analytics view with comparisons

**Risk**: Low-Medium | **Effort**: 5-6 hours

---

### Phase 4: Risk Matrix & Watch List (Days 7-9)
- [ ] Calculate risk scores for all performances
- [ ] Build 2D scatter plot (D3.js scatterplot)
- [ ] Add interactive tooltips
- [ ] Create watch list table (sortable)
- [ ] Add filtering (by series, date range, etc.)
- [ ] Connect to performance details

**Deliverable**: Risk identification and monitoring system

**Risk**: Medium | **Effort**: 6-7 hours

---

### Phase 5: Season Progression Tab (Days 10-11)
- [ ] Calculate cumulative revenue by week
- [ ] Build cumulative revenue line chart (D3.js)
- [ ] Add goal projection line
- [ ] Build occupancy trend chart
- [ ] Create projection card with calculations
- [ ] Build weekly breakdown table
- [ ] Add insights generator

**Deliverable**: Season tracking and projection views

**Risk**: Low-Medium | **Effort**: 5-6 hours

---

### Phase 6: Polish & Optimization (Days 12-14)
- [ ] Performance testing with 118 performances
- [ ] Responsive design refinement
- [ ] Accessibility audit (WCAG 2.1)
- [ ] Error handling and edge cases
- [ ] Documentation and code comments
- [ ] Final testing and QA

**Deliverable**: Production-ready analytics dashboard

**Risk**: Low | **Effort**: 4-5 hours

---

### Overall Timeline
| Phase | Duration | Effort | Risk |
|-------|----------|--------|------|
| **Phase 1: Foundation** | 2 days | 2-3h | 🟢 Low |
| **Phase 2: Health Overview** | 2 days | 4-5h | 🟢 Low |
| **Phase 3: Series Comparison** | 2 days | 5-6h | 🟡 Low-Med |
| **Phase 4: Risk Matrix** | 3 days | 6-7h | 🟡 Medium |
| **Phase 5: Season Progression** | 2 days | 5-6h | 🟡 Low-Med |
| **Phase 6: Polish** | 3 days | 4-5h | 🟢 Low |
| **TOTAL** | **14 days** | **26-32 hours** | **Medium** |

**Recommended Pace**: 2-3 hours per day ≈ 10-15 business days to completion

---

## Success Criteria

### Functional Requirements
- [ ] Dashboard displays all 118 performances without performance degradation
- [ ] Season health visible and accurate at a glance
- [ ] Can identify top 5 and bottom 5 performances in <5 seconds
- [ ] Series comparison accurately aggregates performances by series
- [ ] Risk matrix correctly calculates and displays risk scores
- [ ] Season progression accurately tracks cumulative revenue
- [ ] All projections are mathematically sound

### User Experience Requirements
- [ ] Tab navigation is intuitive and responsive
- [ ] All numbers auto-update when data refreshes
- [ ] Charts are visually clear and accessible (not cluttered)
- [ ] Mobile responsive (works on tablets, phones)
- [ ] Drill-down works: click shows → see performance detail
- [ ] Watch list is actionable (sortable, filterable)

### Performance Requirements
- [ ] Page load time <3 seconds (including charts)
- [ ] Tab switching <500ms
- [ ] Aggregations calculate in <1 second
- [ ] Charts render smoothly without jank

### Business Intelligence Requirements
- [ ] Answers: "Are we on track for revenue goals?" clearly
- [ ] Answers: "Are we on track for occupancy goals?" clearly
- [ ] Identifies which series needs attention
- [ ] Flags shows needing intervention
- [ ] Shows realistic season outcome projection

---

## Future Considerations

### Integration with Tessitura API (Post-MVP)

Once this foundation is solid, next steps could include:

1. **Live data integration**: Query Tessitura API daily instead of static data file
2. **Historical data warehouse**: Archive season data for trend analysis
3. **Customer API integration**: Pull buyer segments from CRM
4. **Real-time updates**: Push notifications when shows hit risk thresholds

### Advanced Analytics (Post-MVP)

1. **Predictive ML models**: Forecast revenue with higher accuracy
2. **Anomaly detection**: Automatically flag unusual performance
3. **Marketing attribution**: Connect campaigns to sales spikes
4. **Churn analysis**: Identify at-risk customer segments

### Executive Tools (Post-MVP)

1. **Customizable dashboards**: Let each user configure their view
2. **Email reports**: Automated weekly/monthly summaries
3. **Alert system**: Notifications when thresholds crossed
4. **Export capabilities**: Reports to PDF, Excel, etc.

---

## Questions & Next Steps

### For Leadership
- What's the minimum acceptable revenue achievement % for the season?
- What's your target occupancy %? (Currently assuming 85%)
- Should we implement price discounting for at-risk shows, or other strategies?
- What would constitute "intervention needed"?

### For Product/Data
- Should we integrate live Tessitura data, or keep static data file?
- Do we want customer segmentation analysis? (requires CRM data)
- What's our definition of "at-risk" - revenue miss %, occupancy %, both?
- Should projections use historical benchmarks or current trajectory?

### For Design
- Should tabs be horizontal (current approach) or in a sidebar?
- Do we want dark mode for the analytics views?
- Should cards be draggable/rearrangeable?
- How much detail should be shown vs hidden behind "details" links?

---

## Appendix: Data Requirements Summary

### Current Data Available
- ✅ 118 performance records with full sales data
- ✅ Series categorization (Classical, Pops, Family, Special)
- ✅ Weekly sales progression (10 weeks)
- ✅ Budget goals and occupancy targets
- ✅ Venue information

### Data Gaps for Future Phases
- ❌ Historical performance data (previous seasons)
- ❌ Customer demographic information
- ❌ Marketing spend and attribution data
- ❌ Daily sales data (only weekly available currently)
- ❌ Detailed order information (only aggregated sales)

### Recommended Next Data Collection
1. Archive current season data before next season starts
2. Request historical data export from Tessitura (previous 3 seasons)
3. Document marketing spend per performance/campaign
4. Implement customer tracking for new ticket purchases

---

**Document Version**: 1.0 | **Last Updated**: November 2025 | **Status**: Ready for Implementation
