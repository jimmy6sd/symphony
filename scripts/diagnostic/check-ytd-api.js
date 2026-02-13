const http = require('http');

http.get('http://localhost:8888/.netlify/functions/bigquery-snapshots?action=get-ytd-comparison&weekType=fiscal&attributionMode=performance', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    const fy26 = json.data['FY26 Current'] || json.data['FY26'];

    console.log('FY26 Performance Attribution Data:');
    console.log('Total data points:', fy26?.length || 0);

    if (fy26) {
      console.log('\nFirst 15 weeks:');
      fy26.slice(0, 15).forEach(w => {
        console.log(`Week ${w.week}: Revenue $${Math.round(w.revenue).toLocaleString()}, Tickets ${w.tickets}`);
      });

      console.log('\nLast 5 weeks:');
      fy26.slice(-5).forEach(w => {
        console.log(`Week ${w.week}: Revenue $${Math.round(w.revenue).toLocaleString()}, Tickets ${w.tickets}`);
      });
    }
  });
}).on('error', console.error);
