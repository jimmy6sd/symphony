// Complete BigQuery audit - detailed view of all tables and data
// READ-ONLY - does not modify any data

const { BigQuery } = require('@google-cloud/bigquery');

async function auditBigQuery() {
  try {
    console.log('═'.repeat(80));
    console.log('BIGQUERY COMPLETE AUDIT - symphony_dashboard dataset');
    console.log('═'.repeat(80));

    const bigquery = new BigQuery({
      projectId: 'kcsymphony',
      keyFilename: '../symphony-bigquery-key.json'
    });

    const dataset = bigquery.dataset('symphony_dashboard');

    // Get all tables
    const [tables] = await dataset.getTables();
    console.log(`\n📚 Found ${tables.length} tables in dataset\n`);

    // Audit each table
    for (const table of tables) {
      console.log('─'.repeat(80));
      console.log(`📋 TABLE: ${table.id}`);
      console.log('─'.repeat(80));

      try {
        // Get table metadata
        const [metadata] = await table.getMetadata();
        console.log(`   Rows: ${metadata.numRows || 'Unknown'}`);
        console.log(`   Size: ${metadata.numBytes ? (metadata.numBytes / 1024 / 1024).toFixed(2) + ' MB' : 'Unknown'}`);
        console.log(`   Created: ${metadata.creationTime ? new Date(parseInt(metadata.creationTime)).toLocaleString() : 'Unknown'}`);
        console.log(`   Modified: ${metadata.lastModifiedTime ? new Date(parseInt(metadata.lastModifiedTime)).toLocaleString() : 'Unknown'}`);

        // Get schema
        console.log(`\n   Schema (${metadata.schema?.fields?.length || 0} columns):`);
        if (metadata.schema?.fields) {
          metadata.schema.fields.forEach(field => {
            console.log(`      - ${field.name} (${field.type}${field.mode === 'REQUIRED' ? ' REQUIRED' : ''})`);
          });
        }

        // Table-specific queries
        console.log(`\n   Data Summary:`);

        switch (table.id) {
          case 'performances':
            await auditPerformances(bigquery);
            break;
          case 'data_snapshots':
            await auditSnapshots(bigquery);
            break;
          case 'pipeline_execution_log':
            await auditPipelineLog(bigquery);
            break;
          case 'weekly_sales':
            await auditWeeklySales(bigquery);
            break;
          case 'series':
            await auditSeries(bigquery);
            break;
          case 'seasons':
            await auditSeasons(bigquery);
            break;
          case 'venues':
            await auditVenues(bigquery);
            break;
          case 'data_sources':
            await auditDataSources(bigquery);
            break;
          case 'performance_freshness':
            await auditPerformanceFreshness(bigquery);
            break;
          case 'latest_snapshot':
            await auditLatestSnapshot(bigquery);
            break;
          case 'refresh_log':
            await auditRefreshLog(bigquery);
            break;
          default:
            console.log(`      (No custom audit for this table)`);
        }

      } catch (error) {
        console.log(`   ❌ Error auditing table: ${error.message}`);
      }

      console.log('');
    }

    console.log('═'.repeat(80));
    console.log('✅ AUDIT COMPLETE');
    console.log('═'.repeat(80));

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
  }
}

// Detailed audit functions for each table

async function auditPerformances(bigquery) {
  const query = `
    SELECT
      COUNT(*) as total,
      COUNT(DISTINCT performance_code) as unique_codes,
      COUNTIF(has_sales_data = true) as with_sales,
      COUNTIF(has_sales_data = false) as without_sales,
      MIN(performance_date) as earliest_date,
      MAX(performance_date) as latest_date,
      SUM(single_tickets_sold) as total_single,
      SUM(subscription_tickets_sold) as total_sub,
      SUM(total_revenue) as total_revenue,
      AVG(capacity_percent) as avg_capacity,
      COUNT(DISTINCT series) as unique_series,
      COUNT(DISTINCT season) as unique_seasons
    FROM \`kcsymphony.symphony_dashboard.performances\`
  `;

  const [rows] = await bigquery.query({ query, location: 'US' });
  const stats = rows[0];

  console.log(`      Total Rows: ${stats.total}`);
  console.log(`      Unique Performance Codes: ${stats.unique_codes}`);
  console.log(`      With Sales Data: ${stats.with_sales}`);
  console.log(`      Without Sales Data: ${stats.without_sales}`);
  console.log(`      Date Range: ${stats.earliest_date?.value || 'N/A'} to ${stats.latest_date?.value || 'N/A'}`);
  console.log(`      Total Single Tickets: ${stats.total_single?.toLocaleString() || 0}`);
  console.log(`      Total Subscription Tickets: ${stats.total_sub?.toLocaleString() || 0}`);
  console.log(`      Total Revenue: $${stats.total_revenue?.toLocaleString() || 0}`);
  console.log(`      Average Capacity: ${stats.avg_capacity?.toFixed(1) || 0}%`);
  console.log(`      Unique Series: ${stats.unique_series}`);
  console.log(`      Unique Seasons: ${stats.unique_seasons}`);

  // Show top series by performance count
  const seriesQuery = `
    SELECT series, COUNT(*) as count
    FROM \`kcsymphony.symphony_dashboard.performances\`
    GROUP BY series
    ORDER BY count DESC
    LIMIT 10
  `;
  const [seriesRows] = await bigquery.query({ query: seriesQuery, location: 'US' });
  console.log(`\n      Top 10 Series by Performance Count:`);
  seriesRows.forEach(row => {
    console.log(`         ${row.series || '(null)'}: ${row.count}`);
  });
}

