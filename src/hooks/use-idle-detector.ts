import { useCallback, useEffect, useRef, useState } from 'react'

export type IdleState = 'active' | 'idle'
export type IdleSupport = 'native' | 'fallback'

export interface UseIdleDetectorOptions {
  thresholdSeconds: number
  enabled: boolean
  onChange?: (state: IdleState) => void
}

export interface IdleDetectorAPI {
  state: IdleState
  support: IdleSupport
  permissionRequired: boolean
  permissionGranted: boolean
  requestPermission: () => Promise<boolean>
  markActive: () => void
  error: string | null
}

interface NativeIdleDetector extends EventTarget {
  userState: 'active' | 'idle' | null
  screenState: 'locked' | 'unlocked' | null
  start: (options: { threshold: number; signal?: AbortSignal }) => Promise<void>
}

interface NativeIdleDetectorConstructor {
  new (): NativeIdleDetector
  requestPermission: () => Promise<'granted' | 'denied'>
}

declare global {
  interface Window {
    IdleDetector?: NativeIdleDetectorConstructor
  }
}

const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
] as const

/**
 * Detects user inactivity.
 *
 * Uses the system-wide `IdleDetector` API when available and permitted
 * (Chromium, secure context) — it sees keyboard/mouse activity in *any*
 * app and screen locks. Otherwise falls back to in-page activity events
 * with a per-second threshold check.
 */
export function useIdleDetector({
  thresholdSeconds,
  enabled,
  onChange,
}: UseIdleDetectorOptions): IdleDetectorAPI {
  const [state, setState] = useState<IdleState>('active')
  const [support, setSupport] = useState<IdleSupport>('fallback')
  const [permissionGranted, setPermissionGranted] = useState(false)
  const [nativeFailed, setNativeFailed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stateRef = useRef<IdleState>('active')
  const lastActivityRef = useRef<number>(Date.now())
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const transition = useCallback((next: IdleState) => {
    if (stateRef.current === next) return
    stateRef.current = next
    setState(next)
    onChangeRef.current?.(next)
  }, [])

  // Feature-detect after mount (SSR-safe) and read the current permission
  // state without prompting.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.IdleDetector) return
    setSupport('native')
    let cancelled = false
    let watched: PermissionStatus | null = null
    const onPermissionChange = () => {
      if (watched) setPermissionGranted(watched.state === 'granted')
    }
    navigator.permissions
      ?.query({ name: 'idle-detection' as PermissionName })
      .then((status) => {
        if (cancelled) return
        watched = status
        setPermissionGranted(status.state === 'granted')
        status.addEventListener('change', onPermissionChange)
      })
      .catch(() => {
        // Permission introspection unavailable; requestPermission() will tell us.
      })
    return () => {
      cancelled = true
      watched?.removeEventListener('change', onPermissionChange)
    }
  }, [])

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !window.IdleDetector) return false
    try {
      const result = await window.IdleDetector.requestPermission()
      const granted = result === 'granted'
      setPermissionGranted(granted)
      if (!granted) setError('Idle detection permission denied — using in-page fallback.')
      return granted
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Idle detection permission request failed.')
      return false
    }
  }, [])

  const useNative = support === 'native' && permissionGranted && !nativeFailed

  // --- Native mode -------------------------------------------------
  useEffect(() => {
    if (!enabled || !useNative || typeof window === 'undefined') return
    const IdleDetectorCtor = window.IdleDetector
    if (!IdleDetectorCtor) return

    const controller = new AbortController()
    const detector = new IdleDetectorCtor()

    detector.addEventListener('change', () => {
      const idle =
        detector.userState === 'idle' || detector.screenState === 'locked'
      if (!idle) lastActivityRef.current = Date.now()
      transition(idle ? 'idle' : 'active')
    })

    detector
      .start({
        // The native API requires a threshold of at least 60s.
        threshold: Math.max(60_000, thresholdSeconds * 1000),
        signal: controller.signal,
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return
        setError(
          e instanceof Error
            ? `Idle detector failed to start: ${e.message}`
            : 'Idle detector failed to start.',
        )
        setNativeFailed(true)
      })

    return () => controller.abort()
  }, [enabled, useNative, thresholdSeconds, transition])

  // --- Fallback mode -----------------------------------------------
  useEffect(() => {
    if (!enabled || useNative || typeof window === 'undefined') return

    lastActivityRef.current = Date.now()

    const onActivity = () => {
      lastActivityRef.current = Date.now()
      transition('active')
    }

    const check = () => {
      if (Date.now() - lastActivityRef.current >= thresholdSeconds * 1000) {
        transition('idle')
      }
    }

    const onVisibility = () => {
      // No events reach a hidden tab, so lastActivity naturally stalls and
      // the threshold check flags idle. Re-check as soon as we're visible.
      if (document.visibilityState === 'visible') check()
    }

    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, onActivity, { passive: true })
    }
    document.addEventListener('visibilitychange', onVisibility)
    const interval = window.setInterval(check, 1000)

    return () => {
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, onActivity)
      }
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(interval)
    }
  }, [enabled, useNative, thresholdSeconds, transition])

  // Reset to active whenever detection is turned off.
  useEffect(() => {
    if (!enabled) {
      lastActivityRef.current = Date.now()
      transition('active')
    }
  }, [enabled, transition])

  const markActive = useCallback(() => {
    lastActivityRef.current = Date.now()
    transition('active')
  }, [transition])

  return {
    state,
    support: useNative ? 'native' : 'fallback',
    permissionRequired: support === 'native',
    permissionGranted,
    requestPermission,
    markActive,
    error,
  }
}
