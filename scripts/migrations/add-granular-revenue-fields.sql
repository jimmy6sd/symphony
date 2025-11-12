-- ============================================================================
-- Schema Migration: Add Granular Revenue & Ticket Data Fields
-- ============================================================================
-- Date: 2025-01-11
-- Purpose: Enhance performance_sales_snapshots table to capture detailed
--          ticket type breakdown, revenue breakdown, and ATP analytics
--
-- SAFETY: This is an ADDITIVE migration (only ADD COLUMN operations)
--         - Backward compatible with existing queries
--         - Existing data unaffected (new fields will be NULL)
--         - Can be run multiple times safely (IF NOT EXISTS)
--
-- USAGE:
--   bq query --use_legacy_sql=false < scripts/migrations/add-granular-revenue-fields.sql
--   OR
--   node scripts/migrations/run-schema-migration.js
-- ============================================================================

-- Add performance time field
ALTER TABLE `kcsymphony.symphony_dashboard.performance_sales_snapshots`
ADD COLUMN IF NOT EXISTS performance_time STRING
OPTIONS(description="Performance time (e.g., '7:30 PM', '2:00 PM')");

-- ============================================================================
-- TICKET COUNT BREAKDOWN (Granular ticket type tracking)
-- ============================================================================

ALTER TABLE `kcsymphony.symphony_dashboard.performance_sales_snapshots`
ADD COLUMN IF NOT EXISTS fixed_tickets_sold INT64
OPTIONS(description="Fixed package tickets (subscriptions)");

ALTER TABLE `kcsymphony.symphony_dashboard.performance_sales_snapshots`
ADD COLUMN IF NOT EXISTS non_fixed_tickets_sold INT64
OPTIONS(description="Non-fixed package tickets (flexible packages)");

-- Note: single_tickets_sold already exists, but now represents PURE single tickets
-- (not combined with non-fixed packages)

ALTER TABLE `kcsymphony.symphony_dashboard.performance_sales_snapshots`
ADD COLUMN IF NOT EXISTS reserved_tickets INT64
OPTIONS(description="Reserved/comp tickets");

-- ============================================================================
-- REVENUE BREAKDOWN (Granular revenue by ticket type)
-- ============================================================================

ALTER TABLE `kcsymphony.symphony_dashboard.performance_sales_snapshots`
ADD COLUMN IF NOT EXISTS fixed_revenue FLOAT64
OPTIONS(description="Revenue from fixed packages (subscriptions)");

ALTER TABLE `kcsymphony.symphony_dashboard.performance_sales_snapshots`
ADD COLUMN IF NOT EXISTS non_fixed_revenue FLOAT64
OPTIONS(description="Revenue from non-fixed packages");

ALTER TABLE `kcsymphony.symphony_dashboard.performance_sales_snapshots`
ADD COLUMN IF NOT EXISTS single_revenue FLOAT64
OPTIONS(description="Revenue from single tickets");

ALTER TABLE `kcsymphony.symphony_dashboard.performance_sales_snapshots`
ADD COLUMN IF NOT EXISTS reserved_revenue FLOAT64
OPTIONS(description="Revenue from reserved/comp tickets");

ALTER TABLE `kcsymphony.symphony_dashboard.performance_sales_snapshots`
ADD COLUMN IF NOT EXISTS subtotal_revenue FLOAT64
OPTIONS(description="Revenue before reserved/comps");

-- ============================================================================
-- INVENTORY TRACKING
-- ============================================================================

ALTER TABLE `kcsymphony.symphony_dashboard.performance_sales_snapshots`
ADD COLUMN IF NOT EXISTS available_seats INT64
OPTIONS(description="Remaining available seats at snapshot time");

-- ============================================================================
-- CALCULATED ATP ANALYTICS (Average Ticket Price by type)
-- ============================================================================

ALTER TABLE `kcsymphony.symphony_dashboard.performance_sales_snapshots`
ADD COLUMN IF NOT EXISTS fixed_atp FLOAT64
OPTIONS(description="Average ticket price for fixed packages: fixed_revenue / fixed_tickets_sold");

ALTER TABLE `kcsymphony.symphony_dashboard.performance_sales_snapshots`
ADD COLUMN IF NOT EXISTS non_fixed_atp FLOAT64
OPTIONS(description="Average ticket price for non-fixed packages: non_fixed_revenue / non_fixed_tickets_sold");

ALTER TABLE `kcsymphony.symphony_dashboard.performance_sales_snapshots`
ADD COLUMN IF NOT EXISTS single_atp FLOAT64
OPTIONS(description="Average ticket price for single tickets: single_revenue / single_tickets_sold");

ALTER TABLE `kcsymphony.symphony_dashboard.performance_sales_snapshots`
ADD COLUMN IF NOT EXISTS overall_atp FLOAT64
OPTIONS(description="Overall average ticket price: total_revenue / total_tickets_sold");

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
-- Run this to verify the migration worked:
--
-- SELECT
--   column_name,
--   data_type,
--   description
-- FROM `kcsymphony.symphony_dashboard.INFORMATION_SCHEMA.COLUMNS`
-- WHERE table_name = 'performance_sales_snapshots'
--   AND column_name IN (
--     'performance_time',
--     'fixed_tickets_sold', 'non_fixed_tickets_sold', 'reserved_tickets',
--     'fixed_revenue', 'non_fixed_revenue', 'single_revenue', 'reserved_revenue', 'subtotal_revenue',
--     'available_seats',
--     'fixed_atp', 'non_fixed_atp', 'single_atp', 'overall_atp'
--   )
-- ORDER BY ordinal_position;
-- ============================================================================
