# Make.com Integration Guide - Symphony Dashboard PDF Pipeline

## 🎯 Overview

This guide shows how to set up Make.com to automatically process daily Tessitura PDF reports and update your Symphony Dashboard's BigQuery database while preserving sales trends.

## 📋 Prerequisites

- ✅ Symphony Dashboard deployed to Netlify with BigQuery integration
- ✅ Make.com account with access to email and HTTP modules
- ✅ BigQuery schema enhancements applied (run `npm run apply-schema-enhancements`)
- ✅ Daily Tessitura PDF reports being emailed to a dedicated email address

## 🔄 Make.com Workflow Overview

```
📧 Daily Email → 📄 PDF Extraction → 🔍 Text Parsing → 📊 Data Transformation → 🚀 HTTP POST → ⚡ Netlify Function → 💾 BigQuery Update
```

## 🛠️ Step-by-Step Setup

### **Step 1: Create New Make.com Scenario**

1. Log into Make.com and create a new scenario
2. Name it: "Symphony Dashboard - Daily PDF Data Pipeline"
3. Set schedule: Daily at your preferred time (recommend 6-8 AM)

### **Step 2: Configure Email Trigger**

**Module**: Gmail / Email (Watch emails)

**Settings**:
- **Email account**: Connect your email that receives Tessitura reports
- **Folder**: Inbox (or dedicated folder for Tessitura reports)
- **Filter**:
  - Subject contains: "Tessitura" or "Performance Sales" (adjust to your email subject)
  - Sender: Your Tessitura system email
  - Has attachments: Yes
- **Limit**: 1 (process one email per run)
- **Mark as read**: Yes (optional)

**Example Filter**:
```
Subject: "Daily Performance Sales Summary"
From: "noreply@tessitura.com"
Attachment type: PDF
```

### **Step 3: PDF Text Extraction**

**Module**: PDF (Extract text from PDF)

**Settings**:
- **PDF file**: Map from email trigger → Attachments → Data
- **Output format**: Plain text
- **Page range**: All pages

**Advanced Options**:
- Enable OCR if needed for scanned PDFs
- Set encoding to UTF-8

### **Step 4: Data Parsing and Transformation**

**Module**: Text Parser (Match pattern)

**Pattern Configuration**:

Since Tessitura PDF formats vary, you'll need to create regex patterns based on your specific PDF structure. Here are common patterns:

```javascript
// Performance ID pattern
Performance\s+ID:\s*(\d+)

// Performance code pattern
Code:\s*([A-Z0-9]+)

// Title pattern
Title:\s*(.+?)(?:\n|Series:)

// Ticket sales pattern
Single\s+Tickets:\s*(\d+).*?Subscription:\s*(\d+)

// Revenue pattern
Total\s+Revenue:\s*\$?([\d,]+\.?\d*)

// Date pattern
Performance\s+Date:\s*(\d{2}/\d{2}/\d{4})
```

**Text Processing Example**:
```javascript
// Sample transformation logic
const performanceData = [];
const lines = input.split('\n');

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Extract performance ID
    const idMatch = line.match(/Performance\s+ID:\s*(\d+)/);
    if (idMatch) {
        const performance = {
            performance_id: parseInt(idMatch[1]),
            // ... extract other fields
        };
        performanceData.push(performance);
    }
}

return performanceData;
```

### **Step 5: Data Structure Preparation**

**Module**: Tools (Set variables)

Create the payload structure expected by the Netlify function:

```json
{
    "metadata": {
        "filename": "{{Email.Attachments.Name}}",
        "email_id": "{{Email.ID}}",
        "processed_date": "{{formatDate(now; 'YYYY-MM-DD')}}",
        "source": "tessitura_pdf"
    },
    "performances": [
        {
            "performance_id": 24085,
            "performance_code": "250902E",
            "title": "Morgan Freeman's Symphonic Blu",
            "series": "Special Event",
            "performance_date": "2025-09-02",
            "venue": "HELZBERG HALL",
            "season": "25-26 Special",
            "capacity": 1500,
            "single_tickets_sold": 942,
            "subscription_tickets_sold": 6,
            "total_revenue": 113051,
            "occupancy_goal": 85,
            "budget_goal": 124780
        }
    ]
}
```

### **Step 6: HTTP POST to Netlify Function**

**Module**: HTTP (Make a request)

**Settings**:
- **URL**: `https://kcsdashboard.netlify.app/.netlify/functions/pdf-data-processor`
- **Method**: POST
- **Headers**:
  ```
  Content-Type: application/json
  ```
- **Body**: Map from previous step's transformed data
- **Timeout**: 60 seconds

### **Step 7: Error Handling and Notifications**

**Add Error Handler Route**:

**Module**: Slack / Email (Send notification)

**Trigger**: When HTTP request fails or returns error status

**Message Template**:
```
🚨 Symphony Dashboard Pipeline Error

Date: {{formatDate(now; 'YYYY-MM-DD HH:mm')}}
Email: {{Email.Subject}}
PDF: {{Email.Attachments.Name}}
Error: {{HTTP.statusCode}} - {{HTTP.error}}

Please check the Netlify function logs and retry if needed.
```

### **Step 8: Success Confirmation**

**Module**: Slack / Email (Send notification)

**Trigger**: When HTTP request succeeds

