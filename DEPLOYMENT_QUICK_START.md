# 🚀 Deployment Quick Start

## Current Status
❌ Your site shows: **"supabaseUrl is required"**

## Fix in 3 Steps (5 minutes)

### 1️⃣ Add GitHub Secrets

Go to: **Repository → Settings → Secrets and variables → Actions**

Add these **two** secrets:

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | `https://nusnquvsugwnahlurgyo.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51c25xdXZzdWd3bmFobHVyZ3lvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjA5MzAsImV4cCI6MjA3NTUzNjkzMH0.NT0-RfZx1yyFbEJTCnwPjeCfIOn6M-Yf0d4ANT2oZkQ` |

> **Note:** Names must be **exact** (case-sensitive)

### 2️⃣ Commit and Push Changes

```bash
git add .
git commit -m "Add GitHub Actions deployment workflow"
git push origin master
```

### 3️⃣ Wait for Deployment

1. Go to **Actions** tab on GitHub
2. Watch the workflow run (takes ~2-3 minutes)
3. When complete (green ✓), visit your site!

## 🌐 Your Live Site

https://wltoupin-boop.github.io/

## ✅ Success Indicators

After deployment:
- ✅ Page loads (not blank)
- ✅ No console errors
- ✅ Calendar is interactive
- ✅ Can make test bookings

## ❓ Troubleshooting

**Workflow fails?**
- Check secret names are exact: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

**Site still blank?**
- Clear browser cache (Ctrl+Shift+Delete)
- Check Actions tab for error logs
- Verify both secrets were added

**Need detailed help?**
See `GITHUB_SECRETS_SETUP.md` for step-by-step instructions with screenshots descriptions.

## 🔄 Future Deployments

After initial setup, deployments are automatic:
- Push to `master` branch → Site updates automatically
- No manual steps needed!

---

**Created:** GitHub Actions workflow at `.github/workflows/deploy.yml`