async function auditSnapshots(bigquery) {
  const query = `
    SELECT
      COUNT(*) as total_snapshots,
      COUNT(DISTINCT source_identifier) as unique_sources,
      MIN(snapshot_date) as earliest,
      MAX(snapshot_date) as latest,
      SUM(performance_count) as total_performances,
      SUM(total_tickets_in_snapshot) as total_tickets,
      SUM(total_revenue_in_snapshot) as total_revenue
    FROM \`kcsymphony.symphony_dashboard.data_snapshots\`
  `;

  const [rows] = await bigquery.query({ query, location: 'US' });
  const stats = rows[0];

  console.log(`      Total Snapshots: ${stats.total_snapshots}`);
  console.log(`      Unique Source Files: ${stats.unique_sources}`);
  console.log(`      Date Range: ${stats.earliest?.value || 'N/A'} to ${stats.latest?.value || 'N/A'}`);
  console.log(`      Total Performances Across All Snapshots: ${stats.total_performances?.toLocaleString() || 0}`);
  console.log(`      Total Tickets: ${stats.total_tickets?.toLocaleString() || 0}`);
  console.log(`      Total Revenue: $${stats.total_revenue?.toLocaleString() || 0}`);

  // Show recent snapshots
  const recentQuery = `
    SELECT
      snapshot_id,
      snapshot_date,
      source_identifier,
      performance_count,
      processing_status
    FROM \`kcsymphony.symphony_dashboard.data_snapshots\`
    ORDER BY snapshot_date DESC
    LIMIT 5
  `;
  const [recentRows] = await bigquery.query({ query: recentQuery, location: 'US' });
  console.log(`\n      Recent Snapshots:`);
  recentRows.forEach(row => {
    console.log(`         ${row.snapshot_date?.value || 'N/A'}: ${row.source_identifier} (${row.performance_count} perfs, ${row.processing_status})`);
  });
}

async function auditPipelineLog(bigquery) {
  const query = `
    SELECT
      COUNT(*) as total_executions,
      COUNTIF(status = 'completed') as completed,
      COUNTIF(status = 'failed') as failed,
      COUNTIF(status = 'running') as running,
      SUM(records_processed) as total_processed,
      SUM(records_inserted) as total_inserted,
      SUM(records_updated) as total_updated,
      MIN(start_time) as earliest,
      MAX(start_time) as latest
    FROM \`kcsymphony.symphony_dashboard.pipeline_execution_log\`
  `;

  const [rows] = await bigquery.query({ query, location: 'US' });
  const stats = rows[0];

  console.log(`      Total Executions: ${stats.total_executions}`);
  console.log(`      Completed: ${stats.completed}`);
  console.log(`      Failed: ${stats.failed}`);
  console.log(`      Running: ${stats.running}`);
  console.log(`      Total Records Processed: ${stats.total_processed || 0}`);
  console.log(`      Total Records Inserted: ${stats.total_inserted || 0}`);
  console.log(`      Total Records Updated: ${stats.total_updated || 0}`);
  console.log(`      Execution Range: ${stats.earliest?.value || 'N/A'} to ${stats.latest?.value || 'N/A'}`);

  // Show recent executions
  const recentQuery = `
    SELECT
      execution_id,
      start_time,
      status,
      source_file,
      records_processed,
      records_inserted,
      records_updated
    FROM \`kcsymphony.symphony_dashboard.pipeline_execution_log\`
    ORDER BY start_time DESC
    LIMIT 5
  `;
  const [recentRows] = await bigquery.query({ query: recentQuery, location: 'US' });
  console.log(`\n      Recent Executions:`);
  recentRows.forEach(row => {
    console.log(`         ${row.start_time?.value || 'N/A'}: ${row.source_file || 'unknown'}`);
    console.log(`            Status: ${row.status}, Processed: ${row.records_processed || 0}, Inserted: ${row.records_inserted || 0}, Updated: ${row.records_updated || 0}`);
  });
}

