#!/bin/bash
# Setup script for PDF backup bucket in Google Cloud Storage

set -e

BUCKET_NAME="symphony-dashboard-pdfs"
PROJECT_ID="kcsymphony"
LOCATION="US"

echo "🪣 Setting up PDF backup bucket..."
echo ""
echo "Bucket: gs://${BUCKET_NAME}"
echo "Project: ${PROJECT_ID}"
echo "Location: ${LOCATION}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI not found"
    echo "   Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
    echo "❌ Error: Not authenticated with gcloud"
    echo "   Run: gcloud auth login"
    exit 1
fi

# Create bucket
echo "1️⃣  Creating bucket..."
if gcloud storage buckets describe gs://${BUCKET_NAME} &> /dev/null; then
    echo "   ✅ Bucket already exists"
else
    gcloud storage buckets create gs://${BUCKET_NAME} \
        --project=${PROJECT_ID} \
        --location=${LOCATION} \
        --uniform-bucket-level-access
    echo "   ✅ Bucket created"
fi

# Get service account email
echo ""
echo "2️⃣  Finding service account..."
SERVICE_ACCOUNT=$(gcloud iam service-accounts list \
    --project=${PROJECT_ID} \
    --filter="displayName:symphony OR displayName:bigquery" \
    --format="value(email)" \
    --limit=1)

if [ -z "$SERVICE_ACCOUNT" ]; then
    echo "   ⚠️  No service account found automatically"
    echo "   Please enter your service account email:"
    read SERVICE_ACCOUNT
fi

echo "   Service account: ${SERVICE_ACCOUNT}"

# Grant permissions
echo ""
echo "3️⃣  Granting storage permissions..."
gcloud storage buckets add-iam-policy-binding gs://${BUCKET_NAME} \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/storage.objectAdmin"

echo "   ✅ Permissions granted"

# Set lifecycle policy (optional)
echo ""
echo "4️⃣  Setting up lifecycle policy (optional - keeps PDFs for 1 year)..."
cat > /tmp/lifecycle.json <<EOF
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
EOF

gcloud storage buckets update gs://${BUCKET_NAME} \
    --lifecycle-file=/tmp/lifecycle.json

rm /tmp/lifecycle.json
echo "   ✅ Lifecycle policy set"

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Deploy updated webhook: git push origin main"
echo "2. PDFs will be backed up to: gs://${BUCKET_NAME}/YYYY/MM/"
echo "3. View in console: https://console.cloud.google.com/storage/browser/${BUCKET_NAME}"
echo ""
