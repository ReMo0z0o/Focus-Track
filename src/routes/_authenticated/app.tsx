import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import {
  endSession,
  getProfile,
  getRecentSessions,
  startSession,
} from '@/lib/sessions.functions'
import { useIdleDetector } from '@/hooks/use-idle-detector'
import type { IdleState } from '@/hooks/use-idle-detector'
import { playReminderChime, unlockAudio } from '@/lib/audio'
import {
  DAILY_GOAL_SECONDS,
  filterSince,
  fmtClock,
  fmtDuration,
  fmtPercent,
  startOfDay,
  summarize,
} from '@/lib/stats'
import { useToast } from '@/components/Toaster'
import { useAuth } from '@/routes/__root'

export const Route = createFileRoute('/_authenticated/app')({
  component: SessionPage,
})

const GRACE_SECONDS = 15
/**
 * Gaps between ticks longer than this are treated as machine sleep or a
 * suspended tab and credited as pause. Chrome throttles background-tab
 * timers to one wake per minute, so this must sit above 60s to avoid
 * false positives while the user works in another window.
 */
const SLEEP_GAP_MS = 90_000

const BASE_TITLE = 'FocusGuard — honest focus time'

/** localStorage crash-recovery snapshot of the running session. */
const PERSIST_KEY = 'focusguard.active-session.v1'
/** Snapshots older than this are closed with their saved counters instead. */
const PERSIST_MAX_AGE_MS = 12 * 60 * 60 * 1000

interface PersistedSession {
  userId: string
  id: string
  startedAt: number
  focusMs: number
  idleMs: number
  resumes: number
  lastTick: number
  idleSince: number | null
  manualPause: boolean
  pauseConfirmedAt: number | null
}