async function auditWeeklySales(bigquery) {
  const query = `
    SELECT
      COUNT(*) as total_records,
      COUNT(DISTINCT performance_id) as unique_performances,
      AVG(week_number) as avg_week,
      MAX(week_number) as max_week,
      SUM(tickets_sold_this_week) as total_tickets,
      SUM(revenue_this_week) as total_revenue
    FROM \`kcsymphony.symphony_dashboard.weekly_sales\`
  `;

  const [rows] = await bigquery.query({ query, location: 'US' });
  const stats = rows[0];

  console.log(`      Total Records: ${stats.total_records}`);
  console.log(`      Unique Performances: ${stats.unique_performances}`);
  console.log(`      Average Week: ${stats.avg_week?.toFixed(1) || 0}`);
  console.log(`      Max Week: ${stats.max_week || 0}`);
  console.log(`      Total Tickets Across All Weeks: ${stats.total_tickets?.toLocaleString() || 0}`);
  console.log(`      Total Revenue Across All Weeks: $${stats.total_revenue?.toLocaleString() || 0}`);
}

async function auditSeries(bigquery) {
  const query = `SELECT COUNT(*) as count, series_name FROM \`kcsymphony.symphony_dashboard.series\` GROUP BY series_name`;
  const [rows] = await bigquery.query({ query, location: 'US' });
  console.log(`      Total Series: ${rows.length}`);
  rows.forEach(row => console.log(`         ${row.series_name}: ${row.count} records`));
}

async function auditSeasons(bigquery) {
  const query = `SELECT COUNT(*) as count, season_name FROM \`kcsymphony.symphony_dashboard.seasons\` GROUP BY season_name`;
  const [rows] = await bigquery.query({ query, location: 'US' });
  console.log(`      Total Seasons: ${rows.length}`);
  rows.forEach(row => console.log(`         ${row.season_name}: ${row.count} records`));
}

async function auditVenues(bigquery) {
  const query = `SELECT COUNT(*) as count, venue_name FROM \`kcsymphony.symphony_dashboard.venues\` GROUP BY venue_name`;
  const [rows] = await bigquery.query({ query, location: 'US' });
  console.log(`      Total Venues: ${rows.length}`);
  rows.forEach(row => console.log(`         ${row.venue_name}: ${row.count} records`));
}

async function auditDataSources(bigquery) {
  const query = `SELECT * FROM \`kcsymphony.symphony_dashboard.data_sources\` ORDER BY source_name`;
  const [rows] = await bigquery.query({ query, location: 'US' });
  console.log(`      Total Data Sources: ${rows.length}`);
  rows.forEach(row => console.log(`         ${row.source_name}: ${row.description || 'No description'}`));
}

async function auditPerformanceFreshness(bigquery) {
  const query = `SELECT COUNT(*) as count FROM \`kcsymphony.symphony_dashboard.performance_freshness\``;
  const [rows] = await bigquery.query({ query, location: 'US' });
  console.log(`      Total Records: ${rows[0].count}`);
}

async function auditLatestSnapshot(bigquery) {
  const query = `SELECT COUNT(*) as count FROM \`kcsymphony.symphony_dashboard.latest_snapshot\``;
  const [rows] = await bigquery.query({ query, location: 'US' });
  console.log(`      Total Records: ${rows[0].count}`);
}

async function auditRefreshLog(bigquery) {
  const query = `
    SELECT
      COUNT(*) as total,
      MAX(refresh_time) as last_refresh
    FROM \`kcsymphony.symphony_dashboard.refresh_log\`
  `;
  const [rows] = await bigquery.query({ query, location: 'US' });
  console.log(`      Total Refresh Events: ${rows[0].total}`);
  console.log(`      Last Refresh: ${rows[0].last_refresh?.value || 'N/A'}`);
}

// Run the audit
auditBigQuery();
