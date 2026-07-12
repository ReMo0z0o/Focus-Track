import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { supabase } from '@/integrations/supabase/client'
import { Brand } from '@/components/Brand'
import { useAuth } from '@/routes/__root'

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
      setError(
        err instanceof Error ? err.message : 'Something went wrong. Try again.',
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
      </div>
    </div>
  )
}
