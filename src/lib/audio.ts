/**
 * Reminder sounds built on the Web Audio API — fully synthesized (no
 * audio assets), quiet enough not to startle. The user picks one in
 * Settings; the session engine plays it when an inactivity check fires.
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

interface NoteOpts {
  type?: OscillatorType
  /** Glide the pitch to this frequency over the note's duration. */
  bendTo?: number
  /** Low-pass cutoff to soften harsh waveforms. */
  lowpass?: number
}

function note(
  c: AudioContext,
  frequency: number,
  startAt: number,
  duration: number,
  peakGain: number,
  opts: NoteOpts = {},
): void {
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = opts.type ?? 'sine'
  osc.frequency.setValueAtTime(frequency, startAt)
  if (opts.bendTo) {
    osc.frequency.exponentialRampToValueAtTime(opts.bendTo, startAt + duration)
  }
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(peakGain, startAt + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  osc.connect(gain)
  if (opts.lowpass) {
    const filter = c.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = opts.lowpass
    gain.connect(filter)
    filter.connect(c.destination)
  } else {
    gain.connect(c.destination)
  }
  osc.start(startAt)
  osc.stop(startAt + duration + 0.05)
}

/* ------------------------------------------------------------------ */
/* The catalog                                                         */
/* ------------------------------------------------------------------ */

export interface ReminderSoundDef {
  id: string
  name: string
  description: string
}

export const DEFAULT_REMINDER_SOUND = 'chime'

export const REMINDER_SOUNDS: ReminderSoundDef[] = [
  { id: 'chime', name: 'Chime', description: 'Two soft notes — the original.' },
  { id: 'bell', name: 'Bell', description: 'A single strike, ringing out.' },
  { id: 'marimba', name: 'Marimba', description: 'Three quick wooden notes.' },
  { id: 'birds', name: 'Birdsong', description: 'A couple of light chirps.' },
  { id: 'drop', name: 'Water drop', description: 'A drip and its echo.' },
  { id: 'pulse', name: 'Pulse', description: 'A gentle wristwatch beep.' },
]

const SYNTHS: Record<string, (c: AudioContext, t: number) => void> = {
  chime(c, t) {
    note(c, 660, t, 0.25, 0.06)
    note(c, 528, t + 0.18, 0.28, 0.05)
  },
  bell(c, t) {
    // fundamental + inharmonic partials, long decay
    note(c, 440, t, 1.4, 0.06)
    note(c, 440 * 2.32, t, 1.0, 0.025)
    note(c, 440 * 3.76, t, 0.6, 0.012)
  },
  marimba(c, t) {
    note(c, 523, t, 0.16, 0.07, { type: 'triangle' })
    note(c, 659, t + 0.14, 0.16, 0.06, { type: 'triangle' })
    note(c, 784, t + 0.28, 0.22, 0.06, { type: 'triangle' })
  },
  birds(c, t) {
    note(c, 1420, t, 0.12, 0.035, { bendTo: 2100 })
    note(c, 1560, t + 0.2, 0.1, 0.03, { bendTo: 2350 })
    note(c, 1380, t + 0.34, 0.14, 0.03, { bendTo: 1980 })
  },
  drop(c, t) {
    note(c, 1150, t, 0.22, 0.06, { bendTo: 320 })
    note(c, 980, t + 0.34, 0.16, 0.025, { bendTo: 340 })
  },
  pulse(c, t) {
    note(c, 880, t, 0.09, 0.035, { type: 'square', lowpass: 2200 })
    note(c, 880, t + 0.16, 0.09, 0.035, { type: 'square', lowpass: 2200 })
  },
}

/** Play a reminder sound by id (unknown ids fall back to the chime). */
export function playReminderSound(id: string): void {
  const c = getContext()
  if (!c) return
  const synth = SYNTHS[id] ?? SYNTHS[DEFAULT_REMINDER_SOUND]!
  const play = () => synth(c, c.currentTime)
  if (c.state === 'suspended') {
    void c.resume().then(play).catch(() => {})
  } else {
    play()
  }
}

/* ---------------- room ambience ---------------- */

/**
 * The room tone behind the Street Art theme: plain steady white noise,
 * nothing else. Anything with a pitch — a hum, a knock, a rattle — turns
 * into a whistle you notice, which is the opposite of what background
 * noise is for. Synthesized, so there is nothing to download, and off
 * unless the user asks for it.
 */
const AMBIENCE_KEY = 'focusguard.ambience'

let ambience: {
  master: GainNode
  nodes: AudioScheduledSourceNode[]
} | null = null

export function ambienceEnabled(): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    return localStorage.getItem(AMBIENCE_KEY) === 'on'
  } catch {
    return false
  }
}

export function setAmbienceEnabled(on: boolean): void {
  try {
    localStorage.setItem(AMBIENCE_KEY, on ? 'on' : 'off')
  } catch {
    /* private mode — the setting just won't stick */
  }
}

/**
 * Flat white noise. The buffer is long and its ends are cross-faded, so
 * looping it doesn't introduce a click or an audible period — a short
 * loop is the one way noise can start to sound like a pattern.
 */
function noiseBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(c.sampleRate * seconds)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  const fade = Math.min(2048, Math.floor(len / 8))
  for (let i = 0; i < fade; i++) {
    const k = i / fade
    data[i] = data[i]! * k + data[len - fade + i]! * (1 - k)
  }
  return buf
}

/**
 * Start the loop. Returns false when the audio context is still locked —
 * browsers only unlock it from a user gesture — so the caller can retry
 * on the next click instead of leaving a silent graph running. Safe to
 * call repeatedly.
 */
export function startAmbience(): boolean {
  if (ambience) return true
  const c = getContext()
  if (!c) return false
  if (c.state !== 'running') {
    // Locked until a gesture. Ask to resume and build only if that
    // succeeds; report failure so the caller keeps listening for the
    // next click rather than leaving a silent graph in place.
    void c
      .resume()
      .then(() => {
        if (!ambience && c.state === 'running') build(c)
      })
      .catch(() => {})
    return false
  }
  build(c)
  return true
}

function build(c: AudioContext): void {
  const master = c.createGain()
  master.gain.setValueAtTime(0.0001, c.currentTime)
  master.gain.exponentialRampToValueAtTime(0.05, c.currentTime + 2.5)
  master.connect(c.destination)

  // One steady noise bed. No oscillator, no modulation, nothing that can
  // ring: a gentle shelf just takes the sharpest top off so it sits behind
  // the work instead of in front of it.
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, 8)
  src.loop = true
  const shelf = c.createBiquadFilter()
  shelf.type = 'highshelf'
  shelf.frequency.value = 3500
  shelf.gain.value = -9
  src.connect(shelf)
  shelf.connect(master)
  src.start()

  ambience = { master, nodes: [src] }
}

export function stopAmbience(): void {
  if (!ambience) return
  const c = getContext()
  const { master, nodes } = ambience
  ambience = null
  if (c) {
    master.gain.cancelScheduledValues(c.currentTime)
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), c.currentTime)
    master.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.6)
  }
  nodes.forEach((n) => {
    try {
      n.stop(c ? c.currentTime + 0.7 : 0)
    } catch {
      /* already stopped */
    }
  })
  // release the graph once the fade is done, so repeated start/stop
  // cycles (every tab hide and show) don't pile up dead nodes
  window.setTimeout(() => {
    nodes.forEach((n) => {
      try {
        n.disconnect()
      } catch {
        /* already detached */
      }
    })
    try {
      master.disconnect()
    } catch {
      /* already detached */
    }
  }, 900)
}
