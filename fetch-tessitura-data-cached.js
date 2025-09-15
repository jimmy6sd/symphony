#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { CacheManager } = require('./cache-manager.js');

// Load environment variables
require('dotenv').config();

// Import configuration
const CONFIG = require('./js/config.js');

// Import data transformer
const { TessituraDataTransformer } = require('./data/tessitura-data-transformer.js');

// Fetch implementation for Node.js
let fetch;
try {
    fetch = require('undici').fetch;
} catch (e) {
    try {
        fetch = require('node-fetch');
    } catch (e2) {
        console.error('❌ No fetch implementation found. Install undici or node-fetch:');
        console.error('npm install undici');
        process.exit(1);
    }
}

class TessituraDataFetcherCached {
    constructor() {
        // Load config from environment variables
        this.config = {
            baseUrl: process.env.TESSITURA_BASE_URL,
            authentication: {
                username: process.env.TESSITURA_USERNAME,
                password: process.env.TESSITURA_PASSWORD
            },
            userGroup: process.env.TESSITURA_USER_GROUP,
            machineLocation: process.env.TESSITURA_MACHINE_LOCATION
        };
        this.cache = new CacheManager('./data');

        // Build authentication string
        this.authString = `${this.config.authentication.username}:${this.config.userGroup}:${this.config.machineLocation}:${this.config.authentication.password}`;
        this.encodedAuth = Buffer.from(this.authString).toString('base64');

        // Cache TTL settings (in milliseconds)
        this.cacheTTL = {
            performances: 24 * 60 * 60 * 1000,    // 24 hours
            seasons: 7 * 24 * 60 * 60 * 1000,     // 7 days (seasons change less frequently)
            sales: 4 * 60 * 60 * 1000,             // 4 hours (sales data changes more frequently)
            diagnostics: 60 * 60 * 1000,           // 1 hour
            default: 24 * 60 * 60 * 1000           // 24 hours default
        };

        console.log('🔧 Cached Tessitura Data Fetcher initialized');
        console.log('🔗 Base URL:', this.config.baseUrl);
        console.log('👤 Auth User:', this.config.authentication.username);
        console.log('💾 Cache TTL: 24h (performances), 4h (sales), 7d (seasons)');
    }

    async init() {
        await this.cache.init();
        console.log('💾 Cache manager initialized');
    }

