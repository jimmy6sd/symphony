-- Create subscription_renewal_snapshots table
-- Stores data from KCS Package Sales Renewal Report PDFs (combined format)
-- One PDF per day, all categories, with New/Renewed breakdown

CREATE TABLE IF NOT EXISTS kcsymphony.symphony_dashboard.subscription_renewal_snapshots (
  snapshot_date DATE NOT NULL,
  season STRING NOT NULL,
  category STRING NOT NULL,
  package_type STRING NOT NULL,
  package_name STRING NOT NULL,
  new_pkg_seats INT64,
  new_amount FLOAT64,
  renewed_pkg_seats INT64,
  renewed_amount FLOAT64,
  total_pkg_seats INT64,
  total_amount FLOAT64,
  is_sub_line BOOLEAN DEFAULT FALSE
)
PARTITION BY snapshot_date
CLUSTER BY category, season;
