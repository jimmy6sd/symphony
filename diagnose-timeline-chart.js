// Diagnostic Script for Historical Timeline Chart
// This script tests each step of the chart rendering process

console.log('🔍 Starting diagnostic test...\n');

const performanceCode = '250902E';
const apiUrl = `https://kcsdashboard.netlify.app/netlify/functions/bigquery-snapshots?action=get-performance-history&performanceCode=${performanceCode}`;

// Step 1: Test API endpoint
console.log('📊 Step 1: Testing API endpoint...');
console.log(`   URL: ${apiUrl}`);

fetch(apiUrl)
    .then(response => {
        console.log(`   ✅ Response status: ${response.status}`);
        return response.json();
    })
    .then(apiResponse => {
        console.log(`   ✅ API Response received`);
        console.log(`   Response structure:`, Object.keys(apiResponse));

        // Step 2: Test data parsing
        console.log('\n📦 Step 2: Testing data parsing...');
        let historicalData = apiResponse.snapshots || [];
        console.log(`   Raw snapshots count: ${historicalData.length}`);

        if (historicalData.length === 0) {
            console.error('   ❌ ERROR: No snapshots in API response!');
            return;
        }

        console.log(`   Sample snapshot:`, historicalData[0]);

        // Step 3: Test deduplication
        console.log('\n🔄 Step 3: Testing deduplication...');
        const uniqueByDate = {};
        for (const snapshot of historicalData) {
            const date = snapshot.snapshot_date;
            if (!uniqueByDate[date] || new Date(snapshot.created_at) > new Date(uniqueByDate[date].created_at)) {
                uniqueByDate[date] = snapshot;
            }
        }
        historicalData = Object.values(uniqueByDate);
        console.log(`   Unique dates count: ${historicalData.length}`);
        console.log(`   Dates: ${historicalData.map(d => d.snapshot_date).join(', ')}`);

        // Step 4: Test conditional logic
        console.log('\n🎯 Step 4: Testing conditional logic...');
        console.log(`   historicalData exists: ${!!historicalData}`);
        console.log(`   historicalData.length: ${historicalData.length}`);
        console.log(`   historicalData.length > 1: ${historicalData.length > 1}`);
        console.log(`   Condition (historicalData && historicalData.length > 1): ${historicalData && historicalData.length > 1}`);

        if (historicalData && historicalData.length > 1) {
            console.log('   ✅ SHOULD render timeline chart');

            // Step 5: Test data transformation
            console.log('\n🔢 Step 5: Testing data transformation for D3...');
            historicalData.forEach((snapshot, i) => {
                console.log(`   Snapshot ${i + 1}:`, {
                    date: snapshot.snapshot_date,
                    tickets: snapshot.total_tickets_sold,
                    revenue: snapshot.total_revenue,
                    capacity: snapshot.capacity_percent
                });
            });

        } else {
            console.log('   ❌ WOULD NOT render timeline chart');
            console.log('   Will fallback to standard sales curve');
        }

        console.log('\n✅ Diagnostic complete!');
        console.log('\n📋 Summary:');
        console.log(`   - API endpoint: Working`);
        console.log(`   - Data fetching: ${historicalData.length > 0 ? 'Success' : 'Failed'}`);
        console.log(`   - Deduplication: ${historicalData.length} unique dates`);
        console.log(`   - Should show timeline: ${historicalData.length > 1 ? 'YES' : 'NO'}`);

    })
    .catch(error => {
        console.error('❌ Error:', error);
        console.error('   Stack:', error.stack);
    });
