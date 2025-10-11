# Quick Start Guide - Cross-Device Sync Setup

## What Changed?

Your booking system now uses **Supabase** (a cloud database) instead of localStorage. This means:

✅ **Bookings sync across ALL devices** - When someone submits a request on their phone, dates become unavailable on all computers and phones  
✅ **Employee mode works everywhere** - View bookings and manage availability from any device  
✅ **Real-time updates** - Changes appear instantly without refreshing  

## Setup Steps (5-10 minutes)

### 1. Create Supabase Account (Free)

1. Go to [supabase.com](https://supabase.com) and sign up
2. Click "New Project"
3. Name it "TAS Online Booking" (or whatever you like)
4. Set a database password and choose a region
5. Wait 1-2 minutes for setup to complete

### 2. Create Database Tables

1. In Supabase dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy and paste this SQL code:

```sql
-- Create bookings table
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_iso TEXT NOT NULL,
  choice JSONB NOT NULL,
  customer JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bookings_date ON bookings(date_iso);

-- Create unavailable_dates table
CREATE TABLE unavailable_dates (
  date_iso TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE unavailable_dates ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Allow public read on bookings" ON bookings FOR SELECT USING (true);
CREATE POLICY "Allow public read on unavailable_dates" ON unavailable_dates FOR SELECT USING (true);

-- Public write access
CREATE POLICY "Allow public insert on bookings" ON bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert on unavailable_dates" ON unavailable_dates FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on unavailable_dates" ON unavailable_dates FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on unavailable_dates" ON unavailable_dates FOR DELETE USING (true);
```

4. Click "Run" (or press Ctrl/Cmd + Enter)
5. You should see "Success. No rows returned"

### 3. Enable Real-time Sync

1. Go to **Database** → **Replication** in Supabase
2. Find `bookings` table → Toggle **Realtime** ON
3. Find `unavailable_dates` table → Toggle **Realtime** ON

### 4. Get Your API Keys

1. Go to **Settings** → **API**
2. Copy your **Project URL** (looks like `https://xxxxx.supabase.co`)
3. Copy your **anon public** key (long string under "Project API keys")

### 5. Configure Your App

1. Create a file named `.env` in your project root (same folder as `package.json`)

2. Add these two lines (replace with your actual values):

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-long-anon-key-here
```

3. Save the file

### 6. Test It!

1. Run your app:
```bash
npm run dev
```

2. Open the app in two browser tabs (or on your phone and computer)

3. Submit a booking from one device

4. **Check the other device** - the dates should become unavailable automatically! 🎉

## Testing Cross-Device Sync

### Test Customer Mode:
1. Open app on Phone and Computer
2. Phone: Select a date and submit a booking
3. Computer: Refresh if needed - that date should now be unavailable
4. Computer: Try to select that date - it should be blocked

### Test Employee Mode (code: 1123):
1. Open employee mode on two devices
2. Device 1: Mark a date as unavailable
3. Device 2: Watch it update in real-time (no refresh needed!)

## Deploying to Production

When you deploy your app (GitHub Pages, Vercel, etc.):

1. Add the environment variables to your hosting platform:
   - **Vercel**: Project Settings → Environment Variables
   - **Netlify**: Site Settings → Environment → Environment Variables
   - **GitHub Pages**: May need alternative deployment method

2. Your Supabase credentials work for both development and production!

## Troubleshooting

**"Failed to load bookings" error:**
- Check that `.env` file exists and has correct values
- Verify Supabase URL and key are correct (no extra spaces)
- Restart dev server after creating `.env`

**Data not syncing:**
- Confirm Realtime is enabled for both tables
- Check browser console for errors
- Try hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

**Still using old data:**
- Clear browser localStorage: Open DevTools → Application → Local Storage → Clear
- Refresh the page

## Need More Help?

See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for detailed instructions and troubleshooting.



