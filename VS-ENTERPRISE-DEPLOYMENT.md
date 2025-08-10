# 🎯 Visual Studio Enterprise Azure Deployment Guide

## Step-by-Step Azure Portal Deployment

### 1. Create Resource Group
1. Go to [Azure Portal](https://portal.azure.com)
2. Sign in with `anand.deshpande125@outlook.com`
3. Click **"Resource groups"** → **"Create"**
4. **Resource group name**: `judgement-card-game-rg`
5. **Region**: `East US` (or your preferred region)
6. Click **"Review + create"** → **"Create"**

### 2. Create App Service (Web App)
1. Click **"Create a resource"** → **"Web App"**
2. **Resource Group**: Select `judgement-card-game-rg`
3. **Name**: `judgement-card-game-[your-unique-id]` (must be globally unique)
4. **Runtime stack**: `Node 18 LTS`
5. **Operating System**: `Linux`
6. **Region**: Same as resource group
7. **Pricing plan**: 
   - For testing: `Free F1`
   - For production: `Basic B1` (recommended)
8. Click **"Review + create"** → **"Create"**

### 3. Configure App Service Settings
After creation:
1. Go to your **App Service** → **Configuration**
2. **General Settings**:
   - **Web sockets**: `On` ⚠️ **CRITICAL for the game to work**
   - **Always On**: `On` (if using paid tier)
3. **Application settings** (Add these):
   ```
   WEBSITE_NODE_DEFAULT_VERSION = 18.17.0
   SCM_DO_BUILD_DURING_DEPLOYMENT = true
   ```
4. Click **"Save"**

### 4. Deploy Your Code

**Option A: ZIP Deployment (Recommended)**
1. Download the `judgement-game-deployment.zip` file (I'll create this for you)
2. Go to your **App Service** → **Deployment Center**
3. Choose **"ZIP Deploy"**
4. Upload the zip file
5. Wait for deployment to complete

**Option B: GitHub Deployment**
1. Push your code to GitHub (if not already done)
2. Go to **App Service** → **Deployment Center**
3. Choose **"GitHub"**
4. Authorize and select your repository
5. Configure automatic deployments

### 5. Test Your Deployment
1. Go to your **App Service** → **Overview**
2. Click the **URL** (e.g., `https://your-app-name.azurewebsites.net`)
3. Your Judgement card game should load!

## 🎮 Testing Checklist
- [ ] Game loads without errors
- [ ] Can create/host a game
- [ ] Can join games with game code
- [ ] Cards deal and display correctly
- [ ] Bidding system works
- [ ] Card playing functions
- [ ] Chat system works
- [ ] Host controls (pause/stop) function
- [ ] Mobile responsive design works

## 📊 Visual Studio Enterprise Benefits
- **Monthly Azure Credit**: $150/month
- **Free tier options**: Perfect for development/testing
- **Premium support**: Access to Azure support
- **Advanced monitoring**: Application Insights included

## 🔧 Troubleshooting
If issues occur:
1. Check **App Service Logs**: Monitoring → Log stream
2. Verify **WebSockets are enabled**: Configuration → General settings
3. Check **Application settings**: Ensure Node.js version is correct
4. Review **Deployment logs**: Deployment Center → Logs

Your Visual Studio Enterprise subscription is perfect for hosting this game! 🚀
