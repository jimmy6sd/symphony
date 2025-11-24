# Make.com PDF Backup to Google Cloud Storage

## Overview

Instead of backing up PDFs in the webhook, have Make.com save them directly to Cloud Storage before sending to the webhook. This is more reliable and doesn't depend on webhook execution.

## Make.com Workflow Updates

### Current Flow:
```
Email → Extract PDF → Send to Webhook
```

### New Flow:
```
Email → Extract PDF → Save to GCS → Send to Webhook
```

## Setup Steps

### 1. Add Google Cloud Storage Module in Make.com

In your Make.com scenario, add a new module **after** PDF extraction and **before** the webhook:

**Module**: Google Cloud Storage → Upload a File

**Configuration**:
- **Connection**: Create new GCS connection
  - Use your service account JSON credentials (same as BigQuery)
  - Project ID: `kcsymphony`

- **Bucket Name**: `symphony-dashboard-pdfs`

- **File Path**: Use dynamic path with date
  ```
  {{formatDate(now; "YYYY/MM")}}/FY26_Performance_Sales_Summary_{{formatDate(now; "YYYY-MM-DDTHH-mm-ss")}}.pdf
  ```
  This creates: `2025/10/FY26_Performance_Sales_Summary_2025-10-23T14-30-45.pdf`

- **File Data**: Map from previous PDF module (the base64 or binary data)

- **Content Type**: `application/pdf`

- **Metadata** (Optional):
  - `email_subject`: {{Email subject}}
  - `email_date`: {{Email date}}
  - `processed_by`: make.com

### 2. Keep Webhook Step

After saving to GCS, continue to send to webhook as normal. The webhook will:
- Process the PDF data
- Create snapshots
- Update BigQuery

Now you have both:
- ✅ PDF backed up in GCS (via Make.com)
- ✅ Data processed and stored in BigQuery (via webhook)

## Benefits

- **More Reliable**: Backup happens before processing
- **Independent**: Backup success not tied to webhook success
- **Faster Webhook**: No backup logic in webhook = faster execution
- **Same Result**: PDFs organized by date in Cloud Storage

## Make.com Module Settings

### Google Cloud Storage Module Details:

**Action**: `Upload a File`

**Parameters**:
```
Bucket Name: symphony-dashboard-pdfs
File Name: {{formatDate(now; "YYYY/MM")}}/FY26_Performance_Sales_Summary_{{formatDate(now; "YYYY-MM-DDTHH-mm-ss")}}.pdf
File Data: {{PDF data from previous module}}
Content-Type: application/pdf
```

**Advanced Settings**:
- Enable "Continue on error" - so webhook still runs if backup fails
- Add metadata fields for tracking

## Alternative: Simpler Filename

If the dynamic path is complex, you can use a simpler one:

```
File Name: pdfs/{{formatDate(now; "YYYY-MM-DD")}}_performance_sales.pdf
```

This creates: `pdfs/2025-10-23_performance_sales.pdf`

## Testing

1. Trigger Make.com scenario
2. Check Cloud Storage: https://console.cloud.google.com/storage/browser/symphony-dashboard-pdfs
3. Verify PDF appears in correct folder
4. Verify webhook still processes successfully

## Troubleshooting

**"Access denied" error in Make.com:**
- Check service account has `Storage Object Creator` role
- Verify bucket name is correct: `symphony-dashboard-pdfs`

**PDF not appearing:**
- Check Make.com execution logs for GCS module
- Verify the File Data is mapped correctly from PDF module

**Webhook still runs even if backup fails:**
- This is expected if "Continue on error" is enabled
- Data will still be processed

## Cost

- Make.com GCS operations: Included in Make.com plan
- GCS storage: Same as before (~$0.02/month)

---

**Recommended**: Use this approach instead of webhook-based backup. It's simpler and more reliable.