function SessionPage() {
  const toast = useToast().toast
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const startSessionFn = useServerFn(startSession)
  const endSessionFn = useServerFn(endSession)
  const getProfileFn = useServerFn(getProfile)
  const getRecentSessionsFn = useServerFn(getRecentSessions)

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: () => getProfileFn(),
  })
  const sessionsQuery = useQuery({
    queryKey: ['sessions'],
    queryFn: () => getRecentSessionsFn(),
  })

  const thresholdSeconds = profileQuery.data?.idle_threshold_seconds ?? 120
  const soundEnabled = profileQuery.data?.sound_enabled ?? true

  /* ---------------- session state machine ---------------- */

  const [active, setActive] = useState<{ id: string; startedAt: number } | null>(null)
  const [focusSeconds, setFocusSeconds] = useState(0)
  const [idleSeconds, setIdleSeconds] = useState(0)
  const [resumes, setResumes] = useState(0)
  const [showIdleModal, setShowIdleModal] = useState(false)
  const [manualPause, setManualPause] = useState(false)
  /** Timestamp when inactivity was first detected (grace starts here). */
  const [idleSince, setIdleSince] = useState<number | null>(null)
  /** Timestamp when the pause became real (grace elapsed or manual pause). */
  const [pauseConfirmedAt, setPauseConfirmedAt] = useState<number | null>(null)
  /** Re-render clock driven by the tick engine. */
  const [nowTs, setNowTs] = useState(() => Date.now())

  const notifiedRef = useRef(false)
  const focusMsRef = useRef(0)
  const idleMsRef = useRef(0)
  const lastTickRef = useRef(Date.now())
  const activeRef = useRef(active)
  const pauseConfirmedRef = useRef(pauseConfirmedAt)

  useEffect(() => {
    activeRef.current = active
  }, [active])
  useEffect(() => {
    pauseConfirmedRef.current = pauseConfirmedAt
  }, [pauseConfirmedAt])

  /* ---------------- idle detection ---------------- */

  const handleIdleChange = useCallback((state: IdleState) => {
    if (!activeRef.current) return
    if (state === 'idle') {
      setIdleSince((prev) => prev ?? Date.now())
    } else {
      setIdleSince(null)
      notifiedRef.current = false
    }
  }, [])

  const idle = useIdleDetector({
    thresholdSeconds,
    enabled: !!active,
    onChange: handleIdleChange,
  })

  /* ---------------- derived state ---------------- */

  const graceElapsed =
    idleSince !== null && nowTs - idleSince >= GRACE_SECONDS * 1000
  const isIdle = pauseConfirmedAt !== null && !!active
  const inGrace =
    !!active &&
    pauseConfirmedAt === null &&
    idleSince !== null &&
    !graceElapsed &&
    idle.state === 'idle' &&
    !manualPause
  const graceFraction =
    inGrace && idleSince !== null
      ? Math.min(1, Math.max(0, (GRACE_SECONDS * 1000 - (nowTs - idleSince)) / (GRACE_SECONDS * 1000)))
      : 0
  const graceRemaining =
    inGrace && idleSince !== null
      ? Math.max(0, Math.ceil((GRACE_SECONDS * 1000 - (nowTs - idleSince)) / 1000))
      : 0

  /* ---------------- tick engine (Date.now() deltas) ---------------- */

  const tick = useCallback(() => {
    if (!activeRef.current) return
    const now = Date.now()
    const delta = now - lastTickRef.current
    lastTickRef.current = now
    if (delta > 0) {
      if (delta > SLEEP_GAP_MS) {
        // Machine slept or the tab was frozen: the whole gap is pause,
        // starting (retroactively) when the gap began.
        idleMsRef.current += delta
        setIdleSince((prev) => prev ?? now - delta)
        setPauseConfirmedAt((prev) => prev ?? now - delta)
      } else if (pauseConfirmedRef.current !== null) {
        idleMsRef.current += delta
      } else {
        focusMsRef.current += delta
      }
      setFocusSeconds(Math.floor(focusMsRef.current / 1000))
      setIdleSeconds(Math.floor(idleMsRef.current / 1000))
    }
    setNowTs(now)
  }, [])

  useEffect(() => {
    if (!active) return
    const interval = window.setInterval(tick, 1000)
    const onWake = () => tick()
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('focus', onWake)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('focus', onWake)
    }
  }, [active, tick])

  /* ---------------- grace elapse → confirmed pause ---------------- */

  useEffect(() => {
    if (!active || pauseConfirmedAt !== null) return
    if (manualPause) {
      setPauseConfirmedAt(Date.now())
      return
    }
    if (idleSince !== null && graceElapsed) {
      // Ticks may arrive late (throttled background tabs), so some post-grace
      // time can already sit in the focus bucket. Reclassify the overshoot
      // and anchor the pause where the grace window actually ended.
      const confirmedAt = idleSince + GRACE_SECONDS * 1000
      const overshoot = Date.now() - confirmedAt
      if (overshoot > 2000) {
        const move = Math.min(focusMsRef.current, overshoot)
        focusMsRef.current -= move
        idleMsRef.current += move
        setFocusSeconds(Math.floor(focusMsRef.current / 1000))
        setIdleSeconds(Math.floor(idleMsRef.current / 1000))
      }
      setPauseConfirmedAt(confirmedAt)
    }
  }, [active, manualPause, idleSince, graceElapsed, pauseConfirmedAt])

  /* ---------------- modal + notification + sound ---------------- */

  const modalShouldOpen = !!active && (manualPause || idleSince !== null)

  useEffect(() => {
    if (!active) return
    if (modalShouldOpen) {
      setShowIdleModal(true)
      if (!notifiedRef.current) {
        notifiedRef.current = true
        if (
          !manualPause &&
          typeof Notification !== 'undefined' &&
          Notification.permission === 'granted'
        ) {
          try {
            const n = new Notification('Still there?', {
              body: 'FocusGuard noticed you went quiet — your session will pause soon.',
              tag: 'focusguard-idle',
            })
            n.onclick = () => {
              window.focus()
              n.close()
            }
          } catch {
            // Notification construction can throw on some platforms; ignore.
          }
        }
        if (soundEnabled) playReminderChime()
      }
    } else if (pauseConfirmedAt === null) {
      // Activity came back during grace — dismiss quietly.
      setShowIdleModal(false)
    }
  }, [active, modalShouldOpen, manualPause, pauseConfirmedAt, soundEnabled])

  /* ---------------- crash recovery (localStorage) ---------------- */

  // Snapshot the running session once per tick so a closed tab or crash
  // can be recovered. Cleared on stop; overwritten on start.
  useEffect(() => {
    if (typeof window === 'undefined' || !active || !user) return
    const snapshot: PersistedSession = {
      userId: user.id,
      id: active.id,
      startedAt: active.startedAt,
      focusMs: focusMsRef.current,
      idleMs: idleMsRef.current,
      resumes,
      lastTick: lastTickRef.current,
      idleSince,
      manualPause,
      pauseConfirmedAt,
    }
    try {
      localStorage.setItem(PERSIST_KEY, JSON.stringify(snapshot))
    } catch {
      // Storage full/unavailable — recovery is best-effort.
    }
  }, [active, user, nowTs, resumes, idleSince, manualPause, pauseConfirmedAt])

  const restoredRef = useRef(false)

  useEffect(() => {
    if (restoredRef.current || typeof window === 'undefined' || !user) return
    if (activeRef.current) return
    restoredRef.current = true
    let saved: PersistedSession | null = null
    try {
      const raw = localStorage.getItem(PERSIST_KEY)
      if (raw) saved = JSON.parse(raw) as PersistedSession
    } catch {
      saved = null
    }
    if (!saved || saved.userId !== user.id || typeof saved.id !== 'string') {
      return
    }
    const age = Date.now() - saved.lastTick
    if (age > PERSIST_MAX_AGE_MS) {
      // Too old to resume meaningfully — close it with the counters we have
      // so it doesn't linger as a zero-second "in progress" row.
      localStorage.removeItem(PERSIST_KEY)
      void endSessionFn({
        data: {
          id: saved.id,
          focus_seconds: Math.floor(saved.focusMs / 1000),
          idle_seconds: Math.floor(saved.idleMs / 1000),
          resumes_count: saved.resumes,
        },
      })
        .then(() => queryClient.invalidateQueries({ queryKey: ['sessions'] }))
        .catch(() => {})
      return
    }
    // Restore, classifying the offline gap explicitly: a quick reload (≤10s)
    // continues seamlessly in whichever bucket was running; anything longer
    // is pause that needs an explicit Resume.
    const now = Date.now()
    const gap = Math.max(0, now - saved.lastTick)
    let focusMs = saved.focusMs
    let idleMs = saved.idleMs
    let idleSinceValue = saved.idleSince
    let pauseConfirmedValue = saved.pauseConfirmedAt
    if (gap > 10_000) {
      idleMs += gap
      idleSinceValue = idleSinceValue ?? saved.lastTick
      pauseConfirmedValue = pauseConfirmedValue ?? saved.lastTick
    } else if (pauseConfirmedValue !== null) {
      idleMs += gap
    } else {
      focusMs += gap
    }
    focusMsRef.current = focusMs
    idleMsRef.current = idleMs
    lastTickRef.current = now
    notifiedRef.current = true // don't replay the chime on restore
    setFocusSeconds(Math.floor(focusMs / 1000))
    setIdleSeconds(Math.floor(idleMs / 1000))
    setResumes(saved.resumes)
    setIdleSince(idleSinceValue)
    setManualPause(saved.manualPause)
    setPauseConfirmedAt(pauseConfirmedValue)
    setActive({ id: saved.id, startedAt: saved.startedAt })
    setNowTs(now)
    if (gap > 10_000) {
      toast('Recovered your running session — time away counts as pause.')
    }
  }, [user, endSessionFn, queryClient, toast])

  /* ---------------- handlers ---------------- */

  const startMutation = useMutation({
    mutationFn: () => startSessionFn(),
  })

  const resetSessionState = useCallback(() => {
    focusMsRef.current = 0
    idleMsRef.current = 0
    lastTickRef.current = Date.now()
    notifiedRef.current = false
    setFocusSeconds(0)
    setIdleSeconds(0)
    setResumes(0)
    setIdleSince(null)
    setManualPause(false)
    setPauseConfirmedAt(null)
    setShowIdleModal(false)
    setNowTs(Date.now())
  }, [])

  const handleStart = useCallback(async () => {
    if (startMutation.isPending || activeRef.current) return
    unlockAudio()
    try {
      if (idle.permissionRequired && !idle.permissionGranted) {
        await idle.requestPermission()
      }
      if (
        typeof Notification !== 'undefined' &&
        Notification.permission === 'default'
      ) {
        await Notification.requestPermission().catch(() => null)
      }
      const row = await startMutation.mutateAsync()
      try {
        localStorage.removeItem(PERSIST_KEY)
      } catch {
        // best effort
      }
      resetSessionState()
      setActive({ id: row.id, startedAt: new Date(row.started_at).getTime() })
      idle.markActive()
    } catch (err) {
      toast(
        err instanceof Error && /unauthorized/i.test(err.message)
          ? 'Your session expired — please sign in again.'
          : 'Could not start the session. Check your connection and retry.',
        'error',
      )
    }
  }, [idle, resetSessionState, startMutation, toast])

  const handleStop = useCallback(async () => {
    const current = activeRef.current
    if (!current) return
    tick() // settle accounts up to this instant
    const payload = {
      id: current.id,
      focus_seconds: Math.floor(focusMsRef.current / 1000),
      idle_seconds: Math.floor(idleMsRef.current / 1000),
      resumes_count: resumes,
    }
    try {
      await endSessionFn({ data: payload })
      toast(
        `Session saved — ${fmtDuration(payload.focus_seconds)} of focus`,
        'success',
      )
      try {
        localStorage.removeItem(PERSIST_KEY)
      } catch {
        // best effort
      }
      setActive(null)
      resetSessionState()
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
    } catch {
      toast('Could not save the session — it is still running. Try again.', 'error')
    }
  }, [endSessionFn, queryClient, resetSessionState, resumes, tick, toast])

  const handlePause = useCallback(() => {
    if (!activeRef.current || pauseConfirmedRef.current !== null) return
    tick() // credit focus up to the pause instant
    setManualPause(true)
    setShowIdleModal(true)
    setPauseConfirmedAt((prev) => prev ?? Date.now())
  }, [tick])

  const handleResume = useCallback(() => {
    tick() // settle the pause up to this instant
    if (inGrace) {
      // Silently cancel the grace countdown — no resume is counted.
      setShowIdleModal(false)
      setIdleSince(null)
      notifiedRef.current = false
      idle.markActive()
      return
    }
    setResumes((r) => r + 1)
    setShowIdleModal(false)
    setManualPause(false)
    setIdleSince(null)
    setPauseConfirmedAt(null)
    notifiedRef.current = false
    idle.markActive()
  }, [idle, inGrace, tick])

  /* ---------------- keyboard shortcut: P ---------------- */

  const handlePauseRef = useRef(handlePause)
  handlePauseRef.current = handlePause

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'p' && e.key !== 'P') return
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
      const t = e.target as HTMLElement | null
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      ) {
        return
      }
      handlePauseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* ---------------- tab title mirrors the timer ---------------- */

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (!active) {
      document.title = BASE_TITLE
      return
    }
    document.title = isIdle
      ? `⏸ ${fmtClock(focusSeconds)} paused · FocusGuard`
      : `● ${fmtClock(focusSeconds)} focus · FocusGuard`
    return () => {
      document.title = BASE_TITLE
    }
  }, [active, isIdle, focusSeconds])

  /* ---------------- warn before losing a running session ---------------- */

  useEffect(() => {
    if (!active) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [active])

  /* ---------------- today panel ---------------- */

  const today = useMemo(() => {
    const rows = sessionsQuery.data ?? []
    const todayRows = filterSince(rows, startOfDay(new Date(nowTs)))
    return summarize(todayRows)
  }, [sessionsQuery.data, nowTs])

  const todayFocus = today.focus + focusSeconds
  const todayIdle = today.idle + idleSeconds
  const todaySessions = today.sessions + (active ? 1 : 0)
  const todayRatio = todayFocus > 0 ? todayIdle / todayFocus : 0
  const goalPct = Math.min(100, Math.round((todayFocus / DAILY_GOAL_SECONDS) * 100))

  /* ---------------- render ---------------- */

  const statusChip = !active ? (
    <span className="status-chip">
      <span className="status-dot" />
      No session
    </span>
  ) : isIdle ? (
    <span className="status-chip paused">
      <span className="status-dot" />
      Paused
    </span>
  ) : idleSince !== null ? (
    <span className="status-chip paused">
      <span className="status-dot" />
      Inactivity detected
    </span>
  ) : (
    <span className="status-chip running">
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
        <section
          className={`card timer-card${active && !isIdle ? ' is-running' : ''}`}
          aria-live="polite"
        >
          {statusChip}

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
              {new Date(active.startedAt).toLocaleTimeString([], {
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
                disabled={startMutation.isPending}
              >
                {startMutation.isPending ? 'Starting…' : 'Start session'}
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
                >
                  End session
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
            {' · '}threshold {formatThresholdMinutes(thresholdSeconds)}
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

      {showIdleModal && active && (
        <IdleModal
          inGrace={inGrace}
          manualPause={manualPause}
          graceFraction={graceFraction}
          graceRemaining={graceRemaining}
          thresholdSeconds={thresholdSeconds}
          currentPauseSeconds={
            pauseConfirmedAt !== null
              ? Math.max(0, Math.floor((nowTs - pauseConfirmedAt) / 1000))
              : 0
          }
          totalPauseSeconds={idleSeconds}
          onResume={handleResume}
          onStop={() => void handleStop()}
        />
      )}
    </div>
  )
}

function formatThresholdMinutes(seconds: number): string {
  const minutes = seconds / 60
  return Number.isInteger(minutes) ? `${minutes} min` : `${minutes.toFixed(1)} min`
}

/* ------------------------------------------------------------------ */
/* Idle / pause modal                                                  */
/* ------------------------------------------------------------------ */

function IdleModal({
  inGrace,
  manualPause,
  graceFraction,
  graceRemaining,
  thresholdSeconds,
  currentPauseSeconds,
  totalPauseSeconds,
  onResume,
  onStop,
}: {
  inGrace: boolean
  manualPause: boolean
  graceFraction: number
  graceRemaining: number
  thresholdSeconds: number
  currentPauseSeconds: number
  totalPauseSeconds: number
  onResume: () => void
  onStop: () => void
}) {
  return (
    <div className="modal-overlay" role="presentation">
      <div
        className="modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="idle-modal-title"
      >
        <h2 id="idle-modal-title">{inGrace ? 'Still there?' : 'Paused'}</h2>
        <p className="modal-text">
          {inGrace
            ? 'Inactivity detected. Tap before the ring empties to keep your session going.'
            : manualPause
              ? 'Session paused. Take your time — the focus timer is frozen until you resume.'
              : `More than ${formatThresholdMinutes(thresholdSeconds)} of inactivity detected. Confirm to resume the focus timer.`}
        </p>

        {inGrace ? (
          <>
            <div className="grace-ring-wrap">
              <GraceRing fraction={graceFraction} remaining={graceRemaining} />
            </div>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={onResume}
              autoFocus
            >
              I'm here
            </button>
          </>
        ) : (
          <>
            <div className="pause-facts">
              <div>
                <div className="label">Current pause</div>
                <div className="value">{fmtDuration(currentPauseSeconds)}</div>
              </div>
              <div>
                <div className="label">Total pause</div>
                <div className="value">{fmtDuration(totalPauseSeconds)}</div>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={onResume}
              autoFocus
            >
              Resume
            </button>
            <button
              type="button"
              className="btn btn-ghost mt-1"
              onClick={onStop}
            >
              End session
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Rings                                                               */
/* ------------------------------------------------------------------ */

const GRACE_R = 44
const GRACE_C = 2 * Math.PI * GRACE_R

function GraceRing({
  fraction,
  remaining,
}: {
  fraction: number
  remaining: number
}) {
  return (
    <svg
      className="grace-ring"
      width="120"
      height="120"
      viewBox="0 0 120 120"
      role="timer"
      aria-label={`${remaining} seconds to confirm you are here`}
    >
      <circle className="track" cx="60" cy="60" r={GRACE_R} fill="none" strokeWidth="7" />
      <circle
        className="fill"
        cx="60"
        cy="60"
        r={GRACE_R}
        fill="none"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={GRACE_C}
        strokeDashoffset={GRACE_C * (1 - fraction)}
        transform="rotate(-90 60 60)"
      />
      <text x="60" y="60" textAnchor="middle" dominantBaseline="central" fontSize="34">
        {remaining}
      </text>
    </svg>
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
