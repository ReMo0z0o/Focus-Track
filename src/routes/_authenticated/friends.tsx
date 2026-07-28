import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import {
  getFriends,
  getFriendStats,
  removeFriendship,
  respondFriendRequest,
  searchUsers,
  sendFriendRequest,
} from '@/lib/friends.functions'
import type {
  FriendProfile,
  FriendsOverview,
  FriendshipEntry,
} from '@/lib/friends.functions'
import { normalizeMilestones } from '@/lib/rewards'
import {
  APP_LOCALE,
  DAILY_GOAL_SECONDS,
  GRADE_NAMES,
  dailyBuckets,
  filterSince,
  fmtDuration,
  fmtSessions,
  startOfDay,
  summarize,
  tierMaterial,
} from '@/lib/stats'
import { BADGES, BadgeMedal } from '@/components/BadgeMedal'
import type { BadgeKind } from '@/components/BadgeMedal'
import { GradeEmblem } from '@/components/GradeEmblem'
import { FocusPauseChart } from '@/components/charts'
import { Avatar } from '@/components/avatars'
import { useToast } from '@/components/Toaster'

export const Route = createFileRoute('/_authenticated/friends')({
  component: FriendsPage,
})

function FriendsPage() {
  const toast = useToast().toast
  const queryClient = useQueryClient()
  const getFriendsFn = useServerFn(getFriends)
  const sendRequestFn = useServerFn(sendFriendRequest)
  const respondFn = useServerFn(respondFriendRequest)
  const removeFn = useServerFn(removeFriendship)

  const overviewQuery = useQuery({
    queryKey: ['friends'],
    queryFn: () => getFriendsFn(),
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['friends'] })

  const sendMutation = useMutation({
    mutationFn: (username: string) => sendRequestFn({ data: { username } }),
    onSuccess: (res) => {
      void invalidate()
      toast(
        res.status === 'accepted'
          ? `You and @${res.username} are now friends 🤝`
          : `Request sent to @${res.username}`,
        'success',
      )
    },
    onError: (err) =>
      toast(err instanceof Error ? err.message : 'Could not send the request.', 'error'),
  })

  const respondMutation = useMutation({
    mutationFn: (vars: { id: string; accept: boolean }) =>
      respondFn({ data: vars }),
    onSuccess: (_res, vars) => {
      void invalidate()
      toast(vars.accept ? 'Friend request accepted 🤝' : 'Request declined')
    },
    onError: () => toast('Could not update the request.', 'error'),
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => {
      void invalidate()
      toast('Removed.')
    },
    onError: () => toast('Could not remove it.', 'error'),
  })

  const overview = overviewQuery.data

  if (overviewQuery.isLoading) {
    return (
      <div className="loading-screen">
        <span className="spinner" aria-hidden="true" />
        Calling your friends…
      </div>
    )
  }

  if (overviewQuery.isError) {
    return (
      <div>
        <h1 className="page-title">Friends</h1>
        <div className="card chart-empty" style={{ marginTop: '1rem' }}>
          Couldn't load your friends. If you just deployed, make sure the
          friends database migration has been applied.{' '}
          <button
            type="button"
            style={{ color: 'var(--accent-strong)', textDecoration: 'underline' }}
            onClick={() => void overviewQuery.refetch()}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="page-title">Friends</h1>
      <p className="page-sub">
        Add focus buddies by username. Friends see each other's stats — best
        grade, badges and focus time.
      </p>

      <AddFriendCard
        overview={overview}
        onAdd={(username) => sendMutation.mutate(username)}
        adding={sendMutation.isPending}
      />

      {overview && overview.incoming.length > 0 && (
        <section className="card mt-3" aria-label="Incoming friend requests">
          <h2 className="card-title">
            Requests <span className="count-pill">{overview.incoming.length}</span>
          </h2>
          {overview.incoming.map((entry) => (
            <div key={entry.friendshipId} className="friend-row">
              <Avatar id={entry.user.avatar} size={40} />
              <div className="fr-id">
                <span className="fr-name">@{entry.user.username}</span>
                <span className="fr-sub">wants to be focus buddies</span>
              </div>
              <span className="spacer" />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={respondMutation.isPending}
                onClick={() =>
                  respondMutation.mutate({ id: entry.friendshipId, accept: true })
                }
              >
                Accept
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={respondMutation.isPending}
                onClick={() =>
                  respondMutation.mutate({ id: entry.friendshipId, accept: false })
                }
              >
                Decline
              </button>
            </div>
          ))}
        </section>
      )}

      <FriendList
        friends={overview?.friends ?? []}
        onRemove={(id) => removeMutation.mutate(id)}
        removing={removeMutation.isPending}
      />

      {overview && overview.outgoing.length > 0 && (
        <section className="card mt-3" aria-label="Outgoing friend requests">
          <h2 className="card-title">Sent — waiting for an answer</h2>
          {overview.outgoing.map((entry) => (
            <div key={entry.friendshipId} className="friend-row">
              <Avatar id={entry.user.avatar} size={40} />
              <div className="fr-id">
                <span className="fr-name">@{entry.user.username}</span>
                <span className="fr-sub">pending</span>
              </div>
              <span className="spacer" />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={removeMutation.isPending}
                onClick={() => removeMutation.mutate(entry.friendshipId)}
              >
                Cancel
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Add friend (search)                                                 */
/* ------------------------------------------------------------------ */

function AddFriendCard({
  overview,
  onAdd,
  adding,
}: {
  overview: FriendsOverview | undefined
  onAdd: (username: string) => void
  adding: boolean
}) {
  const searchUsersFn = useServerFn(searchUsers)
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(term.trim().toLowerCase()), 300)
    return () => window.clearTimeout(t)
  }, [term])

  const searchQuery = useQuery({
    queryKey: ['friend-search', debounced],
    queryFn: () => searchUsersFn({ data: { query: debounced } }),
    enabled: debounced.length >= 2,
    staleTime: 10_000,
  })

  const relationOf = useMemo(() => {
    const map = new Map<string, 'friend' | 'incoming' | 'outgoing'>()
    for (const f of overview?.friends ?? []) map.set(f.user.id, 'friend')
    for (const f of overview?.incoming ?? []) map.set(f.user.id, 'incoming')
    for (const f of overview?.outgoing ?? []) map.set(f.user.id, 'outgoing')
    return map
  }, [overview])

  const results = searchQuery.data ?? []

  return (
    <section className="card" aria-label="Add a friend">
      <h2 className="card-title">Add a friend</h2>
      <input
        className="input"
        type="search"
        placeholder="Search by username, e.g. ada.lovelace"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        aria-label="Search users by username"
      />
      {debounced.length >= 2 && (
        <div className="search-results" role="list">
          {searchQuery.isLoading ? (
            <div className="sr-empty">Searching…</div>
          ) : searchQuery.isError ? (
            <div className="sr-empty">
              Search isn't available right now — try again in a moment.
            </div>
          ) : results.length === 0 ? (
            <div className="sr-empty">
              Nobody named “{debounced}” yet — check the spelling?
            </div>
          ) : (
            results.map((user) => {
              const relation = relationOf.get(user.id)
              const grade = normalizeMilestones(user.milestones).grade
              return (
                <div key={user.id} className="friend-row" role="listitem">
                  <Avatar id={user.avatar} size={40} />
                  <div className="fr-id">
                    <span className="fr-name">@{user.username}</span>
                    <span className={`fr-sub grade-${grade}`}>
                      <span className="fr-grade">{GRADE_NAMES[grade]}</span>
                    </span>
                  </div>
                  <span className="spacer" />
                  {relation === 'friend' ? (
                    <span className="fr-state">Friends ✓</span>
                  ) : relation === 'outgoing' ? (
                    <span className="fr-state">Request sent</span>
                  ) : relation === 'incoming' ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={adding}
                      onClick={() => onAdd(user.username)}
                    >
                      Accept request
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={adding}
                      onClick={() => onAdd(user.username)}
                    >
                      Add
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Friends list + stats panel                                          */
/* ------------------------------------------------------------------ */

function FriendList({
  friends,
  onRemove,
  removing,
}: {
  friends: FriendshipEntry[]
  onRemove: (friendshipId: string) => void
  removing: boolean
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  return (
    <section className="card mt-3" aria-label="Your friends">
      <h2 className="card-title">Friends ({friends.length})</h2>
      {friends.length === 0 ? (
        <div className="chart-empty">
          No friends yet — search a username above to send your first request.
        </div>
      ) : (
        friends.map((entry) => {
          const milestones = normalizeMilestones(entry.user.milestones)
          const open = openId === entry.user.id
          return (
            <div key={entry.friendshipId} className="friend-block">
              <div className="friend-row">
                <Avatar id={entry.user.avatar} size={44} />
                <div className="fr-id">
                  <span className="fr-name">@{entry.user.username}</span>
                  <span className={`fr-sub grade-${milestones.grade}`}>
                    <span className="fr-grade">{GRADE_NAMES[milestones.grade]}</span>
                    {milestones.streak > 0 && (
                      <> · best streak {milestones.streak}d</>
                    )}
                  </span>
                </div>
                <span className="spacer" />
                <button
                  type="button"
                  className={`btn btn-sm ${open ? 'btn-primary' : 'btn-ghost'}`}
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : entry.user.id)}
                >
                  {open ? 'Hide stats' : 'View stats'}
                </button>
                {confirmingId === entry.friendshipId ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      autoFocus
                      disabled={removing}
                      onClick={() => {
                        onRemove(entry.friendshipId)
                        setConfirmingId(null)
                      }}
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setConfirmingId(null)}
                    >
                      Keep
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setConfirmingId(entry.friendshipId)}
                  >
                    Remove
                  </button>
                )}
              </div>
              {open && <FriendStatsPanel user={entry.user} />}
            </div>
          )
        })
      )}
    </section>
  )
}

function FriendStatsPanel({ user }: { user: FriendProfile }) {
  const getFriendStatsFn = useServerFn(getFriendStats)
  const statsQuery = useQuery({
    queryKey: ['friend-stats', user.id],
    queryFn: () => getFriendStatsFn({ data: { userId: user.id } }),
    staleTime: 60_000,
  })

  if (statsQuery.isLoading) {
    return (
      <div className="friend-stats">
        <div className="sr-empty">Loading their numbers…</div>
      </div>
    )
  }

  if (statsQuery.isError || !statsQuery.data) {
    return (
      <div className="friend-stats">
        <div className="sr-empty">Couldn't load their stats right now.</div>
      </div>
    )
  }

  const { profile, sessions } = statsQuery.data
  const milestones = normalizeMilestones(profile.milestones)
  // Best tier ever reached per badge — friends see milestones, not today's form.
  const badgeTiers: Record<BadgeKind, number> = {
    attention: milestones.concTier,
    deadAir: milestones.ratioTier,
    haul: milestones.weekTier,
  }
  const now = new Date()
  const today = summarize(filterSince(sessions, startOfDay(now)))
  const week = summarize(
    filterSince(sessions, new Date(startOfDay(now).getTime() - 6 * 86_400_000)),
  )
  const weekBuckets = dailyBuckets(sessions, 7, now).map((b) => ({
    label: b.date.toLocaleDateString(APP_LOCALE, { weekday: 'short' }),
    detail: b.date.toLocaleDateString(APP_LOCALE, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }),
    focus: b.focus,
    idle: b.idle,
    sessions: b.sessions.length,
  }))

  return (
    <div className={`friend-stats grade-${milestones.grade}`}>
      <div className="fs-emblem">
        <GradeEmblem level={milestones.grade} width={92} />
        <div className="fs-grade-name">{GRADE_NAMES[milestones.grade]}</div>
        <div className="fs-grade-sub">best grade reached</div>
      </div>

      <div className="fs-body">
        <div className="tile-grid">
          <div className="tile">
            <div className="tile-label">Focus today</div>
            <div className="tile-value accent">{fmtDuration(today.focus)}</div>
            <div className="tile-hint">{fmtSessions(today.sessions)}</div>
          </div>
          <div className="tile">
            <div className="tile-label">Focus this week</div>
            <div className="tile-value accent">{fmtDuration(week.focus)}</div>
            <div className="tile-hint">{fmtSessions(week.sessions)}</div>
          </div>
          <div className="tile">
            <div className="tile-label">Best streak</div>
            <div className="tile-value">
              {milestones.streak}
              <span style={{ fontSize: '0.9rem' }}> day{milestones.streak === 1 ? '' : 's'}</span>
            </div>
            <div className="tile-hint">{fmtDuration(DAILY_GOAL_SECONDS)}+ per day</div>
          </div>
          <div className="tile">
            <div className="tile-label">Sessions (60d)</div>
            <div className="tile-value">{sessions.length}</div>
          </div>
        </div>

        <div className="fs-badges">
          {BADGES.map((badge) => {
            const tier = badgeTiers[badge.kind]
            return (
              <div key={badge.kind} className={`fs-badge tier-c${tier}`}>
                <BadgeMedal kind={badge.kind} tier={tier} small />
                <div className="fsb-text">
                  <span className="fsb-name">{badge.name}</span>
                  <span className="fsb-nick">{badge.nicknames[tier]}</span>
                  <span className="fsb-material">{tierMaterial(tier)}</span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="fs-chart">
          <h3 className="card-title" style={{ marginBottom: '0.6rem' }}>
            Their last 7 days
          </h3>
          <FocusPauseChart buckets={weekBuckets} />
        </div>
      </div>
    </div>
  )
}
