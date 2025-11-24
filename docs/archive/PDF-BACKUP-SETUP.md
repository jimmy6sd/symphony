# PDF Backup to Google Cloud Storage - Setup Guide

## Overview

The webhook now automatically backs up every incoming PDF to **Google Cloud Storage** before processing. This provides:
- ✅ Audit trail of all received PDFs
- ✅ Recovery capability if processing fails
- ✅ Historical archive organized by date
- ✅ Metadata tracking (execution ID, email info, timestamps)

## Storage Structure

```
gs://symphony-dashboard-pdfs/
├── 2025/
│   ├── 10/
│   │   ├── FY26_Performance_Sales_Summary_2025-10-23T10-30-15_webhook_abc123.pdf
│   │   ├── FY26_Performance_Sales_Summary_2025-10-24T10-35-22_webhook_def456.pdf
│   │   └── ...
│   ├── 11/
│   └── 12/
└── 2026/
```

## Setup Steps

### 1. Create Google Cloud Storage Bucket

```bash
# Using gcloud CLI
gcloud storage buckets create gs://symphony-dashboard-pdfs \
  --project=kcsymphony \
  --location=US \
  --uniform-bucket-level-access

# Set lifecycle rule (optional - auto-delete after 1 year)
gcloud storage buckets update gs://symphony-dashboard-pdfs \
  --lifecycle-file=bucket-lifecycle.json
```

**bucket-lifecycle.json** (optional - keeps PDFs for 1 year):
```json
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {"age": 365}
      }
    ]
  }
}
```

### 2. Grant Storage Permissions

Your service account already has BigQuery access. Add Storage permissions:

```bash
# Option A: Add Storage Object Admin role
gcloud projects add-iam-policy-binding kcsymphony \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT@kcsymphony.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

# Option B: Grant bucket-specific access only
gsutil iam ch serviceAccount:YOUR_SERVICE_ACCOUNT@kcsymphony.iam.gserviceaccount.com:objectAdmin \
  gs://symphony-dashboard-pdfs
```

**Note**: The same credentials used for BigQuery will work for Cloud Storage.

### 3. Configure Environment Variable (Optional)

By default, the webhook uses bucket name: `symphony-dashboard-pdfs`

To use a different bucket, add to Netlify environment variables:
```
GCS_PDF_BACKUP_BUCKET=your-custom-bucket-name
```

### 4. Install Dependencies

```bash
npm install @google-cloud/storage
```

### 5. Deploy

```bash
git add .
git commit -m "Add PDF backup to Cloud Storage"
git push origin main
```

Netlify will automatically deploy the updated function.

## How It Works

1. **Webhook receives PDF** from Make.com
2. **Before processing**, saves PDF to Cloud Storage:
   - Converts base64 → Buffer
   - Generates timestamped filename
   - Uploads to date-organized folder
   - Stores metadata (execution ID, email info, etc.)
3. **Processing continues** normally (BigQuery updates)
4. **If backup fails**, webhook continues anyway (won't block processing)

## Accessing Backed Up PDFs

### Via Web Console
1. Go to: https://console.cloud.google.com/storage/browser/symphony-dashboard-pdfs
2. Navigate by year/month
3. Download any PDF

### Via gcloud CLI
```bash
# List recent PDFs
gcloud storage ls gs://symphony-dashboard-pdfs/2025/10/

# Download a specific PDF
gcloud storage cp gs://symphony-dashboard-pdfs/2025/10/FY26_Performance_Sales_Summary_2025-10-23T10-30-15_webhook_abc123.pdf ./

# Download all PDFs from October 2025
gcloud storage cp -r gs://symphony-dashboard-pdfs/2025/10/ ./october-pdfs/
```

### Via Node.js Script
```javascript
const { Storage } = require('@google-cloud/storage');
const storage = new Storage();

// List all PDFs from October 2025
async function listOctoberPdfs() {
  const [files] = await storage.bucket('symphony-dashboard-pdfs')
    .getFiles({ prefix: '2025/10/' });

  files.forEach(file => {
    console.log(file.name);
  });
}
```

## Metadata Stored with Each PDF

Each PDF includes custom metadata:
- `executionId`: Webhook execution identifier
- `uploadedAt`: ISO timestamp
- `originalFilename`: Original filename from email
- `emailSubject`: Subject line from source email
- `emailDate`: Date from source email
- `source`: Always "pdf_webhook"

View metadata:
```bash
gcloud storage objects describe gs://symphony-dashboard-pdfs/2025/10/filename.pdf
```

## Cost Estimate

**Storage Costs** (Cloud Storage Standard):
- Storage: $0.020 per GB/month
- Typical PDF: ~300KB
- Daily PDFs: ~9MB/month = **$0.0002/month**
- Annual: ~110MB = **$0.002/year**

**Retrieval Costs**:
- Class A (uploads): $0.05 per 1,000 operations = **~$0.0015/month** (1 upload/day)
- Class B (downloads): $0.004 per 1,000 operations (only when you download)

**Total**: ~$0.02/month or $0.24/year for daily backups

## Troubleshooting

### PDF backup fails with "Bucket not found"
**Solution**: Create the bucket (see Step 1 above)

### PDF backup fails with "Permission denied"
**Solution**: Grant storage permissions (see Step 2 above)

### Want to change bucket name
**Solution**: Set `GCS_PDF_BACKUP_BUCKET` environment variable in Netlify

### Backup failing but webhook still works
**Expected**: Backup failures are non-blocking. Check Netlify function logs for the error message.

## Backup Recovery

If you need to reprocess a PDF from backup:

```bash
# Download the PDF
gcloud storage cp gs://symphony-dashboard-pdfs/2025/10/filename.pdf ./

# Process it manually (convert to base64 and send to webhook)
node scripts/test-webhook-with-pdf.js ./filename.pdf
```

## Monitoring

Check backup status in Netlify function logs:
```
💾 Backing up PDF to gs://symphony-dashboard-pdfs/2025/10/...
✅ PDF backed up successfully to Cloud Storage
   Location: gs://symphony-dashboard-pdfs/2025/10/filename.pdf
   Size: 264KB
```

If backup fails, you'll see:
```
⚠️  PDF backup failed (continuing with processing): [error message]
```

---

**Status**: ✅ Implemented in pdf-webhook.js
**Last Updated**: October 23, 2025
