# BigQuery Setup Instructions for Symphony Dashboard

## Prerequisites
- Google Cloud Platform account
- Billing enabled on your GCP project
- BigQuery API enabled

## Step 1: Google Cloud Platform Setup

### 1.1 Create/Select Project
```bash
# Install gcloud CLI first: https://cloud.google.com/sdk/docs/install

# Login to GCP
gcloud auth login

# Create new project (or use existing)
gcloud projects create symphony-dashboard-[UNIQUE-ID]
gcloud config set project symphony-dashboard-[UNIQUE-ID]

# Enable required APIs
gcloud services enable bigquery.googleapis.com
gcloud services enable storage.googleapis.com
```

### 1.2 Create Service Account
```bash
# Create service account for the application
gcloud iam service-accounts create symphony-bigquery-service \
    --display-name="Symphony BigQuery Service Account" \
    --description="Service account for Symphony Dashboard BigQuery access"

# Grant necessary roles
gcloud projects add-iam-policy-binding symphony-dashboard-[UNIQUE-ID] \
    --member="serviceAccount:symphony-bigquery-service@symphony-dashboard-[UNIQUE-ID].iam.gserviceaccount.com" \
    --role="roles/bigquery.dataEditor"

gcloud projects add-iam-policy-binding symphony-dashboard-[UNIQUE-ID] \
    --member="serviceAccount:symphony-bigquery-service@symphony-dashboard-[UNIQUE-ID].iam.gserviceaccount.com" \
    --role="roles/bigquery.jobUser"

# Create and download service account key
gcloud iam service-accounts keys create symphony-bigquery-key.json \
    --iam-account=symphony-bigquery-service@symphony-dashboard-[UNIQUE-ID].iam.gserviceaccount.com
```

## Step 2: BigQuery Dataset Creation

### 2.1 Create Dataset via gcloud
```bash
# Create the main dataset
bq mk --dataset \
    --description="Symphony Dashboard Performance Data" \
    --location=US \
    symphony-dashboard-[UNIQUE-ID]:symphony_dashboard
```

### 2.2 Create Tables
```bash
# Run the schema creation script
bq query --use_legacy_sql=false < bigquery-schema.sql
```

## Step 3: Environment Variables Setup

### 3.1 Netlify Environment Variables
Add these to your Netlify site settings:

```bash
# In Netlify Dashboard -> Site Settings -> Environment Variables
GOOGLE_CLOUD_PROJECT_ID=symphony-dashboard-[UNIQUE-ID]
BIGQUERY_DATASET=symphony_dashboard
GOOGLE_APPLICATION_CREDENTIALS_JSON=[paste entire JSON content from symphony-bigquery-key.json]
NODE_ENV=production
```

### 3.2 Local Development (.env)
```bash
# Create .env file in project root
GOOGLE_CLOUD_PROJECT_ID=symphony-dashboard-[UNIQUE-ID]
BIGQUERY_DATASET=symphony_dashboard
GOOGLE_APPLICATION_CREDENTIALS=./symphony-bigquery-key.json
NODE_ENV=development
```

## Step 4: Security Best Practices

### 4.1 Service Account Key Security
- **NEVER** commit the JSON key file to git
- Add `symphony-bigquery-key.json` to .gitignore
- Store the JSON content as environment variable in Netlify
- Rotate keys regularly (every 90 days recommended)

### 4.2 IAM Permissions
The service account has minimal required permissions:
- `bigquery.dataEditor`: Read/write data in tables
- `bigquery.jobUser`: Run queries and jobs
- No admin or delete permissions for security

## Step 5: Cost Management

### 5.1 Query Optimization
- Use partitioned tables (already set up by date)
- Use clustered tables (already set up by series/season)
- Limit query results with WHERE clauses
- Use SELECT * sparingly

### 5.2 Monitoring Setup
```bash
# Set up billing alerts
gcloud alpha billing budgets create \
    --billing-account=[YOUR-BILLING-ACCOUNT-ID] \
    --display-name="Symphony Dashboard Budget" \
    --budget-amount=50USD \
    --threshold-rule=percent=50,basis=CURRENT_SPEND \
    --threshold-rule=percent=90,basis=CURRENT_SPEND
```

## Step 6: Data Migration Strategy

### 6.1 Initial Data Load
1. Use the provided Node.js script to migrate existing dashboard.json data
2. Verify data integrity with sample queries
3. Set up incremental updates from Tessitura API

### 6.2 Ongoing Updates
- Schedule daily updates via Netlify Functions
- Implement upsert logic for performance data
- Log all data operations in refresh_log table

## Step 7: Testing & Validation

### 7.1 Connection Test
```sql
-- Test basic connectivity
SELECT COUNT(*) as total_performances
FROM `symphony-dashboard-[UNIQUE-ID].symphony_dashboard.performances`;
```

### 7.2 Data Quality Checks
```sql
-- Check for data completeness
SELECT
    COUNT(*) as total_records,
    COUNT(CASE WHEN has_sales_data = TRUE THEN 1 END) as with_sales,
    COUNT(CASE WHEN total_revenue > 0 THEN 1 END) as with_revenue
FROM `symphony-dashboard-[UNIQUE-ID].symphony_dashboard.performances`;
```

## Step 8: Backup & Recovery

### 8.1 Automated Exports
```bash
# Set up automated exports to Cloud Storage
bq extract \
    --destination_format=NEWLINE_DELIMITED_JSON \
    --compression=GZIP \
    symphony_dashboard.performances \
    gs://symphony-dashboard-backups/performances_$(date +%Y%m%d).json.gz
```

## Troubleshooting

### Common Issues:
1. **Authentication**: Verify service account key is correctly set
2. **Permissions**: Ensure all required IAM roles are assigned
3. **Quotas**: Check BigQuery quotas in GCP Console
4. **Costs**: Monitor query costs in BigQuery console

### Support Resources:
- [BigQuery Documentation](https://cloud.google.com/bigquery/docs)
- [Node.js BigQuery Client](https://googleapis.dev/nodejs/bigquery/latest/)
- [Cost Optimization Guide](https://cloud.google.com/bigquery/docs/best-practices-costs)