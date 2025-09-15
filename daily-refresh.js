#!/usr/bin/env node

const { TessituraDataFetcherCached } = require('./fetch-tessitura-data-cached.js');

/**
 * Daily refresh script for Symphony Dashboard
 * This script should be run once per day to refresh the dashboard data
 * Can be scheduled via cron, GitHub Actions, or cloud scheduler
 */

async function dailyRefresh() {
    console.log('🌅 Starting daily dashboard refresh...');
    console.log(`📅 Date: ${new Date().toISOString()}`);

    const fetcher = new TessituraDataFetcherCached();
    await fetcher.init();

    try {
        // Clean up expired cache first
        console.log('\n🧹 Cleaning expired cache entries...');
        const expiredKeys = await fetcher.cleanExpiredCache();
        console.log(`Cleaned ${expiredKeys.length} expired entries`);

        // Force refresh dashboard data (this will fetch fresh data from Tessitura)
        console.log('\n📊 Force refreshing dashboard data...');
        const result = await fetcher.getDashboardData(true); // forceRefresh = true

        if (result.success) {
            console.log(`✅ Daily refresh completed successfully!`);
            console.log(`📊 Updated ${result.data.length} performances`);
            console.log(`💾 Data cached for next 24 hours`);

            // Log cache status
            const status = await fetcher.getCacheStatus();
            console.log(`📋 Cache now contains ${status.validEntries} valid entries`);

            return { success: true, performanceCount: result.data.length };
        } else {
            console.error('❌ Daily refresh failed:', result.error);
            return { success: false, error: result.error };
        }
    } catch (error) {
        console.error('💥 Daily refresh error:', error.message);
        return { success: false, error: error.message };
    }
}

// Run if called directly
if (require.main === module) {
    dailyRefresh()
        .then(result => {
            if (result.success) {
                console.log('\n✅ Daily refresh completed successfully');
                process.exit(0);
            } else {
                console.error('\n❌ Daily refresh failed');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('💥 Fatal error during daily refresh:', error.message);
            process.exit(1);
        });
}

module.exports = { dailyRefresh };