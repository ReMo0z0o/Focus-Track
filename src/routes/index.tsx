import { Link, createFileRoute } from '@tanstack/react-router'
import { Brand } from '@/components/Brand'
import { useAuth } from '@/routes/__root'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

function LandingPage() {
  const { user } = useAuth()
  const ctaTarget = user ? '/app' : '/login'
  const ctaLabel = user ? 'Open the app' : 'Start focusing — it’s free'

  return (
    <>
      <header className="landing-header">
        <div className="container">
          <Brand />
          <nav>
            <Link to={ctaTarget} className="btn btn-ghost btn-sm">
              {user ? 'Open app' : 'Sign in'}
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="container">
            <div className="hero-inner">
              <span className="hero-eyebrow">Focus timer with a conscience</span>
              <h1>
                Track the focus you <em>actually</em> put in.
              </h1>
              <p className="lede">
                FocusGuard runs a session while you work and quietly watches for
                inactivity. Drift away and it asks, “still there?” — with a
                15-second grace window before the timer pauses. What's left is
                honest focus time, not wishful thinking.
              </p>
              <div className="hero-actions">
                <Link to={ctaTarget} className="btn btn-primary btn-lg">
                  {ctaLabel}
                </Link>
                <a href="#how" className="btn btn-ghost btn-lg">
                  How it works
                </a>
              </div>
            </div>

            <DemoTimerFigure />
          </div>
        </section>

        <section className="features" id="how">
          <div className="container">
            <h2>Built to keep you honest</h2>
            <p className="section-sub">
              Most timers keep counting while you make coffee. FocusGuard
              separates real focus from pauses — automatically.
            </p>

            <div className="feature-grid">
              <div className="card feature-card">
                <div className="f-icon" aria-hidden="true">
                  <EyeIcon />
                </div>
                <h3>Idle detection</h3>
                <p>
                  Uses your browser's native idle detection when available —
                  it notices keyboard, mouse and screen-lock activity
                  system-wide — with a seamless in-page fallback everywhere
                  else.
                </p>
              </div>
              <div className="card feature-card">
                <div className="f-icon" aria-hidden="true">
                  <HourglassIcon />
                </div>
                <h3>15-second grace</h3>
                <p>
                  Stretching or thinking? You get a 15-second countdown to wave
                  back before the session pauses. Your focus streak survives
                  the small stuff.
                </p>
              </div>
              <div className="card feature-card">
                <div className="f-icon" aria-hidden="true">
                  <ScaleIcon />
                </div>
                <h3>Honest accounting</h3>
                <p>
                  Focus and pause time are tracked separately — even through
                  laptop sleep and background tabs. The numbers you see are the
                  numbers that happened.
                </p>
              </div>
              <div className="card feature-card">
                <div className="f-icon" aria-hidden="true">
                  <TrophyIcon />
                </div>
                <h3>Grades &amp; streaks</h3>
                <p>
                  Daily 2-hour goals build a streak. Deep, uninterrupted runs
                  raise your concentration score and earn badges from Bronze to
                  Diamond.
                </p>
              </div>
            </div>

            <div className="steps">
              <div className="step">
                <h4>Start a session</h4>
                <p>One click. FocusGuard starts counting your focus time.</p>
              </div>
              <div className="step">
                <h4>Work — it watches</h4>
                <p>
                  Go idle longer than your threshold and a gentle chime asks if
                  you're still there.
                </p>
              </div>
              <div className="step">
                <h4>Pause honestly</h4>
                <p>
                  Miss the grace window and the timer pauses until you're
                  actually back. Manual pause works too — press{' '}
                  <span className="kbd">P</span>.
                </p>
              </div>
              <div className="step">
                <h4>See the truth</h4>
                <p>
                  Daily, weekly and monthly stats: focus vs. pause, streaks,
                  concentration and badges.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container">
          FocusGuard — a focus timer that keeps you honest.
        </div>
      </footer>
    </>
  )
}

/** Decorative mini timer card shown in the hero. */
function DemoTimerFigure() {
  return (
    <div className="hero-figure" aria-hidden="true">
      <div className="card timer-card is-running" style={{ padding: '2rem 1.4rem' }}>
        <span className="status-chip running">
          <span className="status-dot" />
          Session active
        </span>
        <div className="timer-clock" style={{ fontSize: '3rem' }}>
          1:24:37
        </div>
        <p className="timer-sub">
          Focus 1h 24m<span className="sep">·</span>Pause 6m 12s
        </p>
      </div>
    </div>
  )
}

/* --- tiny inline icons (stroke inherits currentColor) --- */

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function HourglassIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12M6 21h12M8 3v4l4 5 4-5V3M8 21v-4l4-5 4 5v4" />
    </svg>
  )
}

function ScaleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18M3 21h18M7 7 4 13a3 3 0 0 0 6 0L7 7ZM17 7l-3 6a3 3 0 0 0 6 0l-3-6ZM5 7h14" />
    </svg>
  )
}

function TrophyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0V4ZM7 5H4a2 2 0 0 0 2 5h1M17 5h3a2 2 0 0 1-2 5h-1" />
    </svg>
  )
}
