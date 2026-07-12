import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/lib/supabase-auth'
import type { SessionRow } from '@/lib/stats'

const RECENT_WINDOW_DAYS = 60
const RECENT_LIMIT = 1000

function asNonNegativeInt(value: unknown, field: string): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Invalid ${field}`)
  }
  return Math.floor(n)
}

function asUuid(value: unknown, field: string): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new Error(`Invalid ${field}`)
  }
  return value
}

/** Insert a new focus session and return its id + server-side start time. */
export const startSession = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from('focus_sessions')
      .insert({ user_id: context.user.id })
      .select('id, started_at')
      .single()
    if (error) throw new Error(error.message)
    return data
  })

/** Close a session with its final counters. */
export const endSession = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      id: string
      focus_seconds: number
      idle_seconds: number
      resumes_count: number
    }) => ({
      id: asUuid(input.id, 'session id'),
      focus_seconds: asNonNegativeInt(input.focus_seconds, 'focus_seconds'),
      idle_seconds: asNonNegativeInt(input.idle_seconds, 'idle_seconds'),
      resumes_count: asNonNegativeInt(input.resumes_count, 'resumes_count'),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from('focus_sessions')
      .update({
        ended_at: new Date().toISOString(),
        focus_seconds: data.focus_seconds,
        idle_seconds: data.idle_seconds,
        resumes_count: data.resumes_count,
      })
      .eq('id', data.id)
      .eq('user_id', context.user.id)
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    return row
  })

/** Last 1000 sessions within the last 60 days, newest first. */
export const getRecentSessions = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SessionRow[]> => {
    const since = new Date(
      Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString()
    const { data, error } = await context.supabase
      .from('focus_sessions')
      .select('id, started_at, ended_at, focus_seconds, idle_seconds, resumes_count')
      .gte('started_at', since)
      .order('started_at', { ascending: false })
      .limit(RECENT_LIMIT)
    if (error) throw new Error(error.message)
    return data
  })

/** Delete one of the caller's sessions. */
export const deleteSession = createServerFn({ method: 'POST' })
  .validator((input: { id: string }) => ({ id: asUuid(input.id, 'session id') }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from('focus_sessions')
      .delete()
      .eq('id', data.id)
      .eq('user_id', context.user.id)
    if (error) throw new Error(error.message)
    return { success: true }
  })

/** Current user's profile settings. */
export const getProfile = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from('profiles')
      .select('display_name, idle_threshold_seconds, sound_enabled')
      .eq('id', context.user.id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    // The signup trigger creates the row; fall back to defaults if it is
    // missing (e.g. user predates the trigger).
    return (
      data ?? {
        display_name: null,
        idle_threshold_seconds: 120,
        sound_enabled: true,
      }
    )
  })

/** Update profile settings (partial). */
export const updateProfile = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      display_name?: string | null
      idle_threshold_seconds?: number
      sound_enabled?: boolean
    }) => {
      const out: {
        display_name?: string | null
        idle_threshold_seconds?: number
        sound_enabled?: boolean
      } = {}
      if ('display_name' in input) {
        const name =
          typeof input.display_name === 'string'
            ? input.display_name.trim().slice(0, 80)
            : null
        out.display_name = name || null
      }
      if (input.idle_threshold_seconds !== undefined) {
        const t = asNonNegativeInt(
          input.idle_threshold_seconds,
          'idle_threshold_seconds',
        )
        out.idle_threshold_seconds = Math.min(900, Math.max(60, t))
      }
      if (input.sound_enabled !== undefined) {
        out.sound_enabled = Boolean(input.sound_enabled)
      }
      return out
    },
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    if (Object.keys(data).length === 0) return { success: true }
    const { error } = await context.supabase
      .from('profiles')
      .upsert({ id: context.user.id, ...data })
    if (error) throw new Error(error.message)
    return { success: true }
  })
