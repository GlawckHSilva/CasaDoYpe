import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

const isValidSupabaseUrl = (value) => /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(value || '');
const isPlaceholderValue = (value) => /seu-projeto|sua-chave|your-project|your-key/i.test(value || '');

export const supabaseConfig = {
  hasUrl: Boolean(supabaseUrl),
  hasAnonKey: Boolean(supabaseAnonKey),
  hasValidUrl: isValidSupabaseUrl(supabaseUrl),
  isPlaceholder: isPlaceholderValue(supabaseUrl) || isPlaceholderValue(supabaseAnonKey),
};

export const hasSupabaseConfig =
  supabaseConfig.hasUrl &&
  supabaseConfig.hasAnonKey &&
  supabaseConfig.hasValidUrl &&
  !supabaseConfig.isPlaceholder;

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    })
  : null;
