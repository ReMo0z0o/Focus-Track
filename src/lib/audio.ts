/**
 * Tiny reminder chime built on the Web Audio API — two soft sine notes
 * with an exponential decay, quiet enough not to startle.
 */

let ctx: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!Ctor) return null
  if (!ctx) ctx = new Ctor()
  return ctx
}

/**
 * Call from a user gesture (e.g. the Start button) so the context is
 * unlocked before we need to play unattended.
 */
export function unlockAudio(): void {
  const c = getContext()
  if (c && c.state === 'suspended') {
    void c.resume().catch(() => {})
  }
}

function note(
  c: AudioContext,
  frequency: number,
  startAt: number,
  duration: number,
  peakGain: number,
): void {
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sine'
  osc.frequency.value = frequency
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(peakGain, startAt + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start(startAt)
  osc.stop(startAt + duration + 0.05)
}

/** Gentle two-note "are you there?" chime (~0.45s total). */
export function playReminderChime(): void {
  const c = getContext()
  if (!c) return
  const play = () => {
    const t = c.currentTime
    note(c, 660, t, 0.25, 0.06)
    note(c, 528, t + 0.18, 0.28, 0.05)
  }
  if (c.state === 'suspended') {
    void c.resume().then(play).catch(() => {})
  } else {
    play()
  }
}
