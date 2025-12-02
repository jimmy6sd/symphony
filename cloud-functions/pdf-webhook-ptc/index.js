// Google Cloud Function: PTC PDF Webhook - Complimentary Ticket Extractor
// Accepts "Performance Sales Summary by Price Type Category" PDFs from Make.com
// Updates existing snapshots with comp_tickets data

const { BigQuery } = require('@google-cloud/bigquery');
const { Storage } = require('@google-cloud/storage');
const crypto = require('crypto');
const functions = require('@google-cloud/functions-framework');

const DATASET_ID = process.env.BIGQUERY_DATASET || 'symphony_dashboard';

// Initialize credentials (same as main webhook)
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

    const originalFilename = metadata?.filename || 'ptc_report';
    const cleanFilename = originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${year}/${month}/ptc/${cleanFilename}_${timestamp}_${executionId}.pdf`;

    console.log(`Backing up PTC PDF to gs://${bucketName}/${filename}`);

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
          source: 'ptc_webhook'
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

// Parse PTC PDF and extract comp ticket counts
async function parsePtcPdf(base64Data) {
  const PDFParser = require('pdf2json');
  const pdfBuffer = Buffer.from(base64Data, 'base64');

  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataError', errData => reject(errData.parserError));

    pdfParser.on('pdfParser_dataReady', pdfData => {
      const performances = [];
      let reportDate = null;

      // Collect all text items from all pages
      const allItems = [];
      for (const page of pdfData.Pages) {
        for (const textItem of page.Texts) {
          const content = decodeURIComponent(textItem.R[0].T);
          allItems.push(content);
        }
      }

      // Extract report date from "Run by ... on MM/DD/YYYY"
      for (let i = 0; i < allItems.length; i++) {
        const runByMatch = allItems[i].match(/Run by .* on (\d{1,2}\/\d{1,2}\/\d{4})/);
        if (runByMatch) {
          const dateParts = runByMatch[1].split('/');
          reportDate = `${dateParts[2]}-${dateParts[0].padStart(2, '0')}-${dateParts[1].padStart(2, '0')}`;
          break;
        }
      }

      // Performance code patterns
      const perfCodeRegex = /^(25|26|27)\d{4}[A-Z]{1,2}$|^(25|26|27)[A-Z]+\d*$/;

      for (let i = 0; i < allItems.length; i++) {
        const item = allItems[i];

        if (perfCodeRegex.test(item) && !allItems[i-1]?.includes('Total') && !allItems[i-1]?.includes('26 ')) {
          const performanceCode = item;

          // Find "Ticket Price" row
          let ticketPriceIdx = -1;
          for (let j = i + 1; j < Math.min(i + 20, allItems.length); j++) {
            if (allItems[j] === 'Ticket Price') {
              ticketPriceIdx = j;
              break;
            }
            if (perfCodeRegex.test(allItems[j])) break;
          }

          if (ticketPriceIdx === -1) continue;

          // Parse data after "Ticket Price"
          // Structure: Package# | Package$ | Single# | Single$ | Discount# | Discount$ | Comp# | ...
          let idx = ticketPriceIdx + 1;

          const parseNum = (str) => parseInt((str || '0').replace(/,/g, '')) || 0;

          // Skip Package (# and $)
          idx += 2;
          // Skip Single (# and $)
          idx += 2;
          // Skip Discount (# and $)
          idx += 2;

          // COMP COUNT
          const compCount = parseNum(allItems[idx]);

          performances.push({
            performance_code: performanceCode,
            comp_tickets: compCount
          });
        }
      }

      resolve({ performances, reportDate });
    });

    pdfParser.parseBuffer(pdfBuffer);
  });
}

