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

class SeasonExplorer {
    constructor() {
        this.config = loadEnv();
        this.dataDir = './data';

        this.authString = `${this.config.username}:${this.config.userGroup}:${this.config.machineLocation}:${this.config.password}`;
        this.encodedAuth = Buffer.from(this.authString).toString('base64');

        console.log('🔧 Season Explorer initialized');
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
            'User-Agent': 'Symphony Season Explorer'
        };
    }

    async makeRequest(endpoint, description = '') {
        const url = `${this.config.baseUrl}${endpoint}`;
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

            const data = await response.json();
            return { success: true, data, status: response.status };
        } catch (error) {
            console.error(`❌ Request failed for ${endpoint}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    async exploreSeasons() {
        console.log('\n📅 Exploring Available Seasons...');

        const endpoints = [
            '/TXN/Seasons',
            '/CRM/Seasons',
            '/Reference/Seasons',
            '/Seasons'
        ];

        for (const endpoint of endpoints) {
            console.log(`\n🔍 Trying: ${endpoint}`);
            const result = await this.makeRequest(endpoint, 'seasons');

            if (result.success && result.data) {
                console.log(`✅ Found seasons data from ${endpoint}`);

                if (Array.isArray(result.data)) {
                    console.log(`📊 Total seasons: ${result.data.length}`);

                    // Show season details
                    console.log('\n📋 Available Seasons:');
                    result.data.forEach(season => {
                        console.log(`   • ID: ${season.id || season.seasonId || 'N/A'} - Name: ${season.name || season.description || season.title || 'N/A'}`);
                        if (season.startDate) console.log(`     Start: ${season.startDate}`);
                        if (season.endDate) console.log(`     End: ${season.endDate}`);
                    });

                    // Filter seasons that might contain our target date range (8/1/25 to 8/1/26)
                    const targetStart = new Date('2025-08-01');
                    const targetEnd = new Date('2026-08-01');

                    const relevantSeasons = result.data.filter(season => {
                        if (season.startDate && season.endDate) {
                            const seasonStart = new Date(season.startDate);
                            const seasonEnd = new Date(season.endDate);

                            // Check if the season overlaps with our target range
                            return (seasonStart <= targetEnd && seasonEnd >= targetStart);
                        }
                        return false;
                    });

                    if (relevantSeasons.length > 0) {
                        console.log(`\n🎯 Seasons that overlap with 8/1/25 - 8/1/26:`);
                        relevantSeasons.forEach(season => {
                            console.log(`   • ${season.name || season.description} (ID: ${season.id || season.seasonId})`);
                            console.log(`     ${season.startDate} to ${season.endDate}`);
                        });

                        // Save relevant seasons for further exploration
                        await fs.writeFile(
                            path.join(this.dataDir, 'relevant-seasons.json'),
                            JSON.stringify({
                                targetDateRange: { start: '2025-08-01', end: '2026-08-01' },
                                endpoint: endpoint,
                                totalSeasons: result.data.length,
                                relevantSeasons: relevantSeasons,
                                fetchedAt: new Date().toISOString()
                            }, null, 2),
                            'utf8'
                        );

                        return { success: true, seasons: result.data, relevantSeasons };
                    } else {
                        console.log('⚠️  No seasons found that overlap with target date range');
                    }
                } else {
                    console.log('⚠️  Seasons data is not an array, saving for inspection');
                }

                // Save all seasons data
                await fs.writeFile(
                    path.join(this.dataDir, 'all-seasons.json'),
                    JSON.stringify(result.data, null, 2),
                    'utf8'
                );

                return { success: true, seasons: result.data };
            }
        }

        console.log('❌ No season endpoints returned data');
        return { success: false, error: 'No season data available' };
    }

    async explorePerformancesForSeason(seasonId) {
        console.log(`\n🎭 Exploring Performances for Season ${seasonId}...`);

        const endpoints = [
            `/TXN/Performances?seasonIds=${seasonId}`,
            `/TXN/Performances?productionSeasonId=${seasonId}`,
        ];

        for (const endpoint of endpoints) {
            console.log(`\n🔍 Trying: ${endpoint}`);
            const result = await this.makeRequest(endpoint, `performances for season ${seasonId}`);

            if (result.success && result.data) {
                if (Array.isArray(result.data) && result.data.length > 0) {
                    console.log(`✅ Found ${result.data.length} performances in season ${seasonId}`);

                    // Filter by our target date range
                    const targetStart = new Date('2025-08-01');
                    const targetEnd = new Date('2026-08-01');

                    const relevantPerformances = result.data.filter(perf => {
                        const dateFields = ['date', 'performanceDate', 'performanceDateTime', 'eventDate'];
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

                    if (relevantPerformances.length > 0) {
                        console.log(`🎯 Found ${relevantPerformances.length} performances in target date range!`);
                        relevantPerformances.forEach(perf => {
                            const date = perf.date || perf.performanceDate || perf.performanceDateTime;
                            console.log(`   • ${perf.title || perf.name || 'Unknown'} - ${date}`);
                        });

                        // Save the relevant performances
                        await fs.writeFile(
                            path.join(this.dataDir, `performances-season-${seasonId}-filtered.json`),
                            JSON.stringify({
                                seasonId: seasonId,
                                targetDateRange: { start: '2025-08-01', end: '2026-08-01' },
                                totalPerformances: result.data.length,
                                relevantPerformances: relevantPerformances.length,
                                performances: relevantPerformances,
                                fetchedAt: new Date().toISOString()
                            }, null, 2),
                            'utf8'
                        );

                        return { success: true, performances: relevantPerformances, seasonId };
                    } else {
                        console.log(`⚠️  No performances in date range for season ${seasonId}`);
                    }

                    // Save all performances for this season anyway
                    await fs.writeFile(
                        path.join(this.dataDir, `performances-season-${seasonId}-all.json`),
                        JSON.stringify(result.data, null, 2),
                        'utf8'
                    );

                } else {
                    console.log(`⚠️  No performances found in season ${seasonId}`);
                }
            }
        }

        return { success: false, error: `No performances found for season ${seasonId}` };
    }

    async run() {
        console.log('🚀 Starting Season Exploration...\n');

        try {
            await this.init();

            // First, explore available seasons
            const seasonsResult = await this.exploreSeasons();

            if (!seasonsResult.success) {
                console.log('❌ Could not retrieve seasons data');
                return { success: false, error: 'No seasons data' };
            }

            // If we found relevant seasons, explore their performances
            if (seasonsResult.relevantSeasons && seasonsResult.relevantSeasons.length > 0) {
                console.log(`\n🔍 Exploring performances in ${seasonsResult.relevantSeasons.length} relevant seasons...`);

                let totalRelevantPerformances = 0;
                const allRelevantPerformances = [];

                for (const season of seasonsResult.relevantSeasons) {
                    const seasonId = season.id || season.seasonId;
                    const perfResult = await this.explorePerformancesForSeason(seasonId);

                    if (perfResult.success) {
                        totalRelevantPerformances += perfResult.performances.length;
                        allRelevantPerformances.push(...perfResult.performances);
                    }
                }

                if (totalRelevantPerformances > 0) {
                    console.log(`\n🎉 FOUND ${totalRelevantPerformances} PERFORMANCES IN DATE RANGE (8/1/25 - 8/1/26)!`);

                    // Save consolidated results
                    await fs.writeFile(
                        path.join(this.dataDir, 'final-performances-in-range.json'),
                        JSON.stringify({
                            targetDateRange: { start: '2025-08-01', end: '2026-08-01' },
                            totalPerformances: totalRelevantPerformances,
                            performances: allRelevantPerformances,
                            fetchedAt: new Date().toISOString()
                        }, null, 2),
                        'utf8'
                    );

                    return { success: true, performances: allRelevantPerformances };
                } else {
                    console.log('\n⚠️  No performances found in target date range across all relevant seasons');
                }
            } else {
                // Try a few common season IDs just in case
                console.log('\n🎯 No date-specific seasons found, trying common season IDs...');
                const commonSeasons = [2024, 2025, 2026, 244, 245, 246];

                for (const seasonId of commonSeasons) {
                    console.log(`\n🔍 Checking season ID: ${seasonId}`);
                    const result = await this.explorePerformancesForSeason(seasonId);
                    if (result.success) {
                        console.log(`✅ Found performances in season ${seasonId}!`);
                        return result;
                    }
                }
            }

            console.log('\n📋 Summary: Check the data/ directory for all fetched season and performance data');
            return { success: true, message: 'Exploration complete, check data files' };

        } catch (error) {
            console.error('\n❌ Season exploration failed:', error.message);
            return { success: false, error: error.message };
        }
    }
}

// CLI execution
async function main() {
    const explorer = new SeasonExplorer();
    const result = await explorer.run();

    if (result.success && result.performances) {
        console.log(`\n🎉 SUCCESS! Found ${result.performances.length} performances in date range 8/1/25 - 8/1/26`);
    } else if (result.success) {
        console.log('\n✅ Exploration completed - check data files for results');
    } else {
        console.log('\n❌ Exploration failed');
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { SeasonExplorer };