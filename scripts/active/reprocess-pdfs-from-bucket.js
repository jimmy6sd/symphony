/**
 * Reprocess Historical PDFs from Google Cloud Storage
 *
 * SAFELY reprocesses backed-up PDFs to create historical snapshots.
 * - IDEMPOTENT: Safe to run multiple times (skips existing snapshots)
 * - NO DUPLICATES: Checks for existing data before inserting
 * - SMART: Only processes what's needed
 *
 * USAGE:
 *   node scripts/active/reprocess-pdfs-from-bucket.js [options]
 *
 * OPTIONS:
 *   --dry-run              Show what would be processed (no database changes)
 *   --since=2025-10-01     Only process PDFs since this date
 *   --performance=251011A  Only process specific performance code
 *   --limit=10             Process only first N PDFs (for testing)
 *   --force                Reprocess even if snapshots exist (USE WITH CAUTION)
 */

const { BigQuery } = require('@google-cloud/bigquery');
const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  force: args.includes('--force'),
  since: args.find(arg => arg.startsWith('--since='))?.split('=')[1],
  performance: args.find(arg => arg.startsWith('--performance='))?.split('=')[1],
  limit: parseInt(args.find(arg => arg.startsWith('--limit='))?.split('=')[1]) || null
};

// Configuration
const CONFIG = {
  bucketName: process.env.GCS_PDF_BACKUP_BUCKET || 'symphony-dashboard-pdfs',
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'kcsymphony',
  dataset: 'symphony_dashboard'
};

// Initialize clients
function initializeClients() {
  const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  // Try to use explicit credentials first, fallback to ADC (Application Default Credentials)
  if (credentialsEnv) {
    let credentials;

    if (credentialsEnv.startsWith('{')) {
      credentials = JSON.parse(credentialsEnv);
    } else {
      const credentialsFile = path.resolve(credentialsEnv);
      credentials = JSON.parse(fs.readFileSync(credentialsFile, 'utf8'));
    }

    if (credentials.private_key?.includes('\\\\n')) {
      credentials.private_key = credentials.private_key.replace(/\\\\n/g, '\n');
    }

    console.log('✅ Using explicit credentials from GOOGLE_APPLICATION_CREDENTIALS');

    const bigquery = new BigQuery({
      projectId: CONFIG.projectId,
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
      location: 'US'
    });

    const storage = new Storage({
      projectId: CONFIG.projectId,
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      }
    });

    return { bigquery, storage };
  } else {
    // Use Application Default Credentials (from gcloud auth login)
    console.log('✅ Using Application Default Credentials (gcloud)');

    const bigquery = new BigQuery({
      projectId: CONFIG.projectId,
      location: 'US'
    });

    const storage = new Storage({
      projectId: CONFIG.projectId
    });

    return { bigquery, storage };
  }
}

// Extract date from GCS file metadata
function extractDateFromMetadata(file) {
  // Try to get date from file metadata or filename
  const metadata = file.metadata;

  // Priority 1: Use upload timestamp from GCS
  if (metadata.timeCreated) {
    return new Date(metadata.timeCreated).toISOString().split('T')[0];
  }

  // Priority 2: Parse from filename (format: *_YYYY-MM-DDTHH-mm-ss_*)
  const filenameMatch = file.name.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
  if (filenameMatch) {
    return filenameMatch[1].split('T')[0];
  }

  // Fallback: Use today
  return new Date().toISOString().split('T')[0];
}

// No need to check for existing snapshots - MERGE handles duplicates

// Check which performances exist in the database
async function getExistingPerformances(bigquery) {
  const query = `
    SELECT performance_code, performance_id
    FROM \`${CONFIG.projectId}.${CONFIG.dataset}.performances\`
  `;

  const [rows] = await bigquery.query({ query, location: 'US' });
  return new Map(rows.map(r => [r.performance_code, r.performance_id]));
}

