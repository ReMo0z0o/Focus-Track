import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

/**
 * Normalize a pasted Supabase URL to the bare project origin.
 * The dashboard sometimes shows the REST endpoint
 * (`https://xyz.supabase.co/rest/v1/`); supabase-js wants just
 * `https://xyz.supabase.co`, so strip any trailing path/slash.
 */
function normalizeSupabaseUrl(raw: string | undefined): string {
  if (!raw) return 'https://placeholder.supabase.co'
  const trimmed = raw.trim()
  try {
    return new URL(trimmed).origin
  } catch {
    // Not a full URL — best-effort cleanup of a trailing /rest/v1 or slash.
    return trimmed.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '')
  }
}

export const SUPABASE_URL = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL)

export const SUPABASE_PUBLISHABLE_KEY = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'placeholder-key'
)
  .trim()
  // Strip surrounding quotes if the value was pasted with them.
  .replace(/^['"]|['"]$/g, '')

if (
  (!import.meta.env.VITE_SUPABASE_URL ||
    (!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY &&
      !import.meta.env.VITE_SUPABASE_ANON_KEY)) &&
  typeof window !== 'undefined'
) {
  console.warn(
    '[FocusGuard] Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY — auth and data calls will fail. Copy .env.example to .env and fill it in.',
  )
}

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      persistSession: typeof window !== 'undefined',
      autoRefreshToken: typeof window !== 'undefined',
      detectSessionInUrl: typeof window !== 'undefined',
    },
  },
)
