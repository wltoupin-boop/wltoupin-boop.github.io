import { createClient } from '@supabase/supabase-js';

// Supabase project credentials
// These are public values safe to include in the client-side build
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://nusnquvsugwnahlurgyo.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51c25xdXZzdWd3bmFobHVyZ3lvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjA5MzAsImV4cCI6MjA3NTUzNjkzMH0.NT0-RfZx1yyFbEJTCnwPjeCfIOn6M-Yf0d4ANT2oZkQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export type Database = {
  public: {
    Tables: {
      bookings: {
        Row: {
          id: string;
          date_iso: string;
          choice: any;
          customer: any;
          created_at: string;
        };
        Insert: {
          id?: string;
          date_iso: string;
          choice: any;
          customer: any;
          created_at?: string;
        };
        Update: {
          id?: string;
          date_iso?: string;
          choice?: any;
          customer?: any;
          created_at?: string;
        };
      };
      unavailable_dates: {
        Row: {
          date_iso: string;
          created_at: string;
        };
        Insert: {
          date_iso: string;
          created_at?: string;
        };
        Update: {
          date_iso?: string;
          created_at?: string;
        };
      };
    };
  };
};

