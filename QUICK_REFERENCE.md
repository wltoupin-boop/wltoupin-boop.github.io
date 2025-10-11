# Quick Reference Guide

## 🚀 Getting Started (2 Minutes)

```bash
# 1. Install dependencies
npm install

# 2. Go to Supabase and run SQL schema
#    → Open supabase_schema.sql
#    → Copy all contents
#    → Paste in Supabase SQL Editor
#    → Click Run

# 3. Enable Realtime in Supabase
#    → Database → Replication
#    → Enable: bookings, unavailable_dates, time_slot_bookings

# 4. Start app
npm run dev
```

**Full instructions:** `NEXT_STEPS.md`

## 📚 Documentation Files

| File | Purpose | When to Read |
|------|---------|--------------|
| **NEXT_STEPS.md** | Quick start guide | **Start here!** |
| **SUPABASE_SETUP.md** | Database setup | Setting up for first time |
| **BOOKING_SYSTEM.md** | Technical deep-dive | Understanding how it works |
| **IMPLEMENTATION_SUMMARY.md** | What was built | Review of all changes |
| **SETUP_INSTRUCTIONS.md** | Troubleshooting | When something doesn't work |
| **QUICK_REFERENCE.md** | This file | Quick command reference |

## 🗄️ Database Tables

### `bookings`
All customer booking requests
```sql
SELECT * FROM bookings ORDER BY created_at DESC LIMIT 10;
```

### `unavailable_dates`
Employee-marked unavailable dates (blocks entire day)
```sql
SELECT * FROM unavailable_dates ORDER BY date_iso;
```

### `time_slot_bookings` ⭐ NEW
Time slot occupancy (prevents overlaps)
```sql
SELECT * FROM time_slot_bookings ORDER BY date_iso, start_min;
```

## 🔍 Useful SQL Queries

### See all bookings for a specific date
```sql
SELECT 
  b.customer->>'name' as customer_name,
  b.customer->>'email' as email,
  b.choice->>'kind' as booking_type,
  t.start_min,
  t.end_min
FROM bookings b
LEFT JOIN time_slot_bookings t ON b.id = t.booking_id
WHERE b.date_iso = '2025-10-15'
ORDER BY t.start_min;
```

### Check for conflicts (should return 0)
```sql
SELECT date_iso, start_min, end_min, COUNT(*) as duplicates
FROM time_slot_bookings
GROUP BY date_iso, start_min, end_min
HAVING COUNT(*) > 1;
```

### View busiest dates
```sql
SELECT date_iso, COUNT(*) as booking_count
FROM time_slot_bookings
GROUP BY date_iso
ORDER BY booking_count DESC
LIMIT 10;
```

### Delete bookings before a date
```sql
DELETE FROM bookings WHERE date_iso < '2025-01-01';
-- Cascade automatically deletes related time_slot_bookings
```

## 🧪 Testing Checklist

### ✅ Setup
- [ ] `npm install` completed
- [ ] SQL schema run in Supabase
- [ ] Realtime enabled for all 3 tables
- [ ] Dev server starts without errors

### ✅ Conflict Prevention
- [ ] Booking a time slot removes it from dropdown
- [ ] Overlapping times don't appear in dropdown
- [ ] Non-overlapping times can be booked on same date
- [ ] Same-day bookings gray out entire day

### ✅ Real-Time Sync
- [ ] Open on two devices
- [ ] Book on Device A
- [ ] Device B updates within 1-2 seconds

### ✅ Error Handling
- [ ] Trying to book taken slot shows error
- [ ] Error message is user-friendly
- [ ] Can refresh and try again

## 🐛 Troubleshooting Commands

### Check if Supabase is connected
```typescript
// In browser console (F12)
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
```

### Check if tables exist
```sql
-- In Supabase SQL Editor
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

### View table structure
```sql
-- In Supabase SQL Editor
\d bookings
\d unavailable_dates
\d time_slot_bookings
```

### Test conflict detection
```sql
-- Try to insert duplicate (should fail)
INSERT INTO time_slot_bookings (date_iso, start_min, end_min)
VALUES ('2025-10-15', 930, 990);

