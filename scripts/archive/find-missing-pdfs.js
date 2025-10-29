const { Storage } = require('@google-cloud/storage');

const storage = new Storage({ keyFilename: './symphony-bigquery-key.json' });
const bucket = storage.bucket('symphony-dashboard-pdfs');

async function findMissingPDFs() {
  const [files] = await bucket.getFiles({ prefix: '2025/10/' });
  const pdfs = files.filter(f => f.name.endsWith('.pdf'));

  console.log('Looking for PDFs with IDs 1126300 or 1126746...\n');

  const foundFiles = [];
  pdfs.forEach(f => {
    if (f.name.includes('1126300') || f.name.includes('1126746')) {
      foundFiles.push(f);
      console.log(f.name);
      console.log('  Created:', f.metadata.timeCreated);
    }
  });

  if (foundFiles.length === 0) {
    console.log('❌ No files found with those IDs');
  }

  console.log('\n\nAll PDF files by execution ID:');
  console.log('='.repeat(70));

  const pdfList = [];
  pdfs.forEach(f => {
    const match = f.name.match(/(\d{7})/);
    if (match) {
      pdfList.push({ id: match[1], name: f.name, created: f.metadata.timeCreated });
    }
  });

  pdfList.sort((a, b) => parseInt(a.id) - parseInt(b.id));

  pdfList.forEach(p => {
    console.log(`ID ${p.id}: ${p.name}`);
    console.log(`         Created: ${p.created}`);
  });

  console.log('\n\nChecking for gaps in execution IDs:');
  console.log('='.repeat(70));

  for (let i = 1; i < pdfList.length; i++) {
    const prevId = parseInt(pdfList[i-1].id);
    const currId = parseInt(pdfList[i].id);
    const gap = currId - prevId;

    if (gap > 1000) {
      console.log(`Gap between ${prevId} and ${currId} (difference: ${gap})`);
      console.log(`  Missing range could include 1126300 and 1126746`);
    }
  }
}

findMissingPDFs().catch(console.error);
