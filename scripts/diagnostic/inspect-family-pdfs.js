// Diagnostic: scan Family subtotals across all weekly PDFs to determine
// whether the 24-25 section is a frozen total or a time-aligned comp curve.
const PDFParser = require('../../cloud-functions/subscription-webhook/node_modules/pdf2json');
const fs = require('fs');
const path = require('path');

async function extractFamilySubtotals(filepath) {
  return new Promise((resolve) => {
    const p = new PDFParser();
    p.on('pdfParser_dataReady', d => {
      const result = { '24-25': null, '25-26': null };
      for (const page of d.Pages) {
        const items = page.Texts.map(t => ({ x: t.x, y: t.y, text: decodeURIComponent(t.R[0].T) }));
        const sortedByY = [...items].sort((a, b) => a.y - b.y);
        const rows = [];
        let cur = [];
        for (const it of sortedByY) {
          if (cur.length === 0 || it.y - cur[0].y < 0.5) cur.push(it);
          else { rows.push(cur.sort((a, b) => a.x - b.x)); cur = [it]; }
        }
        if (cur.length) rows.push(cur.sort((a, b) => a.x - b.x));

        let currentSeason = null;
        let inFamily = false;
        for (const row of rows) {
          const first = row[0]?.text || '';
          const m = first.match(/^(\d{2}-\d{2})\s+SY\s+(.+)$/);
          if (m) {
            currentSeason = m[1];
            inFamily = m[2].trim() === 'Family';
            continue;
          }
          if (first === 'SubTotal' && inFamily && currentSeason) {
            const nums = row.filter(r => r.x > 15 && (/^\$[\d,]+\.?\d*$/.test(r.text) || /^[\d,]+$/.test(r.text))).sort((a, b) => a.x - b.x);
            if (nums.length >= 6) {
              result[currentSeason] = {
                new_seats: nums[0].text,
                new_amt: nums[1].text,
                ren_seats: nums[2].text,
                ren_amt: nums[3].text,
                tot_seats: nums[4].text,
                tot_amt: nums[5].text,
              };
            }
            inFamily = false;
          }
        }
      }
      resolve(result);
    });
    p.loadPDF(filepath);
  });
}

(async () => {
  const dir = 'data/source-files/pdfs/family';
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.pdf')).sort();
  console.log('file            | 24-25 Family (new/ren/tot seats, tot$)         | 25-26 Family');
  console.log('-'.repeat(130));
  for (const f of files) {
    const r = await extractFamilySubtotals(path.join(dir, f));
    const fmt = s => s ? `${s.new_seats}/${s.ren_seats}/${s.tot_seats} ${s.tot_amt}`.padEnd(38) : 'n/a'.padEnd(38);
    console.log(`${f.padEnd(15)} | ${fmt(r['24-25'])} | ${fmt(r['25-26'])}`);
  }
})();
