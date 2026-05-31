import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

/**
 * Admin client — uses the service/secret key, bypasses RLS. SERVER ONLY
 * (route handlers, node scripts). Never import this into a client component.
 */
export function createAdminClient(): SupabaseClient {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !key) {
    throw new Error(
      "Missing Supabase admin env: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) in .env.local",
    );
  }
  return createClient(URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
