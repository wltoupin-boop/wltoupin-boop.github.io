# Booking System Architecture

This document explains how The Animal Society's double-booking prevention system works.

## Overview

The booking system uses **Supabase** (PostgreSQL) as a backend with **real-time synchronization** to prevent double-booking across all devices. The system handles two distinct scenarios:

1. **Same-day bookings**: Entire day is blocked once booked
2. **Future bookings**: Multiple bookings allowed per day, but time slots cannot overlap

## Database Schema

### Tables

#### 1. `bookings`
Stores all customer booking requests.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key (auto-generated) |
| date_iso | TEXT | Date in YYYY-MM-DD format |
| choice | JSONB | Booking details (kind, startMin, endMin, price) |
| customer | JSONB | Customer info (name, email, phone, pets, notes) |
| created_at | TIMESTAMP | When booking was created |

**Indexes:**
- `idx_bookings_date` on `date_iso` for fast date lookups
- `idx_bookings_created` on `created_at` for chronological sorting

#### 2. `unavailable_dates`
Stores dates marked unavailable by employees or same-day bookings.

| Column | Type | Description |
|--------|------|-------------|
| date_iso | TEXT | Date in YYYY-MM-DD format (PRIMARY KEY) |
| created_at | TIMESTAMP | When marked unavailable |

**Purpose:** Blocks entire day from customer bookings.

#### 3. `time_slot_bookings`
Tracks individual time slot occupancy to prevent overlaps.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key (auto-generated) |
| date_iso | TEXT | Date in YYYY-MM-DD format |
| start_min | INTEGER | Start time in minutes since midnight (e.g., 930 = 3:30 PM) |
| end_min | INTEGER | End time in minutes since midnight (e.g., 990 = 4:30 PM) |
| booking_id | UUID | Foreign key to bookings table |
| created_at | TIMESTAMP | When slot was booked |

**Constraints:**
- `UNIQUE(date_iso, start_min, end_min)` - Prevents exact duplicate time slots
- Foreign key cascade delete - Removes time slots when booking is deleted

**Indexes:**
- `idx_timeslot_date` on `date_iso`
- `idx_timeslot_range` on `(date_iso, start_min, end_min)` for fast conflict detection

## Conflict Detection Logic

### Overlap Algorithm

Two time slots overlap if:
```
(start1 < end2) AND (end1 > start2)
```

**Examples:**

✅ **No Overlap:**
- Slot A: 3:30 PM - 4:30 PM (930-990)
- Slot B: 4:30 PM - 5:30 PM (990-1050)
- Check: (930 < 1050) AND (990 > 990) = FALSE

❌ **Overlap:**
- Slot A: 3:30 PM - 4:30 PM (930-990)
- Slot B: 4:00 PM - 5:00 PM (960-1020)
- Check: (930 < 1020) AND (990 > 960) = TRUE

### Frontend Validation (App.tsx)

**Step 1: Pre-submission Check**
```typescript
checkTimeSlotConflict(dateISO, startMin, endMin)
```
- Queries loaded `bookedTimeSlots` array
- Checks for overlaps using the overlap algorithm
- Shows error alert if conflict found
- **Prevents unnecessary database calls**

**Step 2: UI Filtering**
```typescript
getBookedSlotsForDate(dateISO)
```
- Filters `bookedTimeSlots` by date
- Passes to `BookingSidebar` component
- Removes conflicting slots from dropdown
- Shows "All slots booked" warning if none available

### Backend Validation (Database)

**Step 3: Unique Constraint**
```sql
UNIQUE(date_iso, start_min, end_min)
```
- Final safety net at database level
- Prevents race conditions (two users booking simultaneously)
- Returns error code `23505` if conflict
- App catches this and shows user-friendly message

### Database Helper Function

```sql
check_time_slot_conflict(p_date_iso, p_start_min, p_end_min)
```
- Can be called from SQL queries
- Returns TRUE if conflict exists
- Useful for manual database operations

