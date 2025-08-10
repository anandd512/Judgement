# 🔄 Alternative: GitHub → Azure Deployment

If you prefer automated deployments from GitHub:

## Step 1: Push to GitHub
```bash
git add .
git commit -m "Ready for Azure deployment"
git push origin main
```

## Step 2: Connect GitHub to Azure
1. In your **App Service** → **Deployment Center**
2. Choose **"GitHub"**
3. Authorize Azure to access your GitHub
4. Select your `Judgement` repository
5. Choose `main` branch
6. Azure will automatically deploy on future commits!

## Step 3: Manual Trigger (if needed)
- Go to **Deployment Center** → **Sync** to trigger deployment

## Benefits of GitHub Integration:
- ✅ Automatic deployments on git push
- ✅ Deployment history tracking
- ✅ Easy rollback to previous versions
- ✅ No manual ZIP uploads needed

This is perfect for ongoing development! 🚀
