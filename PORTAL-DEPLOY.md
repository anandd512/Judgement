# 🚀 Azure Portal Deployment - No CLI Required

## Step 1: Access Azure Portal
1. Go to [https://portal.azure.com](https://portal.azure.com)
2. Sign in with `anand.deshpande125@outlook.com`
3. Confirm you see "Visual Studio Enterprise" subscription

## Step 2: Create Web App (5 minutes)
1. Click **"Create a resource"**
2. Search **"Web App"** → Click **"Create"**
3. Fill in details:
   ```
   Subscription: Visual Studio Enterprise
   Resource Group: Create new → "judgement-game-rg"
   Name: judgement-card-game-[your-initials]
   Runtime: Node 18 LTS
   Operating System: Linux
   Region: East US (or your preference)
   Pricing Plan: Free F1 (for testing) or Basic B1 (production)
   ```
4. Click **"Review + create"** → **"Create"**
5. Wait 2-3 minutes for deployment

## Step 3: Enable WebSockets (CRITICAL!)
1. Go to your new **App Service**
2. Left menu → **"Configuration"**
3. **"General settings"** tab
4. Set **"Web sockets"** to **"On"** ⚠️
5. Click **"Save"** → **"Continue"**

## Step 4: Deploy Your Game
1. Left menu → **"Deployment Center"**
2. Choose **"Local Git"** or **"ZIP Deploy"**

### Option A: ZIP Deploy (Easiest)
1. Click **"ZIP Deploy"**
2. Upload `judgement-game-deployment.zip`
3. Wait for deployment (3-5 minutes)

### Option B: Local Git
1. Click **"Local Git"** → **"Save"**
2. Go to **"Deployment credentials"**
3. Set username/password
4. Use the Git URL provided to push your code

## Step 5: Test Your Game
1. Go to **"Overview"**
2. Click your **App URL**
3. Your Judgement game should load!

## ✅ Success Checklist
- [ ] Web app created successfully
- [ ] WebSockets enabled
- [ ] Code deployed without errors
- [ ] Game loads in browser
- [ ] Can create/join games
- [ ] Multiplayer functionality works

## 🆘 Troubleshooting
- **500 Error**: Check Application Logs in Monitoring
- **WebSocket Issues**: Verify WebSockets are ON
- **Deployment Failed**: Try ZIP deploy method
- **Game Won't Load**: Check Node.js version (should be 18 LTS)

Your VS Enterprise subscription gives you plenty of resources to run this game! 🎮