## Booking Flow

### Customer Books a Date

1. **Customer selects date** on calendar
2. **App loads booked slots** for that date via `getBookedSlotsForDate()`
3. **UI filters dropdown** to show only available times
4. **Customer selects time** and clicks "Add to request"
5. **Customer fills form** and clicks "Submit Request"
6. **App validates slots** (frontend check)
   - If conflict: Show error, stop
   - If clear: Continue
7. **App inserts booking** to `bookings` table
8. **App gets booking ID** from insert response
9. **App inserts time slot** to `time_slot_bookings` table
   - If unique constraint violation: Show error, rollback
   - If success: Continue
10. **If same-day booking:** Add to `unavailable_dates` table
11. **App refreshes data** from database
12. **Real-time sync broadcasts** to all connected devices

### Real-Time Synchronization

**Supabase Realtime** broadcasts changes to all connected clients.

**App subscriptions:**
```typescript
supabase.channel('bookings-changes')
  .on('postgres_changes', { table: 'bookings' }, loadBookings)

supabase.channel('timeslots-changes')
  .on('postgres_changes', { table: 'time_slot_bookings' }, loadTimeSlots)

supabase.channel('unavailable-changes')
  .on('postgres_changes', { table: 'unavailable_dates' }, loadUnavailableDates)
```

**When a booking is made:**
1. Database insert completes
2. Supabase broadcasts change event
3. All connected devices receive notification
4. Apps automatically call `loadTimeSlots()`
5. UI updates with new booked slots
6. Dropdowns filter out newly booked times

**Result:** All users see updated availability in real-time! ✨

## Same-Day vs Future Bookings

### Same-Day Bookings

**Rule:** If someone books ANY time slot for today, the entire day becomes unavailable.

**Why?**
- Same-day bookings need immediate confirmation
- Pet sitter may already be on the way
- Prevents confusion about what times are still available

**Implementation:**
```typescript
// Check if booking is same-day
if (isSameDate(date, today)) {
  // Check if ANY bookings exist for this date
  const dayHasBookings = bookedTimeSlots.some(slot => slot.dateISO === dateISO);
  if (dayHasBookings) {
    // Block entire day
    showError();
  }
}
```

**Database:**
- Date is added to `unavailable_dates` table
- Calendar shows date as unavailable (grayed out)
- Customers cannot select this date

### Future Bookings

**Rule:** Multiple bookings allowed per day, but time slots cannot overlap.

**Example:**
- Customer A books: Oct 15, 3:30-4:30 PM ✅
- Customer B books: Oct 15, 4:30-5:30 PM ✅ (No overlap)
- Customer C books: Oct 15, 4:00-5:00 PM ❌ (Overlaps with Customer A)

**Implementation:**
- UI shows only non-overlapping slots in dropdown
- Database constraint prevents conflicts
- Multiple non-conflicting bookings on same date are fine

## Race Condition Handling

**Scenario:** Two users try to book the same time slot simultaneously.

### Defense Layers

**Layer 1: Frontend Check**
- User A loads available slots: [3:30-4:30, 4:30-5:30]
- User B loads available slots: [3:30-4:30, 4:30-5:30]
- Both see slot as available

**Layer 2: Pre-Submit Validation**
- User A clicks submit, app checks `bookedTimeSlots`
- User B clicks submit, app checks `bookedTimeSlots`
- If A's booking hasn't synced yet, B's app still thinks it's free

**Layer 3: Database Unique Constraint** ⭐
- User A's insert succeeds
- Database creates `time_slot_bookings` entry
- User B's insert attempts same slot
- Database rejects with error code `23505`
- App catches error and shows message:
  ```
  "Sorry, one of those time slots was just booked by someone else. 
   Please refresh and try again."
  ```

**Layer 4: Real-Time Refresh**
- User A's booking broadcasts to all devices
- User B's app receives update
- User B's dropdown refreshes, slot disappears
- Problem resolved for future attempts

