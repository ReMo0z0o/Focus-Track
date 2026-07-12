import { createMiddleware } from '@tanstack/react-start'
import {
  getRequestHeader,
  setResponseHeader,
  setResponseStatus,
} from '@tanstack/react-start/server'
import { createClient } from '@supabase/supabase-js'
import {
  supabase as browserSupabase,
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
} from '@/integrations/supabase/client'
import type { Database } from '@/integrations/supabase/types'

/**
 * Server-function middleware that enforces Supabase authentication.
 *
 * Client phase: attaches the current session's access token as a Bearer header.
 * Server phase: verifies the token with Supabase Auth and provides an
 * RLS-scoped Supabase client (`context.supabase`) plus the verified
 * `context.user`. Row Level Security applies to every query made with it.
 */
export const requireSupabaseAuth = createMiddleware({ type: 'function' })
  .client(async ({ next }) => {
    let token: string | undefined
    if (typeof window !== 'undefined') {
      const { data } = await browserSupabase.auth.getSession()
      token = data.session?.access_token
    }
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  })
  .server(async ({ next }) => {
    // Every response behind this middleware is per-user: make sure no
    // misconfigured shared cache ever stores it.
    setResponseHeader('Cache-Control', 'no-store')
    const header = getRequestHeader('Authorization')
    const token = header?.match(/^Bearer\s+(.+)$/i)?.[1]
    if (!token) {
      setResponseStatus(401)
      throw new Error('Unauthorized: missing access token')
    }

    // A per-request client carrying the user's JWT so PostgREST enforces RLS.
    const supabase = createClient<Database>(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    )

    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) {
      setResponseStatus(401)
      throw new Error('Unauthorized: invalid or expired session')
    }

    return next({ context: { supabase, user: data.user } })
  })
