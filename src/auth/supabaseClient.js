/**
 * Browser Supabase client — only when VITE_SUPABASE_URL + publishable/anon present.
 * Never imports server secret keys. Safe to import without env (returns null).
 */

import { createClient } from '@supabase/supabase-js';

/** @type {import('@supabase/supabase-js').SupabaseClient | null | undefined} */
let cached;

/**
 * @returns {boolean}
 */
export function isSupabaseConfigured() {
  const url = import.meta.env?.VITE_SUPABASE_URL;
  const key =
    import.meta.env?.VITE_SUPABASE_ANON_KEY ||
    import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;
  return Boolean(url && key);
}

/**
 * @returns {import('@supabase/supabase-js').SupabaseClient | null}
 */
export function getSupabaseClient() {
  if (cached !== undefined) return cached;
  const url = import.meta.env?.VITE_SUPABASE_URL;
  const key =
    import.meta.env?.VITE_SUPABASE_ANON_KEY ||
    import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    cached = null;
    return null;
  }
  cached = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return cached;
}

/** Test helper — reset singleton. */
export function __resetSupabaseClientForTests() {
  cached = undefined;
}
