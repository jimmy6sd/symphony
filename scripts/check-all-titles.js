const https = require('http');

const req = https.get('http://localhost:8888/.netlify/functions/bigquery-data', (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    try {
      const performances = JSON.parse(data);

      console.log(`Total performances: ${performances.length}\n`);

      // Group by title
      const titleCounts = {};
      performances.forEach(p => {
        const title = p.title || '(NULL)';
        titleCounts[title] = (titleCounts[title] || 0) + 1;
      });

      // Show titles sorted by count
      const sorted = Object.entries(titleCounts).sort((a, b) => b[1] - a[1]);

      console.log('Title counts:');
      sorted.forEach(([title, count]) => {
        console.log(`  ${count}x - ${title}`);
      });

    } catch (err) {
      console.error('Error:', err.message);
    }
  });
});

req.on('error', (err) => console.error('Request error:', err.message));
