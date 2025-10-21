-- Symphony Dashboard BigQuery Schema
-- Main performances table with normalized structure

-- Step 1: Create dataset via web console first
-- Go to https://console.cloud.google.com/bigquery
-- Create dataset: symphony_dashboard
-- Location: US (multi-region)
-- Default table expiration: Never

-- Step 2: Run each table creation query separately in BigQuery console

-- Main performances table
CREATE TABLE `symphony_dashboard.performances` (
  performance_id INT64 NOT NULL,
  performance_code STRING NOT NULL,
  title STRING NOT NULL,
  series STRING,
  performance_date DATE NOT NULL,
  venue STRING NOT NULL,
  season STRING NOT NULL,
  capacity INT64 NOT NULL,
  single_tickets_sold INT64 DEFAULT 0,
  subscription_tickets_sold INT64 DEFAULT 0,
  total_revenue FLOAT64 DEFAULT 0,
  occupancy_goal FLOAT64 DEFAULT 85,
  budget_goal FLOAT64 DEFAULT 0,
  capacity_percent FLOAT64 DEFAULT 0,
  budget_percent FLOAT64 DEFAULT 0,
  has_sales_data BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),

  -- Computed fields
  total_tickets_sold INT64 GENERATED ALWAYS AS (single_tickets_sold + subscription_tickets_sold) STORED,
  occupancy_percent FLOAT64 GENERATED ALWAYS AS (
    CASE
      WHEN capacity > 0 THEN (single_tickets_sold + subscription_tickets_sold) / capacity * 100
      ELSE 0
    END
  ) STORED
)
PARTITION BY performance_date
CLUSTER BY series, season
OPTIONS(
  description="Main table for symphony performance data with sales metrics"
);

-- Weekly sales progression table
CREATE TABLE `symphony_dashboard.weekly_sales` (
  performance_id INT64 NOT NULL,
  week_number INT64 NOT NULL,
  tickets_sold INT64 NOT NULL,
  percentage FLOAT64 NOT NULL,
  cumulative_tickets INT64,
  cumulative_percentage FLOAT64,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),

  FOREIGN KEY (performance_id) REFERENCES `symphony_dashboard.performances` (performance_id) NOT ENFORCED
)
CLUSTER BY performance_id, week_number
OPTIONS(
  description="Weekly sales progression data for performances"
);

-- Data sources tracking table
CREATE TABLE `symphony_dashboard.data_sources` (
  performance_id INT64 NOT NULL,
  source_name STRING NOT NULL,
  source_priority INT64 DEFAULT 1,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),

  FOREIGN KEY (performance_id) REFERENCES `symphony_dashboard.performances` (performance_id) NOT ENFORCED
)
CLUSTER BY performance_id
OPTIONS(
  description="Tracking of data sources for each performance"
);

-- Seasons lookup table
CREATE TABLE `symphony_dashboard.seasons` (
  season_id STRING NOT NULL,
  season_name STRING NOT NULL,
  fiscal_year INT64,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
OPTIONS(
  description="Season definitions and metadata"
);

-- Series lookup table
CREATE TABLE `symphony_dashboard.series` (
  series_id STRING NOT NULL,
  series_name STRING NOT NULL,
  series_type STRING, -- Classical, Pops, Special Event, Family, etc.
  season_id STRING,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),

  FOREIGN KEY (season_id) REFERENCES `symphony_dashboard.seasons` (season_id) NOT ENFORCED
)
OPTIONS(
  description="Series definitions and categorization"
);

-- Venues lookup table
CREATE TABLE `symphony_dashboard.venues` (
  venue_id STRING NOT NULL,
  venue_name STRING NOT NULL,
  default_capacity INT64,
  location STRING,
  venue_type STRING,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
OPTIONS(
  description="Venue information and capacities"
);

-- Data refresh log
CREATE TABLE `symphony_dashboard.refresh_log` (
  refresh_id STRING NOT NULL,
  refresh_type STRING NOT NULL, -- 'full', 'incremental', 'manual'
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  records_processed INT64,
  records_inserted INT64,
  records_updated INT64,
  status STRING NOT NULL, -- 'running', 'completed', 'failed'
  error_message STRING,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(start_time)
OPTIONS(
  description="Log of data refresh operations"
);