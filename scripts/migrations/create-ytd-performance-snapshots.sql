-- Create ytd_performance_snapshots table
-- Stores per-performance cumulative sales at each snapshot date (from Excel reports)
-- Enables series-level filtering for YTD comparison page
--
-- Usage:
--   bq query --use_legacy_sql=false < scripts/migrations/create-ytd-performance-snapshots.sql

CREATE TABLE IF NOT EXISTS `kcsymphony.symphony_dashboard.ytd_performance_snapshots` (
  record_id STRING NOT NULL,                -- PK: {perf_code}_{snapshot_date}
  performance_code STRING NOT NULL,         -- Sanitized title + date
  title STRING,                             -- Performance name
  series STRING,                            -- Classical, Pops, Family, Film, Piazza, etc.
  snapshot_date DATE NOT NULL,              -- When the Excel report was dated
  performance_date DATE,                    -- When the concert occurs
  fiscal_year STRING,                       -- FY24 or FY25
  snapshot_fiscal_week INT64,               -- Fiscal week of snapshot_date
  snapshot_iso_week INT64,                  -- ISO week of snapshot_date
  performance_fiscal_week INT64,            -- Fiscal week of performance_date
  performance_iso_week INT64,               -- ISO week of performance_date
  single_revenue FLOAT64,                   -- Single ticket revenue
  single_tickets INT64,                     -- Single ticket count
  subscription_revenue FLOAT64,             -- Subscription revenue
  subscription_tickets INT64,               -- Subscription ticket count
  total_revenue FLOAT64,                    -- Combined total revenue
  total_tickets INT64,                      -- Combined total tickets
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);
