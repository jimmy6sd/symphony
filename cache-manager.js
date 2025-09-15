#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

class CacheManager {
    constructor(dataDir = './data') {
        this.dataDir = dataDir;
        this.defaultTTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        this.cacheMetadata = {};
        this.metadataFile = path.join(dataDir, 'cache-metadata.json');
    }

    async init() {
        // Create data directory if it doesn't exist
        await fs.mkdir(this.dataDir, { recursive: true });

        // Load existing cache metadata
        try {
            const metadataContent = await fs.readFile(this.metadataFile, 'utf8');
            this.cacheMetadata = JSON.parse(metadataContent);
            console.log('📋 Loaded cache metadata');
        } catch (error) {
            console.log('📋 No existing cache metadata found, starting fresh');
            this.cacheMetadata = {};
        }
    }

    async saveCacheMetadata() {
        await fs.writeFile(
            this.metadataFile,
            JSON.stringify(this.cacheMetadata, null, 2),
            'utf8'
        );
    }

    async cacheData(key, data, ttl = null) {
        const timestamp = new Date().toISOString();
        const expiryTime = new Date(Date.now() + (ttl || this.defaultTTL)).toISOString();

        const cachedItem = {
            key,
            timestamp,
            expiryTime,
            ttl: ttl || this.defaultTTL,
            dataSize: JSON.stringify(data).length,
            data
        };

        // Save the data file
        const filename = `${key}.json`;
        const filepath = path.join(this.dataDir, filename);
        await fs.writeFile(filepath, JSON.stringify(cachedItem, null, 2), 'utf8');

        // Update metadata
        this.cacheMetadata[key] = {
            timestamp,
            expiryTime,
            ttl: ttl || this.defaultTTL,
            dataSize: cachedItem.dataSize,
            filename
        };

        await this.saveCacheMetadata();

        console.log(`💾 Cached '${key}' (expires: ${expiryTime})`);
        return cachedItem;
    }

    async getCachedData(key) {
        const metadata = this.cacheMetadata[key];
        if (!metadata) {
            console.log(`📭 No cache entry found for '${key}'`);
            return null;
        }

        // Check if cache is expired
        const now = new Date();
        const expiryTime = new Date(metadata.expiryTime);

        if (now > expiryTime) {
            console.log(`⏰ Cache expired for '${key}' (expired: ${metadata.expiryTime})`);
            return null;
        }

        try {
            const filepath = path.join(this.dataDir, metadata.filename);
            const content = await fs.readFile(filepath, 'utf8');
            const cachedItem = JSON.parse(content);

            console.log(`✅ Cache hit for '${key}' (cached: ${metadata.timestamp})`);
            return cachedItem;
        } catch (error) {
            console.log(`❌ Failed to read cached data for '${key}':`, error.message);
            return null;
        }
    }

    async isCacheValid(key) {
        const metadata = this.cacheMetadata[key];
        if (!metadata) return false;

        const now = new Date();
        const expiryTime = new Date(metadata.expiryTime);
        return now <= expiryTime;
    }

    async getCacheStatus() {
        const status = {
            totalEntries: Object.keys(this.cacheMetadata).length,
            validEntries: 0,
            expiredEntries: 0,
            entries: []
        };

        const now = new Date();

        for (const [key, metadata] of Object.entries(this.cacheMetadata)) {
            const expiryTime = new Date(metadata.expiryTime);
            const isValid = now <= expiryTime;
            const ageMs = now - new Date(metadata.timestamp);
            const timeToExpiry = expiryTime - now;

            if (isValid) {
                status.validEntries++;
            } else {
                status.expiredEntries++;
            }

            status.entries.push({
                key,
                valid: isValid,
                timestamp: metadata.timestamp,
                expiryTime: metadata.expiryTime,
                ageHours: Math.round(ageMs / (1000 * 60 * 60) * 10) / 10,
                timeToExpiryHours: isValid ? Math.round(timeToExpiry / (1000 * 60 * 60) * 10) / 10 : 0,
                sizeKB: Math.round(metadata.dataSize / 1024 * 10) / 10
            });
        }

        return status;
    }

    async clearExpiredCache() {
        const now = new Date();
        const expiredKeys = [];

        for (const [key, metadata] of Object.entries(this.cacheMetadata)) {
            const expiryTime = new Date(metadata.expiryTime);
            if (now > expiryTime) {
                expiredKeys.push(key);
            }
        }

        for (const key of expiredKeys) {
            await this.deleteCacheEntry(key);
        }

        console.log(`🗑️  Cleared ${expiredKeys.length} expired cache entries`);
        return expiredKeys;
    }

    async deleteCacheEntry(key) {
        const metadata = this.cacheMetadata[key];
        if (metadata) {
            try {
                const filepath = path.join(this.dataDir, metadata.filename);
                await fs.unlink(filepath);
                console.log(`🗑️  Deleted cache file for '${key}'`);
            } catch (error) {
                console.log(`⚠️  Could not delete cache file for '${key}':`, error.message);
            }

            delete this.cacheMetadata[key];
            await this.saveCacheMetadata();
        }
    }

    async clearAllCache() {
        const keys = Object.keys(this.cacheMetadata);
        for (const key of keys) {
            await this.deleteCacheEntry(key);
        }
        console.log(`🗑️  Cleared all ${keys.length} cache entries`);
        return keys;
    }

    // Helper method to get cache age in human readable format
    getCacheAge(key) {
        const metadata = this.cacheMetadata[key];
        if (!metadata) return null;

        const now = new Date();
        const timestamp = new Date(metadata.timestamp);
        const ageMs = now - timestamp;

        const hours = Math.floor(ageMs / (1000 * 60 * 60));
        const minutes = Math.floor((ageMs % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0) {
            return `${hours}h ${minutes}m ago`;
        } else {
            return `${minutes}m ago`;
        }
    }
}

module.exports = { CacheManager };

// CLI usage if called directly
if (require.main === module) {
    async function main() {
        const cache = new CacheManager();
        await cache.init();

        const args = process.argv.slice(2);
        const command = args[0] || 'status';

        switch (command) {
            case 'status':
                const status = await cache.getCacheStatus();
                console.log('\n📊 Cache Status:');
                console.log(`Total entries: ${status.totalEntries}`);
                console.log(`Valid: ${status.validEntries}, Expired: ${status.expiredEntries}`);

                if (status.entries.length > 0) {
                    console.log('\n📋 Cache Entries:');
                    status.entries.forEach(entry => {
                        const validIcon = entry.valid ? '✅' : '❌';
                        const timeInfo = entry.valid ?
                            `expires in ${entry.timeToExpiryHours}h` :
                            `expired ${entry.ageHours}h ago`;
                        console.log(`${validIcon} ${entry.key} - ${entry.sizeKB}KB - ${timeInfo}`);
                    });
                }
                break;

            case 'clear':
                const clearedKeys = await cache.clearAllCache();
                console.log(`Cleared ${clearedKeys.length} cache entries`);
                break;

            case 'clean':
                const expiredKeys = await cache.clearExpiredCache();
                console.log(`Cleaned ${expiredKeys.length} expired cache entries`);
                break;

            default:
                console.log('Usage: node cache-manager.js [status|clear|clean]');
                break;
        }
    }

    main().catch(console.error);
}