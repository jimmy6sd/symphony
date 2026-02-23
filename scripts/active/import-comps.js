#!/usr/bin/env node
/**
 * Quick comp import script
 * Usage: node scripts/active/import-comps.js "Your Comp File.xlsx"
 * Or: npm run import-comps "Your Comp File.xlsx"
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get filename from command line
const inputFile = process.argv[2];

if (!inputFile) {
  console.log('Usage: npm run import-comps "Your Comp File.xlsx"');
  console.log('');
  console.log('Example: npm run import-comps "Comps for 25-26 Performances.xlsx"');
  process.exit(1);
}

// Resolve path
const filePath = path.resolve(inputFile);

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

console.log(`\n📂 File: ${inputFile}`);
console.log('🚀 Starting import (clearing imported comps, preserving manual)...\n');

try {
  execSync(`node scripts/active/import-historical-comps-v2.js --clear --file="${inputFile}"`, {
    cwd: path.join(__dirname, '..', '..'),
    stdio: 'inherit',
    env: {
      ...process.env,
      GOOGLE_APPLICATION_CREDENTIALS: './symphony-bigquery-key.json'
    }
  });
} catch (error) {
  console.error('Import failed:', error.message);
  process.exit(1);
}
