import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client'
import { Brand } from '@/components/Brand'
import { useAuth } from '@/routes/__root'

const USING_PLACEHOLDER = SUPABASE_URL.includes('placeholder.supabase.co')

type Mode = 'signin' | 'signup'

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): { mode?: Mode } => ({
    mode: search.mode === 'signup' ? 'signup' : undefined,
  }),
  component: LoginPage,
})

function LoginPage() {
  const { user, isLoading } = useAuth()
  const navigate = useNavigate()
  const search = Route.useSearch()

  const [mode, setMode] = useState<Mode>(search.mode ?? 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Already authenticated → straight to the app.
  useEffect(() => {
    if (!isLoading && user) {
      void navigate({ to: '/app' })
    }
  }, [isLoading, user, navigate])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (mode === 'signin') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) throw signInError
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: displayName.trim()
              ? { display_name: displayName.trim().slice(0, 80) }
              : undefined,
          },
        })
        if (signUpError) throw signUpError
        // Some projects don't return a session on sign-up (e.g. when email
        // confirmation is toggled); sign in immediately with the same
        // credentials so the user lands in the app.
        if (!data.session) {
          const { error: signInError } =
            await supabase.auth.signInWithPassword({ email, password })
          if (signInError) {
            if (/email not confirmed/i.test(signInError.message)) {
              throw new Error(
                'Account created! Check your inbox for a confirmation email, then sign in.',
              )
            }
            throw signInError
          }
        }
      }
      await navigate({ to: '/app' })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Try again.'
      // "Failed to fetch" means the Supabase request never reached the
      // server — almost always a misconfigured URL/key, not bad credentials.
      // Surface the actual backend host so config problems are diagnosable.
      setError(
        /failed to fetch|networkerror|load failed/i.test(message)
          ? `Cannot reach the authentication server at ${SUPABASE_URL}. ${
              USING_PLACEHOLDER
                ? 'The app has no Supabase URL configured — VITE_SUPABASE_URL is missing from the build.'
                : 'Check the Supabase URL/key and that the project is running.'
            }`
          : message,
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <Brand />
        <h1 style={{ fontSize: '1.3rem', textAlign: 'center', marginBottom: '0.4rem' }}>
          {mode === 'signin' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p
          style={{
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.9rem',
            marginBottom: '1.5rem',
          }}
        >
          {mode === 'signin'
            ? 'Sign in to pick up your focus streak.'
            : 'A minute now, honest focus stats forever.'}
        </p>

        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div className="field">
              <label htmlFor="displayName">Display name (optional)</label>
              <input
                id="displayName"
                className="input"
                type="text"
                maxLength={80}
                autoComplete="nickname"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ada"
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              className="input"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              className="input"
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: '0.4rem' }}
            disabled={submitting}
          >
            {submitting
              ? 'One moment…'
              : mode === 'signin'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'signin' ? 'New to FocusGuard?' : 'Already have an account?'}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin')
              setError(null)
            }}
          >
            {mode === 'signin' ? 'Create an account' : 'Sign in'}
          </button>
        </p>

        {/* Diagnostic line: shows which backend the build is configured for.
            Remove once auth is confirmed working. */}
        <p
          style={{
            textAlign: 'center',
            marginTop: '1rem',
            fontSize: '0.72rem',
            color: USING_PLACEHOLDER ? 'var(--danger)' : 'var(--text-faint)',
          }}
        >
          {USING_PLACEHOLDER
            ? '⚠ No Supabase URL in this build (VITE_SUPABASE_URL missing)'
            : `backend: ${SUPABASE_URL.replace('https://', '')}`}
        </p>
      </div>
    </div>
  )
}
