#!/bin/bash

# Azure Deployment Script for Judgement Card Game
# Make sure you're logged into Azure CLI before running this script

# Configuration
RESOURCE_GROUP_NAME="judgement-game-rg"
LOCATION="East US"
APP_NAME="judgement-card-game"

echo "🎯 Starting Azure deployment for Judgement Card Game..."

# Create resource group
echo "📁 Creating resource group: $RESOURCE_GROUP_NAME"
az group create --name $RESOURCE_GROUP_NAME --location "$LOCATION"

# Deploy the ARM template
echo "🚀 Deploying Azure resources..."
az deployment group create \
    --resource-group $RESOURCE_GROUP_NAME \
    --template-file azure-template.json \
    --parameters appName=$APP_NAME

# Get the web app name from deployment output
WEB_APP_NAME=$(az deployment group show \
    --resource-group $RESOURCE_GROUP_NAME \
    --name azure-template \
    --query properties.outputs.webAppName.value \
    --output tsv)

echo "📦 Web App Name: $WEB_APP_NAME"

# Deploy the application code
echo "📤 Deploying application code..."
az webapp deployment source config-zip \
    --resource-group $RESOURCE_GROUP_NAME \
    --name $WEB_APP_NAME \
    --src "judgement-game.zip"

# Get the URL
WEB_APP_URL=$(az deployment group show \
    --resource-group $RESOURCE_GROUP_NAME \
    --name azure-template \
    --query properties.outputs.webAppUrl.value \
    --output tsv)

echo "✅ Deployment completed!"
echo "🌐 Your Judgement Card Game is now available at: $WEB_APP_URL"
echo ""
echo "🎮 To test your game:"
echo "   1. Open $WEB_APP_URL in your browser"
echo "   2. Host a game and share the game code with friends"
echo "   3. Enjoy playing Judgement!"
