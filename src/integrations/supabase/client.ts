import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://placeholder.supabase.co'

export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'placeholder-key'

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
