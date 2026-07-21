import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  Constants.expoConfig?.extra?.supabaseUrl ??
  '';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  Constants.expoConfig?.extra?.supabaseAnonKey ??
  '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export type WorkoutSession = {
  id: string;
  device_id: string;
  started_at: string;
  ended_at: string | null;
  total_reps: number;
  valid_reps: number;
  invalid_reps: number;
  average_form_score: number | null;
};

export type RepRecord = {
  id: string;
  session_id: string;
  rep_number: number;
  is_valid: boolean;
  form_score: number;
  invalid_reason: string | null;
  elbow_angle: number | null;
  body_straightness: number | null;
  recorded_at: string;
};
