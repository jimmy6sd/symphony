// Google Cloud Function: Subscription Webhook - Package Sales PDF Processor
// Accepts Tessitura Package Sales Report PDFs from Make.com
// Handles all 5 categories: Classical, Pops, Flex, Family, Specials
// Inserts into subscription_sales_snapshots table

const { BigQuery } = require('@google-cloud/bigquery');
const { Storage } = require('@google-cloud/storage');
const crypto = require('crypto');
const functions = require('@google-cloud/functions-framework');

const DATASET_ID = process.env.BIGQUERY_DATASET || 'symphony_dashboard';
const TABLE_ID = 'subscription_sales_snapshots';

// Category detection patterns
const CATEGORY_PATTERNS = [
  { category: 'Classical', pattern: /classical/i },
  { category: 'Pops', pattern: /pops/i },
  { category: 'Flex', pattern: /flex/i },
  { category: 'Family', pattern: /family/i },
  { category: 'Specials', pattern: /special/i }
];

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

// Detect category from filename, email subject, or metadata
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

// Extract season from PDF text items
function extractSeason(items) {
  for (const item of items) {
    const seasonMatch = item.match(/Season:\s*(\d{2}-\d{2})/);
    if (seasonMatch) return seasonMatch[1];
    const altMatch = item.match(/(\d{2}-\d{2})\s*SY/);
    if (altMatch) return altMatch[1];
  }
  return '25-26';
}

// Extract report date from PDF text items
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

