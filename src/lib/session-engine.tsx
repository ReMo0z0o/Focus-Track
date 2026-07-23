import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { endSession, getProfile, startSession } from '@/lib/sessions.functions'
import { useIdleDetector } from '@/hooks/use-idle-detector'
import type { IdleDetectorAPI, IdleState } from '@/hooks/use-idle-detector'
import { DEFAULT_REMINDER_SOUND, playReminderSound, unlockAudio } from '@/lib/audio'
import { fmtClock, fmtDuration } from '@/lib/stats'
import { useToast } from '@/components/Toaster'
import { useAuth } from '@/routes/__root'

/**
 * The running-session state machine, hosted at the authenticated-layout
 * level so the timer, idle detection and pause prompts survive in-app
 * navigation (Stats, Settings) — only closing the tab interrupts it, and
 * crash recovery covers that.
 */

export const GRACE_SECONDS = 15
/**
 * Gaps between ticks longer than this are treated as machine sleep or a
 * suspended tab and credited as pause. Chrome throttles background-tab
 * timers to one wake per minute, so this must sit above 60s to avoid
 * false positives while the user works in another window.
 */
export const SLEEP_GAP_MS = 90_000

const BASE_TITLE = 'FocusGuard — honest focus time'

/** localStorage crash-recovery snapshot of the running session. */
const PERSIST_KEY = 'focusguard.active-session.v1'
/** Snapshots older than this are closed with their saved counters instead. */
const PERSIST_MAX_AGE_MS = 12 * 60 * 60 * 1000
/** Cross-tab coordination channel. */
const CHANNEL_NAME = 'focusguard-session'

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

export interface SessionEngine {
  active: { id: string; startedAt: number } | null
  focusSeconds: number
  idleSeconds: number
  resumes: number
  nowTs: number
  /** Confirmed pause — focus clock frozen until an explicit resume. */
  isIdle: boolean
  /** Grace countdown running (focus clock still counting). */
  inGrace: boolean
  graceFraction: number
  graceRemaining: number
  showIdleModal: boolean
  manualPause: boolean
  pauseConfirmedAt: number | null
  thresholdSeconds: number
  soundEnabled: boolean
  starting: boolean
  ending: boolean
  idle: IdleDetectorAPI
  handleStart: () => Promise<void>
  handleStop: () => Promise<void>
  handlePause: () => void
  handleResume: () => void
}

const SessionEngineContext = createContext<SessionEngine | null>(null)

export function useSessionEngine(): SessionEngine {
  const engine = useContext(SessionEngineContext)
  if (!engine) {
    throw new Error('useSessionEngine must be used within SessionEngineProvider')
  }
  return engine
}

