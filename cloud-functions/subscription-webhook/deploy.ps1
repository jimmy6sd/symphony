# Deploy Symphony Subscription Webhook to Google Cloud Functions (PowerShell)
# Usage: .\deploy.ps1 [environment]
# Environment: prod (default) or test

param(
    [string]$Environment = "prod"
)

$FUNCTION_NAME = "symphony-subscription-webhook"
$REGION = "us-central1"
$RUNTIME = "nodejs20"
$ENTRY_POINT = "subscriptionWebhook"
$MEMORY = "1GB"
$TIMEOUT = "300s"

if ($Environment -eq "test") {
    $FUNCTION_NAME = "$FUNCTION_NAME-test"
    Write-Host "Deploying to TEST environment" -ForegroundColor Yellow
} else {
    Write-Host "Deploying to PRODUCTION environment" -ForegroundColor Green
}

Write-Host "Function:  $FUNCTION_NAME"
Write-Host "Region:    $REGION"
Write-Host "Runtime:   $RUNTIME"
Write-Host "Memory:    $MEMORY"
Write-Host "Timeout:   $TIMEOUT"

# Check if gcloud is installed
try {
    $null = Get-Command gcloud -ErrorAction Stop
} catch {
    Write-Host "Error: gcloud CLI not found. Install Google Cloud SDK." -ForegroundColor Red
    exit 1
}

# Check if authenticated
$activeAccount = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>$null
if ([string]::IsNullOrWhiteSpace($activeAccount)) {
    Write-Host "Error: Not authenticated. Run: gcloud auth login" -ForegroundColor Red
    exit 1
}

$PROJECT_ID = gcloud config get-value project 2>$null
if ([string]::IsNullOrWhiteSpace($PROJECT_ID)) {
    Write-Host "Error: No project set. Run: gcloud config set project YOUR_PROJECT_ID" -ForegroundColor Red
    exit 1
}

Write-Host "Project: $PROJECT_ID"

$confirmation = Read-Host "Deploy to $Environment environment? (y/N)"
if ($confirmation -notmatch '^[Yy]$') {
    Write-Host "Deployment cancelled" -ForegroundColor Red
    exit 1
}

Write-Host "Deploying function..." -ForegroundColor Yellow

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
    $FUNCTION_URL = gcloud functions describe $FUNCTION_NAME --region=$REGION --gen2 --format="value(serviceConfig.uri)"
    Write-Host ""
    Write-Host "Deployment successful!" -ForegroundColor Green
    Write-Host "Function URL: $FUNCTION_URL" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "  1. Create 4 Make.com scenarios (Classical, Pops, Flex, Family)"
    Write-Host "  2. Each scenario POSTs to: $FUNCTION_URL"
    Write-Host "  3. Include filename with category name in metadata"
    Write-Host "  4. Test with: node test-local.js"
    Write-Host ""
} else {
    Write-Host "Deployment failed" -ForegroundColor Red
    exit 1
}
