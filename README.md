# The Animal Society - Pet Sitting Booking Website

A modern, responsive web application for booking pet sitting services. Built with React, TypeScript, and Tailwind CSS.

## Features

- 📅 Interactive calendar for date selection
- 🐾 Multiple booking options (pet sitting, weekday/weekend bundles)
- 👥 Employee mode for managing availability
- 📧 Email integration for booking requests
- 📱 QR code generation for easy sharing
- 💾 Supabase database with real-time sync
- 🚫 **Double-booking prevention** with time slot conflict detection
- ⚡ Real-time updates across all devices
- 🔒 Database-level race condition protection

## Setup

### Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up Supabase database:
   - See **`NEXT_STEPS.md`** for complete setup guide
   - Or follow **`SUPABASE_SETUP.md`** for detailed instructions

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:5173](http://localhost:5173) in your browser

### Documentation

#### Setup & Deployment
- **`DEPLOYMENT_QUICK_START.md`** - ⚡ Fix "supabaseUrl is required" error (start here!)
- **`GITHUB_SECRETS_SETUP.md`** - Detailed guide for adding GitHub Secrets
- **`NEXT_STEPS.md`** - Quick start guide for local development
- **`SUPABASE_SETUP.md`** - Database setup walkthrough

#### Technical Documentation
- **`BOOKING_SYSTEM.md`** - Technical documentation on conflict prevention
- **`SETUP_INSTRUCTIONS.md`** - Troubleshooting guide

## Building for Production

```bash
npm run build
```

## Deployment

This project is automatically deployed to GitHub Pages using GitHub Actions. Every push to the `master` branch triggers an automatic build and deployment.

**Live Site:** https://wltoupin-boop.github.io/

### GitHub Actions Setup

The deployment workflow (`.github/workflows/deploy.yml`) automatically:
1. Checks out the code
2. Installs dependencies
3. Builds the project with Supabase credentials from GitHub Secrets
4. Deploys to GitHub Pages

### Required GitHub Secrets

To enable deployment, you must add these secrets to your GitHub repository:

1. Go to: **Repository → Settings → Secrets and variables → Actions**
2. Click **"New repository secret"**
3. Add these two secrets:

| Secret Name | Value |
|-------------|-------|
| `VITE_SUPABASE_URL` | Your Supabase project URL (e.g., `https://xxxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous key |

Get these values from: https://app.supabase.com/project/_/settings/api

### Manual Deployment (Alternative)

If you need to deploy manually:
```bash
# 1. Ensure .env file exists with credentials
# 2. Build the project
npm run build

# 3. Deploy to GitHub Pages
npm run deploy
```

## Technologies Used

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Supabase (PostgreSQL database with real-time subscriptions)
- date-fns
- Lucide React icons

## License

© 2024 The Animal Society. All rights reserved.
# Trigger GitHub Actions