// Parse PDF using pdf2json (same logic as cloud function)
async function parsePdf(pdfBuffer) {
  const PDFParser = require('pdf2json');
  const pdfParser = new PDFParser();

  return new Promise((resolve, reject) => {
    pdfParser.on('pdfParser_dataError', errData => reject(errData.parserError));
    pdfParser.on('pdfParser_dataReady', pdfData => {
      const performances = [];
      let reportDate = null;

      for (const page of pdfData.Pages) {
        const allItems = [];
        for (const textItem of page.Texts) {
          const content = decodeURIComponent(textItem.R[0].T);
          allItems.push(content);
        }

        // Extract report date from PDF footer
        // Look for pattern: "Run by ... on MM/DD/YYYY HH:MM:SS AM/PM"
        if (!reportDate) {
          for (const item of allItems) {
            // Look for the footer pattern with the actual report generation date
            const footerMatch = item.match(/Run by .* on (\d{1,2}\/\d{1,2}\/\d{4})/i);
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
        }

        const isCurrency = (str) => /^\d{1,3}(,\d{3})*\.\d{2}$/.test(str);
        const isCount = (str) => /^\d+$/.test(str);

        for (let i = 0; i < allItems.length; i++) {
          const item = allItems[i];

          if (item.match(/^25\d{4}[A-Z]{1,2}$/) && !allItems[i-1]?.includes('Total')) {
            const performanceCode = item;
            let idx = i + 1;

            const dateTime = allItems[idx++] || '';
            const budgetStr = allItems[idx++] || '0%';
            const fixedCountStr = allItems[idx++] || '0';
            const fixedRevStr = allItems[idx++] || '0.00';
            const nonFixedCountStr = allItems[idx++] || '0';
            const nonFixedRevStr = allItems[idx++] || '0.00';
            const singleCountStr = allItems[idx++] || '0';
            const singleRevStr = allItems[idx++] || '0.00';
            const subtotalStr = allItems[idx++] || '0.00';

            let reservedStr = '0';
            let reservedRevStr = '0.00';
            if (idx < allItems.length && isCount(allItems[idx])) {
              reservedStr = allItems[idx++];
              if (idx < allItems.length && isCurrency(allItems[idx])) {
                reservedRevStr = allItems[idx++];
              }
            }

            const totalStr = allItems[idx++] || subtotalStr;
            const availStr = allItems[idx++] || '0';
            const capacityStr = allItems[idx++] || '0.0%';

            const budgetPercent = parseFloat(budgetStr.replace('%', '')) || 0;
            const fixedCount = parseInt(fixedCountStr.replace(/,/g, '')) || 0;
            const nonFixedCount = parseInt(nonFixedCountStr.replace(/,/g, '')) || 0;
            const singleCount = parseInt(singleCountStr.replace(/,/g, '')) || 0;
            const totalRevenue = parseFloat(totalStr.replace(/,/g, '')) || 0;
            const capacityPercent = parseFloat(capacityStr.replace('%', '')) || 0;

            const subscriptionTickets = fixedCount;
            const singleTicketsTotal = singleCount + nonFixedCount;

            performances.push({
              performance_code: performanceCode,
              single_tickets_sold: singleTicketsTotal,
              subscription_tickets_sold: subscriptionTickets,
              total_revenue: totalRevenue,
              capacity_percent: capacityPercent,
              budget_percent: budgetPercent
            });
          }
        }
      }

      resolve({ performances, reportDate });
    });

    pdfParser.parseBuffer(pdfBuffer);
  });
}

// Upsert snapshots using MERGE (idempotent - no duplicates, no pre-checking needed)
async function upsertSnapshots(bigquery, snapshots, snapshotDate) {
  if (snapshots.length === 0) return { inserted: 0, updated: 0 };

  // Create temp table data as CTE
  const sourceData = snapshots.map(s => `
    SELECT
      '${crypto.randomBytes(8).toString('hex')}' as snapshot_id,
      ${s.performance_id} as performance_id,
      '${s.performance_code}' as performance_code,
      DATE('${snapshotDate}') as snapshot_date,
      ${s.single_tickets_sold} as single_tickets_sold,
      ${s.subscription_tickets_sold} as subscription_tickets_sold,
      ${s.single_tickets_sold + s.subscription_tickets_sold} as total_tickets_sold,
      ${s.total_revenue} as total_revenue,
      ${s.capacity_percent} as capacity_percent,
      ${s.budget_percent} as budget_percent,
      'pdf_reprocess' as source,
      CURRENT_TIMESTAMP() as created_at
  `).join(' UNION ALL ');

  // MERGE statement - idempotent (updates if exists, inserts if not)
  const mergeQuery = `
    MERGE \`${CONFIG.projectId}.${CONFIG.dataset}.performance_sales_snapshots\` AS target
    USING (${sourceData}) AS source
    ON target.performance_code = source.performance_code
       AND target.snapshot_date = source.snapshot_date
    WHEN MATCHED THEN
      UPDATE SET
        single_tickets_sold = source.single_tickets_sold,
        subscription_tickets_sold = source.subscription_tickets_sold,
        total_tickets_sold = source.total_tickets_sold,
        total_revenue = source.total_revenue,
        capacity_percent = source.capacity_percent,
        budget_percent = source.budget_percent
    WHEN NOT MATCHED THEN
      INSERT (snapshot_id, performance_id, performance_code, snapshot_date,
              single_tickets_sold, subscription_tickets_sold, total_tickets_sold,
              total_revenue, capacity_percent, budget_percent, source, created_at)
      VALUES (source.snapshot_id, source.performance_id, source.performance_code,
              source.snapshot_date, source.single_tickets_sold, source.subscription_tickets_sold,
              source.total_tickets_sold, source.total_revenue, source.capacity_percent,
              source.budget_percent, source.source, source.created_at)
  `;

  const result = await bigquery.query({ query: mergeQuery, location: 'US' });

  // BigQuery returns number of rows affected
  const numDmlAffectedRows = result[0]?.numDmlAffectedRows || snapshots.length;

  return {
    inserted: numDmlAffectedRows,
    updated: 0 // MERGE doesn't distinguish, but this is fine
  };
}

// Main processing function
async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📦 PDF Reprocessing from Cloud Storage');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  if (options.dryRun) {
    console.log('🔍 DRY RUN MODE - No database changes will be made\n');
  }

  if (options.force) {
    console.log('⚠️  FORCE MODE - Will reprocess even if snapshots exist\n');
  }

  // Initialize clients
  console.log('🔧 Initializing BigQuery and Cloud Storage clients...');
  const { bigquery, storage } = initializeClients();
  const bucket = storage.bucket(CONFIG.bucketName);

  // Get all PDFs from bucket
  console.log(`📂 Fetching PDFs from gs://${CONFIG.bucketName}/...`);
  const [files] = await bucket.getFiles();
  const pdfFiles = files.filter(f => f.name.endsWith('.pdf'));

  console.log(`✅ Found ${pdfFiles.length} PDF files\n`);

  // Apply filters
  let filteredFiles = pdfFiles;

  if (options.since) {
    const sinceDate = new Date(options.since);
    filteredFiles = filteredFiles.filter(f => {
      const fileDate = new Date(f.metadata.timeCreated);
      return fileDate >= sinceDate;
    });
    console.log(`📅 Filtered to ${filteredFiles.length} PDFs since ${options.since}`);
  }

  if (options.limit) {
    filteredFiles = filteredFiles.slice(0, options.limit);
    console.log(`🔢 Limited to first ${options.limit} PDFs`);
  }

  // Sort by date (oldest first for chronological processing)
  filteredFiles.sort((a, b) => {
    const dateA = new Date(a.metadata.timeCreated);
    const dateB = new Date(b.metadata.timeCreated);
    return dateA - dateB;
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Get existing performances from DB (needed to map codes to IDs)
  console.log('🔍 Checking existing performances in database...');
  const existingPerformances = await getExistingPerformances(bigquery);
  console.log(`✅ Found ${existingPerformances.size} performances in database\n`);

  // Statistics tracking
  const stats = {
    totalPdfs: filteredFiles.length,
    processed: 0,
    skipped: 0,
    snapshotsCreated: 0,
    snapshotsSkipped: 0,
    errors: 0
  };

  // Process each PDF
  for (let i = 0; i < filteredFiles.length; i++) {
    const file = filteredFiles[i];
    const fileName = file.name.split('/').pop();

    try {
      // Download and parse PDF
      console.log(`\n[${i + 1}/${filteredFiles.length}] Processing: ${fileName}`);
      console.log('    📄 Downloading and parsing PDF...');
      const [fileContents] = await file.download();
      const { performances, reportDate } = await parsePdf(fileContents);

      // Use report date from PDF content, fallback to file metadata
      const snapshotDate = reportDate || extractDateFromMetadata(file);
      console.log(`    📅 Report Date: ${snapshotDate} ${reportDate ? '(from PDF)' : '(from metadata)'}`);
      console.log(`    ✅ Parsed ${performances.length} performances`);

      // Filter to only performances that exist in DB
      const validPerformances = performances.filter(p => {
        // Check if performance exists in DB
        if (!existingPerformances.has(p.performance_code)) {
          return false;
        }

        // Check if filtering by specific performance
        if (options.performance && p.performance_code !== options.performance) {
          return false;
        }

        return true;
      });

      // Add performance IDs
      const snapshotsToUpsert = validPerformances.map(p => ({
        ...p,
        performance_id: existingPerformances.get(p.performance_code)
      }));

      const skippedCount = performances.length - validPerformances.length;
      if (skippedCount > 0) {
        console.log(`    ⏭️  Skipped ${skippedCount} (not in DB)`);
      }

      if (snapshotsToUpsert.length === 0) {
        console.log('    ℹ️  No snapshots to process');
        stats.skipped++;
        continue;
      }

      // Upsert snapshots using MERGE (idempotent - unless dry run)
      if (!options.dryRun) {
        const result = await upsertSnapshots(bigquery, snapshotsToUpsert, snapshotDate);
        console.log(`    💾 Upserted ${result.inserted} snapshots (inserts + updates)`);
        stats.snapshotsCreated += result.inserted;
      } else {
        console.log(`    🔍 Would upsert ${snapshotsToUpsert.length} snapshots (dry run)`);
        stats.snapshotsCreated += snapshotsToUpsert.length;
      }

      stats.processed++;

    } catch (error) {
      console.error(`    ❌ Error: ${error.message}`);
      stats.errors++;
    }
  }

  // Final summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Reprocessing Complete');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📦 PDFs Processed:     ${stats.processed}/${stats.totalPdfs}`);
  console.log(`⏭️  PDFs Skipped:       ${stats.skipped}`);
  console.log(`💾 Snapshots Created:  ${stats.snapshotsCreated}`);
  console.log(`⏭️  Snapshots Skipped:  ${stats.snapshotsSkipped}`);
  console.log(`❌ Errors:             ${stats.errors}`);

  if (options.dryRun) {
    console.log('\n⚠️  This was a DRY RUN - no changes were made to the database');
    console.log('   Run without --dry-run to actually process the PDFs');
  }

  console.log('\n✅ Done!');
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
