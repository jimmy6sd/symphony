const https = require('http');

const req = https.get('http://localhost:8888/.netlify/functions/bigquery-data', (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    try {
      const performances = JSON.parse(data);
      const genericTitle = performances.filter(p => p.title === 'Performance');

      console.log(`Found ${genericTitle.length} performances with title='Performance'\n`);

      genericTitle.forEach(p => {
        console.log(`Code: ${p.performance_code}`);
        console.log(`  Title: ${p.title}`);
        console.log(`  Series: ${p.series || 'NULL'}`);
        console.log(`  Date: ${p.performance_date}`);
        console.log(`  Has Sales: ${p.has_sales_data}`);
        console.log(`  Created: ${p.created_at}`);
        console.log('---');
      });

      // Check if there are duplicates by performance_code
      const codes = genericTitle.map(p => p.performance_code);
      const duplicates = codes.filter((code, index) => codes.indexOf(code) !== index);

      if (duplicates.length > 0) {
        console.log('\n🚨 DUPLICATES FOUND:');
        console.log(duplicates);
      }

    } catch (err) {
      console.error('Error parsing response:', err.message);
    }
  });
});

req.on('error', (err) => {
  console.error('Request error:', err.message);
});
