import { useMemo } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { getProfile, getRecentSessions } from '@/lib/sessions.functions'
import { useSessionEngine } from '@/lib/session-engine'
import {
  APP_LOCALE,
  DAILY_GOAL_SECONDS,
  GRADE_NAMES,
  filterSince,
  fmtClock,
  fmtDuration,
  fmtPercent,
  startOfDay,
  summarize,
} from '@/lib/stats'
import {
  computeMilestones,
  mergeMilestones,
  normalizeMilestones,
} from '@/lib/rewards'
import { GradeEmblem } from '@/components/GradeEmblem'

export const Route = createFileRoute('/_authenticated/app')({
  component: SessionPage,
})

function SessionPage() {
  const {
    active,
    focusSeconds,
    idleSeconds,
    resumes,
    nowTs,
    isIdle,
    idle,
    thresholdSeconds,
    starting,
    ending,
    handleStart,
    handleStop,
    handlePause,
  } = useSessionEngine()

  const getRecentSessionsFn = useServerFn(getRecentSessions)
  const sessionsQuery = useQuery({
    queryKey: ['sessions'],
    queryFn: () => getRecentSessionsFn(),
  })

  const getProfileFn = useServerFn(getProfile)
  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: () => getProfileFn(),
  })

  /* ---------------- grade badge ---------------- */

  // Best grade reached (persisted milestone high-water mark merged with the
  // current session data), same source of truth as Rewards and Friends.
  const grade = useMemo(() => {
    const stored = normalizeMilestones(profileQuery.data?.milestones)
    if (!sessionsQuery.data) return stored.grade
    return mergeMilestones(
      stored,
      computeMilestones(sessionsQuery.data, new Date(nowTs)),
    ).grade
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileQuery.data?.milestones, sessionsQuery.data])

  /* ---------------- today panel ---------------- */

  const today = useMemo(() => {
    const rows = sessionsQuery.data ?? []
    // The running session's row is already in the DB (with zero counters
    // until it ends); exclude it so the live values below aren't doubled.
    const todayRows = filterSince(rows, startOfDay(new Date(nowTs))).filter(
      (s) => s.id !== active?.id,
    )
    return summarize(todayRows)
  }, [sessionsQuery.data, nowTs, active?.id])

  const todayFocus = today.focus + focusSeconds
  const todayIdle = today.idle + idleSeconds
  const todaySessions = today.sessions + (active ? 1 : 0)
  const todayRatio = todayFocus > 0 ? todayIdle / todayFocus : 0
  const goalPct = Math.min(100, Math.round((todayFocus / DAILY_GOAL_SECONDS) * 100))

  /* ---------------- render ---------------- */

  const statusChip = !active ? (
    <span className="status-chip" role="status">
      <span className="status-dot" />
      No session
    </span>
  ) : isIdle ? (
    <span className="status-chip paused" role="status">
      <span className="status-dot" />
      Paused
    </span>
  ) : (
    <span className="status-chip running" role="status">
      <span className="status-dot" />
      Session active
    </span>
  )

  return (
    <div>
      <h1 className="page-title">Focus session</h1>
      <p className="page-sub">
        Start a session and work — FocusGuard tells focus from pause on its own.
      </p>

      <div className="session-layout">
        <section className={`card timer-card${active && !isIdle ? ' is-running' : ''}`}>
          <div className="timer-top">
            <Link
              to="/rewards"
              className={`grade-badge grade-${grade}`}
              title={`${GRADE_NAMES[grade]} — your current grade. Open Rewards.`}
            >
              <GradeEmblem level={grade} width={26} />
              <span className="gb-name">{GRADE_NAMES[grade]}</span>
            </Link>
            {statusChip}
          </div>

          <div className={`timer-clock${isIdle ? ' paused' : ''}`}>
            {fmtClock(focusSeconds)}
          </div>
          <p className="timer-sub">
            Focus {fmtDuration(focusSeconds)}
            <span className="sep">·</span>
            Pause {fmtDuration(idleSeconds)}
            {resumes > 0 && (
              <>
                <span className="sep">·</span>
                {resumes} resume{resumes > 1 ? 's' : ''}
              </>
            )}
          </p>
          {active && (
            <p className="timer-sub mt-1" style={{ fontSize: '0.82rem' }}>
              Started at{' '}
              {new Date(active.startedAt).toLocaleTimeString(APP_LOCALE, {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}

          <div className="timer-actions">
            {!active ? (
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={() => void handleStart()}
                disabled={starting}
              >
                {starting ? 'Starting…' : 'Start session'}
              </button>
            ) : (
              <>
                {!isIdle && (
                  <button type="button" className="btn btn-ghost" onClick={handlePause}>
                    Pause <span className="kbd">P</span>
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => void handleStop()}
                  disabled={ending}
                >
                  {ending ? 'Saving…' : 'End session'}
                </button>
              </>
            )}
          </div>

          <p className="detector-note">
            {idle.support === 'native' && idle.permissionGranted ? (
              <>Idle detection: system-wide (native)</>
            ) : idle.permissionRequired && !idle.permissionGranted ? (
              <>
                Idle detection: in-page fallback ·{' '}
                <button type="button" onClick={() => void idle.requestPermission()}>
                  enable system-wide detection
                </button>
              </>
            ) : (
              <>Idle detection: in-page fallback</>
            )}
            {' · '}threshold{' '}
            {thresholdSeconds % 60 === 0
              ? `${thresholdSeconds / 60} min`
              : `${(thresholdSeconds / 60).toFixed(1)} min`}
          </p>
          {idle.error && (
            <p className="detector-note" style={{ color: 'var(--danger)' }}>
              {idle.error}
            </p>
          )}
        </section>

        <aside className="card">
          <h2 className="card-title">Today</h2>
          <div className="goal-ring-wrap">
            <GoalRing percent={goalPct} />
            <div className="goal-meta">
              <div className="big">{fmtDuration(todayFocus)}</div>
              <div className="sub">
                of a {fmtDuration(DAILY_GOAL_SECONDS)} daily goal
              </div>
            </div>
          </div>
          <div className="stat-rows">
            <div className="stat-row">
              <span className="label">Pause</span>
              <span className="value" style={{ color: 'var(--pause)' }}>
                {fmtDuration(todayIdle)}
              </span>
            </div>
            <div className="stat-row">
              <span className="label">Sessions</span>
              <span className="value">{todaySessions}</span>
            </div>
            <div className="stat-row">
              <span className="label">Pause / focus ratio</span>
              <span className="value">{fmtPercent(todayRatio)}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

const GOAL_R = 30
const GOAL_C = 2 * Math.PI * GOAL_R

function GoalRing({ percent }: { percent: number }) {
  return (
    <svg
      className="goal-ring"
      width="84"
      height="84"
      viewBox="0 0 84 84"
      role="img"
      aria-label={`${percent}% of the daily focus goal`}
    >
      <circle className="track" cx="42" cy="42" r={GOAL_R} fill="none" strokeWidth="7" />
      <circle
        className="fill"
        cx="42"
        cy="42"
        r={GOAL_R}
        fill="none"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={GOAL_C}
        strokeDashoffset={GOAL_C * (1 - percent / 100)}
        transform="rotate(-90 42 42)"
      />
      <text x="42" y="42" textAnchor="middle" dominantBaseline="central" fontSize="17">
        {percent}%
      </text>
    </svg>
  )
}