// Extract snapshot date from filename (e.g., "12.04.25 Classical Package Sales.pdf")
function extractDateFromFilename(filename) {
  if (!filename) return null;
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

// Parse subscription PDF and extract package data
async function parseSubscriptionPdf(base64Data) {
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

        // Extract season from header
        if (!season) {
          season = extractSeason(allItems);
        }

        // Extract report date
        if (!reportDate) {
          reportDate = extractReportDate(allItems);
        }

        // Parse table rows - look for package types and their data
        let currentPackageType = null;

        for (let i = 0; i < allItems.length; i++) {
          const item = allItems[i];

          // Detect package type headers
          if (item.match(/^SY-Full/i)) {
            currentPackageType = 'SY-Full';
            continue;
          }
          if (item.match(/^SY-Mini/i)) {
            currentPackageType = 'SY-Mini';
            continue;
          }
          if (item.match(/^SY-FlexPass/i)) {
            currentPackageType = 'SY-FlexPass';
            continue;
          }

          // Look for package name patterns (e.g., "26 Friday Masterworks", "26 CYO 5+")
          // Package names typically start with "26 " or "25 " followed by the name
          const packageNameMatch = item.match(/^(25|26|27)\s+(.+)$/);
          if (packageNameMatch && currentPackageType) {
            const packageName = item;

            // Next items should be: Pkg seats, Perf seats, Total Amount, Paid Amount, Orders
            let idx = i + 1;

            // Collect numeric values after package name
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
              const pkgSeats = parseInt(numericValues[0].replace(/,/g, '')) || 0;
              const perfSeats = parseInt(numericValues[1].replace(/,/g, '')) || 0;
              const totalAmount = parseFloat(numericValues[2].replace(/,/g, '')) || 0;
              const paidAmount = parseFloat(numericValues[3].replace(/,/g, '')) || 0;
              const orders = parseInt(numericValues[4].replace(/,/g, '')) || 0;

              packages.push({
                package_type: currentPackageType,
                package_name: packageName,
                package_seats: pkgSeats,
                perf_seats: perfSeats,
                total_amount: totalAmount,
                paid_amount: paidAmount,
                orders: orders
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

// Insert snapshots into BigQuery
async function insertSnapshots(bigquery, snapshots) {
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
      FROM \`${projectId}.${DATASET_ID}.${TABLE_ID}\`
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

  // Filter to only new snapshots
  const newSnapshots = snapshots.filter(s =>
    !existingSet.has(`${s.snapshot_date}_${s.category}_${s.package_name}`)
  );

  const skipped = snapshots.length - newSnapshots.length;
  if (skipped > 0) {
    console.log(`Skipping ${skipped} existing snapshot(s)`);
  }

  if (newSnapshots.length === 0) {
    console.log('All snapshots already exist');
    return { inserted: 0, skipped };
  }

  console.log(`Inserting ${newSnapshots.length} new snapshot(s)...`);

  const table = bigquery.dataset(DATASET_ID).table(TABLE_ID);
  const rows = newSnapshots.map(s => ({
    snapshot_date: s.snapshot_date,
    season: s.season,
    category: s.category,
    package_type: s.package_type,
    package_name: s.package_name,
    package_seats: s.package_seats,
    perf_seats: s.perf_seats,
    total_amount: s.total_amount,
    paid_amount: s.paid_amount,
    orders: s.orders
  }));

  await table.insert(rows);
  console.log(`Inserted ${rows.length} snapshots`);
  return { inserted: rows.length, skipped };
}

// Update subscription_historical_data with daily totals for the sales curve chart
// This upserts a row for the current category (series) + season + snapshot_date
async function updateHistoricalData(bigquery, category, season, snapshotDate, snapshots) {
  // Only track Classical and Pops (matches existing historical data)
  if (category !== 'Classical' && category !== 'Pops') {
    console.log(`Skipping historical data update for ${category} (only Classical/Pops tracked)`);
    return;
  }

  if (snapshots.length === 0) return;

  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;

  // Calculate ISO week number (kept for reference/compatibility)
  const d = new Date(snapshotDate);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);

  // Aggregate totals from all packages in this category
  const totalUnits = snapshots.reduce((sum, s) => sum + (s.package_seats || 0), 0);
  const totalRevenue = snapshots.reduce((sum, s) => sum + (s.total_amount || 0), 0);

  console.log(`Updating historical data: ${category} ${season} ${snapshotDate} (week ${weekNumber}) - ${totalUnits} units, $${totalRevenue}`);

  try {
    // MERGE upsert keyed on snapshot_date for daily granularity
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
          total_units = ${totalUnits},
          total_revenue = ${totalRevenue}
      WHEN NOT MATCHED THEN
        INSERT (series, season, snapshot_date, week_number, new_units, new_revenue, renewal_units, renewal_revenue, total_units, total_revenue, is_final)
        VALUES ('${category}', '${season}', '${snapshotDate}', ${weekNumber}, 0, 0, 0, 0, ${totalUnits}, ${totalRevenue}, FALSE)
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

    // Detect category from metadata
    const category = detectCategory(metadata);
    console.log(`Detected category: ${category}`);

    if (category === 'Unknown') {
      console.log('WARNING: Could not detect category from filename/subject. Include "Classical", "Pops", "Flex", "Family", or "Special" in the filename or email_subject metadata field.');
    }

    // Backup PDF
    const backupResult = await backupPdfToStorage(pdf_base64, executionId, metadata);

    // Parse subscription PDF
    console.log('Parsing subscription PDF...');
    const { packages, reportDate, season } = await parseSubscriptionPdf(pdf_base64);

    // Determine snapshot date: PDF report date > filename date > today
    const snapshotDate = reportDate
      || extractDateFromFilename(metadata?.filename)
      || new Date().toISOString().split('T')[0];

    console.log(`Report date: ${reportDate}`);
    console.log(`Snapshot date: ${snapshotDate}`);
    console.log(`Season: ${season}`);
    console.log(`Packages found: ${packages.length}`);

    if (packages.length > 0) {
      packages.forEach(pkg => {
        console.log(`  ${pkg.package_type} | ${pkg.package_name}: ${pkg.package_seats} pkg, ${pkg.perf_seats} perf, $${pkg.total_amount.toLocaleString()}, ${pkg.orders} orders`);
      });
    }

    // Build snapshot rows
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

    // Insert into BigQuery
    const bigquery = initializeBigQuery();
    const result = await insertSnapshots(bigquery, snapshots);

    // Update historical data for sales curve chart
    await updateHistoricalData(bigquery, category, season, snapshotDate, snapshots);

    // Log execution
    await logPipelineExecution(bigquery, executionId, 'completed', {
      start_time: startTime,
      source_file: metadata?.filename || 'unknown',
      records_processed: packages.length,
      records_inserted: result.inserted,
      end_time: new Date().toISOString()
    });

    console.log(`Processing complete - Inserted: ${result.inserted}, Skipped: ${result.skipped}`);

    res.status(200).json({
      success: true,
      execution_id: executionId,
      backup: backupResult,
      summary: {
        category: category,
        snapshot_date: snapshotDate,
        season: season,
        packages_found: packages.length,
        inserted: result.inserted,
        skipped: result.skipped
      },
      message: `Subscription PDF processed: ${category} - ${packages.length} packages`
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
