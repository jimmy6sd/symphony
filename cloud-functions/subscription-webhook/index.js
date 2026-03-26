// Google Cloud Function: Subscription Webhook - Package Sales PDF Processor
// Accepts both legacy per-category PDFs and combined renewal report PDFs from Make.com
// Format auto-detected from attachment filename:
//   Legacy: "12.04.25 Classical Package Sales.pdf" → subscription_sales_snapshots
//   Renewal: "03.01.2026.pdf" → subscription_renewal_snapshots

const { BigQuery } = require('@google-cloud/bigquery');
const { Storage } = require('@google-cloud/storage');
const crypto = require('crypto');
const functions = require('@google-cloud/functions-framework');

const DATASET_ID = process.env.BIGQUERY_DATASET || 'symphony_dashboard';
const LEGACY_TABLE_ID = 'subscription_sales_snapshots';
const RENEWAL_TABLE_ID = 'subscription_renewal_snapshots';

// Legacy: category detection from filename/subject
const CATEGORY_PATTERNS = [
  { category: 'Classical', pattern: /classical/i },
  { category: 'Pops', pattern: /pops/i },
  { category: 'Flex', pattern: /flex/i },
  { category: 'Family', pattern: /family/i },
  { category: 'Specials', pattern: /special/i }
];

// Renewal: category mapping from PDF section headers
const CATEGORY_MAP = {
  'Classical': 'Classical',
  'Pops': 'Pops',
  'Family': 'Family',
  'Special': 'Specials',
  'Flex/CYO': 'Flex',
  'Flex': 'Flex',
  'Student Pass': 'Student Pass'
};

// Initialize credentials (same pattern as other webhooks)
const initializeCredentials = () => {
  try {
    const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!credentialsEnv) return null;

    if (credentialsEnv.startsWith('{')) {
      const credentials = JSON.parse(credentialsEnv);
      if (credentials.private_key && credentials.private_key.includes('\\n')) {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      }
      return credentials;
    }
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON must be JSON string');
  } catch (error) {
    console.error('Credentials error:', error.message);
    throw error;
  }
};

const initializeBigQuery = () => {
  const credentials = initializeCredentials();
  if (credentials) {
    return new BigQuery({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || credentials.project_id,
      credentials: { client_email: credentials.client_email, private_key: credentials.private_key },
      location: 'US'
    });
  }
  return new BigQuery({ projectId: process.env.GOOGLE_CLOUD_PROJECT_ID, location: 'US' });
};

const initializeStorage = () => {
  const credentials = initializeCredentials();
  if (credentials) {
    return new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || credentials.project_id,
      credentials: { client_email: credentials.client_email, private_key: credentials.private_key }
    });
  }
  return new Storage({ projectId: process.env.GOOGLE_CLOUD_PROJECT_ID });
};

