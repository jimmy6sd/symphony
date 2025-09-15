// Test script for Tessitura API call
// Run with: node test-tessitura-api.js

async function testTessituraAPI() {
    const credentials = {
        username: 'jhender',
        userGroup: 'syweb',
        machineLocation: 'jhender',
        password: 'ForTheShowKCSY25!'
    };

    // Construct Basic Auth string as per Tessitura format
    const authString = `${credentials.username}:${credentials.userGroup}:${credentials.machineLocation}:${credentials.password}`;
    const encodedAuth = Buffer.from(authString).toString('base64');

    const testUrl = 'https://KFFCTRUSMO0webtest.tnhs.cloud/Tessitura/api/Diagnostics/Status';

    console.log('🧪 Testing Tessitura API Call');
    console.log('🔗 URL:', testUrl);
    console.log('🔐 Auth String:', authString);
    console.log('🔒 Base64 Encoded:', encodedAuth);
    console.log('📤 Making API call...\n');

    try {
        const response = await fetch(testUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${encodedAuth}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        console.log('📥 Response Status:', response.status, response.statusText);
        console.log('📋 Response Headers:', Object.fromEntries(response.headers.entries()));

        if (response.ok) {
            const data = await response.json();
            console.log('✅ SUCCESS! Response Data:');
            console.log(JSON.stringify(data, null, 2));
        } else {
            const errorText = await response.text();
            console.log('❌ ERROR Response Body:');
            console.log(errorText);
        }

    } catch (error) {
        console.log('💥 Request Failed:');
        console.log('Error:', error.message);
    }
}

// Check if we're in Node.js environment
if (typeof require !== 'undefined' && require.main === module) {
    // Node.js environment - need to import fetch
    const { fetch } = require('undici'); // or install node-fetch
    testTessituraAPI();
} else {
    // Browser environment
    testTessituraAPI();
}