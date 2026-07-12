import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/lib/supabase-auth'
import type { SessionRow } from '@/lib/stats'

const RECENT_WINDOW_DAYS = 60
const RECENT_LIMIT = 1000
/** Sanity ceiling for session counters (90 days in seconds) — keeps absurd
 * client values out and stays far below the int4 range. */
const MAX_COUNTER = 90 * 24 * 60 * 60

function asNonNegativeInt(value: unknown, field: string): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Invalid ${field}`)
  }
  return Math.min(MAX_COUNTER, Math.floor(n))
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
      // Explicit owner filter: RLS also lets accepted friends read rows, so
      // "my stats" must never rely on RLS alone to scope this query.
      .eq('user_id', context.user.id)
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
    // select('*') keeps this tolerant of databases that haven't run the
    // latest migration yet — missing columns simply fall back to defaults.
    const { data, error } = await context.supabase
      .from('profiles')
      .select('*')
      .eq('id', context.user.id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    const row = data as
      | (typeof data & { display_name?: string | null; username?: string })
      | null
    return {
      // Tolerate a pre-migration DB where the column is still display_name.
      username: row?.username ?? row?.display_name ?? null,
      idle_threshold_seconds: row?.idle_threshold_seconds ?? 120,
      sound_enabled: row?.sound_enabled ?? true,
      theme: row?.theme ?? 'amber',
      avatar: row?.avatar ?? 'spark',
      milestones: (row?.milestones ?? {}) as Record<string, number>,
    }
  })

const MILESTONE_FIELDS = ['grade', 'streak', 'sessions', 'concTier', 'ratioTier'] as const

function asToken(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^[a-z0-9-]{1,40}$/.test(value)) {
    throw new Error(`Invalid ${field}`)
  }
  return value
}

export const USERNAME_PATTERN = /^[a-z0-9_.-]{3,24}$/

/** Update profile settings (partial). */
export const updateProfile = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      username?: string
      idle_threshold_seconds?: number
      sound_enabled?: boolean
      theme?: string
      avatar?: string
      milestones?: Record<string, number>
    }) => {
      const out: {
        username?: string
        idle_threshold_seconds?: number
        sound_enabled?: boolean
        theme?: string
        avatar?: string
        milestones?: Record<string, number>
      } = {}
      if (input.username !== undefined) {
        const name =
          typeof input.username === 'string'
            ? input.username.trim().toLowerCase()
            : ''
        if (!USERNAME_PATTERN.test(name)) {
          throw new Error(
            'Usernames are 3-24 characters: lowercase letters, digits, "_", "." or "-".',
          )
        }
        out.username = name
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
      if (input.theme !== undefined) {
        out.theme = asToken(input.theme, 'theme')
      }
      if (input.avatar !== undefined) {
        out.avatar = asToken(input.avatar, 'avatar')
      }
      if (input.milestones !== undefined) {
        if (typeof input.milestones !== 'object' || input.milestones === null) {
          throw new Error('Invalid milestones')
        }
        const clean: Record<string, number> = {}
        for (const key of MILESTONE_FIELDS) {
          const v = (input.milestones as Record<string, unknown>)[key]
          if (v !== undefined) {
            clean[key] = Math.min(1_000_000, asNonNegativeInt(v, `milestones.${key}`))
          }
        }
        out.milestones = clean
      }
      return out
    },
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    if (Object.keys(data).length === 0) return { success: true }

    // Milestones are high-water marks: merge per-key max with the stored row
    // so no client (stale cache, second device) can ever lower one.
    if (data.milestones) {
      const { data: row, error: readError } = await context.supabase
        .from('profiles')
        .select('milestones')
        .eq('id', context.user.id)
        .maybeSingle()
      if (!readError && row?.milestones && typeof row.milestones === 'object') {
        const existing = row.milestones as Record<string, unknown>
        for (const key of MILESTONE_FIELDS) {
          const prev = Number(existing[key])
          if (Number.isFinite(prev) && prev > (data.milestones[key] ?? 0)) {
            data.milestones[key] = Math.min(1_000_000, Math.floor(prev))
          }
        }
      }
    }

    // UPDATE, not upsert: the signup trigger guarantees the row exists, and an
    // upsert's INSERT arm would violate the NOT NULL username constraint on a
    // partial update (e.g. avatar/theme only) that omits username. Fall back
    // to an insert only if the row is genuinely missing.
    const { data: updated, error } = await context.supabase
      .from('profiles')
      .update(data)
      .eq('id', context.user.id)
      .select('id')
      .maybeSingle()
    if (error) {
      if (/duplicate key|profiles_username_key/i.test(error.message)) {
        throw new Error('That username is already taken — try another one.')
      }
      throw new Error(error.message)
    }
    if (!updated) {
      const { error: insertError } = await context.supabase
        .from('profiles')
        .insert({ id: context.user.id, ...data })
      if (insertError) {
        if (/duplicate key|profiles_username_key/i.test(insertError.message)) {
          throw new Error('That username is already taken — try another one.')
        }
        throw new Error(insertError.message)
      }
    }
    return { success: true }
  })
