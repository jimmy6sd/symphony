-- Symphony Dashboard BigQuery Schema Enhancements
-- Additional tables for PDF data pipeline and trend preservation

-- Data snapshots table - stores each daily PDF data version
CREATE TABLE `symphony_dashboard.data_snapshots` (
  snapshot_id STRING NOT NULL,
  snapshot_date DATE NOT NULL,
  source_type STRING NOT NULL, -- 'pdf_tessitura', 'manual', 'api'
  source_identifier STRING, -- PDF filename, email subject, etc.
  raw_data JSON, -- Store original parsed PDF data
  processed_data JSON, -- Store transformed data before merge
  performance_count INT64,
  total_tickets_in_snapshot INT64,
  total_revenue_in_snapshot FLOAT64,
  processing_status STRING NOT NULL, -- 'pending', 'processed', 'failed'
  processing_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  error_message STRING,
  created_by STRING DEFAULT 'system',

  -- Metadata for auditing
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY snapshot_date
CLUSTER BY source_type, processing_status
OPTIONS(
  description="Daily data snapshots from PDF imports with full audit trail"
);

-- Trend adjustments table - tracks how historical trends were recalculated
CREATE TABLE `symphony_dashboard.trend_adjustments` (
  adjustment_id STRING NOT NULL,
  performance_id INT64 NOT NULL,
  snapshot_id STRING NOT NULL,
  adjustment_type STRING NOT NULL, -- 'backfill', 'correction', 'new_data'

  -- Before/after comparison
  old_total_tickets INT64,
  new_total_tickets INT64,
  tickets_difference INT64,
  old_total_revenue FLOAT64,
  new_total_revenue FLOAT64,
  revenue_difference FLOAT64,

  -- Trend preservation details
  weekly_adjustments JSON, -- Array of {week: number, old_value: number, new_value: number}
  trend_velocity_preserved BOOLEAN DEFAULT FALSE,
  adjustment_algorithm STRING, -- 'proportional', 'linear', 'manual'
  confidence_score FLOAT64, -- 0-1 score for adjustment reliability

  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  created_by STRING DEFAULT 'system',
  notes STRING,

  FOREIGN KEY (performance_id) REFERENCES `symphony_dashboard.performances` (performance_id) NOT ENFORCED,
  FOREIGN KEY (snapshot_id) REFERENCES `symphony_dashboard.data_snapshots` (snapshot_id) NOT ENFORCED
)
CLUSTER BY performance_id, adjustment_type
OPTIONS(
  description="Track how sales trends were adjusted during data updates"
);

-- Enhanced weekly sales table (modify existing)
-- Note: Run this as ALTER TABLE commands, not CREATE TABLE
-- ALTER TABLE `symphony_dashboard.weekly_sales` ADD COLUMN data_source STRING DEFAULT 'historical';
-- ALTER TABLE `symphony_dashboard.weekly_sales` ADD COLUMN last_adjusted TIMESTAMP;
-- ALTER TABLE `symphony_dashboard.weekly_sales` ADD COLUMN adjustment_id STRING;
-- ALTER TABLE `symphony_dashboard.weekly_sales` ADD COLUMN confidence_score FLOAT64 DEFAULT 1.0;

-- Data quality metrics table
CREATE TABLE `symphony_dashboard.data_quality_metrics` (
  metric_id STRING NOT NULL,
  snapshot_id STRING NOT NULL,
  metric_type STRING NOT NULL, -- 'outlier_detection', 'trend_consistency', 'data_completeness'
  metric_value FLOAT64,
  threshold_value FLOAT64,
  is_anomaly BOOLEAN DEFAULT FALSE,
  severity STRING, -- 'low', 'medium', 'high', 'critical'
  description STRING,
  recommendation STRING,

  -- Performance-specific metrics
  performance_id INT64,
  performance_code STRING,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),

  FOREIGN KEY (snapshot_id) REFERENCES `symphony_dashboard.data_snapshots` (snapshot_id) NOT ENFORCED
)
CLUSTER BY snapshot_id, metric_type, is_anomaly
OPTIONS(
  description="Data quality and anomaly detection metrics for each import"
);

-- Pipeline execution log (enhanced version of refresh_log)
CREATE TABLE `symphony_dashboard.pipeline_execution_log` (
  execution_id STRING NOT NULL,
  pipeline_type STRING NOT NULL, -- 'pdf_import', 'manual_update', 'api_sync'
  snapshot_id STRING,

  -- Execution details
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  duration_seconds INT64,
  status STRING NOT NULL, -- 'running', 'completed', 'failed', 'partial'

  -- Processing stats
  records_received INT64,
  records_processed INT64,
  records_inserted INT64,
  records_updated INT64,
  records_skipped INT64,
  trends_adjusted INT64,
  anomalies_detected INT64,

  -- Error handling
  error_message STRING,
  error_code STRING,
  retry_count INT64 DEFAULT 0,

  -- Source information
  source_file STRING, -- PDF filename
  source_email STRING, -- Email ID if applicable
  triggered_by STRING DEFAULT 'make.com',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),

  FOREIGN KEY (snapshot_id) REFERENCES `symphony_dashboard.data_snapshots` (snapshot_id) NOT ENFORCED
)
PARTITION BY DATE(start_time)
CLUSTER BY pipeline_type, status
OPTIONS(
  description="Comprehensive log of all data pipeline executions"
);

-- Views for easy querying

-- Latest data snapshot view
CREATE VIEW `symphony_dashboard.latest_snapshot` AS
SELECT
  snapshot_id,
  snapshot_date,
  source_type,
  performance_count,
  total_tickets_in_snapshot,
  total_revenue_in_snapshot,
  processing_timestamp
FROM `symphony_dashboard.data_snapshots`
WHERE processing_status = 'processed'
ORDER BY snapshot_date DESC, processing_timestamp DESC
LIMIT 1;

-- Performance data freshness view
CREATE VIEW `symphony_dashboard.performance_freshness` AS
SELECT
  p.performance_id,
  p.performance_code,
  p.title,
  p.performance_date,
  p.updated_at as last_updated,
  DATE_DIFF(CURRENT_DATE(), DATE(p.updated_at), DAY) as days_since_update,
  CASE
    WHEN DATE_DIFF(CURRENT_DATE(), DATE(p.updated_at), DAY) <= 1 THEN 'fresh'
    WHEN DATE_DIFF(CURRENT_DATE(), DATE(p.updated_at), DAY) <= 7 THEN 'moderate'
    ELSE 'stale'
  END as freshness_status,
  ls.snapshot_date as latest_snapshot_date
FROM `symphony_dashboard.performances` p
CROSS JOIN `symphony_dashboard.latest_snapshot` ls
ORDER BY p.performance_date DESC;

-- Trend adjustment summary view
CREATE VIEW `symphony_dashboard.trend_adjustment_summary` AS
SELECT
  ta.performance_id,
  p.performance_code,
  p.title,
  COUNT(*) as total_adjustments,
  SUM(ta.tickets_difference) as total_ticket_adjustments,
  SUM(ta.revenue_difference) as total_revenue_adjustments,
  AVG(ta.confidence_score) as avg_confidence_score,
  MAX(ta.created_at) as last_adjustment_date
FROM `symphony_dashboard.trend_adjustments` ta
JOIN `symphony_dashboard.performances` p ON ta.performance_id = p.performance_id
GROUP BY ta.performance_id, p.performance_code, p.title
ORDER BY last_adjustment_date DESC;