// Backup PDF to Cloud Storage
async function backupPdfToStorage(base64Data, executionId, metadata) {
  try {
    const storage = initializeStorage();
    const bucketName = process.env.GCS_PDF_BACKUP_BUCKET || 'symphony-dashboard-pdfs';

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const timestamp = now.toISOString().replace(/[:.]/g, '-').substring(0, 19);

    const originalFilename = metadata?.filename || 'subscription_package_sales';
    const cleanFilename = originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${year}/${month}/subscriptions/${cleanFilename}_${timestamp}_${executionId}.pdf`;

    console.log(`Backing up subscription PDF to gs://${bucketName}/${filename}`);

    const pdfBuffer = Buffer.from(base64Data, 'base64');
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(filename);

    await file.save(pdfBuffer, {
      metadata: {
        contentType: 'application/pdf',
        metadata: {
          executionId,
          uploadedAt: now.toISOString(),
          originalFilename: metadata?.filename || 'unknown',
          source: 'subscription_webhook'
        }
      }
    });

    console.log(`PDF backed up: ${Math.round(pdfBuffer.length / 1024)}KB`);
    return { success: true, filename };
  } catch (error) {
    console.error('PDF backup failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Detect report format from filename
// Legacy: "12.04.25 Classical Package Sales.pdf" (category in name)
// Renewal: "27 SY-Package Sales Renewal Report_1174278.pdf" (no category, has "Renewal")
function detectFormat(filename) {
  if (!filename) return 'renewal';
  if (/renewal/i.test(filename)) return 'renewal';
  for (const { pattern } of CATEGORY_PATTERNS) {
    if (pattern.test(filename)) return 'legacy';
  }
  return 'renewal';
}

// Legacy: detect category from filename, email subject, or metadata
function detectCategory(metadata) {
  const sources = [
    metadata?.filename || '',
    metadata?.email_subject || '',
    metadata?.category || ''
  ];

  for (const source of sources) {
    for (const { category, pattern } of CATEGORY_PATTERNS) {
      if (pattern.test(source)) {
        return category;
      }
    }
  }

  return 'Unknown';
}

// Legacy: extract season from PDF text items
function extractSeason(items) {
  for (const item of items) {
    const seasonMatch = item.match(/Season:\s*(\d{2}-\d{2})/);
    if (seasonMatch) return seasonMatch[1];
    const altMatch = item.match(/(\d{2}-\d{2})\s*SY/);
    if (altMatch) return altMatch[1];
  }
  return '25-26';
}

// Legacy: extract report date from PDF text items
function extractReportDate(items) {
  for (const item of items) {
    const runByMatch = item.match(/on\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (runByMatch) {
      const [_, month, day, year] = runByMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }
  return null;
}

// Extract snapshot date from filename (supports both MM.DD.YYYY and MM.DD.YY)
function extractDateFromFilename(filename) {
  if (!filename) return null;
  // Try 4-digit year first: MM.DD.YYYY
  const mmddyyyyMatch = filename.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (mmddyyyyMatch) {
    const [_, month, day, year] = mmddyyyyMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  // Fallback: 2-digit year MM.DD.YY
  const mmddyyMatch = filename.match(/(\d{1,2})\.(\d{1,2})\.(\d{2})/);
  if (mmddyyMatch) {
    const [_, month, day, year] = mmddyyMatch;
    const fullYear = parseInt(year) < 50 ? `20${year}` : `19${year}`;
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  const isoMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  return null;
}

function parseNumeric(text) {
  return parseFloat(text.replace(/[$,]/g, '')) || 0;
}

// Parse renewal PDF using coordinate-based extraction
// One PDF contains all categories with New/Renewed/Total breakdown
async function parseRenewalPdf(base64Data) {
  const PDFParser = require('pdf2json');
  const pdfBuffer = Buffer.from(base64Data, 'base64');

  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataError', errData => reject(errData.parserError));

    pdfParser.on('pdfParser_dataReady', pdfData => {
      const packages = [];
      let currentCategory = null;
      let currentSeason = null;
      let reportDate = null;

      for (const page of pdfData.Pages) {
        const items = page.Texts.map(t => ({
          x: t.x,
          y: t.y,
          text: decodeURIComponent(t.R[0].T)
        }));

        // Extract report date from PDF header (e.g., "3/1/2026" near top of page 1)
        if (!reportDate) {
          for (const item of items) {
            const dateMatch = item.text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (dateMatch && item.y < 5) {
              const [_, month, day, year] = dateMatch;
              reportDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
              break;
            }
          }
        }

        // Group into rows by y-coordinate
        const sortedByY = [...items].sort((a, b) => a.y - b.y);
        const rows = [];
        let currentRow = [];

        for (const item of sortedByY) {
          if (currentRow.length === 0 || item.y - currentRow[0].y < 0.5) {
            currentRow.push(item);
          } else {
            rows.push(currentRow.sort((a, b) => a.x - b.x));
            currentRow = [item];
          }
        }
        if (currentRow.length > 0) {
          rows.push(currentRow.sort((a, b) => a.x - b.x));
        }

        for (const row of rows) {
          const firstText = row[0]?.text || '';

          // Detect category header: "26-27 SY Classical"
          const catMatch = firstText.match(/^(\d{2}-\d{2})\s+SY\s+(.+)$/);
          if (catMatch) {
            currentSeason = catMatch[1];
            const rawCat = catMatch[2].trim();
            currentCategory = CATEGORY_MAP[rawCat] || rawCat;
            continue;
          }

          if (firstText === 'SubTotal' || firstText === 'Total') continue;
          if (!currentCategory) continue;
          if (!firstText.match(/^\d{2}\s+.+/)) continue;

          const packageName = firstText;
          const typeItem = row.find(r => /^SY-/.test(r.text));
          const packageType = typeItem ? typeItem.text : 'SY-Full';

          // Collect numeric items in data columns (x > 15), sorted by x
          const numericItems = row.filter(r =>
            r.x > 15 && (
              /^\$[\d,]+\.?\d*$/.test(r.text) ||
              /^[\d,]+$/.test(r.text)
            )
          ).sort((a, b) => a.x - b.x);

          if (numericItems.length < 6) continue;

          // Column order: new_seats, new_amount, renewed_seats, renewed_amount, total_seats, total_amount
          const newSeats = parseInt(numericItems[0].text.replace(/[$,]/g, '')) || 0;
          const newAmount = parseNumeric(numericItems[1].text);
          const renewedSeats = parseInt(numericItems[2].text.replace(/[$,]/g, '')) || 0;
          const renewedAmount = parseNumeric(numericItems[3].text);
          const totalSeats = parseInt(numericItems[4].text.replace(/[$,]/g, '')) || 0;
          const totalAmount = parseNumeric(numericItems[5].text);

          const isSubLine = /\bsub\b/i.test(packageName);

          packages.push({
            season: currentSeason,
            category: currentCategory,
            package_type: packageType,
            package_name: packageName,
            new_pkg_seats: isSubLine ? 0 : newSeats,
            new_amount: newAmount,
            renewed_pkg_seats: isSubLine ? 0 : renewedSeats,
            renewed_amount: renewedAmount,
            total_pkg_seats: isSubLine ? 0 : totalSeats,
            total_amount: totalAmount,
            is_sub_line: isSubLine
          });
        }
      }

      resolve({ packages, season: currentSeason, reportDate });
    });

    pdfParser.parseBuffer(pdfBuffer);
  });
}

// Legacy: parse subscription PDF (per-category format)
async function parseLegacyPdf(base64Data) {
  const PDFParser = require('pdf2json');
  const pdfBuffer = Buffer.from(base64Data, 'base64');

  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataError', errData => reject(errData.parserError));

    pdfParser.on('pdfParser_dataReady', pdfData => {
      const packages = [];
      let reportDate = null;
      let season = null;

      for (const page of pdfData.Pages) {
        const allItems = [];
        for (const textItem of page.Texts) {
          const content = decodeURIComponent(textItem.R[0].T);
          allItems.push(content);
        }

        if (!season) season = extractSeason(allItems);
        if (!reportDate) reportDate = extractReportDate(allItems);

        let currentPackageType = null;

        for (let i = 0; i < allItems.length; i++) {
          const item = allItems[i];

          if (item.match(/^SY-Full/i)) { currentPackageType = 'SY-Full'; continue; }
          if (item.match(/^SY-Mini/i)) { currentPackageType = 'SY-Mini'; continue; }
          if (item.match(/^SY-FlexPass/i)) { currentPackageType = 'SY-FlexPass'; continue; }

          const packageNameMatch = item.match(/^(25|26|27)\s+(.+)$/);
          if (packageNameMatch && currentPackageType) {
            const packageName = item;
            let idx = i + 1;

            const numericValues = [];
            while (idx < allItems.length && numericValues.length < 5) {
              const val = allItems[idx];
              if (val.match(/^[\d,]+$/) || val.match(/^[\d,]+\.\d{2}$/)) {
                numericValues.push(val);
              } else if (val.match(/^(25|26|27)\s/) || val.match(/^SY-/) || val === 'SubTotal' || val === 'Total') {
                break;
              }
              idx++;
            }

            if (numericValues.length >= 5) {
              packages.push({
                package_type: currentPackageType,
                package_name: packageName,
                package_seats: parseInt(numericValues[0].replace(/,/g, '')) || 0,
                perf_seats: parseInt(numericValues[1].replace(/,/g, '')) || 0,
                total_amount: parseFloat(numericValues[2].replace(/,/g, '')) || 0,
                paid_amount: parseFloat(numericValues[3].replace(/,/g, '')) || 0,
                orders: parseInt(numericValues[4].replace(/,/g, '')) || 0
              });
            }
          }
        }
      }

      resolve({ packages, reportDate, season });
    });

    pdfParser.parseBuffer(pdfBuffer);
  });
}

// Insert snapshots into BigQuery (works for both table formats)
async function insertSnapshots(bigquery, snapshots, tableId) {
  if (snapshots.length === 0) {
    return { inserted: 0, skipped: 0 };
  }

  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;

  // Check for existing snapshots to avoid duplicates
  const dates = [...new Set(snapshots.map(s => `'${s.snapshot_date}'`))].join(',');
  const categories = [...new Set(snapshots.map(s => `'${s.category}'`))].join(',');

  let existingSet = new Set();
  try {
    const checkQuery = `
      SELECT DISTINCT snapshot_date, category, package_name
      FROM \`${projectId}.${DATASET_ID}.${tableId}\`
      WHERE snapshot_date IN (${dates})
        AND category IN (${categories})
    `;
    const [existingRows] = await bigquery.query({ query: checkQuery, location: 'US' });
    existingSet = new Set(existingRows.map(r => {
      const date = r.snapshot_date.value || r.snapshot_date;
      return `${date}_${r.category}_${r.package_name}`;
    }));
  } catch (error) {
    console.log('Could not check for existing records (table may be empty)');
  }

  const newSnapshots = snapshots.filter(s =>
    !existingSet.has(`${s.snapshot_date}_${s.category}_${s.package_name}`)
  );

  const skipped = snapshots.length - newSnapshots.length;
  if (skipped > 0) console.log(`Skipping ${skipped} existing snapshot(s)`);

  if (newSnapshots.length === 0) {
    console.log('All snapshots already exist');
    return { inserted: 0, skipped };
  }

  console.log(`Inserting ${newSnapshots.length} new snapshot(s) into ${tableId}...`);

  const table = bigquery.dataset(DATASET_ID).table(tableId);
  await table.insert(newSnapshots);
  console.log(`Inserted ${newSnapshots.length} snapshots`);
  return { inserted: newSnapshots.length, skipped };
}

// Update subscription_historical_data with daily totals for the sales curve chart
async function updateHistoricalData(bigquery, category, season, snapshotDate, snapshots, format) {
  if (category !== 'Classical' && category !== 'Pops') {
    console.log(`Skipping historical data update for ${category} (only Classical/Pops tracked)`);
    return;
  }

  if (snapshots.length === 0) return;

  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;

  // Calculate ISO week number
  const d = new Date(snapshotDate);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);

  let newUnits, newRevenue, renewalUnits, renewalRevenue, totalUnits, totalRevenue;

  if (format === 'renewal') {
    // Renewal format: actual new/renewed breakdown available
    newUnits = snapshots.reduce((sum, s) => sum + (s.is_sub_line ? 0 : (s.new_pkg_seats || 0)), 0);
    newRevenue = snapshots.reduce((sum, s) => sum + (s.new_amount || 0), 0);
    renewalUnits = snapshots.reduce((sum, s) => sum + (s.is_sub_line ? 0 : (s.renewed_pkg_seats || 0)), 0);
    renewalRevenue = snapshots.reduce((sum, s) => sum + (s.renewed_amount || 0), 0);
    totalUnits = snapshots.reduce((sum, s) => sum + (s.is_sub_line ? 0 : (s.total_pkg_seats || 0)), 0);
    totalRevenue = snapshots.reduce((sum, s) => sum + (s.total_amount || 0), 0);
  } else {
    // Legacy format: no new/renewed breakdown
    newUnits = 0;
    newRevenue = 0;
    renewalUnits = 0;
    renewalRevenue = 0;
    totalUnits = snapshots.reduce((sum, s) => sum + (s.package_seats || 0), 0);
    totalRevenue = snapshots.reduce((sum, s) => sum + (s.total_amount || 0), 0);
  }

  console.log(`Updating historical data: ${category} ${season} ${snapshotDate} (week ${weekNumber}) - ${totalUnits} units, $${totalRevenue}`);

  try {
    const mergeQuery = `
      MERGE \`${projectId}.${DATASET_ID}.subscription_historical_data\` target
      USING (SELECT '${category}' as series, '${season}' as season, DATE('${snapshotDate}') as snapshot_date) source
      ON target.series = source.series
        AND target.season = source.season
        AND target.snapshot_date = source.snapshot_date
        AND target.is_final = FALSE
      WHEN MATCHED THEN
        UPDATE SET
          week_number = ${weekNumber},
          new_units = ${newUnits},
          new_revenue = ${newRevenue},
          renewal_units = ${renewalUnits},
          renewal_revenue = ${renewalRevenue},
          total_units = ${totalUnits},
          total_revenue = ${totalRevenue}
      WHEN NOT MATCHED THEN
        INSERT (series, season, snapshot_date, week_number, new_units, new_revenue, renewal_units, renewal_revenue, total_units, total_revenue, is_final)
        VALUES ('${category}', '${season}', '${snapshotDate}', ${weekNumber}, ${newUnits}, ${newRevenue}, ${renewalUnits}, ${renewalRevenue}, ${totalUnits}, ${totalRevenue}, FALSE)
    `;
    await bigquery.query({ query: mergeQuery, location: 'US' });
    console.log(`Historical data updated: ${category} ${snapshotDate}`);
  } catch (error) {
    console.error(`Historical data update failed for ${category}:`, error.message);
  }
}

// Log pipeline execution
async function logPipelineExecution(bigquery, executionId, status, details) {
  try {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const query = `
      INSERT INTO \`${projectId}.${DATASET_ID}.pipeline_execution_log\`
      (execution_id, pipeline_type, status, start_time, source_file, triggered_by,
       records_processed, records_inserted, records_updated, end_time, error_message)
      VALUES (?, 'subscription_webhook', ?, ?, ?, 'make.com', ?, ?, 0, ?, ?)
    `;

    await bigquery.query({
      query,
      params: [
        executionId,
        status,
        details.start_time || new Date().toISOString(),
        details.source_file || 'unknown',
        details.records_processed || 0,
        details.records_inserted || 0,
        details.end_time || new Date().toISOString(),
        details.error_message || null
      ],
      location: 'US'
    });
  } catch (error) {
    console.log('Pipeline logging skipped:', error.message);
  }
}

// Main HTTP handler
functions.http('subscriptionWebhook', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const executionId = `sub_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const startTime = new Date().toISOString();

  try {
    console.log(`Subscription webhook received - Execution ID: ${executionId}`);

    const { pdf_base64, metadata } = req.body;

    if (!pdf_base64) {
      throw new Error('No pdf_base64 provided');
    }

    console.log(`PDF size: ${Math.round(pdf_base64.length * 0.75 / 1024)}KB`);
    console.log(`Metadata: ${JSON.stringify(metadata || {})}`);

    // Detect format from filename
    const format = detectFormat(metadata?.filename);
    console.log(`Detected format: ${format}`);

    // Backup PDF
    const backupResult = await backupPdfToStorage(pdf_base64, executionId, metadata);

    const bigquery = initializeBigQuery();
    let result;
    let summary;

    if (format === 'renewal') {
      // ── Renewal format: combined PDF with all categories ──
      console.log('Parsing renewal PDF...');
      const { packages, season, reportDate } = await parseRenewalPdf(pdf_base64);

      // Date priority: PDF report date > email date from Make.com > today
      const snapshotDate = reportDate
        || metadata?.email_date
        || new Date().toISOString().split('T')[0];

      console.log(`Snapshot date: ${snapshotDate}, Season: ${season}, Packages: ${packages.length}`);

      const subLines = packages.filter(p => p.is_sub_line);
      const categories = [...new Set(packages.map(p => p.category))];
      console.log(`Categories: ${categories.join(', ')}, Sub lines: ${subLines.length}`);

      packages.forEach(pkg => {
        console.log(`  ${pkg.category} | ${pkg.package_name}: ${pkg.total_pkg_seats} seats, $${pkg.total_amount}${pkg.is_sub_line ? ' [SUB]' : ''}`);
      });

      // Build snapshots with date
      const snapshots = packages.map(pkg => ({ ...pkg, snapshot_date: snapshotDate }));

      // Insert into renewal table
      result = await insertSnapshots(bigquery, snapshots, RENEWAL_TABLE_ID);

      // Update historical data for each tracked category
      for (const cat of ['Classical', 'Pops']) {
        const catSnapshots = snapshots.filter(s => s.category === cat);
        if (catSnapshots.length > 0) {
          await updateHistoricalData(bigquery, cat, season, snapshotDate, catSnapshots, 'renewal');
        }
      }

      summary = {
        format: 'renewal',
        snapshot_date: snapshotDate,
        season: season,
        categories: categories,
        packages_found: packages.length,
        sub_lines: subLines.length,
        inserted: result.inserted,
        skipped: result.skipped
      };

    } else {
      // ── Legacy format: one category per PDF ──
      const category = detectCategory(metadata);
      console.log(`Detected category: ${category}`);

      if (category === 'Unknown') {
        console.log('WARNING: Could not detect category. Include category name in filename or email_subject.');
      }

      console.log('Parsing legacy subscription PDF...');
      const { packages, reportDate, season } = await parseLegacyPdf(pdf_base64);

      const snapshotDate = reportDate
        || extractDateFromFilename(metadata?.filename)
        || new Date().toISOString().split('T')[0];

      console.log(`Report date: ${reportDate}, Snapshot date: ${snapshotDate}, Season: ${season}, Packages: ${packages.length}`);

      packages.forEach(pkg => {
        console.log(`  ${pkg.package_type} | ${pkg.package_name}: ${pkg.package_seats} pkg, ${pkg.perf_seats} perf, $${pkg.total_amount}, ${pkg.orders} orders`);
      });

      const snapshots = packages.map(pkg => ({
        snapshot_date: snapshotDate,
        season: season,
        category: category,
        package_type: pkg.package_type,
        package_name: pkg.package_name,
        package_seats: pkg.package_seats,
        perf_seats: pkg.perf_seats,
        total_amount: pkg.total_amount,
        paid_amount: pkg.paid_amount,
        orders: pkg.orders
      }));

      result = await insertSnapshots(bigquery, snapshots, LEGACY_TABLE_ID);
      await updateHistoricalData(bigquery, category, season, snapshotDate, snapshots, 'legacy');

      summary = {
        format: 'legacy',
        category: category,
        snapshot_date: snapshotDate,
        season: season,
        packages_found: packages.length,
        inserted: result.inserted,
        skipped: result.skipped
      };
    }

    // Log execution
    await logPipelineExecution(bigquery, executionId, 'completed', {
      start_time: startTime,
      source_file: metadata?.filename || 'unknown',
      records_processed: summary.packages_found,
      records_inserted: result.inserted,
      end_time: new Date().toISOString()
    });

    console.log(`Processing complete - Inserted: ${result.inserted}, Skipped: ${result.skipped}`);

    res.status(200).json({
      success: true,
      execution_id: executionId,
      backup: backupResult,
      summary,
      message: `Subscription PDF processed (${format}): ${summary.packages_found} packages`
    });

  } catch (error) {
    console.error(`Subscription webhook failed - ${executionId}:`, error.message);
    console.error('Stack trace:', error.stack);

    try {
      const bigquery = initializeBigQuery();
      await logPipelineExecution(bigquery, executionId, 'failed', {
        start_time: startTime,
        source_file: req.body?.metadata?.filename || 'unknown',
        end_time: new Date().toISOString(),
        error_message: error.message
      });
    } catch (logError) {
      console.error('Failed to log error:', logError.message);
    }

    res.status(500).json({
      error: 'Subscription PDF processing failed',
      execution_id: executionId,
      message: error.message
    });
  }
});
