#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

// Load environment variables from .env file
function loadEnv() {
    const config = {
        baseUrl: 'https://KFFCTRUSMO0webprod.tnhs.cloud/tessitura/api',
        username: 'jhender',
        password: 'ForTheShowKCSY25!',
        userGroup: 'syweb',
        machineLocation: 'jhender'
    };

    try {
        const envFile = require('fs').readFileSync('.env', 'utf8');
        const lines = envFile.split('\n');

        for (const line of lines) {
            if (line.trim() && !line.startsWith('#')) {
                const [key, value] = line.split('=');
                if (key && value) {
                    switch (key.trim()) {
                        case 'TESSITURA_BASE_URL':
                            config.baseUrl = value.trim();
                            break;
                        case 'TESSITURA_USERNAME':
                            config.username = value.trim();
                            break;
                        case 'TESSITURA_PASSWORD':
                            config.password = value.trim();
                            break;
                        case 'TESSITURA_USERGROUP':
                            config.userGroup = value.trim();
                            break;
                        case 'TESSITURA_LOCATION':
                            config.machineLocation = value.trim();
                            break;
                    }
                }
            }
        }
        console.log('✅ Loaded configuration from .env file');
    } catch (error) {
        console.log('⚠️  No .env file found, using default configuration');
    }

    return config;
}

// Fetch implementation
let fetch;
try {
    fetch = require('undici').fetch;
} catch (e) {
    try {
        fetch = require('node-fetch');
    } catch (e2) {
        console.error('❌ No fetch implementation found');
        process.exit(1);
    }
}

class TessituraProductionSearch {
    constructor() {
        this.config = loadEnv();
        this.dataDir = './data';

        this.authString = `${this.config.username}:${this.config.userGroup}:${this.config.machineLocation}:${this.config.password}`;
        this.encodedAuth = Buffer.from(this.authString).toString('base64');

        console.log('🔧 Tessitura Production Search initialized');
        console.log('🔗 Base URL:', this.config.baseUrl);
        console.log('👤 Auth User:', this.config.username);
    }

    async init() {
        await fs.mkdir(this.dataDir, { recursive: true });
    }

