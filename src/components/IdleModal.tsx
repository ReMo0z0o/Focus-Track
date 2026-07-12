import { useEffect, useRef } from 'react'
import { fmtDuration } from '@/lib/stats'
import { useSessionEngine } from '@/lib/session-engine'

function formatThresholdMinutes(seconds: number): string {
  const minutes = seconds / 60
  const value = Number.isInteger(minutes) ? `${minutes}` : minutes.toFixed(1)
  return `${value} minute${minutes === 1 ? '' : 's'}`
}

/**
 * The inactivity / pause dialog. Rendered at the authenticated-layout level
 * so it appears on any page while a session is running.
 */
export function IdleModal() {
  const {
    active,
    showIdleModal,
    inGrace,
    manualPause,
    graceFraction,
    graceRemaining,
    thresholdSeconds,
    pauseConfirmedAt,
    idleSeconds,
    nowTs,
    ending,
    handleResume,
    handleStop,
  } = useSessionEngine()

  const open = showIdleModal && !!active

  const dialogRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  // Focus management: remember the opener, trap Tab inside, Escape resumes,
  // and give focus back when the dialog closes.
  useEffect(() => {
    if (!open) return
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    const onKeyDown = (e: KeyboardEvent) => {
      const dialog = dialogRef.current
      if (!dialog) return
      if (e.key === 'Escape') {
        e.preventDefault()
        handleResumeRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>('button:not([disabled])'),
      )
      if (focusables.length === 0) return
      const first = focusables[0]!
      const last = focusables[focusables.length - 1]!
      const activeEl = document.activeElement
      if (e.shiftKey) {
        if (activeEl === first || !dialog.contains(activeEl)) {
          e.preventDefault()
          last.focus()
        }
      } else if (activeEl === last || !dialog.contains(activeEl)) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      previouslyFocusedRef.current?.focus?.()
    }
  }, [open])

  const handleResumeRef = useRef(handleResume)
  handleResumeRef.current = handleResume

  if (!open) return null

  const currentPauseSeconds =
    pauseConfirmedAt !== null
      ? Math.max(0, Math.floor((nowTs - pauseConfirmedAt) / 1000))
      : 0

  return (
    <div className="modal-overlay" role="presentation">
      <div
        ref={dialogRef}
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
              onClick={handleResume}
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
                <div className="value">{fmtDuration(idleSeconds)}</div>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={handleResume}
              autoFocus
            >
              Resume
            </button>
            <button
              type="button"
              className="btn btn-ghost mt-1"
              onClick={() => void handleStop()}
              disabled={ending}
            >
              {ending ? 'Saving…' : 'End session'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

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
