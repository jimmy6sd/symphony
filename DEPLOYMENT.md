# Symphony Dashboard - Netlify Deployment Guide

## 🚀 Quick Deploy Steps

### **Step 1: Deploy to Netlify**

#### Option A: Netlify CLI (Recommended)
```bash
# Deploy the site
netlify deploy --prod --dir .

# Follow the prompts and select your site
```

#### Option B: GitHub + Netlify Auto-Deploy
1. Push code to GitHub repository
2. Connect repository in Netlify dashboard
3. Set build settings:
   - **Build command**: `echo 'Static build complete'`
   - **Publish directory**: `.` (root directory)

### **Step 2: Set Environment Variables in Netlify**

Go to your Netlify site dashboard → **Site Settings** → **Environment Variables** and add these:

#### **Essential Environment Variables:**
```
GOOGLE_CLOUD_PROJECT_ID=kcsymphony
BIGQUERY_DATASET=symphony_dashboard
NODE_ENV=production
```

#### **BigQuery Service Account (Critical):**
```
GOOGLE_APPLICATION_CREDENTIALS_JSON=[YOUR_SERVICE_ACCOUNT_JSON_HERE]
```
**Note**: Copy the JSON content from your downloaded service account key file. This contains sensitive credentials - never commit to repository.

#### **Dashboard Authentication:**
```
DASHBOARD_AUTH_USERNAME=[YOUR_ADMIN_USERNAME]
DASHBOARD_AUTH_PASSWORD=[YOUR_SECURE_PASSWORD]
JWT_SECRET=[YOUR_32_CHAR_SECRET_KEY]
JWT_EXPIRY=24h
```

#### **Optional - Tessitura API (if needed for future updates):**
```
TESSITURA_BASE_URL=[YOUR_TESSITURA_API_URL]
TESSITURA_USERNAME=[YOUR_USERNAME]
TESSITURA_PASSWORD=[YOUR_PASSWORD]
TESSITURA_USER_GROUP=[YOUR_USER_GROUP]
TESSITURA_MACHINE_LOCATION=[YOUR_MACHINE_LOCATION]
```

### **Step 3: Verify Deployment**

After deployment, test these URLs:

1. **Main Dashboard**: `https://your-site.netlify.app`
2. **BigQuery API**: `https://your-site.netlify.app/.netlify/functions/bigquery-data?action=get-performances&limit=5`
3. **Login**: `https://your-site.netlify.app/login.html`

### **Step 4: Test BigQuery Integration**

The dashboard should show:
- ✅ Green "BigQuery" badge with performance count
- ✅ Real performance data in tables and charts
- ✅ Fast loading times (BigQuery queries ~500-800ms)

## 🔧 Build Configuration

Your `netlify.toml` is already configured with:
- ✅ Static site hosting
- ✅ Netlify Functions
- ✅ Security headers
- ✅ Authentication redirects
- ✅ Content Security Policy

## 🔍 Troubleshooting

### **Common Issues:**

1. **BigQuery Connection Fails**
   - Check `GOOGLE_APPLICATION_CREDENTIALS_JSON` is set correctly
   - Verify service account has proper permissions in GCP

2. **Authentication Issues**
   - Ensure `DASHBOARD_AUTH_USERNAME` and `DASHBOARD_AUTH_PASSWORD` are set
   - Check `JWT_SECRET` is set and at least 32 characters

3. **CSP Violations**
   - Already fixed in `netlify.toml`
   - All required sources are whitelisted

### **Monitoring:**

- **Function Logs**: Check Netlify Functions tab for BigQuery API logs
- **Build Logs**: Monitor deployment in Netlify dashboard
- **Browser Console**: Check for any JavaScript errors

## 📊 Expected Performance

- **BigQuery Queries**: 400-800ms response time
- **Dashboard Load**: 1-2 seconds for full load
- **Data Volume**: 118+ performances from live database
- **Uptime**: 99.9%+ with Netlify hosting

## 🎯 Success Criteria

✅ Dashboard loads with BigQuery data
✅ All charts display real performance metrics
✅ Authentication system works
✅ Mobile responsive design
✅ No console errors
✅ Fast loading times

Your Symphony Dashboard is production-ready! 🎉