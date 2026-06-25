import { createClient } from "@supabase/supabase-js";

// Browser Supabase client. Uses the publishable key (safe to ship to the
// client — Row Level Security protects the data). Configured at build time via
// Vite env vars (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
  | string
  | undefined;

export const isSupabaseConfigured = Boolean(url && publishableKey);

if (!isSupabaseConfigured) {
  // Surfaced loudly in dev; in prod the auth UI will show a configuration error.
  console.warn(
    "Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY."
  );
}

export const supabase = createClient(url ?? "http://localhost", publishableKey ?? "public-anon-key", {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    flowType: "pkce",
  },
});
