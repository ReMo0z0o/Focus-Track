import { Link, Navigate, Outlet, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { Brand } from '@/components/Brand'
import { IdleModal } from '@/components/IdleModal'
import { SessionEngineProvider, useSessionEngine } from '@/lib/session-engine'
import { getProfile } from '@/lib/sessions.functions'
import { fmtClock } from '@/lib/stats'
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

function AppShell() {
  const { user, signOut } = useAuth()

  const getProfileFn = useServerFn(getProfile)
  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: () => getProfileFn(),
  })

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
            <Link to="/settings" activeProps={{ className: 'active' }}>
              Settings
            </Link>
          </nav>
          <MiniTimer />
          <span className="header-spacer" />
          <span className="header-user" title={user?.email ?? undefined}>
            {displayName}
          </span>
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
