import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isDeveloperPlaygroundRoute } from './developerPlayground';

// Environment variables remain the preferred override for other deployments.
// The defaults below point this SalesShop prototype at its dedicated Supabase
// project. Supabase publishable keys are designed to be used in browser clients;
// authorization is enforced by Postgres RLS, never by keeping this key secret.
// Browser-only visual QC may use a local-only workspace without contacting
// the live Supabase project. Never permit this override in a production build.
const localVisualQc = import.meta.env.DEV && import.meta.env.VITE_SALES_SHOP_LOCAL_QC === '1';

const DEFAULT_SUPABASE_URL = 'https://pvchgibllozuwickhfqz.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_lq79tQrf8RDCkGVv0powYQ_y9sfzRy7';

/** The Playground never constructs the customer-data Supabase client.
 * Only the separate Auth/RPC gate below may contact the identity service. */
export const developerPlaygroundActive = isDeveloperPlaygroundRoute();
const productionUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL;
const productionKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  ?? import.meta.env.VITE_SUPABASE_ANON_KEY
)?.trim() || DEFAULT_SUPABASE_PUBLISHABLE_KEY;
export const supabaseUrl = localVisualQc || developerPlaygroundActive ? '' : productionUrl;
export const supabaseKey = localVisualQc || developerPlaygroundActive ? '' : productionKey;

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

/** Only for verified Developer Playground entry. Never export this client to
 * tenant stores or UI; those use `supabase`, which is null in this route. */
export const playgroundIdentityClient: SupabaseClient | null = developerPlaygroundActive && !localVisualQc
  ? createClient(productionUrl, productionKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null;
