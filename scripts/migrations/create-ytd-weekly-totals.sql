-- Create YTD Weekly Totals table for year-over-year comparison
-- Run with: bq query --use_legacy_sql=false < scripts/migrations/create-ytd-weekly-totals.sql

CREATE TABLE IF NOT EXISTS `kcsymphony.symphony_dashboard.ytd_weekly_totals` (
  -- Primary Key
  record_id STRING NOT NULL,

  -- Time Dimensions
  fiscal_year STRING NOT NULL,           -- 'FY23', 'FY24', 'FY25', 'FY26'
  fiscal_week INT64 NOT NULL,            -- 1-52 (weeks from July 1)
  iso_week INT64 NOT NULL,               -- 1-52 (ISO week number)
  week_end_date DATE NOT NULL,           -- Actual date for this week's snapshot

  -- YTD Cumulative Metrics
  ytd_tickets_sold INT64 NOT NULL,       -- Cumulative single + subscription tickets
  ytd_single_tickets INT64,              -- Cumulative single tickets only
  ytd_subscription_tickets INT64,        -- Cumulative subscription tickets only
  ytd_revenue FLOAT64,                   -- Cumulative revenue (if available)

  -- Additional Context
  performance_count INT64,               -- Number of performances included in YTD
  source STRING,                         -- 'excel_import', 'bigquery_calc'

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
OPTIONS(
  description='Weekly YTD cumulative sales data for year-over-year comparison charts'
);