**Message Template**:
```
✅ Symphony Dashboard Updated Successfully

Date: {{formatDate(now; 'YYYY-MM-DD HH:mm')}}
PDF Processed: {{Email.Attachments.Name}}
Performances Updated: {{HTTP.summary.processed}}
New Records: {{HTTP.summary.inserted}}
Updated Records: {{HTTP.summary.updated}}
Trends Adjusted: {{HTTP.summary.trends_adjusted}}

Dashboard: https://kcsdashboard.netlify.app
```

## 🧪 Testing Your Workflow

### **Test Data Format**

Create a test email with this sample PDF content to validate your parsing:

```
Performance Sales Summary - September 2025

Performance ID: 24085
Code: 250902E
Title: Morgan Freeman's Symphonic Blu
Series: Special Event
Date: 09/02/2025
Venue: HELZBERG HALL
Capacity: 1500

Ticket Sales:
Single Tickets: 942
Subscription: 6
Total Sold: 948

Revenue:
Total Revenue: $113,051
Budget Goal: $124,780
Occupancy: 66.8%
```

### **Validation Checklist**

- [ ] Email trigger detects test email
- [ ] PDF text extraction works correctly
- [ ] Data parsing extracts all required fields
- [ ] JSON structure matches expected format
- [ ] HTTP POST to Netlify function succeeds
- [ ] BigQuery data is updated correctly
- [ ] Sales trends are preserved
- [ ] Success notification is sent

## 🔧 Advanced Configuration

### **Multiple PDF Formats**

If you receive different PDF formats, add conditional logic:

```javascript
// Detect PDF format type
if (text.includes("Daily Sales Report")) {
    // Parse format A
    return parseFormatA(text);
} else if (text.includes("Performance Summary")) {
    // Parse format B
    return parseFormatB(text);
} else {
    // Default parsing
    return parseDefault(text);
}
```

### **Data Validation**

Add validation before sending to Netlify:

```javascript
// Validate required fields
function validatePerformance(perf) {
    const required = ['performance_id', 'title', 'performance_date'];

    for (const field of required) {
        if (!perf[field]) {
            throw new Error(`Missing required field: ${field}`);
        }
    }

    // Validate data types
    if (typeof perf.single_tickets_sold !== 'number') {
        perf.single_tickets_sold = parseInt(perf.single_tickets_sold) || 0;
    }

    return perf;
}
```

### **Retry Logic**

Configure automatic retries for failed requests:

- **Max retries**: 3
- **Retry interval**: 5 minutes
- **Exponential backoff**: Yes

## 📊 Monitoring and Maintenance

### **Dashboard Monitoring**

The Symphony Dashboard now includes pipeline status indicators:

- **Last Update Time**: Shows when data was last refreshed
- **Data Source**: Indicates whether using PDF, API, or local data
- **Pipeline Health**: Green/Yellow/Red status indicator

### **Make.com Monitoring**

Monitor your scenario:

- **Execution history**: Check for failed runs
- **Data usage**: Monitor operations consumed
- **Performance**: Track execution times

### **BigQuery Monitoring**

Monitor data quality:

```sql
-- Check recent data imports
SELECT
    snapshot_date,
    performance_count,
    total_tickets_in_snapshot,
    processing_status
FROM `symphony_dashboard.data_snapshots`
ORDER BY snapshot_date DESC
LIMIT 10;

-- Check pipeline health
SELECT
    pipeline_type,
    status,
    start_time,
    records_processed,
    error_message
FROM `symphony_dashboard.pipeline_execution_log`
ORDER BY start_time DESC
LIMIT 10;
```

## 🚨 Troubleshooting

### **Common Issues**

**1. PDF Text Extraction Fails**
- Solution: Enable OCR in PDF module
- Check PDF isn't password protected
- Verify file size limits

**2. Data Parsing Returns Empty Results**
- Solution: Test regex patterns with sample text
- Check for encoding issues (UTF-8)
- Validate PDF text format hasn't changed

**3. HTTP Request Fails**
- Solution: Check Netlify function logs
- Verify JSON structure is correct
- Ensure environment variables are set

**4. BigQuery Connection Errors**
- Solution: Check service account credentials
- Verify table permissions
- Monitor BigQuery quotas

### **Debug Mode**

Enable detailed logging in Make.com:

1. Add "Tools > Set variable" modules to log intermediate data
2. Use "Tools > Compose text" to create debug messages
3. Send debug info to separate Slack channel

### **Manual Override**

For urgent updates, you can manually trigger the pipeline:

```bash
# Test the Netlify function directly
curl -X POST https://kcsdashboard.netlify.app/.netlify/functions/pdf-data-processor \
  -H "Content-Type: application/json" \
  -d @sample-data.json
```

## 📝 NPM Scripts

Add these to your `package.json`:

```json
{
  "scripts": {
    "apply-schema-enhancements": "node scripts/apply-schema-enhancements.js",
    "test-pdf-processor": "node scripts/test-pdf-processor.js",
    "pipeline-status": "node scripts/check-pipeline-status.js"
  }
}
```

## 🎉 Success!

Once configured, your workflow will:

- ✅ Automatically process daily Tessitura PDFs
- ✅ Preserve existing sales trend patterns
- ✅ Update BigQuery database in real-time
- ✅ Show fresh data in your dashboard
- ✅ Send notifications on success/failure
- ✅ Provide full audit trail of all changes

Your Symphony Dashboard now has a fully automated data pipeline! 🚀