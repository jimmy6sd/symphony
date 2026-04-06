-- Studio Tables Migration
-- Creates tables for Studio planning view: plans, comps, and activities

-- Studio Plans: plan metadata and templates
CREATE TABLE IF NOT EXISTS `kcsymphony.symphony_dashboard.studio_plans` (
  plan_id STRING NOT NULL,
  plan_name STRING NOT NULL,
  target_perf_code STRING,
  series STRING,
  venue STRING,
  capacity INT64,
  budget_goal FLOAT64,
  is_template BOOL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- Studio Plan Comps: selected comparison performances per plan
CREATE TABLE IF NOT EXISTS `kcsymphony.symphony_dashboard.studio_plan_comps` (
  id STRING NOT NULL,
  plan_id STRING NOT NULL,
  performance_code STRING NOT NULL,
  is_target BOOL DEFAULT FALSE,
  sort_order INT64 DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- Studio Plan Activities: marketing activities per plan
CREATE TABLE IF NOT EXISTS `kcsymphony.symphony_dashboard.studio_plan_activities` (
  activity_id STRING NOT NULL,
  plan_id STRING NOT NULL,
  week_number INT64 NOT NULL,
  label STRING NOT NULL,
  activity_type STRING DEFAULT 'OTHER',
  color STRING,
  end_week INT64,
  ticket_delta INT64,
  spread_weeks INT64 DEFAULT 1,
  sort_order INT64 DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);
