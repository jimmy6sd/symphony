# BigQuery Data Strategy

## Data Flow Architecture

### Two Types of Data

1. **Automated Daily Updates (from PDF webhook)**
   - Weekly sales progression
   - Ticket counts (single, subscription)
   - Revenue data
   - Budget percentages
   - **Source**: PDF Performance Sales Report via webhook

2. **Manual One-Time Setup + Edits**
   - Performance metadata (title, series, season)
   - Venue information
   - Capacity
   - Occupancy goals
   - **Source**: Manually curated, editable via admin interface

---

## Recommended BigQuery Table Structure

### Table 1: `performances` (Main Table - Manual + Auto)
```sql
CREATE TABLE `kcsymphony.symphony_dashboard.performances` (
  -- Identifiers
  performance_id INTEGER NOT NULL,
  performance_code STRING NOT NULL,  -- e.g., "250903E"

  -- Manual Metadata (Edit via Admin UI)
  title STRING NOT NULL,
  series STRING,
  season STRING NOT NULL,
  venue STRING NOT NULL,
  performance_date DATE NOT NULL,
  capacity INTEGER NOT NULL,
  occupancy_goal FLOAT,
  budget_goal FLOAT,

  -- Auto-Updated Sales Data (from PDF webhook)
  single_tickets_sold INTEGER,
  subscription_tickets_sold INTEGER,
  total_tickets_sold INTEGER,
  total_revenue FLOAT,
  capacity_percent FLOAT,
  budget_percent FLOAT,
  has_sales_data BOOLEAN,

  -- Tracking
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  last_pdf_import_date DATE,  -- Track when PDF last updated this record

  PRIMARY KEY (performance_code)
);
```

### Table 2: `weekly_sales` (Auto-Updated from PDF)
```sql
CREATE TABLE `kcsymphony.symphony_dashboard.weekly_sales` (
  performance_code STRING NOT NULL,
  week_number INTEGER NOT NULL,
  tickets_sold INTEGER NOT NULL,
  percentage FLOAT NOT NULL,
  cumulative_tickets INTEGER,
  cumulative_percentage FLOAT,
  import_date DATE NOT NULL,  -- When this data was imported

  PRIMARY KEY (performance_code, week_number)
);
```

---

## Data Import Strategy

### Initial One-Time Setup

**Step 1**: Import your curated metadata
```javascript
// Load from dashboard.json (118 performances)
const performances = require('./data/dashboard.json');

// Insert into BigQuery with MANUAL metadata only
performances.forEach(perf => {
  INSERT INTO performances (
    performance_code, title, series, season, venue,
    performance_date, capacity, occupancy_goal, budget_goal,
    single_tickets_sold, subscription_tickets_sold, total_revenue,
    capacity_percent, budget_percent, has_sales_data
  ) VALUES (...)
});
```

### Daily Automated Updates (PDF Webhook)

**What the webhook should do:**
1. Parse PDF → Extract sales data
2. **UPDATE only sales columns** in `performances` table:
   - `single_tickets_sold`
   - `subscription_tickets_sold`
   - `total_revenue`
   - `capacity_percent`
   - `budget_percent`
   - `has_sales_data` = TRUE
   - `last_pdf_import_date` = TODAY
   - `updated_at` = NOW
3. **REPLACE weekly_sales** for each performance
4. **NEVER touch** the manual metadata columns

---

## Webhook Update Logic

```javascript
// In pdf-webhook.js
async function processPerformanceData(bigquery, performances) {
  for (const perf of performances) {
    // UPDATE ONLY sales data, preserve manual metadata
    const updateQuery = `
      UPDATE \`kcsymphony.symphony_dashboard.performances\`
      SET
        single_tickets_sold = @single,
        subscription_tickets_sold = @subscription,
        total_tickets_sold = @total,
        total_revenue = @revenue,
        capacity_percent = @capacity_pct,
        budget_percent = @budget_pct,
        has_sales_data = TRUE,
        last_pdf_import_date = CURRENT_DATE(),
        updated_at = CURRENT_TIMESTAMP()
      WHERE performance_code = @code
    `;

    await bigquery.query({
      query: updateQuery,
      params: {
        code: perf.performance_code,
        single: perf.single_tickets_sold,
        subscription: perf.subscription_tickets_sold,
        total: perf.total_tickets_sold,
        revenue: perf.total_revenue,
        capacity_pct: perf.capacity_percent,
        budget_pct: perf.budget_percent
      }
    });

    // Update weekly sales (DELETE + INSERT)
    await bigquery.query(`
      DELETE FROM \`kcsymphony.symphony_dashboard.weekly_sales\`
      WHERE performance_code = '${perf.performance_code}'
    `);

    // Insert new weekly sales data
    if (perf.weekly_sales) {
      // INSERT weekly sales rows...
    }
  }
}
```

---

## Admin UI for Manual Edits

Create an admin interface where you can:
- ✅ Edit performance title, series, season
- ✅ Update venue, capacity, goals
- ✅ **Cannot edit** sales data (auto-updated only)
- ✅ View last PDF import date
- ✅ Manually mark performances as "exclude from reports"

---

## Benefits of This Approach

1. **Clear Separation**: Manual vs auto-updated data
2. **Audit Trail**: `last_pdf_import_date` tracks when sales data was last refreshed
3. **Safe Updates**: Webhook can't accidentally overwrite your manual edits
4. **Flexible**: You can fix metadata anytime without affecting sales data
5. **Simple**: Two tables, clear responsibility for each

---

## Current State & Next Steps

**What we have now:**
- ✅ Clean `performances` table with 118 records in BigQuery
- ✅ Data loaded from `dashboard.json`
- ❌ Webhook exists but doesn't update properly
- ❌ No admin UI for manual edits

**What we need to do:**
1. Add `last_pdf_import_date` column to performances table
2. Create/fix `weekly_sales` table
3. Update PDF webhook to use UPDATE (not INSERT) for sales data
4. Create simple admin UI for editing metadata
5. Test end-to-end: PDF import → BigQuery → Dashboard display

---

## Sample Admin UI (Simple HTML Form)

```html
<!-- Edit Performance -->
<form id="edit-performance">
  <h3>Edit Performance: 250903E</h3>

  <!-- Editable Metadata -->
  <label>Title: <input name="title" value="Morgan Freeman's Symphonic Blues"></label>
  <label>Series: <select name="series"><option>Special Event</option></select></label>
  <label>Venue: <input name="venue" value="HELZBERG HALL"></label>
  <label>Capacity: <input type="number" name="capacity" value="1419"></label>

  <!-- Read-Only Sales Data (from PDF) -->
  <fieldset disabled>
    <legend>Sales Data (Auto-Updated from PDF)</legend>
    <label>Single Tickets: <input value="942" readonly></label>
    <label>Revenue: <input value="$113,051" readonly></label>
    <label>Last Updated: <input value="2025-09-30" readonly></label>
  </fieldset>

  <button type="submit">Save Changes</button>
</form>
```

Would you like me to:
1. **Add the `last_pdf_import_date` column** to your current BigQuery table?
2. **Create the `weekly_sales` table**?
3. **Update the PDF webhook** to properly update (not insert) sales data?
4. **Create a simple admin UI** for editing metadata?

Or all of the above?
