# Judgement Card Game - Azure Deployment Guide

## 🎯 Quick Deployment to Azure

This guide will help you deploy your Judgement card game to Azure App Service.

### Prerequisites

1. **Azure Account**: You need an active Azure subscription
2. **Azure CLI**: Install from [https://docs.microsoft.com/en-us/cli/azure/install-azure-cli](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
3. **Git**: For version control

### Option 1: Automated Deployment (Recommended)

1. **Login to Azure**:
   ```bash
   az login
   ```
   This will open a browser window for authentication.

2. **Set your subscription** (if you have multiple):
   ```bash
   az account set --subscription "Your Subscription Name"
   ```

3. **Run the deployment script**:
   
   **On Windows (PowerShell):**
   ```powershell
   .\deploy-to-azure.ps1
   ```
   
   **On macOS/Linux:**
   ```bash
   chmod +x deploy-to-azure.sh
   ./deploy-to-azure.sh
   ```

### Option 2: Manual Deployment

1. **Create Resource Group**:
   ```bash
   az group create --name judgement-game-rg --location "East US"
   ```

2. **Deploy Infrastructure**:
   ```bash
   az deployment group create \
     --resource-group judgement-game-rg \
     --template-file azure-template.json \
     --parameters appName=judgement-card-game
   ```

3. **Get Web App Name**:
   ```bash
   az deployment group show \
     --resource-group judgement-game-rg \
     --name azure-template \
     --query properties.outputs.webAppName.value \
     --output tsv
   ```

4. **Create Deployment Package**:
   - Create a zip file containing all your project files except:
     - `.git` folder
     - `node_modules` folder
     - deployment scripts
     - `.gitignore`

5. **Deploy Code**:
   ```bash
   az webapp deployment source config-zip \
     --resource-group judgement-game-rg \
     --name <YOUR-WEB-APP-NAME> \
     --src judgement-game.zip
   ```

### Option 3: Azure Portal Deployment

1. **Login to Azure Portal**: [https://portal.azure.com](https://portal.azure.com)
2. **Create a new Resource Group** named `judgement-game-rg`
3. **Create an App Service** with the following settings:
   - Runtime: Node.js 18 LTS
   - Operating System: Linux
   - Pricing Plan: Free F1 (for testing) or Basic B1 (for production)
4. **Enable WebSockets** in the App Service configuration
5. **Deploy your code** using one of these methods:
   - GitHub Actions (connect your repository)
   - Local Git deployment
   - FTP/FTPS
   - ZIP deployment

### Post-Deployment Configuration

1. **Enable WebSockets**: 
   - Go to your App Service in Azure Portal
   - Navigate to Configuration → General Settings
   - Set "Web sockets" to "On"
   - Save the configuration

2. **Set Application Settings** (if needed):
   ```
   WEBSITE_NODE_DEFAULT_VERSION = 18.17.0
   SCM_DO_BUILD_DURING_DEPLOYMENT = true
   ```

### Testing Your Deployment

1. Navigate to your Azure Web App URL (e.g., `https://your-app-name.azurewebsites.net`)
2. Host a new game
3. Share the game code with friends to test multiplayer functionality
4. Verify all features work:
   - Card dealing and sorting
   - Bidding system
   - Card playing and trick resolution
   - Scoring and round progression
   - Chat functionality
   - Host controls (pause/stop)

### Troubleshooting

**Common Issues:**

1. **WebSocket Connection Errors**:
   - Ensure WebSockets are enabled in App Service configuration
   - Check that your firewall allows WebSocket connections

2. **Static Assets Not Loading**:
   - Verify the `Assets` folder is included in your deployment
   - Check the static file serving configuration

3. **Application Crashes**:
   - Check Application Logs in Azure Portal
   - Verify all dependencies are listed in `package.json`

**Viewing Logs:**
```bash
az webapp log tail --resource-group judgement-game-rg --name <YOUR-WEB-APP-NAME>
```

### Scaling and Production Considerations

1. **Upgrade Pricing Tier**: For production use, consider upgrading from Free F1 to Basic B1 or higher
2. **Custom Domain**: Add a custom domain for a professional URL
3. **SSL Certificate**: Azure provides free SSL certificates for custom domains
4. **Application Insights**: Enable for monitoring and diagnostics
5. **CDN**: Use Azure CDN for better performance with static assets

### Cost Estimation

- **Free Tier (F1)**: $0/month (limited resources, good for testing)
- **Basic Tier (B1)**: ~$13/month (recommended for production)
- **Standard Tier (S1)**: ~$56/month (for high-traffic scenarios)

### Support

If you encounter issues during deployment:
1. Check the Azure Activity Log for detailed error messages
2. Review the deployment logs in the Azure Portal
3. Use `az webapp log tail` to view real-time logs
4. Ensure all prerequisites are met and you have the necessary permissions

---

## 🎮 Game Features

Your deployed Judgement card game includes:

- ✅ 4-player real-time multiplayer gameplay
- ✅ Mobile-responsive design
- ✅ Host controls (pause/stop games)
- ✅ Enhanced statistics and insights
- ✅ Chat system with notifications
- ✅ Professional UI with animations
- ✅ Comprehensive scoring system
- ✅ Round and game end celebrations

Enjoy your deployed Judgement card game! 🃏