    getAuthHeaders() {
        return {
            'Authorization': `Basic ${this.encodedAuth}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Symphony Dashboard Data Fetcher (Cached)'
        };
    }

    buildUrl(endpoint) {
        return `${this.config.baseUrl}${endpoint}`;
    }

    async makeRequest(endpoint, description = '') {
        const url = this.buildUrl(endpoint);
        const headers = this.getAuthHeaders();

        console.log(`📤 Fetching ${description || endpoint}...`);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers,
                timeout: 30000
            });

            console.log(`📥 Status: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unable to read error response');
                throw new Error(`HTTP ${response.status}: ${response.statusText}\n${errorText}`);
            }

            const data = await response.json().catch(async () => {
                const text = await response.text();
                console.log('⚠️  Non-JSON response, saving as text');
                return { rawResponse: text };
            });

            return { success: true, data, status: response.status };
        } catch (error) {
            console.error(`❌ Request failed for ${endpoint}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    async fetchWithCache(cacheKey, fetchFunction, ttl = null) {
        console.log(`\n🔍 Checking cache for '${cacheKey}'...`);

        // Try to get from cache first
        const cached = await this.cache.getCachedData(cacheKey);
        if (cached) {
            console.log(`✅ Using cached data for '${cacheKey}'`);
            return { success: true, data: cached.data, fromCache: true, cachedAt: cached.timestamp };
        }

        console.log(`📡 Cache miss for '${cacheKey}', fetching from API...`);

        // Fetch fresh data
        const result = await fetchFunction();
        if (result.success) {
            // Cache the successful result
            const cacheTTL = ttl || this.cacheTTL[cacheKey] || this.cacheTTL.default;
            await this.cache.cacheData(cacheKey, result.data, cacheTTL);

            console.log(`✅ Fetched and cached '${cacheKey}'`);
            return { ...result, fromCache: false, freshData: true };
        }

        return result;
    }

    async testConnection() {
        console.log('\n🧪 Testing Tessitura API Connection...');

        return await this.fetchWithCache('diagnostics', async () => {
            return await this.makeRequest('/Diagnostics/Status', 'connection test');
        }, this.cacheTTL.diagnostics);
    }

    async fetchPerformances(forceRefresh = false) {
        console.log('\n🎭 Fetching Performances...');

        if (forceRefresh) {
            console.log('🔄 Force refresh requested, skipping cache');
            await this.cache.deleteCacheEntry('performances');
        }

        return await this.fetchWithCache('performances', async () => {
            // Try different performance endpoints with parameters
            const endpoints = [
                '/TXN/Performances?seasonIds=244',  // Use the season ID we know has data
                '/TXN/Performances?seasonIds=2025',
                '/TXN/Performances?seasonIds=2024',
                '/TXN/Performances?productionSeasonId=244',
                '/TXN/Performances?productionSeasonId=1'
            ];

            for (const endpoint of endpoints) {
                console.log(`🔍 Trying endpoint: ${endpoint}`);
                const result = await this.makeRequest(endpoint, 'performances data');

                if (result.success && result.data && Array.isArray(result.data) && result.data.length > 0) {
                    console.log(`✅ Found ${result.data.length} performances`);
                    return result;
                } else {
                    console.log(`⚠️  Endpoint ${endpoint} returned no data or failed`);
                }
            }

            return { success: false, error: 'All performance endpoints failed or returned no data' };
        }, this.cacheTTL.performances);
    }

    async fetchSeasons(forceRefresh = false) {
        console.log('\n📅 Fetching Seasons...');

        if (forceRefresh) {
            console.log('🔄 Force refresh requested, skipping cache');
            await this.cache.deleteCacheEntry('seasons');
        }

        return await this.fetchWithCache('seasons', async () => {
            const endpoints = [
                '/TXN/Seasons',
                '/CRM/Seasons',
                '/Reference/Seasons'
            ];

            for (const endpoint of endpoints) {
                console.log(`🔍 Trying endpoint: ${endpoint}`);
                const result = await this.makeRequest(endpoint, 'seasons data');

                if (result.success) {
                    return result;
                }
            }

            return { success: false, error: 'All season endpoints failed' };
        }, this.cacheTTL.seasons);
    }

    async fetchSalesData(forceRefresh = false) {
        console.log('\n📊 Fetching Sales Data...');

        if (forceRefresh) {
            console.log('🔄 Force refresh requested, skipping cache');
            await this.cache.deleteCacheEntry('sales');
        }

        return await this.fetchWithCache('sales', async () => {
            const endpoints = [
                '/TXN/Orders/Search',
                '/TXN/Orders',
                '/TXN/Sales',
                '/Sales'
            ];

            for (const endpoint of endpoints) {
                console.log(`🔍 Trying endpoint: ${endpoint}`);
                const result = await this.makeRequest(endpoint, 'sales data');

                if (result.success) {
                    return result;
                }
            }

            return { success: false, error: 'All sales endpoints failed' };
        }, this.cacheTTL.sales);
    }

    async transformToDashboard(performancesData) {
        console.log('\n🔄 Transforming data for dashboard...');

        if (!performancesData || !Array.isArray(performancesData)) {
            console.log('⚠️  No valid performance data to transform');
            return [];
        }

        const transformed = performancesData.map(perf => {
            // Calculate occupancy rate
            const totalSold = (perf.singleTicketsSold || 0) + (perf.subscriptionTicketsSold || 0);
            const capacity = perf.capacity || 0;
            const occupancyRate = capacity > 0 ? (totalSold / capacity * 100) : 0;

            // Determine status
            let status = 'On Sale';
            if (occupancyRate >= 100) {
                status = 'Sold Out';
            } else if (occupancyRate >= 95) {
                status = 'Nearly Sold Out';
            }

            return {
                id: perf.id,
                title: perf.title || perf.name || 'Unknown Performance',
                code: perf.code || perf.performanceCode || '',
                date: perf.date || perf.performanceDate || new Date().toISOString(),
                venue: perf.venue || perf.facilityName || 'Unknown Venue',
                capacity: capacity,
                singleTicketsSold: perf.singleTicketsSold || 0,
                subscriptionTicketsSold: perf.subscriptionTicketsSold || 0,
                totalSold: totalSold,
                totalRevenue: perf.totalRevenue || perf.revenue || 0,
                occupancyRate: Math.round(occupancyRate * 10) / 10,
                occupancyGoal: perf.occupancyGoal || CONFIG.performances.defaultOccupancyGoal,
                status: status,
                rawData: perf // Keep original data for debugging
            };
        });

        console.log(`✅ Transformed ${transformed.length} performances for dashboard`);
        return transformed;
    }

    async getDashboardData(forceRefresh = false) {
        console.log('\n📊 Getting Dashboard Data...');

        // Check if we have cached dashboard data
        const dashboardCacheKey = 'dashboard-performances';

        if (!forceRefresh) {
            const cached = await this.cache.getCachedData(dashboardCacheKey);
            if (cached) {
                console.log('✅ Using cached dashboard data');
                return { success: true, data: cached.data, fromCache: true };
            }
        }

        // Fetch fresh performance data
        const performancesResult = await this.fetchPerformances(forceRefresh);

        if (performancesResult.success) {
            // Transform the data
            const dashboardData = TessituraDataTransformer.createDashboardData(performancesResult.data);

            // Cache the transformed dashboard data
            await this.cache.cacheData(dashboardCacheKey, dashboardData, this.cacheTTL.performances);

            // Also save to the expected dashboard file for the frontend
            await fs.writeFile(
                path.join('./data', 'dashboard-performances.json'),
                JSON.stringify(dashboardData, null, 2),
                'utf8'
            );

            console.log('💾 Saved dashboard data to dashboard-performances.json');

            return { success: true, data: dashboardData, fromCache: false };
        }

        return performancesResult;
    }

    async getCacheStatus() {
        return await this.cache.getCacheStatus();
    }

    async clearCache(keys = null) {
        if (keys) {
            for (const key of keys) {
                await this.cache.deleteCacheEntry(key);
            }
            console.log(`🗑️  Cleared cache for: ${keys.join(', ')}`);
        } else {
            await this.cache.clearAllCache();
            console.log('🗑️  Cleared all cache');
        }
    }

    async cleanExpiredCache() {
        const expiredKeys = await this.cache.clearExpiredCache();
        return expiredKeys;
    }
}

// CLI execution
async function main() {
    const fetcher = new TessituraDataFetcherCached();
    await fetcher.init();

    const args = process.argv.slice(2);
    const command = args[0] || 'dashboard';
    const forceRefresh = args.includes('--force') || args.includes('-f');

    switch (command) {
        case 'status':
            console.log('\n📊 Cache Status:');
            const status = await fetcher.getCacheStatus();
            console.log(`Total entries: ${status.totalEntries}`);
            console.log(`Valid: ${status.validEntries}, Expired: ${status.expiredEntries}`);

            if (status.entries.length > 0) {
                console.log('\n📋 Cache Entries:');
                status.entries.forEach(entry => {
                    const validIcon = entry.valid ? '✅' : '❌';
                    const timeInfo = entry.valid ?
                        `expires in ${entry.timeToExpiryHours}h` :
                        `expired ${entry.ageHours}h ago`;
                    console.log(`${validIcon} ${entry.key} (${entry.sizeKB}KB) - ${timeInfo}`);
                });
            }
            break;

        case 'clear':
            const keysToClear = args.slice(1).filter(arg => !arg.startsWith('-'));
            await fetcher.clearCache(keysToClear.length > 0 ? keysToClear : null);
            break;

        case 'clean':
            const expiredKeys = await fetcher.cleanExpiredCache();
            console.log(`🗑️  Cleaned ${expiredKeys.length} expired cache entries`);
            break;

        case 'test':
            const connectionResult = await fetcher.testConnection();
            console.log(connectionResult.fromCache ? '📁 From cache' : '📡 Fresh data');
            break;

        case 'performances':
            const performancesResult = await fetcher.fetchPerformances(forceRefresh);
            console.log(performancesResult.fromCache ? '📁 From cache' : '📡 Fresh data');
            if (performancesResult.success) {
                console.log(`Found ${Array.isArray(performancesResult.data) ? performancesResult.data.length : 'unknown count'} performances`);
            }
            break;

        case 'seasons':
            const seasonsResult = await fetcher.fetchSeasons(forceRefresh);
            console.log(seasonsResult.fromCache ? '📁 From cache' : '📡 Fresh data');
            break;

        case 'sales':
            const salesResult = await fetcher.fetchSalesData(forceRefresh);
            console.log(salesResult.fromCache ? '📁 From cache' : '📡 Fresh data');
            break;

        case 'dashboard':
        default:
            console.log(forceRefresh ? '🔄 Force refreshing dashboard data...' : '📊 Getting dashboard data...');
            const dashboardResult = await fetcher.getDashboardData(forceRefresh);
            if (dashboardResult.success) {
                console.log(`✅ Dashboard data ready with ${dashboardResult.data.length} performances`);
                console.log(dashboardResult.fromCache ? '📁 Data served from cache' : '📡 Fresh data fetched and cached');
            } else {
                console.log('❌ Failed to get dashboard data');
            }
            break;
    }
}

// Export for use as module
module.exports = { TessituraDataFetcherCached };

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('💥 Fatal error:', error.message);
        process.exit(1);
    });
}