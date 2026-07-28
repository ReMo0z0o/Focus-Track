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
 * The warehouse hum behind the Street Art theme: distant ventilation,
 * the odd metallic knock from somewhere down the hall. Synthesized, so
 * there is nothing to download, and off unless the user asks for it.
 */
const AMBIENCE_KEY = 'focusguard.ambience'

let ambience: {
  master: GainNode
  nodes: AudioScheduledSourceNode[]
  timer: number
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

/** Brown-ish noise, the cheapest convincing air-handling rumble. */
function noiseBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate)
  const data = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1
    last = (last + 0.02 * white) / 1.02
    data[i] = last * 3.2
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

  // ventilation: filtered noise, slowly breathing
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, 4)
  src.loop = true
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 320
  const swell = c.createGain()
  swell.gain.value = 0.85
  const lfo = c.createOscillator()
  lfo.frequency.value = 0.045
  const lfoGain = c.createGain()
  lfoGain.gain.value = 0.3
  lfo.connect(lfoGain)
  lfoGain.connect(swell.gain)
  src.connect(lp)
  lp.connect(swell)
  swell.connect(master)
  src.start()
  lfo.start()

  // Occasional metallic knock somewhere down the hall. Routed through
  // master so it fades with everything else rather than ringing out over
  // the silence after a stop.
  const knock = () => {
    if (!ambience) return
    const t = c.currentTime
    const f = 180 + Math.random() * 420
    const osc = c.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(f, t)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.24, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5 + Math.random() * 0.6)
    const lpf = c.createBiquadFilter()
    lpf.type = 'lowpass'
    lpf.frequency.value = 1400
    osc.connect(g)
    g.connect(lpf)
    lpf.connect(master)
    osc.start(t)
    osc.stop(t + 1.3)
    ambience.timer = window.setTimeout(knock, 9000 + Math.random() * 26000)
  }

  ambience = { master, nodes: [src, lfo], timer: 0 }
  ambience.timer = window.setTimeout(knock, 6000 + Math.random() * 12000)
}

export function stopAmbience(): void {
  if (!ambience) return
  const c = getContext()
  const { master, nodes, timer } = ambience
  ambience = null
  clearTimeout(timer)
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

/** The rattle of a can being shaken — fired by the graffiti scene. */
export function playSprayShake(): void {
  const c = getContext()
  if (!c || c.state !== 'running') return
  const t = c.currentTime
  for (let i = 0; i < 7; i++) {
    note(c, 2200 + Math.random() * 1800, t + i * 0.13, 0.05, 0.006, {
      type: 'square',
      lowpass: 5200,
    })
  }
}
