const { Storage } = require('@google-cloud/storage');

async function checkPdfDates() {
  const storage = new Storage({
    projectId: 'kcsymphony'
  });

  const bucket = storage.bucket('symphony-dashboard-pdfs');
  const [files] = await bucket.getFiles();

  console.log('📅 Checking all PDF dates in bucket...\n');

  const dateMap = new Map();

  for (const file of files) {
    if (!file.name.endsWith('.pdf')) continue;

    const [fileContents] = await file.download();
    const PDFParser = require('pdf2json');
    const pdfParser = new PDFParser();

    await new Promise((resolve, reject) => {
      pdfParser.on('pdfParser_dataError', errData => reject(errData.parserError));
      pdfParser.on('pdfParser_dataReady', pdfData => {
        let reportDate = null;

        for (const page of pdfData.Pages) {
          for (const textItem of page.Texts) {
            const content = decodeURIComponent(textItem.R[0].T);
            const footerMatch = content.match(/Run by .* on (\d{1,2}\/\d{1,2}\/\d{4})/i);
            if (footerMatch) {
              const parts = footerMatch[1].split('/');
              if (parts.length === 3) {
                const month = parts[0].padStart(2, '0');
                const day = parts[1].padStart(2, '0');
                const year = parts[2];
                reportDate = `${year}-${month}-${day}`;
                break;
              }
            }
          }
          if (reportDate) break;
        }

        if (reportDate) {
          if (!dateMap.has(reportDate)) {
            dateMap.set(reportDate, []);
          }
          dateMap.set(reportDate, [...dateMap.get(reportDate), file.name.split('/').pop()]);
        }

        resolve();
      });

      pdfParser.parseBuffer(fileContents);
    });
  }

  // Sort dates and display
  const sortedDates = Array.from(dateMap.keys()).sort();

  console.log('PDFs by Report Date:\n');
  sortedDates.forEach(date => {
    const files = dateMap.get(date);
    console.log(`${date}: ${files.length} PDF(s)`);
  });

  // Check for missing dates in October
  console.log('\n🔍 Checking for gaps in October 2025...\n');

  const octoberDates = sortedDates.filter(d => d.startsWith('2025-10-'));

  for (let day = 1; day <= 31; day++) {
    const dateStr = `2025-10-${day.toString().padStart(2, '0')}`;
    if (!octoberDates.includes(dateStr)) {
      console.log(`❌ Missing: ${dateStr}`);
    }
  }

  console.log(`\n✅ Total unique report dates: ${sortedDates.length}`);
}

checkPdfDates().catch(console.error);