### Why This Works

1. **PostgreSQL transactions** ensure atomic operations
2. **Unique constraint** is enforced at lowest level (cannot be bypassed)
3. **Real-time sync** prevents subsequent attempts
4. **User-friendly errors** explain what happened

## Time Representation

### Format: Minutes Since Midnight

Time slots use **minutes since midnight** for easy calculation:

| Time | Minutes | Calculation |
|------|---------|-------------|
| 12:00 PM | 720 | 12 × 60 |
| 3:30 PM | 930 | 15.5 × 60 |
| 4:00 PM | 960 | 16 × 60 |
| 4:30 PM | 990 | 16.5 × 60 |
| 5:30 PM | 1050 | 17.5 × 60 |

### Bundle Windows

**Weekday Bundle:**
- Window: 3:30 PM - 5:30 PM (930-1050 minutes)
- Duration: 1 hour per booking
- Slots generated in 30-minute increments:
  - 3:30-4:30 PM (930-990)
  - 4:00-4:00 PM (960-1020)
  - 4:30-5:30 PM (990-1050)
  - etc.

**Weekend Bundle:**
- Window: 12:00 PM - 5:30 PM (720-1050 minutes)
- Duration: 1 hour per booking
- More slots available due to longer window

### Display Format

Internal: `930` → Display: `"3:30 PM"`

```typescript
function minutesToLabel(mins: number) {
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}
```

## Employee Mode

### Marking Dates Unavailable

**Purpose:** Block dates when pet sitter is unavailable (vacation, holidays, etc.)

**Actions:**
1. Employee clicks date on calendar
2. Clicks "Mark Unavailable" button
3. Date is added to `unavailable_dates` table
4. Real-time sync broadcasts change
5. Date becomes unavailable on all devices
6. Customers see date grayed out (cannot select)

**Database:**
```sql
INSERT INTO unavailable_dates (date_iso) VALUES ('2025-10-15')
ON CONFLICT (date_iso) DO NOTHING;
```

**Reversal:**
```sql
DELETE FROM unavailable_dates WHERE date_iso = '2025-10-15';
```

### Viewing Bookings

**Employee mode shows:**
- All bookings for selected date
- Customer details (name, email, phone)
- Pet information
- Time slots booked
- Booking type (weekday/weekend/pet sitting)
- Submission timestamp

**Data source:** `bookings` table filtered by `date_iso`

## Testing

### Test Double-Booking Prevention

**Manual Test:**
1. Open app on Device A (computer)
2. Open app on Device B (phone)
3. On Device A: Select Oct 15, choose 3:30-4:30 PM, submit
4. On Device B: Select Oct 15, try to book 3:30-4:30 PM
5. **Expected:** Device B's dropdown should not show 3:30-4:30 PM
6. **If it does:** Wait for real-time sync (~1-2 seconds), refresh

**Race Condition Test:**
1. Turn off WiFi on Device A
2. Device A: Select Oct 15, 3:30-4:30 PM, click submit (will queue)
3. Device B: Select Oct 15, 3:30-4:30 PM, click submit (will succeed)
4. Turn on WiFi on Device A
5. Device A tries to submit
6. **Expected:** Database rejects, shows error message

### Test Same-Day Blocking

1. Book any time slot for today
2. Try to book another time slot for today
3. **Expected:** Entire day should be grayed out/unavailable

### Test Real-Time Sync

1. Open app on two devices
2. Book a slot on Device A
3. **Expected:** Within 1-2 seconds, Device B shows slot as unavailable
4. Employee marks date unavailable on Device A
5. **Expected:** Device B shows date grayed out

## Troubleshooting

### Slots not filtering

**Symptom:** Already-booked slots still appear in dropdown

**Fixes:**
1. Check browser console for errors
2. Verify `time_slot_bookings` table exists in Supabase
3. Check Realtime is enabled for `time_slot_bookings` table
4. Hard refresh (Ctrl+Shift+R)