    getAuthHeaders() {
        return {
            'Authorization': `Basic ${this.encodedAuth}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Symphony Production Tessitura Search'
        };
    }

    async makeRequest(endpoint, method = 'GET', body = null, description = '') {
        const url = `${this.config.baseUrl}${endpoint}`;
        const headers = this.getAuthHeaders();

        console.log(`📤 ${method} ${description || endpoint}...`);
        console.log(`🔗 URL: ${url}`);

        try {
            const options = {
                method,
                headers,
                timeout: 30000
            };

            if (body && (method === 'POST' || method === 'PUT')) {
                options.body = JSON.stringify(body);
                console.log('📄 Request body:', JSON.stringify(body, null, 2));
            }

            const response = await fetch(url, options);

            console.log(`📥 Status: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unable to read error response');
                throw new Error(`HTTP ${response.status}: ${response.statusText}\n${errorText}`);
            }

            const data = await response.json();
            return { success: true, data, status: response.status };
        } catch (error) {
            console.error(`❌ Request failed for ${endpoint}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    async testConnection() {
        console.log('\n🧪 Testing Production API Connection...');

        // Try the diagnostics endpoint first
        const result = await this.makeRequest('/Diagnostics/Status', 'GET', null, 'connection test');

        if (result.success) {
            console.log('✅ Production connection successful!');
            await fs.writeFile(
                path.join(this.dataDir, 'production-diagnostics.json'),
                JSON.stringify(result.data, null, 2),
                'utf8'
            );
            return true;
        } else {
            console.error('❌ Production connection failed:', result.error);
            return false;
        }
    }

    async searchPerformances() {
        console.log('\n🎭 Searching for Performances using POST /TXN/Performances/Search...');

        // Create search request for performances in our date range
        const searchRequest = {
            // Date range for our target period (8/1/25 to 8/1/26)
            DefaultStartSaleDateTime: '2025-08-01T00:00:00.000Z',
            DefaultEndSaleDateTime: '2026-08-01T23:59:59.999Z'
        };

        const result = await this.makeRequest(
            '/TXN/Performances/Search',
            'POST',
            searchRequest,
            'performance search with date range'
        );

        if (result.success) {
            console.log('✅ Performance search successful!');

            if (Array.isArray(result.data)) {
                console.log(`📊 Found ${result.data.length} performances`);

                // Filter by date range if needed
                const targetStart = new Date('2025-08-01');
                const targetEnd = new Date('2026-08-01');

                const filteredPerformances = result.data.filter(perf => {
                    const dateFields = ['PerformanceDateTime', 'DefaultStartSaleDateTime', 'DefaultEndSaleDateTime', 'Date'];
                    for (const field of dateFields) {
                        if (perf[field]) {
                            const perfDate = new Date(perf[field]);
                            if (perfDate >= targetStart && perfDate <= targetEnd) {
                                return true;
                            }
                        }
                    }
                    return false;
                });

                console.log(`🎯 ${filteredPerformances.length} performances in target date range`);

                if (filteredPerformances.length > 0) {
                    console.log('\n🎪 Performances in date range:');
                    filteredPerformances.forEach((perf, index) => {
                        const date = perf.PerformanceDateTime || perf.Date || 'Unknown date';
                        const title = perf.Title || perf.Name || `Performance ${perf.Id || index + 1}`;
                        console.log(`   • ${title} - ${date}`);
                    });

                    // Save filtered results
                    await fs.writeFile(
                        path.join(this.dataDir, 'performances-2025-2026-filtered.json'),
                        JSON.stringify({
                            searchCriteria: searchRequest,
                            totalResults: result.data.length,
                            filteredResults: filteredPerformances.length,
                            performances: filteredPerformances,
                            fetchedAt: new Date().toISOString()
                        }, null, 2),
                        'utf8'
                    );
                }

                // Save all results
                await fs.writeFile(
                    path.join(this.dataDir, 'all-performances-search-results.json'),
                    JSON.stringify(result.data, null, 2),
                    'utf8'
                );

                return { success: true, total: result.data.length, filtered: filteredPerformances.length, performances: filteredPerformances };
            } else {
                console.log('⚠️  Search returned non-array result');
                await fs.writeFile(
                    path.join(this.dataDir, 'performance-search-debug.json'),
                    JSON.stringify(result.data, null, 2),
                    'utf8'
                );
                return { success: true, data: result.data };
            }
        } else {
            console.log('❌ Performance search failed');
            return result;
        }
    }

    async tryAlternativeSearches() {
        console.log('\n🔍 Trying alternative search approaches...');

        // Try different search parameters
        const searchVariations = [
            // Try without date filters (get all performances)
            {},

            // Try with different date field names
            {
                PerformanceDateTimeStart: '2025-08-01T00:00:00.000Z',
                PerformanceDateTimeEnd: '2026-08-01T23:59:59.999Z'
            },

            // Try with season-based search (common season IDs for 2025-2026)
            {
                SeasonIds: ['2025', '2026']
            },

            // Try numeric season IDs
            {
                SeasonIds: [2025, 2026]
            },

            // Try product search
            {
                ProductType: 'Performance'
            }
        ];

        for (let i = 0; i < searchVariations.length; i++) {
            const searchRequest = searchVariations[i];
            console.log(`\n🧪 Search variation ${i + 1}:`, JSON.stringify(searchRequest, null, 2));

            const result = await this.makeRequest(
                '/TXN/Performances/Search',
                'POST',
                searchRequest,
                `search variation ${i + 1}`
            );

            if (result.success) {
                const resultCount = Array.isArray(result.data) ? result.data.length : 'non-array';
                console.log(`✅ Search variation ${i + 1} succeeded: ${resultCount} results`);

                if (Array.isArray(result.data) && result.data.length > 0) {
                    console.log('🎉 Found performance data! Saving results...');

                    await fs.writeFile(
                        path.join(this.dataDir, `search-variation-${i + 1}-results.json`),
                        JSON.stringify({
                            searchCriteria: searchRequest,
                            resultCount: result.data.length,
                            results: result.data,
                            fetchedAt: new Date().toISOString()
                        }, null, 2),
                        'utf8'
                    );

                    return { success: true, variation: i + 1, data: result.data };
                }
            } else {
                console.log(`❌ Search variation ${i + 1} failed:`, result.error);
            }
        }

        return { success: false, error: 'All search variations failed' };
    }

    async run() {
        console.log('🚀 Starting Tessitura Production Search...\n');

        try {
            await this.init();

            // Test connection first
            const connectionOK = await this.testConnection();
            if (!connectionOK) {
                throw new Error('Production API connection test failed');
            }

            // Try the main performance search
            const searchResult = await this.searchPerformances();

            if (searchResult.success && searchResult.filtered > 0) {
                console.log(`\n🎉 SUCCESS! Found ${searchResult.filtered} performances in date range 8/1/25 - 8/1/26`);
                return searchResult;
            } else if (searchResult.success && searchResult.total > 0) {
                console.log(`\n⚠️  Found ${searchResult.total} total performances but none in target date range`);
            }

            // If main search didn't yield results in our date range, try alternatives
            console.log('\n🔄 Trying alternative search approaches...');
            const altResult = await this.tryAlternativeSearches();

            if (altResult.success) {
                console.log(`\n🎉 Alternative search succeeded! Found data with variation ${altResult.variation}`);
                return altResult;
            }

            return { success: false, error: 'No performances found in target date range' };

        } catch (error) {
            console.error('\n❌ Production search failed:', error.message);
            return { success: false, error: error.message };
        }
    }
}

// CLI execution
async function main() {
    const searcher = new TessituraProductionSearch();
    const result = await searcher.run();

    if (result.success) {
        console.log('\n✅ Production search completed successfully!');
        console.log('📁 Check the ./data directory for all results');
    } else {
        console.log('\n❌ Production search failed');
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { TessituraProductionSearch };