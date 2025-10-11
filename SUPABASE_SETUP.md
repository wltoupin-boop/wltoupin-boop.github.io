# Complete Supabase Setup Guide

This guide will walk you through setting up your Supabase database for The Animal Society booking system with double-booking prevention.

## Prerequisites

- [ ] A Supabase account (free tier is fine)
- [ ] Your `.env` file with Supabase credentials (already exists in your project)

## Step 1: Verify Your Supabase Connection

You already have a `.env` file with these credentials:
```
VITE_SUPABASE_URL=https://nusnquvsugnwahlurgyo.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

**Test the connection:**
1. Start your dev server: `npm run dev`
2. Open browser console (F12)
3. Look for Supabase-related errors

If you see errors, verify your credentials at: https://app.supabase.com/project/_/settings/api

## Step 2: Create Database Tables

Your booking system needs three tables. Follow these steps:

### Method A: Using SQL Editor (Recommended)

1. Go to your Supabase project: https://app.supabase.com
2. Click on your project (URL should match `nusnquvsugnwahlurgyo`)
3. Navigate to **SQL Editor** in the left sidebar
4. Click **"New Query"**
5. Copy the ENTIRE contents of `supabase_schema.sql` from your project
6. Paste into the SQL editor
7. Click **"Run"** (or press Ctrl+Enter)
8. Wait for "Success. No rows returned" message

✅ **That's it!** All three tables are now created with proper constraints.

### Method B: Manual Table Creation (Alternative)

If you prefer to create tables manually through the Table Editor:

<details>
<summary>Click to expand manual instructions</summary>

#### Table 1: bookings

1. Go to **Table Editor** → **New Table**
2. Table name: `bookings`
3. Enable RLS: ✅ Yes
4. Add columns:

| Column Name | Type | Default Value | Primary | Nullable |
|------------|------|---------------|---------|----------|
| id | uuid | gen_random_uuid() | ✅ | No |
| date_iso | text | - | | No |
| choice | jsonb | - | | No |
| customer | jsonb | - | | No |
| created_at | timestamptz | now() | | No |

5. After creation, go to **SQL Editor** and run:
```sql
CREATE INDEX idx_bookings_date ON public.bookings(date_iso);
CREATE POLICY "Allow public read access on bookings" ON public.bookings FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on bookings" ON public.bookings FOR INSERT WITH CHECK (true);
```

#### Table 2: unavailable_dates

1. **Table Editor** → **New Table**
2. Table name: `unavailable_dates`
3. Enable RLS: ✅ Yes
4. Add columns:

| Column Name | Type | Default Value | Primary | Nullable |
|------------|------|---------------|---------|----------|
| date_iso | text | - | ✅ | No |
| created_at | timestamptz | now() | | No |

5. Run in SQL Editor:
```sql
CREATE POLICY "Allow public read access on unavailable_dates" ON public.unavailable_dates FOR SELECT USING (true);
CREATE POLICY "Allow public insert/update/delete on unavailable_dates" ON public.unavailable_dates FOR ALL USING (true);
```

#### Table 3: time_slot_bookings

1. **Table Editor** → **New Table**
2. Table name: `time_slot_bookings`
3. Enable RLS: ✅ Yes
4. Add columns:

| Column Name | Type | Default Value | Primary | Nullable |
|------------|------|---------------|---------|----------|
| id | uuid | gen_random_uuid() | ✅ | No |
| date_iso | text | - | | No |
| start_min | int4 | - | | No |
| end_min | int4 | - | | No |
| booking_id | uuid | - | | Yes |
| created_at | timestamptz | now() | | No |

5. Add foreign key constraint and indexes via SQL Editor:
```sql
ALTER TABLE public.time_slot_bookings 
  ADD CONSTRAINT fk_booking 
  FOREIGN KEY (booking_id) 
  REFERENCES public.bookings(id) 
  ON DELETE CASCADE;

ALTER TABLE public.time_slot_bookings 
  ADD CONSTRAINT unique_slot 
  UNIQUE (date_iso, start_min, end_min);

CREATE INDEX idx_timeslot_date ON public.time_slot_bookings(date_iso);
CREATE INDEX idx_timeslot_range ON public.time_slot_bookings(date_iso, start_min, end_min);

CREATE POLICY "Allow public read access on time_slot_bookings" ON public.time_slot_bookings FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on time_slot_bookings" ON public.time_slot_bookings FOR INSERT WITH CHECK (true);
```

</details>

## Step 3: Enable Realtime

Real-time updates allow all devices to see bookings instantly.

1. Go to **Database** → **Replication** in Supabase dashboard
2. Scroll to **Tables** section
3. Enable replication for:
   - ✅ `bookings`
   - ✅ `unavailable_dates`
   - ✅ `time_slot_bookings`

**Or run this SQL:**
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.unavailable_dates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.time_slot_bookings;
```

## Step 4: Verify Everything Works

### Test 1: Check Tables Exist

Run in SQL Editor:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('bookings', 'unavailable_dates', 'time_slot_bookings');
```

✅ Should return 3 rows (one for each table)

### Test 2: Test Your App

1. Start dev server: `npm run dev`
2. Open app in browser
3. Open browser console (F12)
4. Try to book a date
5. Check console for errors

**Success indicators:**
- No red errors in console
- Booking saves successfully
- Date becomes unavailable on calendar
- Open app on phone → should see same unavailable date

### Test 3: Multi-Device Sync

1. Open app on computer
2. Open app on phone (or second browser window)
3. Book a date from phone
4. **Watch computer instantly show date as unavailable** ✨

If this works, your real-time sync is perfect!

## Troubleshooting

### Error: "Invalid API key"
- Go to https://app.supabase.com/project/_/settings/api
- Copy **Project URL** and **anon public** key
- Update your `.env` file
- Restart dev server: `Ctrl+C` then `npm run dev`

### Error: "relation public.bookings does not exist"
- Tables aren't created yet
- Run `supabase_schema.sql` in SQL Editor (Step 2)

### Error: "duplicate key value violates unique constraint"
- This is GOOD! It means double-booking prevention is working
- Someone already booked that time slot
- The app will now show a user-friendly error

### No real-time sync
- Go to **Database** → **Replication**
- Enable all three tables
- Or run the `ALTER PUBLICATION` commands from Step 3

### Bookings save but don't show on other devices
- Check browser console on both devices
- Verify Realtime is enabled (Step 3)
- Make sure both devices are connected to internet
- Try hard refresh (Ctrl+Shift+R)

## Database Schema Summary

Your database now has:

**bookings**: All customer booking requests
- Stores customer info, dates, and time choices
- One row per date booked

**unavailable_dates**: Employee-marked unavailable dates
- Blocks entire day from customer bookings
- Managed via Employee Mode

**time_slot_bookings**: Time slot occupancy tracker
- Prevents overlapping time bookings
- Database constraint ensures no double-booking
- Automatically syncs across all devices

## Security Notes

**Current setup:** Public read/write access (suitable for a public booking form)

**For production:** Consider adding:
- Rate limiting on bookings table
- Captcha verification
- Email verification before booking confirmation
- Admin-only access to delete bookings

Row Level Security (RLS) is enabled but policies allow public access. Modify policies in SQL Editor if you need stricter security.

## Next Steps

✅ Database is ready!

Now you can:
- Test booking from multiple devices
- Use Employee Mode to manage availability
- Monitor bookings in Supabase dashboard (**Table Editor** → View data)
- Export booking data for records

---

**Need help?** Check the browser console (F12) for detailed error messages, or review `BOOKING_SYSTEM.md` for how the conflict prevention works.

