import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client (publishable key, subject to RLS — read-only here). Available
 * for client-side Supabase access if needed; the semantic-search UI itself goes
 * through the /api/semantic-search route handler because the query must be
 * embedded server-side (the model is too large to ship to the browser).
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
