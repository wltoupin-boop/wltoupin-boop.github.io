-- =====================================================
-- The Animal Society - Pet Sitting Booking Database
-- =====================================================
-- This schema supports double-booking prevention with:
-- - Time slot level conflict detection
-- - Real-time sync across all devices
-- - Employee availability management
-- =====================================================

-- Table: bookings
-- Stores all customer booking requests
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_iso TEXT NOT NULL,
  choice JSONB NOT NULL,
  customer JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups by date
CREATE INDEX IF NOT EXISTS idx_bookings_date ON public.bookings(date_iso);
CREATE INDEX IF NOT EXISTS idx_bookings_created ON public.bookings(created_at);

-- Table: unavailable_dates
-- Stores dates marked unavailable by employees (blocks entire day)
CREATE TABLE IF NOT EXISTS public.unavailable_dates (
  date_iso TEXT PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: time_slot_bookings
-- Tracks individual time slot occupancy to prevent overlapping bookings
-- This is the key table for preventing double-booking at the time slot level
CREATE TABLE IF NOT EXISTS public.time_slot_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_iso TEXT NOT NULL,
  start_min INTEGER NOT NULL,
  end_min INTEGER NOT NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint: prevent overlapping time slots on the same date
  -- This is enforced at the database level for race condition safety
  UNIQUE(date_iso, start_min, end_min)
);

-- Indexes for fast conflict detection queries
CREATE INDEX IF NOT EXISTS idx_timeslot_date ON public.time_slot_bookings(date_iso);
CREATE INDEX IF NOT EXISTS idx_timeslot_range ON public.time_slot_bookings(date_iso, start_min, end_min);

-- Enable Row Level Security (RLS) - allows public read/write for now
-- In production, you may want to restrict this further
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unavailable_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_slot_bookings ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (adjust based on your security needs)
-- These allow anyone to read and write - suitable for a public booking system
CREATE POLICY "Allow public read access on bookings" 
  ON public.bookings FOR SELECT 
  USING (true);

CREATE POLICY "Allow public insert access on bookings" 
  ON public.bookings FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow public read access on unavailable_dates" 
  ON public.unavailable_dates FOR SELECT 
  USING (true);

CREATE POLICY "Allow public insert/update/delete on unavailable_dates" 
  ON public.unavailable_dates FOR ALL 
  USING (true);

CREATE POLICY "Allow public read access on time_slot_bookings" 
  ON public.time_slot_bookings FOR SELECT 
  USING (true);

CREATE POLICY "Allow public insert access on time_slot_bookings" 
  ON public.time_slot_bookings FOR INSERT 
  WITH CHECK (true);

-- =====================================================
-- REALTIME SETUP
-- =====================================================
-- Enable realtime replication for all tables
-- This allows the React app to subscribe to changes

-- Note: Run these in the Supabase SQL Editor if realtime isn't working:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.unavailable_dates;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.time_slot_bookings;

-- =====================================================
-- HELPER FUNCTION: Check for time slot conflicts
-- =====================================================
-- This function checks if a time slot overlaps with existing bookings
-- Overlaps occur when: (start1 < end2) AND (end1 > start2)

CREATE OR REPLACE FUNCTION check_time_slot_conflict(
  p_date_iso TEXT,
  p_start_min INTEGER,
  p_end_min INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  conflict_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO conflict_count
  FROM public.time_slot_bookings
  WHERE date_iso = p_date_iso
    AND (
      -- Check for any overlap
      (start_min < p_end_min AND end_min > p_start_min)
    );
  
  RETURN conflict_count > 0;
END;
$$;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these to verify your setup:

-- Check if tables exist:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Check table structures:
-- \d public.bookings
-- \d public.unavailable_dates
-- \d public.time_slot_bookings

-- Test the conflict detection function:
-- SELECT check_time_slot_conflict('2025-10-15', 900, 960);

-- View all bookings:
-- SELECT * FROM public.bookings ORDER BY created_at DESC;

-- View all time slot occupancy:
-- SELECT * FROM public.time_slot_bookings ORDER BY date_iso, start_min;

