import { useEffect, useRef } from 'react'
import { Link, Navigate, Outlet, createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { Brand } from '@/components/Brand'
import { IdleModal } from '@/components/IdleModal'
import { Avatar } from '@/components/avatars'
import { SessionEngineProvider, useSessionEngine } from '@/lib/session-engine'
import {
  getProfile,
  getRecentSessions,
  updateProfile,
} from '@/lib/sessions.functions'
import {
  AVATARS,
  THEMES,
  computeMilestones,
  isUnlocked,
  mergeMilestones,
  milestonesEqual,
  normalizeMilestones,
} from '@/lib/rewards'
import { applyTheme } from '@/lib/theme'
import { fmtClock } from '@/lib/stats'
import { useToast } from '@/components/Toaster'
import { useAuth } from '@/routes/__root'

export const Route = createFileRoute('/_authenticated')({
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const { user, isLoading } = useAuth()

  // Supabase sessions live client-side; while the session is being restored
  // (and during SSR) show a quiet loading state instead of flashing /login.
  if (isLoading) {
    return (
      <div className="loading-screen">
        <span className="spinner" aria-hidden="true" />
        Loading your space…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" />
  }

  return (
    <SessionEngineProvider>
      <AppShell />
    </SessionEngineProvider>
  )
}

/**
 * Keeps profile.milestones as a high-water mark of achievements and toasts
 * newly unlocked rewards. Also applies the user's saved theme.
 */
function useRewardsSync() {
  const toast = useToast().toast
  const queryClient = useQueryClient()
  const getProfileFn = useServerFn(getProfile)
  const getRecentSessionsFn = useServerFn(getRecentSessions)
  const updateProfileFn = useServerFn(updateProfile)

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: () => getProfileFn(),
  })
  const sessionsQuery = useQuery({
    queryKey: ['sessions'],
    queryFn: () => getRecentSessionsFn(),
  })

  // Apply the saved theme whenever the profile (re)loads.
  const theme = profileQuery.data?.theme
  useEffect(() => {
    if (theme) applyTheme(theme)
  }, [theme])

  const syncingRef = useRef(false)

  useEffect(() => {
    if (!profileQuery.data || !sessionsQuery.data || syncingRef.current) return
    const stored = normalizeMilestones(profileQuery.data.milestones)
    const current = computeMilestones(sessionsQuery.data, new Date())
    const merged = mergeMilestones(stored, current)
    if (milestonesEqual(merged, stored)) return

    const newlyUnlocked = [...THEMES, ...AVATARS].filter(
      (r) => !isUnlocked(r.condition, stored) && isUnlocked(r.condition, merged),
    )

    syncingRef.current = true
    updateProfileFn({ data: { milestones: { ...merged } } })
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ['profile'] })
        for (const reward of newlyUnlocked) {
          toast(`Reward unlocked: ${reward.name} 🎉`, 'success')
        }
      })
      .catch(() => {
        // Un-migrated database — milestones just won't persist yet.
      })
      .finally(() => {
        syncingRef.current = false
      })
  }, [profileQuery.data, sessionsQuery.data, updateProfileFn, queryClient, toast])

  return profileQuery
}

function AppShell() {
  const { user, signOut } = useAuth()
  const profileQuery = useRewardsSync()

  const displayName =
    profileQuery.data?.display_name ??
    (user?.user_metadata?.display_name as string | undefined) ??
    user?.email

  return (
    <>
      <header className="site-header">
        <div className="container">
          <Brand to="/app" />
          <nav className="main-nav" aria-label="Main">
            <Link to="/app" activeProps={{ className: 'active' }}>
              Session
            </Link>
            <Link to="/stats" activeProps={{ className: 'active' }}>
              Stats
            </Link>
            <Link to="/rewards" activeProps={{ className: 'active' }}>
              Rewards
            </Link>
            <Link to="/settings" activeProps={{ className: 'active' }}>
              Settings
            </Link>
          </nav>
          <MiniTimer />
          <span className="header-spacer" />
          <Link
            to="/rewards"
            className="header-id"
            title="Your rewards"
            aria-label="Your avatar — open rewards"
          >
            <Avatar id={profileQuery.data?.avatar ?? 'spark'} size={30} />
            <span className="header-user">{displayName}</span>
          </Link>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="container page">
        <Outlet />
      </main>
      <IdleModal />
    </>
  )
}

/** Compact live timer shown in the header while a session runs. */
function MiniTimer() {
  const { active, isIdle, focusSeconds } = useSessionEngine()
  if (!active) return null
  return (
    <Link
      to="/app"
      className={`mini-timer${isIdle ? ' paused' : ''}`}
      aria-label={isIdle ? 'Session paused — open session page' : 'Session running — open session page'}
    >
      <span className="status-dot" aria-hidden="true" />
      {fmtClock(focusSeconds)}
    </Link>
  )
}