export function SessionEngineProvider({ children }: { children: ReactNode }) {
  const toast = useToast().toast
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const startSessionFn = useServerFn(startSession)
  const endSessionFn = useServerFn(endSession)
  const getProfileFn = useServerFn(getProfile)

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: () => getProfileFn(),
  })
  const thresholdSeconds = profileQuery.data?.idle_threshold_seconds ?? 120
  const soundEnabled = profileQuery.data?.sound_enabled ?? true
  const reminderSound = profileQuery.data?.reminder_sound ?? DEFAULT_REMINDER_SOUND

  /* ---------------- state ---------------- */

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
  const [starting, setStarting] = useState(false)
  const [ending, setEnding] = useState(false)

  const notifiedRef = useRef(false)
  const focusMsRef = useRef(0)
  const idleMsRef = useRef(0)
  const lastTickRef = useRef(Date.now())
  const activeRef = useRef(active)
  const pauseConfirmedRef = useRef(pauseConfirmedAt)
  const startingRef = useRef(false)
  const endingRef = useRef(false)
  const channelRef = useRef<BroadcastChannel | null>(null)

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
      // Re-arm the notification only when no pause is confirmed — nudging
      // the mouse mid-pause must not queue another chime for the next idle.
      if (pauseConfirmedRef.current === null) {
        notifiedRef.current = false
      }
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
      ? Math.min(
          1,
          Math.max(0, (GRACE_SECONDS * 1000 - (nowTs - idleSince)) / (GRACE_SECONDS * 1000)),
        )
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
    if (!active) {
      // Keep a slow clock while idle so day boundaries (Today panel) stay
      // fresh even if the app sits open past midnight.
      const slow = window.setInterval(() => setNowTs(Date.now()), 60_000)
      return () => window.clearInterval(slow)
    }
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

  // The modal is the resume UI: it must be open whenever a pause is
  // confirmed, during grace, and on manual pause.
  const modalShouldOpen =
    !!active && (manualPause || idleSince !== null || pauseConfirmedAt !== null)

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
        if (soundEnabled) playReminderSound(reminderSound)
      }
    } else {
      // Activity came back during grace — dismiss quietly.
      setShowIdleModal(false)
    }
  }, [active, modalShouldOpen, manualPause, soundEnabled, reminderSound])

  /* ---------------- cross-tab coordination ---------------- */

  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return
    const channel = new BroadcastChannel(CHANNEL_NAME)
    channelRef.current = channel
    channel.onmessage = (event: MessageEvent) => {
      const msg = event.data as { type?: string; id?: string }
      if (msg?.type === 'ping' && activeRef.current) {
        channel.postMessage({ type: 'alive', id: activeRef.current.id })
      } else if (
        msg?.type === 'ended' &&
        activeRef.current &&
        msg.id === activeRef.current.id
      ) {
        // Another tab saved this session — drop our copy without re-saving.
        setActive(null)
        resetSessionStateRef.current?.()
        toast('Session ended in another tab.')
        void queryClient.invalidateQueries({ queryKey: ['sessions'] })
      }
    }
    return () => {
      channelRef.current = null
      channel.close()
    }
  }, [queryClient, toast])

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
    const snapshot = saved

    const restore = () => {
      const age = Date.now() - snapshot.lastTick
      if (age > PERSIST_MAX_AGE_MS) {
        // Too old to resume meaningfully — close it with the counters we have
        // so it doesn't linger as a zero-second "in progress" row.
        localStorage.removeItem(PERSIST_KEY)
        void endSessionFn({
          data: {
            id: snapshot.id,
            focus_seconds: Math.floor(snapshot.focusMs / 1000),
            idle_seconds: Math.floor(snapshot.idleMs / 1000),
            resumes_count: snapshot.resumes,
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
      const gap = Math.max(0, now - snapshot.lastTick)
      let focusMs = snapshot.focusMs
      let idleMs = snapshot.idleMs
      let idleSinceValue = snapshot.idleSince
      let pauseConfirmedValue = snapshot.pauseConfirmedAt
      if (gap > 10_000) {
        idleMs += gap
        idleSinceValue = idleSinceValue ?? snapshot.lastTick
        pauseConfirmedValue = pauseConfirmedValue ?? snapshot.lastTick
      } else if (pauseConfirmedValue !== null) {
        idleMs += gap
      } else {
        focusMs += gap
        // A grace countdown from before the reload is stale — the fresh
        // detector starts 'active' and would never clear idleSince.
        idleSinceValue = null
      }
      focusMsRef.current = focusMs
      idleMsRef.current = idleMs
      lastTickRef.current = now
      // Suppress the chime only when restoring into an already-prompted
      // state; a clean focused restore keeps future alerts armed.
      notifiedRef.current = pauseConfirmedValue !== null || idleSinceValue !== null
      setFocusSeconds(Math.floor(focusMs / 1000))
      setIdleSeconds(Math.floor(idleMs / 1000))
      setResumes(snapshot.resumes)
      setIdleSince(idleSinceValue)
      setManualPause(snapshot.manualPause)
      setPauseConfirmedAt(pauseConfirmedValue)
      setActive({ id: snapshot.id, startedAt: snapshot.startedAt })
      setNowTs(now)
      if (pauseConfirmedValue !== null) setShowIdleModal(true)
      if (gap > 10_000) {
        toast('Recovered your running session — time away counts as pause.')
      }
    }

    // If another tab is still running this session, don't adopt it.
    const channel = channelRef.current
    if (channel) {
      let claimed = false
      const listener = (event: MessageEvent) => {
        const msg = event.data as { type?: string; id?: string }
        if (msg?.type === 'alive' && msg.id === snapshot.id) claimed = true
      }
      channel.addEventListener('message', listener)
      channel.postMessage({ type: 'ping' })
      window.setTimeout(() => {
        channel.removeEventListener('message', listener)
        if (!claimed) restore()
      }, 400)
    } else {
      restore()
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

  const resetSessionStateRef = useRef<(() => void) | null>(null)
  resetSessionStateRef.current = resetSessionState

  const handleStart = useCallback(async () => {
    if (startingRef.current || activeRef.current) return
    startingRef.current = true
    setStarting(true)
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
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
    } catch (err) {
      toast(
        err instanceof Error && /unauthorized/i.test(err.message)
          ? 'Your session expired — please sign in again.'
          : 'Could not start the session. Check your connection and retry.',
        'error',
      )
    } finally {
      startingRef.current = false
      setStarting(false)
    }
  }, [idle, queryClient, resetSessionState, startMutation, toast])

  const handleStop = useCallback(async () => {
    const current = activeRef.current
    if (!current || endingRef.current) return
    endingRef.current = true
    setEnding(true)
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
      channelRef.current?.postMessage({ type: 'ended', id: current.id })
      setActive(null)
      resetSessionState()
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
    } catch {
      toast('Could not save the session — it is still running. Try again.', 'error')
    } finally {
      endingRef.current = false
      setEnding(false)
    }
  }, [endSessionFn, queryClient, resetSessionState, resumes, tick, toast])

  const handlePause = useCallback(() => {
    if (!activeRef.current || pauseConfirmedRef.current !== null) return
    tick() // credit focus up to the pause instant
    setManualPause(true)
    setShowIdleModal(true)
    setPauseConfirmedAt((prev) => prev ?? Date.now())
  }, [tick])

  const inGraceRef = useRef(inGrace)
  inGraceRef.current = inGrace

  const handleResume = useCallback(() => {
    tick() // settle the pause up to this instant
    if (inGraceRef.current) {
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
  }, [idle, tick])

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

  const engine: SessionEngine = {
    active,
    focusSeconds,
    idleSeconds,
    resumes,
    nowTs,
    isIdle,
    inGrace,
    graceFraction,
    graceRemaining,
    showIdleModal,
    manualPause,
    pauseConfirmedAt,
    thresholdSeconds,
    soundEnabled,
    starting,
    ending,
    idle,
    handleStart,
    handleStop,
    handlePause,
    handleResume,
  }

  return (
    <SessionEngineContext.Provider value={engine}>
      {children}
    </SessionEngineContext.Provider>
  )
}
