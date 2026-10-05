import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Environment variables remain the preferred override for other deployments.
// The defaults below point this SalesShop prototype at its dedicated Supabase
// project. Supabase publishable keys are designed to be used in browser clients;
// authorization is enforced by Postgres RLS, never by keeping this key secret.
const DEFAULT_SUPABASE_URL = 'https://pvchgibllozuwickhfqz.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_lq79tQrf8RDCkGVv0powYQ_y9sfzRy7';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL;
const supabaseKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  ?? import.meta.env.VITE_SUPABASE_ANON_KEY
)?.trim() || DEFAULT_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