### Database constraint violations

**Symptom:** Error "duplicate key value violates unique constraint"

**This is good!** It means double-booking prevention is working.

**User sees:** "Sorry, one of those time slots was just booked by someone else."

**Solution:** Refresh page and select different time

### Real-time not working

**Symptom:** Changes on one device don't appear on another

**Fixes:**
1. Verify Realtime is enabled in Supabase dashboard:
   - Go to Database → Replication
   - Enable `bookings`, `unavailable_dates`, `time_slot_bookings`
2. Check browser console for Supabase connection errors
3. Verify `.env` credentials are correct
4. Restart dev server: `Ctrl+C` then `npm run dev`

### All slots showing as unavailable

**Symptom:** "All time slots are booked" message, but nothing is booked

**Possible causes:**
1. Date is in `unavailable_dates` (check Employee Mode)
2. Stale data in `time_slot_bookings` table
3. Time zone mismatch

**Fixes:**
1. Check Supabase Table Editor → View `time_slot_bookings`
2. Delete invalid entries manually if needed
3. Employee Mode → Make date available

## Security Considerations

### Current Setup: Public Access

**Row Level Security (RLS):** Enabled with public policies

**Allows:**
- Anyone can read bookings
- Anyone can insert bookings
- Anyone can manage unavailable dates

**Suitable for:** Public booking forms where customers need to submit requests

### Production Hardening (Optional)

Consider adding:

1. **Rate limiting:** Prevent spam bookings
   ```sql
   -- Limit to 5 bookings per IP per hour
   ```

2. **Captcha:** Verify human users (reCAPTCHA, hCaptcha)

3. **Email verification:** Confirm bookings before finalizing

4. **Admin-only delete:**
   ```sql
   CREATE POLICY "Only admins can delete bookings"
   ON bookings FOR DELETE
   USING (auth.jwt() ->> 'role' = 'admin');
   ```

5. **Audit logging:** Track who made changes and when

### Data Privacy

**Stored data:**
- Customer names, emails, phone numbers
- Pet information
- Booking notes

**Compliance:**
- Ensure you have a privacy policy
- Only collect necessary information
- Provide way for customers to request data deletion
- Comply with GDPR/CCPA if applicable

## Maintenance

### Viewing All Bookings

**Supabase Dashboard:**
1. Go to Table Editor
2. Select `bookings` table
3. View all customer booking requests
4. Export as CSV for records

### Deleting Old Bookings

**SQL query:**
```sql
DELETE FROM bookings
WHERE date_iso < '2025-01-01';
-- Note: CASCADE will auto-delete related time_slot_bookings
```

### Monitoring

**Check for conflicts:**
```sql
-- Find dates with multiple overlapping bookings
SELECT date_iso, start_min, end_min, COUNT(*) as count
FROM time_slot_bookings
GROUP BY date_iso, start_min, end_min
HAVING COUNT(*) > 1;
-- Should return 0 rows (constraint prevents this)
```

**View busiest dates:**
```sql
SELECT date_iso, COUNT(*) as booking_count
FROM time_slot_bookings
GROUP BY date_iso
ORDER BY booking_count DESC
LIMIT 10;
```

## Summary

### How Double-Booking Prevention Works

1. **Real-time data sync** keeps all devices updated
2. **Frontend filtering** removes booked slots from UI
3. **Database constraints** prevent conflicts at lowest level
4. **Three layers of defense** handle race conditions
5. **Same-day blocking** ensures immediate availability clarity
6. **Future date flexibility** allows multiple non-overlapping bookings

### Key Technologies

- **Supabase:** PostgreSQL database with real-time subscriptions
- **React:** Frontend UI with instant updates
- **TypeScript:** Type-safe booking logic
- **Tailwind CSS:** Responsive design for all devices

---

**Questions?** Check `SUPABASE_SETUP.md` for setup instructions or browser console for error messages.