// Update snapshots with comp ticket data - BATCH VERSION (2 queries instead of N*2)
async function updateSnapshotsWithComps(bigquery, compData) {
  console.log(`Batch updating ${compData.length} performances with comp data...`);

  if (compData.length === 0) {
    return { updated: 0, notFound: 0 };
  }

  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const perfCodes = compData.map(p => p.performance_code);

  // Step 1: Get all max dates in ONE query
  const perfCodeList = perfCodes.map(c => `'${c}'`).join(',');
  const maxDatesQuery = `
    SELECT performance_code, MAX(snapshot_date) as max_date
    FROM \`${projectId}.${DATASET_ID}.performance_sales_snapshots\`
    WHERE performance_code IN (${perfCodeList})
    GROUP BY performance_code
  `;

  console.log('Fetching max snapshot dates for all performances...');
  const [maxDateRows] = await bigquery.query({ query: maxDatesQuery, location: 'US' });

  // Build map of perf_code -> max_date
  const maxDateMap = new Map();
  for (const row of maxDateRows) {
    maxDateMap.set(row.performance_code, row.max_date.value);
  }

  console.log(`Found ${maxDateMap.size} performances with snapshots`);

  // Filter comp data to only those with snapshots
  const toUpdate = compData.filter(p => maxDateMap.has(p.performance_code));
  const notFound = compData.length - toUpdate.length;

  if (notFound > 0) {
    const missing = compData.filter(p => !maxDateMap.has(p.performance_code)).map(p => p.performance_code);
    console.log(`Performances without snapshots: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? '...' : ''}`);
  }

  if (toUpdate.length === 0) {
    return { updated: 0, notFound };
  }

  // Step 2: Build ONE batch UPDATE using FROM clause
  const compValues = toUpdate.map(p =>
    `SELECT '${p.performance_code}' as performance_code, ${p.comp_tickets} as comp_tickets, DATE('${maxDateMap.get(p.performance_code)}') as snapshot_date`
  ).join('\n    UNION ALL ');

  const updateQuery = `
    UPDATE \`${projectId}.${DATASET_ID}.performance_sales_snapshots\` target
    SET comp_tickets = source.comp_tickets
    FROM (
      ${compValues}
    ) source
    WHERE target.performance_code = source.performance_code
      AND target.snapshot_date = source.snapshot_date
  `;

  console.log('Executing batch update...');
  await bigquery.query({ query: updateQuery, location: 'US' });

  console.log(`Batch update complete: ${toUpdate.length} updated, ${notFound} not found`);

  return { updated: toUpdate.length, notFound };
}

// Main HTTP handler
functions.http('ptcPdfWebhook', async (req, res) => {
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

  const executionId = `ptc_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  try {
    console.log(`PTC webhook received - Execution ID: ${executionId}`);

    const { pdf_base64, metadata } = req.body;

    if (!pdf_base64) {
      throw new Error('No pdf_base64 provided');
    }

    console.log(`PDF size: ${Math.round(pdf_base64.length * 0.75 / 1024)}KB`);

    // Backup PDF
    const backupResult = await backupPdfToStorage(pdf_base64, executionId, metadata);

    // Parse PTC PDF
    console.log('Parsing PTC PDF...');
    const { performances, reportDate } = await parsePtcPdf(pdf_base64);

    console.log(`Report date: ${reportDate}`);
    console.log(`Performances found: ${performances.length}`);

    const withComps = performances.filter(p => p.comp_tickets > 0);
    const totalComps = performances.reduce((sum, p) => sum + p.comp_tickets, 0);

    console.log(`Performances with comps: ${withComps.length}`);
    console.log(`Total comp tickets: ${totalComps}`);

    // Update BigQuery
    const bigquery = initializeBigQuery();
    const result = await updateSnapshotsWithComps(bigquery, performances);

    console.log(`Processing complete - Updated: ${result.updated}, Not found: ${result.notFound}`);

    res.status(200).json({
      success: true,
      execution_id: executionId,
      backup: backupResult,
      summary: {
        report_date: reportDate,
        performances_in_pdf: performances.length,
        performances_with_comps: withComps.length,
        total_comp_tickets: totalComps,
        updated: result.updated,
        not_found: result.notFound
      },
      message: 'PTC PDF processed successfully'
    });

  } catch (error) {
    console.error(`PTC webhook failed - ${executionId}:`, error.message);

    res.status(500).json({
      error: 'PTC PDF processing failed',
      execution_id: executionId,
      message: error.message
    });
  }
});