-- Try again (should fail with unique constraint violation)
INSERT INTO time_slot_bookings (date_iso, start_min, end_min)
VALUES ('2025-10-15', 930, 990);
```

## 📱 Employee Mode

**Access Code:** `1123`

**Features:**
- View all bookings for selected date
- Mark dates unavailable (blocks entire day)
- Make dates available again
- See customer details
- View time slots booked

**Common Actions:**
1. Mark vacation days unavailable
2. View bookings for upcoming dates
3. Check customer contact info
4. Export booking data (from Supabase Table Editor)

## 🎯 Key Concepts

### Time Slot Format
| Display | Minutes | Calculation |
|---------|---------|-------------|
| 12:00 PM | 720 | 12 × 60 |
| 3:30 PM | 930 | 15.5 × 60 |
| 4:00 PM | 960 | 16 × 60 |
| 4:30 PM | 990 | 16.5 × 60 |
| 5:30 PM | 1050 | 17.5 × 60 |

### Overlap Detection
Two slots overlap if:
```
(start1 < end2) AND (end1 > start2)
```

Example:
- Slot A: 930-990 (3:30-4:30 PM)
- Slot B: 960-1020 (4:00-5:00 PM)
- Check: (930 < 1020) AND (990 > 960) = **TRUE** → Overlap!

### Same-Day vs Future
- **Same-day:** Any booking blocks entire day
- **Future:** Multiple bookings allowed if no overlap

## 🚨 Common Errors & Fixes

### Error: "Cannot find module '@supabase/supabase-js'"
**Fix:** `npm install`

### Error: "relation public.bookings does not exist"
**Fix:** Run `supabase_schema.sql` in Supabase SQL Editor

### Error: "duplicate key value violates unique constraint"
**Good!** Double-booking prevention is working. Refresh and try different time.

### No real-time sync
**Fix:** Enable Realtime in Supabase → Database → Replication

### Dropdown still shows booked slot
**Fix:** Wait 1-2 seconds, or hard refresh (Ctrl+Shift+R)

## 📂 Project Structure

```
TAS Online/
├── src/
│   ├── App.tsx ⭐ (Main app with conflict detection)
│   ├── supabaseClient.ts (Database connection)
│   └── ...
├── supabase_schema.sql ⭐ (Database schema)
├── .env (Supabase credentials)
├── NEXT_STEPS.md ⭐ (Start here!)
├── SUPABASE_SETUP.md (Database setup)
├── BOOKING_SYSTEM.md (Technical docs)
├── IMPLEMENTATION_SUMMARY.md (What was built)
└── QUICK_REFERENCE.md (This file)
```

⭐ = Most important files

## 🎓 Learning Path

1. **First Time Setup:**
   - Read `NEXT_STEPS.md`
   - Follow steps 1-5
   - Test the system

2. **Understanding the System:**
   - Read `BOOKING_SYSTEM.md`
   - Review `src/App.tsx` code
   - Study `supabase_schema.sql`

3. **Troubleshooting:**
   - Check `SETUP_INSTRUCTIONS.md`
   - Look at browser console (F12)
   - Review Supabase logs

4. **Customization:**
   - Modify time windows in `App.tsx`
   - Adjust prices
   - Change employee code
   - Add new features

## 💡 Pro Tips

- **Browser console (F12)** shows detailed error messages
- **Supabase Table Editor** lets you view/edit data manually
- **Hard refresh (Ctrl+Shift+R)** fixes most caching issues
- **Real-time updates** take 1-2 seconds, be patient
- **Database constraint** is your final safety net

## 🔗 Quick Links

- **Supabase Dashboard:** https://app.supabase.com
- **Your Project:** Check `.env` for URL
- **SQL Editor:** Dashboard → SQL Editor
- **Table Editor:** Dashboard → Table Editor
- **Realtime:** Dashboard → Database → Replication

---

**Need help?** See `NEXT_STEPS.md` for troubleshooting or `BOOKING_SYSTEM.md` for technical details.

