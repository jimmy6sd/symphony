# Simple Make.com Workflow - PDF to Webhook

## 🎯 **New Simplified Approach**

Instead of complex PDF parsing in Make.com, we've moved all the intelligence to your application. Make.com now just needs to:

1. **Detect email** with PDF attachment
2. **Extract PDF file** (as base64 or download)
3. **POST to webhook** with simple payload

**Your application handles everything else!** ✨

---

## 🔄 **Ultra-Simple Make.com Workflow**

### **Total Modules Needed: 3**

```
📧 Gmail (Watch emails) → 📄 Tools (Convert to base64) → 🚀 HTTP (POST to webhook)
```

---

## 🛠️ **Step-by-Step Setup**

### **Module 1: Gmail Email Trigger**

**Module**: Gmail > Watch emails
**Settings**:
- **Folder**: Inbox (or dedicated Tessitura folder)
- **Filter**:
  - Subject contains: "Performance" or "Tessitura" (adjust to your email)
  - Has attachments: Yes
  - Attachment type: PDF
- **Limit**: 1 email per execution
- **Mark as read**: Yes (optional)

### **Module 2: Convert PDF to Base64**

**Module**: Tools > Compose a string
**Value**:
```
{{base64(first(Gmail.Attachments).Data)}}
```

### **Module 3: POST to Your Webhook**

**Module**: HTTP > Make a request
**Settings**:
- **URL**: `https://kcsdashboard.netlify.app/.netlify/functions/pdf-webhook`
- **Method**: POST
- **Headers**:
  ```
  Content-Type: application/json
  ```
- **Body**:
  ```json
  {
    "pdf_base64": "{{2.output}}",
    "metadata": {
      "filename": "{{first(Gmail.Attachments).Name}}",
      "email_subject": "{{Gmail.Subject}}",
      "email_date": "{{Gmail.Date}}",
      "email_id": "{{Gmail.Message ID}}",
      "source": "make_com_webhook"
    }
  }
  ```

**That's it!** 🎉

---

## 🧪 **Testing Your Simple Workflow**

### **Test Email Structure**
Send yourself a test email with a PDF attachment:

**Subject**: `Test Tessitura Performance Data`
**Attachment**: Any PDF file (even a blank one for initial testing)

### **Expected Workflow**
1. Make.com detects the email
2. Extracts PDF as base64
3. POSTs to your webhook
4. Your app processes the PDF and updates BigQuery
5. Dashboard shows new data

### **Webhook Response (Success)**
```json
{
  "success": true,
  "execution_id": "webhook_1234567890_abcd",
  "snapshot_id": "snap_1234567890_efgh",
  "summary": {
    "received": 5,
    "processed": 5,
    "inserted": 3,
    "updated": 2,
    "trends_adjusted": 1,
    "anomalies_detected": 0
  },
  "message": "PDF processed successfully via webhook"
}
```

---

## 📋 **Alternative Webhook Payloads**

Your webhook accepts multiple input formats:

### **Option 1: Base64 PDF (Recommended)**
```json
{
  "pdf_base64": "JVBERi0xLjQKMSAwIG9...",
  "metadata": { "filename": "report.pdf" }
}
```

### **Option 2: Pre-extracted Text**
If Make.com extracts text first:
```json
{
  "pdf_text": "Performance ID: 12345\nTitle: Concert...",
  "metadata": { "filename": "report.pdf" }
}
```

### **Option 3: PDF URL**
If PDF is stored temporarily:
```json
{
  "pdf_url": "https://temp-storage.com/report.pdf",
  "metadata": { "filename": "report.pdf" }
}
```

---

## 🔧 **Advanced Make.com Features (Optional)**

### **Error Handling**
Add an error handling route after the HTTP module:

**Module**: Tools > Set multiple variables
**Trigger**: When HTTP status ≠ 200
**Variables**:
- `error_message`: `{{HTTP.error}}`
- `execution_id`: `{{HTTP.execution_id}}`

**Module**: Slack/Email > Send message
**Message**:
```
🚨 PDF Processing Failed

File: {{Gmail.Attachments.Name}}
Error: {{error_message}}
Execution ID: {{execution_id}}

Check logs: https://kcsdashboard.netlify.app
```

### **Success Notification**
**Module**: Slack/Email > Send message
**Trigger**: When HTTP status = 200
**Message**:
```
✅ PDF Processed Successfully

File: {{Gmail.Attachments.Name}}
Performances: {{HTTP.summary.received}}
Updated: {{HTTP.summary.updated}}
New: {{HTTP.summary.inserted}}

Dashboard: https://kcsdashboard.netlify.app
```

### **Multiple PDF Attachments**
If emails have multiple PDFs, add an iterator:

**Module**: Tools > Iterator
**Array**: `{{Gmail.Attachments}}`

Then process each PDF individually.

---

## 🚀 **Benefits of This Approach**

### **Make.com Simplicity**
- ✅ Only 3 modules needed
- ✅ No complex text parsing in Make.com
- ✅ No regex patterns to maintain
- ✅ Extremely fast execution
- ✅ Low operation count

### **Application Intelligence**
- ✅ Smart PDF parsing with multiple strategies
- ✅ Handles different Tessitura report formats
- ✅ Robust error handling and fallbacks
- ✅ Full audit trail and logging
- ✅ Easy to debug and maintain

### **Maintenance**
- ✅ PDF format changes? Just update your app
- ✅ Add new parsing logic without touching Make.com
- ✅ Test locally with sample PDFs
- ✅ Full control over data processing

---

## 🔍 **Debugging**

### **Check Make.com Execution**
1. Go to your Make.com scenario
2. Check execution history
3. Verify PDF was extracted correctly
4. Check HTTP response from webhook

### **Check Netlify Function Logs**
1. Go to Netlify dashboard
2. Functions → pdf-webhook logs
3. Look for execution ID in error messages
4. Check BigQuery for data snapshots

### **Test Webhook Directly**
```bash
curl -X POST https://kcsdashboard.netlify.app/.netlify/functions/pdf-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "pdf_text": "Performance ID: 12345\nTitle: Test Concert",
    "metadata": {"filename": "test.pdf"}
  }'
```

---

## 🎉 **You're Done!**

Your new workflow is:
- **90% simpler** than the original approach
- **More reliable** with better error handling
- **Easier to maintain** with all logic in your app
- **More flexible** supporting multiple PDF formats

Make.com just becomes a simple email-to-webhook bridge! 🌉