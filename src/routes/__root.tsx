import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import { ToastProvider } from '@/components/Toaster'
import { THEME_BOOT_SCRIPT } from '@/lib/theme'
import stylesUrl from '@/styles.css?url'

/* ------------------------------------------------------------------ */
/* Auth context                                                        */
/* ------------------------------------------------------------------ */

interface AuthContextValue {
  user: User | null
  session: Session | null
  isLoading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  isLoading: true,
  signOut: async () => {},
})

export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const queryClient = useQueryClient()
  const prevUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return
        setSession(data.session)
        prevUserIdRef.current = data.session?.user.id ?? null
        setIsLoading(false)
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false)
      })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setIsLoading(false)
      // Only reset cached data when the signed-in identity actually changes
      // (onAuthStateChange also fires for token refreshes and tab focus).
      const nextUserId = next?.user.id ?? null
      if (nextUserId !== prevUserIdRef.current) {
        prevUserIdRef.current = nextUserId
        void queryClient.invalidateQueries()
      }
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [queryClient])

  const signOut = async () => {
    await supabase.auth.signOut()
    queryClient.clear()
  }

  return (
    <AuthContext.Provider
      value={{ user: session?.user ?? null, session, isLoading, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

/* ------------------------------------------------------------------ */
/* Root route                                                          */
/* ------------------------------------------------------------------ */

const FAVICON =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#0b0e14"/><circle cx="12" cy="12" r="7" stroke="#3d465c" stroke-width="2.2" fill="none"/><path d="M12 5 a7 7 0 0 1 6.7 4.9" stroke="#f6ac3d" stroke-width="2.2" stroke-linecap="round" fill="none"/><circle cx="12" cy="12" r="2.4" fill="#f6ac3d"/></svg>`,
  )

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'FocusGuard — honest focus time' },
      {
        name: 'description',
        content:
          'A focus timer that keeps you honest: it detects when you drift away, gives you a 15-second grace period, and tracks real focus vs. pauses.',
      },
      { name: 'theme-color', content: '#0b0e14' },
    ],
    links: [
      { rel: 'stylesheet', href: stylesUrl },
      { rel: 'icon', type: 'image/svg+xml', href: FAVICON },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFound,
})

function NotFound() {
  return (
    <div className="auth-wrap">
      <div className="card auth-card" style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.4rem', marginBottom: '0.5rem' }}>404</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.4rem' }}>
          This page doesn't exist.
        </p>
        <Link to="/" className="btn btn-primary">
          Back home
        </Link>
      </div>
    </div>
  )
}

function RootComponent() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  return (
    <RootDocument>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <Outlet />
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    // suppressHydrationWarning: the theme boot script below stamps
    // data-theme on <html> before hydration, which the SSR HTML can't know.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Restore the saved reward theme before first paint (no flash). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
