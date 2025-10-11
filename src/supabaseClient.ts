import { createClient } from '@supabase/supabase-js';

// Replace these with your Supabase project credentials
// Get them from: https://app.supabase.com/project/_/settings/api
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

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

