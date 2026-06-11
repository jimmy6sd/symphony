// Regenerates the EMAIL_CAMPAIGNS array in src/marketing/email-performance.js
// from a Constant Contact per-campaign CSV export (Reporting → Email → export).
//
// Expected CSV columns:
//   Time Sent, Campaign Name, Sends, Opens, Open Rate, Mobile Open Rate,
//   Desktop Open Rate, Clicks, Click Rate, Bounces, Bounce Rate,
//   Unsubscribes, Unsubscribe Rate
//
// Usage: node scripts/active/refresh-email-campaigns.js <path-to-export.csv>
//
// Interim workflow while the Constant Contact API is unavailable (app creation
// shut down as of June 2026) — replace with the automated sync once API access
// is restored.

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Usage: node scripts/active/refresh-email-campaigns.js <path-to-export.csv>');
  process.exit(1);
}

const targetPath = path.join(__dirname, '../../src/marketing/email-performance.js');

const records = parse(fs.readFileSync(csvPath, 'utf8'), {
  bom: true,
  columns: true,
  skip_empty_lines: true,
  trim: true,
});

function toIsoMinutes(timeSent) {
  // '2026/06/11 10:20 AM' -> '2026-06-11 10:20'
  const m = timeSent.match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) throw new Error(`Unrecognized Time Sent format: "${timeSent}"`);
  let hour = parseInt(m[4], 10);
  const ampm = m[6].toUpperCase();
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return `${m[1]}-${m[2]}-${m[3]} ${String(hour).padStart(2, '0')}:${m[5]}`;
}

const num = v => (v === '' || v == null ? null : parseFloat(String(v).replace(/[%,]/g, '')));

const lines = records.map(r => {
  const fields = [
    `date: '${toIsoMinutes(r['Time Sent'])}'`,
    `name: ${JSON.stringify(r['Campaign Name'])}`,
    `sends: ${num(r['Sends'])}`,
  ];
  if (num(r['Sends']) != null) {
    fields.push(
      `opens: ${num(r['Opens'])}`,
      `openRate: ${num(r['Open Rate'])}`,
      `mobileOpen: ${num(r['Mobile Open Rate'])}`,
      `desktopOpen: ${num(r['Desktop Open Rate'])}`,
      `clicks: ${num(r['Clicks'])}`,
      `clickRate: ${num(r['Click Rate'])}`,
      `bounces: ${num(r['Bounces'])}`,
      `bounceRate: ${num(r['Bounce Rate'])}`,
      `unsubs: ${num(r['Unsubscribes'])}`,
      `unsubRate: ${num(r['Unsubscribe Rate'])}`,
    );
  }
  return `  { ${fields.join(', ')} },`;
});

const src = fs.readFileSync(targetPath, 'utf8');
const startMarker = 'const EMAIL_CAMPAIGNS = [';
const start = src.indexOf(startMarker);
if (start === -1) throw new Error(`Could not find "${startMarker}" in ${targetPath}`);
// The array closes with `].filter(...)` — match the bracket, keep what follows.
const endMatch = src.slice(start).match(/\r?\n\](?=[.;])/);
if (!endMatch) throw new Error('Could not find closing "]" of EMAIL_CAMPAIGNS');
const end = start + endMatch.index;

const updated = src.slice(0, start) + startMarker + '\n' + lines.join('\n') + src.slice(end);
fs.writeFileSync(targetPath, updated);

console.log(`Wrote ${lines.length} campaigns (${records[records.length - 1]['Time Sent']} – ${records[0]['Time Sent']}) to ${path.relative(process.cwd(), targetPath)}`);
