# Deploy Symphony PDF Webhook to Google Cloud Functions (PowerShell version)
# Usage: .\deploy.ps1 [environment]
# Environment: prod (default) or test

param(
    [string]$Environment = "prod"
)

$FUNCTION_NAME = "symphony-pdf-webhook"
$REGION = "us-central1"
$RUNTIME = "nodejs20"
$ENTRY_POINT = "pdfWebhook"
$MEMORY = "2GB"
$TIMEOUT = "540s"

# Environment-specific settings
if ($Environment -eq "test") {
    $FUNCTION_NAME = "$FUNCTION_NAME-test"
    Write-Host "🧪 Deploying to TEST environment" -ForegroundColor Yellow
} else {
    Write-Host "🚀 Deploying to PRODUCTION environment" -ForegroundColor Green
}

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  Symphony PDF Webhook Deployment" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "Function:  $FUNCTION_NAME"
Write-Host "Region:    $REGION"
Write-Host "Runtime:   $RUNTIME"
Write-Host "Memory:    $MEMORY"
Write-Host "Timeout:   $TIMEOUT"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

# Check if gcloud is installed
try {
    $null = Get-Command gcloud -ErrorAction Stop
} catch {
    Write-Host "❌ Error: gcloud CLI not found. Please install Google Cloud SDK." -ForegroundColor Red
    Write-Host "   Visit: https://cloud.google.com/sdk/docs/install"
    exit 1
}

# Check if authenticated
$activeAccount = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>$null
if ([string]::IsNullOrWhiteSpace($activeAccount)) {
    Write-Host "❌ Error: Not authenticated with gcloud. Run: gcloud auth login" -ForegroundColor Red
    exit 1
}

# Get current project
$PROJECT_ID = gcloud config get-value project 2>$null
if ([string]::IsNullOrWhiteSpace($PROJECT_ID)) {
    Write-Host "❌ Error: No project set. Run: gcloud config set project YOUR_PROJECT_ID" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📋 Using Google Cloud Project: $PROJECT_ID" -ForegroundColor Cyan
Write-Host ""

# Confirm deployment
$confirmation = Read-Host "⚠️  Deploy to $Environment environment? (y/N)"
if ($confirmation -notmatch '^[Yy]$') {
    Write-Host "❌ Deployment cancelled" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔨 Deploying function..." -ForegroundColor Yellow
Write-Host ""

# Deploy the function
$deployCommand = @"
gcloud functions deploy $FUNCTION_NAME ``
  --gen2 ``
  --runtime=$RUNTIME ``
  --region=$REGION ``
  --source=. ``
  --entry-point=$ENTRY_POINT ``
  --trigger-http ``
  --allow-unauthenticated ``
  --memory=$MEMORY ``
  --timeout=$TIMEOUT ``
  --set-env-vars="BIGQUERY_DATASET=symphony_dashboard,GCS_PDF_BACKUP_BUCKET=symphony-dashboard-pdfs,GOOGLE_CLOUD_PROJECT_ID=kcsymphony"
"@

Invoke-Expression $deployCommand

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Deployment successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "  Function Details" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

    # Get function URL
    $FUNCTION_URL = gcloud functions describe $FUNCTION_NAME --region=$REGION --gen2 --format="value(serviceConfig.uri)"

    Write-Host "📍 Function URL:"
    Write-Host "   $FUNCTION_URL" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 View logs:"
    Write-Host "   gcloud functions logs read $FUNCTION_NAME --region=$REGION --gen2 --limit=50"
    Write-Host ""
    Write-Host "🔧 Update environment variables:"
    Write-Host "   gcloud functions deploy $FUNCTION_NAME --region=$REGION --gen2 --update-env-vars=KEY=VALUE"
    Write-Host ""
    Write-Host "🗑️  Delete function:"
    Write-Host "   gcloud functions delete $FUNCTION_NAME --region=$REGION --gen2"
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📝 Next steps:" -ForegroundColor Yellow
    Write-Host "   1. Update Make.com webhook URL to: $FUNCTION_URL"
    Write-Host "   2. Test with: npm run test-webhook (from project root)"
    Write-Host "   3. Monitor logs with: npm run logs (from cloud-functions/pdf-webhook)"
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Deployment failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common issues:"
    Write-Host "  • API not enabled: gcloud services enable cloudfunctions.googleapis.com"
    Write-Host "  • Billing not enabled on project"
    Write-Host "  • Insufficient permissions"
    Write-Host ""
    exit 1
}
