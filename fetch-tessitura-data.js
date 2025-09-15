#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

// Import configuration
const CONFIG = require('./js/config.js');

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

class TessituraDataFetcher {
    constructor() {
        this.config = CONFIG.tessitura;
        this.dataDir = './data';

        // Build authentication string
        this.authString = `${this.config.authentication.username}:${this.config.userGroup}:${this.config.machineLocation}:${this.config.authentication.password}`;
        this.encodedAuth = Buffer.from(this.authString).toString('base64');

        console.log('🔧 Tessitura Data Fetcher initialized');
        console.log('🔗 Base URL:', this.config.baseUrl);
        console.log('👤 Auth User:', this.config.authentication.username);
        console.log('📁 Data Directory:', this.dataDir);
    }

    async init() {
        // Create data directory if it doesn't exist
        try {
            await fs.mkdir(this.dataDir, { recursive: true });
            console.log('📁 Data directory ready:', this.dataDir);
        } catch (error) {
            console.error('❌ Failed to create data directory:', error.message);
            throw error;
        }
    }

    getAuthHeaders() {
        return {
            'Authorization': `Basic ${this.encodedAuth}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Symphony Dashboard Data Fetcher'
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
        console.log('\n🧪 Testing Tessitura API Connection...');
        const result = await this.makeRequest('/Diagnostics/Status', 'connection test');

        if (result.success) {
            console.log('✅ Connection successful!');
            await this.saveData('diagnostics.json', result.data, 'diagnostics data');
            return true;
        } else {
            console.error('❌ Connection failed:', result.error);
            return false;
        }
    }

    async fetchPerformances() {
        console.log('\n🎭 Fetching Performances...');

        // Try different performance endpoints with parameters
        const endpoints = [
            // Try with current season (assuming season 2024-2025)
            '/TXN/Performances?seasonIds=2025',
            '/TXN/Performances?seasonIds=2024',
            '/TXN/Performances?seasonIds=1',

            // Try with production season
            '/TXN/Performances?productionSeasonId=1',
            '/TXN/Performances?productionSeasonId=2024',

            // Try seasons endpoint first to get valid season IDs
            '/TXN/Seasons'
        ];

        for (const endpoint of endpoints) {
            console.log(`\n🔍 Trying endpoint: ${endpoint}`);
            const result = await this.makeRequest(endpoint, 'performances data');

            if (result.success) {
                await this.saveData('performances.json', result.data, 'performances data');
                return result.data;
            } else {
                console.log(`⚠️  Endpoint ${endpoint} failed: ${result.error}`);
            }
        }

        console.error('❌ All performance endpoints failed');
        return null;
    }

    async fetchSeasons() {
        console.log('\n📅 Fetching Seasons...');

        const endpoints = [
            '/TXN/Seasons',
            '/CRM/Seasons',
            '/Reference/Seasons'
        ];

        for (const endpoint of endpoints) {
            console.log(`\n🔍 Trying endpoint: ${endpoint}`);
            const result = await this.makeRequest(endpoint, 'seasons data');

            if (result.success) {
                await this.saveData('seasons.json', result.data, 'seasons data');
                return result.data;
            } else {
                console.log(`⚠️  Endpoint ${endpoint} failed: ${result.error}`);
            }
        }

        console.error('❌ All season endpoints failed');
        return null;
    }

    async fetchSalesData() {
        console.log('\n📊 Fetching Sales Data...');

        const endpoints = [
            '/TXN/Orders/Search',
            '/TXN/Orders',
            '/TXN/Sales',
            '/Sales'
        ];

        for (const endpoint of endpoints) {
            console.log(`\n🔍 Trying endpoint: ${endpoint}`);
            const result = await this.makeRequest(endpoint, 'sales data');

            if (result.success) {
                await this.saveData('sales.json', result.data, 'sales data');
                return result.data;
            } else {
                console.log(`⚠️  Endpoint ${endpoint} failed: ${result.error}`);
            }
        }

        console.error('❌ All sales endpoints failed');
        return null;
    }

    async fetchConstituents() {
        console.log('\n👥 Fetching Constituents/Customers...');

        const endpoints = [
            '/CRM/Constituents/Search',
            '/CRM/Constituents',
            '/Constituents'
        ];

        for (const endpoint of endpoints) {
            console.log(`\n🔍 Trying endpoint: ${endpoint}`);
            const result = await this.makeRequest(endpoint, 'constituents data');

            if (result.success) {
                await this.saveData('constituents.json', result.data, 'constituents data');
                return result.data;
            } else {
                console.log(`⚠️  Endpoint ${endpoint} failed: ${result.error}`);
            }
        }

        console.error('❌ All constituent endpoints failed');
        return null;
    }

    async exploreAPI() {
        console.log('\n🔍 Exploring API Structure...');

        // Try to get API documentation or schema
        const explorationEndpoints = [
            '/swagger/docs/v1',
            '/api-docs',
            '/docs',
            '/help',
            '/metadata',
            '/$metadata'
        ];

        for (const endpoint of explorationEndpoints) {
            console.log(`\n🔍 Trying documentation endpoint: ${endpoint}`);
            const result = await this.makeRequest(endpoint, 'API documentation');

            if (result.success) {
                await this.saveData('api-docs.json', result.data, 'API documentation');
                return result.data;
            }
        }

        console.log('ℹ️  No API documentation endpoints found');
        return null;
    }

    async fetchAllData() {
        console.log('🚀 Starting Tessitura Data Fetch...\n');

        const results = {
            timestamp: new Date().toISOString(),
            success: false,
            data: {}
        };

        try {
            // Initialize data directory
            await this.init();

            // Test connection first
            const connectionOK = await this.testConnection();
            if (!connectionOK) {
                throw new Error('Initial connection test failed');
            }

            results.data.diagnostics = 'success';

            // Explore API structure
            const apiDocs = await this.exploreAPI();
            if (apiDocs) {
                results.data.apiDocs = 'success';
            }

            // First get seasons to understand data structure
            const seasons = await this.fetchSeasons();
            if (seasons) {
                results.data.seasons = 'success';
                console.log(`✅ Found ${Array.isArray(seasons) ? seasons.length : 'unknown count'} seasons`);
            }

            // Fetch main data types
            const performances = await this.fetchPerformances();
            if (performances) {
                results.data.performances = 'success';
                console.log(`✅ Found ${Array.isArray(performances) ? performances.length : 'unknown count'} performances`);
            }

            const sales = await this.fetchSalesData();
            if (sales) {
                results.data.sales = 'success';
                console.log(`✅ Found ${Array.isArray(sales) ? sales.length : 'unknown count'} sales records`);
            }

            const constituents = await this.fetchConstituents();
            if (constituents) {
                results.data.constituents = 'success';
                console.log(`✅ Found ${Array.isArray(constituents) ? constituents.length : 'unknown count'} constituents`);
            }

            results.success = true;

            // Save summary
            await this.saveData('fetch-summary.json', results, 'fetch summary');

            console.log('\n✅ Data fetch completed successfully!');
            console.log('📁 Check the ./data directory for all fetched data files');

        } catch (error) {
            console.error('\n❌ Data fetch failed:', error.message);
            results.error = error.message;
            await this.saveData('fetch-error.json', results, 'error summary');
        }

        return results;
    }
}

// CLI execution
async function main() {
    const fetcher = new TessituraDataFetcher();

    // Check command line arguments
    const args = process.argv.slice(2);
    const command = args[0] || 'all';

    switch (command) {
        case 'test':
            await fetcher.init();
            await fetcher.testConnection();
            break;
        case 'seasons':
            await fetcher.init();
            await fetcher.fetchSeasons();
            break;
        case 'performances':
            await fetcher.init();
            await fetcher.fetchPerformances();
            break;
        case 'sales':
            await fetcher.init();
            await fetcher.fetchSalesData();
            break;
        case 'constituents':
            await fetcher.init();
            await fetcher.fetchConstituents();
            break;
        case 'explore':
            await fetcher.init();
            await fetcher.exploreAPI();
            break;
        case 'all':
        default:
            await fetcher.fetchAllData();
            break;
    }
}

// Export for use as module
module.exports = { TessituraDataFetcher };

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('💥 Fatal error:', error.message);
        process.exit(1);
    });
}