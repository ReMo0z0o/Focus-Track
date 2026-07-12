import { Link, Navigate, Outlet, createFileRoute } from '@tanstack/react-router'
import { Brand } from '@/components/Brand'
import { useAuth } from '@/routes/__root'

export const Route = createFileRoute('/_authenticated')({
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const { user, isLoading, signOut } = useAuth()

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

  const displayName =
    (user.user_metadata?.display_name as string | undefined) ?? user.email

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
          <span className="header-spacer" />
          <span className="header-user" title={user.email ?? undefined}>
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
    </>
  )
}
