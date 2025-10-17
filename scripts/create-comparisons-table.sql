-- Create performance_sales_comparisons table in BigQuery
-- This table stores custom comparison lines for sales progression charts

CREATE TABLE IF NOT EXISTS `kcsymphony.symphony_dashboard.performance_sales_comparisons` (
  comparison_id STRING NOT NULL,
  performance_id STRING NOT NULL,
  comparison_name STRING NOT NULL,
  weeks_data STRING NOT NULL,  -- CSV format: "1200,2400,3500,4800" (farthest week first)
  line_color STRING DEFAULT '#4285f4',
  line_style STRING DEFAULT 'dashed',  -- 'solid', 'dashed', or 'dotted'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(created_at)
OPTIONS(
  description="Custom sales progression comparison lines for individual performances. Each row represents one comparison line that can be overlaid on the sales curve chart."
);

-- Create index for fast lookups by performance
CREATE INDEX IF NOT EXISTS idx_performance_comparisons_perf_id
ON `kcsymphony.symphony_dashboard.performance_sales_comparisons`(performance_id);

-- Add sample data for testing (optional)
INSERT INTO `kcsymphony.symphony_dashboard.performance_sales_comparisons`
(comparison_id, performance_id, comparison_name, weeks_data, line_color, line_style, created_at, updated_at)
VALUES
  ('sample-1', '12345', 'Optimistic Target', '1200,2400,3800,5200,6500,7800,8900,9500', '#ff6b6b', 'dashed', CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()),
  ('sample-2', '12345', 'Conservative Estimate', '800,1600,2500,3400,4200,5000,5600,6000', '#4ecdc4', 'dotted', CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP());
