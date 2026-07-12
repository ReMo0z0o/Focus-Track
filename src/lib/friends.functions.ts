import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/lib/supabase-auth'
import { USERNAME_PATTERN } from '@/lib/sessions.functions'
import type { SessionRow } from '@/lib/stats'

/**
 * Friends: request/accept by username, list relationships, and read an
 * accepted friend's stats. RLS enforces visibility at the database level;
 * these handlers ALSO check friendship explicitly (defense in depth).
 */

export interface FriendProfile {
  id: string
  username: string
  avatar: string
  milestones: Record<string, number>
}

export interface FriendshipEntry {
  friendshipId: string
  since: string
  user: FriendProfile
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

type SupabaseCtx = {
  supabase: import('@supabase/supabase-js').SupabaseClient<
    import('@/integrations/supabase/types').Database
  >
  user: { id: string }
}

function toProfile(row: {
  id: string
  username: string
  avatar: string
  milestones: unknown
}): FriendProfile {
  return {
    id: row.id,
    username: row.username,
    avatar: row.avatar,
    milestones: (row.milestones ?? {}) as Record<string, number>,
  }
}

async function fetchProfiles(
  ctx: SupabaseCtx,
  ids: string[],
): Promise<Map<string, FriendProfile>> {
  const out = new Map<string, FriendProfile>()
  if (ids.length === 0) return out
  const { data, error } = await ctx.supabase
    .from('profiles')
    .select('id, username, avatar, milestones')
    .in('id', ids)
  if (error) throw new Error(error.message)
  for (const row of data) out.set(row.id, toProfile(row))
  return out
}

async function fetchMyFriendships(ctx: SupabaseCtx) {
  const uid = ctx.user.id
  const [asRequester, asAddressee] = await Promise.all([
    ctx.supabase.from('friendships').select('*').eq('requester_id', uid),
    ctx.supabase.from('friendships').select('*').eq('addressee_id', uid),
  ])
  if (asRequester.error) throw new Error(asRequester.error.message)
  if (asAddressee.error) throw new Error(asAddressee.error.message)
  return [...(asRequester.data ?? []), ...(asAddressee.data ?? [])]
}

async function assertAcceptedFriendship(
  ctx: SupabaseCtx,
  otherUserId: string,
): Promise<void> {
  const rows = await fetchMyFriendships(ctx)
  const ok = rows.some(
    (f) =>
      f.status === 'accepted' &&
      (f.requester_id === otherUserId || f.addressee_id === otherUserId),
  )
  if (!ok) throw new Error('You can only view stats of accepted friends.')
}

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

export const searchUsers = createServerFn({ method: 'GET' })
  .validator((input: { query: string }) => {
    const query =
      typeof input.query === 'string' ? input.query.trim().toLowerCase() : ''
    if (query.length < 2 || query.length > 24) {
      throw new Error('Search with at least 2 characters.')
    }
    // Strip anything that isn't valid in a username (also defuses LIKE wildcards).
    return { query: query.replace(/[^a-z0-9_.-]/g, '') }
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<FriendProfile[]> => {
    if (data.query.length < 2) return []
    const { data: rows, error } = await context.supabase
      .from('profiles')
      .select('id, username, avatar, milestones')
      .ilike('username', `${data.query}%`)
      .order('username')
      .limit(8)
    if (error) throw new Error(error.message)
    return rows.filter((r) => r.id !== context.user.id).map(toProfile)
  })

/* ------------------------------------------------------------------ */
/* Requests                                                            */
/* ------------------------------------------------------------------ */

export const sendFriendRequest = createServerFn({ method: 'POST' })
  .validator((input: { username: string }) => {
    const username =
      typeof input.username === 'string' ? input.username.trim().toLowerCase() : ''
    if (!USERNAME_PATTERN.test(username)) throw new Error('Invalid username.')
    return { username }
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: target, error: findError } = await context.supabase
      .from('profiles')
      .select('id, username')
      .eq('username', data.username)
      .maybeSingle()
    if (findError) throw new Error(findError.message)
    if (!target) throw new Error(`No user named "${data.username}" was found.`)
    if (target.id === context.user.id) {
      throw new Error('That would be you — focus buddies must be other people.')
    }

    const existing = await fetchMyFriendships(context)
    const pair = existing.find(
      (f) => f.requester_id === target.id || f.addressee_id === target.id,
    )
    if (pair) {
      if (pair.status === 'accepted') {
        throw new Error(`You are already friends with ${target.username}.`)
      }
      if (pair.requester_id === context.user.id) {
        throw new Error(`Your request to ${target.username} is still pending.`)
      }
      // They already asked us — accept instead of duplicating.
      const { error } = await context.supabase
        .from('friendships')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', pair.id)
        .eq('addressee_id', context.user.id)
      if (error) throw new Error(error.message)
      return { status: 'accepted' as const, username: target.username }
    }

    const { error } = await context.supabase.from('friendships').insert({
      requester_id: context.user.id,
      addressee_id: target.id,
    })
    if (error) throw new Error(error.message)
    return { status: 'requested' as const, username: target.username }
  })

export const respondFriendRequest = createServerFn({ method: 'POST' })
  .validator((input: { id: string; accept: boolean }) => ({
    id: asUuid(input.id, 'friendship id'),
    accept: Boolean(input.accept),
  }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    if (data.accept) {
      const { data: row, error } = await context.supabase
        .from('friendships')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', data.id)
        .eq('addressee_id', context.user.id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle()
      if (error) throw new Error(error.message)
      if (!row) throw new Error('This request is no longer pending.')
      return { success: true }
    }
    const { error } = await context.supabase
      .from('friendships')
      .delete()
      .eq('id', data.id)
      .eq('addressee_id', context.user.id)
    if (error) throw new Error(error.message)
    return { success: true }
  })

export const removeFriendship = createServerFn({ method: 'POST' })
  .validator((input: { id: string }) => ({ id: asUuid(input.id, 'friendship id') }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    // Works for unfriending and for cancelling an outgoing request; RLS
    // limits deletion to rows the caller belongs to, and we double-check.
    const mine = await fetchMyFriendships(context)
    if (!mine.some((f) => f.id === data.id)) {
      throw new Error('Not your friendship to remove.')
    }
    const { error } = await context.supabase
      .from('friendships')
      .delete()
      .eq('id', data.id)
    if (error) throw new Error(error.message)
    return { success: true }
  })

/* ------------------------------------------------------------------ */
/* Lists & stats                                                       */
/* ------------------------------------------------------------------ */

export interface FriendsOverview {
  friends: FriendshipEntry[]
  incoming: FriendshipEntry[]
  outgoing: FriendshipEntry[]
}

export const getFriends = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FriendsOverview> => {
    const uid = context.user.id
    const rows = await fetchMyFriendships(context)
    const otherIds = [
      ...new Set(
        rows.map((f) => (f.requester_id === uid ? f.addressee_id : f.requester_id)),
      ),
    ]
    const profiles = await fetchProfiles(context, otherIds)

    const entry = (f: (typeof rows)[number]): FriendshipEntry | null => {
      const otherId = f.requester_id === uid ? f.addressee_id : f.requester_id
      const user = profiles.get(otherId)
      return user ? { friendshipId: f.id, since: f.created_at, user } : null
    }

    const friends: FriendshipEntry[] = []
    const incoming: FriendshipEntry[] = []
    const outgoing: FriendshipEntry[] = []
    for (const f of rows) {
      const e = entry(f)
      if (!e) continue
      if (f.status === 'accepted') friends.push(e)
      else if (f.addressee_id === uid) incoming.push(e)
      else outgoing.push(e)
    }
    friends.sort((a, b) => a.user.username.localeCompare(b.user.username))
    return { friends, incoming, outgoing }
  })

export interface FriendStats {
  profile: FriendProfile
  sessions: SessionRow[]
}

export const getFriendStats = createServerFn({ method: 'GET' })
  .validator((input: { userId: string }) => ({
    userId: asUuid(input.userId, 'user id'),
  }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<FriendStats> => {
    await assertAcceptedFriendship(context, data.userId)

    const [{ data: profileRow, error: profileError }, sessionsResult] =
      await Promise.all([
        context.supabase
          .from('profiles')
          .select('id, username, avatar, milestones')
          .eq('id', data.userId)
          .maybeSingle(),
        context.supabase
          .from('focus_sessions')
          .select('id, started_at, ended_at, focus_seconds, idle_seconds, resumes_count')
          .eq('user_id', data.userId)
          .gte(
            'started_at',
            new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
          )
          .order('started_at', { ascending: false })
          .limit(1000),
      ])
    if (profileError) throw new Error(profileError.message)
    if (!profileRow) throw new Error('Profile not found.')
    if (sessionsResult.error) throw new Error(sessionsResult.error.message)

    return {
      profile: toProfile(profileRow),
      sessions: sessionsResult.data,
    }
  })
