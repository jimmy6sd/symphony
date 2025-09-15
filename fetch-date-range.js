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
        console.log('💡 Create a .env file with your production credentials');
    }

    return config;
}

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

class DateRangeFetcher {
    constructor() {
        this.config = loadEnv();
        this.dataDir = './data';

        // Build authentication string
        this.authString = `${this.config.username}:${this.config.userGroup}:${this.config.machineLocation}:${this.config.password}`;
        this.encodedAuth = Buffer.from(this.authString).toString('base64');

        // Date range for events (8/1/25 to 8/1/26)
        this.startDate = '2025-08-01';
        this.endDate = '2026-08-01';

        console.log('🔧 Date Range Fetcher initialized');
        console.log('🔗 Base URL:', this.config.baseUrl);
        console.log('👤 Auth User:', this.config.username);
        console.log('📅 Date Range:', `${this.startDate} to ${this.endDate}`);
    }

    async init() {
        await fs.mkdir(this.dataDir, { recursive: true });
        console.log('📁 Data directory ready:', this.dataDir);
    }

    getAuthHeaders() {
        return {
            'Authorization': `Basic ${this.encodedAuth}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Symphony Dashboard Date Range Fetcher'
        };
    }

    buildUrl(endpoint) {
        return `${this.config.baseUrl}${endpoint}`;
    }

    async makeRequest(endpoint, description = '') {
        const url = this.buildUrl(endpoint);
        const headers = this.getAuthHeaders();

        console.log(`📤 Fetching ${description || endpoint}...`);
        console.log(`🔗 URL: ${url}`);

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

    async saveData(filename, data, description = '') {
        try {
            const filepath = path.join(this.dataDir, filename);
            await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf8');
            console.log(`💾 Saved ${description || filename}: ${filepath}`);
            return filepath;
        } catch (error) {
            console.error(`❌ Failed to save ${filename}:`, error.message);
            throw error;
        }
    }

    async testConnection() {
        console.log('\n🧪 Testing Production API Connection...');
        const result = await this.makeRequest('/Diagnostics/Status', 'connection test');

        if (result.success) {
            console.log('✅ Production connection successful!');
            await this.saveData('production-diagnostics.json', result.data, 'production diagnostics');
            return true;
        } else {
            console.error('❌ Production connection failed:', result.error);
            return false;
        }
    }

    async fetchEventsInDateRange() {
        console.log('\n🎭 Fetching Events for Date Range (8/1/25 - 8/1/26)...');

        // Build date range query parameters
        const startDateParam = encodeURIComponent(this.startDate);
        const endDateParam = encodeURIComponent(this.endDate);

        // Try different performance/event endpoints with date filtering
        const endpoints = [
            // Standard performance endpoints with date range
            `/TXN/Performances?performanceDateTimeStart=${startDateParam}&performanceDateTimeEnd=${endDateParam}`,
            `/TXN/Performances?startDate=${startDateParam}&endDate=${endDateParam}`,
            `/TXN/Performances?fromDate=${startDateParam}&toDate=${endDateParam}`,

            // Alternative date formats
            `/TXN/Performances?performanceDateTimeStart=2025-08-01T00:00:00&performanceDateTimeEnd=2026-08-01T23:59:59`,

            // Events endpoints
            `/Events?startDate=${startDateParam}&endDate=${endDateParam}`,
            `/TXN/Events?startDate=${startDateParam}&endDate=${endDateParam}`,

            // Try getting current season and filter by date
            `/TXN/Performances?seasonIds=2025`,
            `/TXN/Performances?seasonIds=2026`,

            // Get all current performances (we'll filter by date after)
            `/TXN/Performances`,
            `/Events`
        ];

        let allResults = [];
        let successfulEndpoint = null;

        for (const endpoint of endpoints) {
            console.log(`\n🔍 Trying endpoint: ${endpoint}`);
            const result = await this.makeRequest(endpoint, `events in date range`);

            if (result.success) {
                console.log(`✅ Endpoint successful: ${endpoint}`);

                let events = result.data;
                if (Array.isArray(events)) {
                    console.log(`📊 Found ${events.length} total events from endpoint`);

                    // Filter by date range if we got all events
                    const filteredEvents = this.filterEventsByDate(events);

                    if (filteredEvents.length > 0) {
                        console.log(`🎯 ${filteredEvents.length} events match date range (${this.startDate} to ${this.endDate})`);
                        allResults.push({
                            endpoint,
                            totalEvents: events.length,
                            filteredEvents: filteredEvents.length,
                            events: filteredEvents
                        });
                        successfulEndpoint = endpoint;

                        // Save this successful result
                        await this.saveData(
                            `events-${this.startDate}-to-${this.endDate}.json`,
                            {
                                dateRange: { start: this.startDate, end: this.endDate },
                                endpoint: endpoint,
                                totalEvents: events.length,
                                filteredEvents: filteredEvents.length,
                                fetchedAt: new Date().toISOString(),
                                events: filteredEvents
                            },
                            'filtered events in date range'
                        );

                        // If we found events in our date range, we can stop here
                        if (filteredEvents.length > 0) {
                            return {
                                success: true,
                                endpoint: endpoint,
                                totalEvents: events.length,
                                eventsInRange: filteredEvents.length,
                                events: filteredEvents
                            };
                        }
                    } else {
                        console.log(`⚠️  No events found in date range for endpoint: ${endpoint}`);
                    }
                } else {
                    console.log(`⚠️  Endpoint returned non-array data: ${endpoint}`);
                    // Save raw response for debugging
                    await this.saveData(`debug-${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}.json`, result.data);
                }
            } else {
                console.log(`❌ Endpoint failed: ${endpoint} - ${result.error}`);
            }
        }

        // If we get here, save all results for debugging
        if (allResults.length > 0) {
            await this.saveData('all-endpoint-results.json', {
                dateRange: { start: this.startDate, end: this.endDate },
                fetchedAt: new Date().toISOString(),
                results: allResults
            }, 'all endpoint results');
        }

        console.error('❌ No events found in the specified date range from any endpoint');
        return {
            success: false,
            error: 'No events found in date range',
            triedEndpoints: endpoints.length,
            resultsWithData: allResults.length
        };
    }

    filterEventsByDate(events) {
        if (!Array.isArray(events)) return [];

        const start = new Date(this.startDate);
        const end = new Date(this.endDate);

        return events.filter(event => {
            // Try different date field names that might contain the performance date
            const dateFields = [
                'date', 'performanceDate', 'performanceDateTime',
                'eventDate', 'eventDateTime', 'showDate', 'showDateTime'
            ];

            for (const field of dateFields) {
                if (event[field]) {
                    const eventDate = new Date(event[field]);
                    if (eventDate >= start && eventDate <= end) {
                        return true;
                    }
                }
            }

            return false;
        });
    }

    async run() {
        console.log('🚀 Starting Date Range Event Fetch...\n');

        try {
            await this.init();

            // Test connection first
            const connectionOK = await this.testConnection();
            if (!connectionOK) {
                throw new Error('Production API connection test failed');
            }

            // Fetch events in date range
            const result = await this.fetchEventsInDateRange();

            if (result.success) {
                console.log('\n✅ Date range fetch completed successfully!');
                console.log(`🎭 Found ${result.eventsInRange} events in date range`);
                console.log(`📡 Successful endpoint: ${result.endpoint}`);
                console.log('📁 Check the ./data directory for saved event data');

                return result;
            } else {
                console.log('\n⚠️  No events found in the specified date range');
                console.log(`🔍 Tried ${result.triedEndpoints} different endpoints`);
                console.log(`📊 ${result.resultsWithData} endpoints returned data (but outside date range)`);

                return result;
            }

        } catch (error) {
            console.error('\n❌ Date range fetch failed:', error.message);
            return { success: false, error: error.message };
        }
    }
}

// CLI execution
async function main() {
    const fetcher = new DateRangeFetcher();
    const result = await fetcher.run();

    if (result.success) {
        console.log(`\n🎉 Success! Found ${result.eventsInRange} events for date range 8/1/25 - 8/1/26`);
        process.exit(0);
    } else {
        console.log('\n❌ Failed to fetch events in date range');
        process.exit(1);
    }
}

// Export for use as module
module.exports = { DateRangeFetcher };

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('💥 Fatal error:', error.message);
        process.exit(1);
    });
}