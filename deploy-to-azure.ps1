# Azure Deployment Script for Judgement Card Game (PowerShell)
# Make sure you're logged into Azure CLI before running this script

# Configuration
$RESOURCE_GROUP_NAME = "judgement-game-rg"
$LOCATION = "East US"
$APP_NAME = "judgement-card-game"

Write-Host "🎯 Starting Azure deployment for Judgement Card Game..." -ForegroundColor Green

# Create resource group
Write-Host "📁 Creating resource group: $RESOURCE_GROUP_NAME" -ForegroundColor Yellow
az group create --name $RESOURCE_GROUP_NAME --location $LOCATION

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to create resource group" -ForegroundColor Red
    exit 1
}

# Deploy the ARM template
Write-Host "🚀 Deploying Azure resources..." -ForegroundColor Yellow
az deployment group create `
    --resource-group $RESOURCE_GROUP_NAME `
    --template-file azure-template.json `
    --parameters appName=$APP_NAME

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to deploy Azure resources" -ForegroundColor Red
    exit 1
}

# Get the web app name from deployment output
$WEB_APP_NAME = az deployment group show `
    --resource-group $RESOURCE_GROUP_NAME `
    --name azure-template `
    --query properties.outputs.webAppName.value `
    --output tsv

Write-Host "📦 Web App Name: $WEB_APP_NAME" -ForegroundColor Cyan

# Create deployment package
Write-Host "📦 Creating deployment package..." -ForegroundColor Yellow
$excludeFiles = @(".git", "node_modules", "*.zip", "deploy-to-azure.*", "azure-template.json", ".gitignore")

# Create a temporary directory for the package
$tempDir = "temp-deploy"
if (Test-Path $tempDir) {
    Remove-Item $tempDir -Recurse -Force
}
New-Item -ItemType Directory -Name $tempDir

# Copy files excluding certain directories
Get-ChildItem -Path . | Where-Object { $_.Name -notin $excludeFiles } | Copy-Item -Destination $tempDir -Recurse

# Create zip file
Compress-Archive -Path "$tempDir\*" -DestinationPath "judgement-game.zip" -Force

# Clean up temp directory
Remove-Item $tempDir -Recurse -Force

# Deploy the application code
Write-Host "📤 Deploying application code..." -ForegroundColor Yellow
az webapp deployment source config-zip `
    --resource-group $RESOURCE_GROUP_NAME `
    --name $WEB_APP_NAME `
    --src "judgement-game.zip"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to deploy application code" -ForegroundColor Red
    exit 1
}

# Get the URL
$WEB_APP_URL = az deployment group show `
    --resource-group $RESOURCE_GROUP_NAME `
    --name azure-template `
    --query properties.outputs.webAppUrl.value `
    --output tsv

Write-Host ""
Write-Host "✅ Deployment completed!" -ForegroundColor Green
Write-Host "🌐 Your Judgement Card Game is now available at: $WEB_APP_URL" -ForegroundColor Cyan
Write-Host ""
Write-Host "🎮 To test your game:" -ForegroundColor Yellow
Write-Host "   1. Open $WEB_APP_URL in your browser"
Write-Host "   2. Host a game and share the game code with friends"
Write-Host "   3. Enjoy playing Judgement!"
Write-Host ""
Write-Host "🧹 Cleaning up deployment files..." -ForegroundColor Yellow
Remove-Item "judgement-game.zip" -ErrorAction SilentlyContinue
