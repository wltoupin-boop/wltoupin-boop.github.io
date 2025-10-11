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

- **`NEXT_STEPS.md`** - Quick start guide (start here!)
- **`SUPABASE_SETUP.md`** - Database setup walkthrough
- **`BOOKING_SYSTEM.md`** - Technical documentation on conflict prevention
- **`SETUP_INSTRUCTIONS.md`** - Troubleshooting guide

## Building for Production

```bash
npm run build
```

## Deployment

This project is automatically deployed to GitHub Pages using GitHub Actions. The website is available at:

**https://wltoupin-boop.github.io/wltoupin-boop.github.io/**

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
