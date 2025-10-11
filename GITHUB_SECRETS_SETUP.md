# GitHub Secrets Setup Guide

## 🎯 Purpose

This guide will help you add your Supabase credentials as GitHub Secrets so your deployed site can connect to the database.

## ⚠️ Why This is Necessary

Your published site currently shows a blank page with the error: **"supabaseUrl is required"**

This happens because:
- The `.env` file (which has your credentials) is not committed to GitHub (correct for security)
- GitHub Pages needs these credentials during the build process
- GitHub Secrets provide a secure way to store and use credentials in GitHub Actions

## 📋 Step-by-Step Instructions

### Step 1: Navigate to Repository Settings

1. Go to your GitHub repository: https://github.com/wltoupin-boop/wltoupin-boop.github.io
2. Click on the **"Settings"** tab at the top
3. In the left sidebar, scroll down and click **"Secrets and variables"**
4. Click **"Actions"** in the submenu

### Step 2: Add First Secret (VITE_SUPABASE_URL)

1. Click the green **"New repository secret"** button
2. In the **"Name"** field, enter exactly:
   ```
   VITE_SUPABASE_URL
   ```
3. In the **"Secret"** field, enter your Supabase URL:
   ```
   https://nusnquvsugwnahlurgyo.supabase.co
   ```
4. Click **"Add secret"**

### Step 3: Add Second Secret (VITE_SUPABASE_ANON_KEY)

1. Click the green **"New repository secret"** button again
2. In the **"Name"** field, enter exactly:
   ```
   VITE_SUPABASE_ANON_KEY
   ```
3. In the **"Secret"** field, enter your Supabase anonymous key:
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51c25xdXZzdWd3bmFobHVyZ3lvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjA5MzAsImV4cCI6MjA3NTUzNjkzMH0.NT0-RfZx1yyFbEJTCnwPjeCfIOn6M-Yf0d4ANT2oZkQ
   ```
4. Click **"Add secret"**

### Step 4: Verify Secrets Are Added

You should now see two secrets listed:
- ✅ `VITE_SUPABASE_URL`
- ✅ `VITE_SUPABASE_ANON_KEY`

Note: GitHub doesn't show the actual values for security reasons - this is normal!

## 🚀 Next Steps

### Option 1: Push Your Changes (Automatic Deployment)

Once you commit and push the new GitHub Actions workflow to the `master` branch:

1. The workflow will automatically trigger
2. GitHub Actions will build your site with the secrets you just added
3. The built site will be deployed to GitHub Pages
4. Your site will work correctly!

### Option 2: Manually Trigger Workflow

If you've already pushed the workflow file:

1. Go to your repository on GitHub
2. Click the **"Actions"** tab at the top
3. Select **"Deploy to GitHub Pages"** from the left sidebar
4. Click **"Run workflow"** on the right
5. Select the `master` branch
6. Click the green **"Run workflow"** button

## 📊 Monitoring the Deployment

1. Go to the **"Actions"** tab in your GitHub repository
2. You'll see the workflow running (yellow dot = in progress)
3. Click on the workflow run to see detailed logs
4. Wait for it to complete (green checkmark = success)
5. Visit your site: https://wltoupin-boop.github.io/

## ✅ Verification Checklist

After deployment completes:

- [ ] Visit https://wltoupin-boop.github.io/
- [ ] The page loads (not blank)
- [ ] No console errors about "supabaseUrl is required"
- [ ] Calendar is visible and interactive
- [ ] Can select dates
- [ ] Can submit booking (test with fake data)
- [ ] Employee mode works (code: 1123)

## 🔧 Troubleshooting

### Workflow Fails with "secret not found"
- Double-check the secret names are **exactly** as shown (case-sensitive)
- Make sure you clicked "Add secret" for both

### Site Still Shows Blank Page
- Check the Actions tab to see if the workflow completed successfully
- Look at the workflow logs for any error messages
- Verify the secrets were added correctly
- Try clearing your browser cache (Ctrl+Shift+Delete)

### How to Update Secrets
1. Go to Repository → Settings → Secrets and variables → Actions
2. Click the secret name
3. Click "Update secret"
4. Enter the new value
5. Click "Update secret"

## 🔒 Security Note

These credentials (URL and anon key) are **safe to expose on the client-side**. They are:
- Intended for browser use
- Protected by Supabase Row Level Security (RLS) policies
- Not your service_role key (which must stay secret)

However, GitHub Secrets are still the best practice for managing them in CI/CD pipelines.

## 📚 Additional Resources

- [GitHub Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Supabase API Keys Documentation](https://supabase.com/docs/guides/api/api-keys)
- [GitHub Actions Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)

---

**Need Help?** Check the browser console (F12) for error messages or review the GitHub Actions logs for build errors.

