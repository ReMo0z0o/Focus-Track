import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

/**
 * Full-screen animated backdrop for the "world" themes (fire, jungle,
 * polar, street, space, future, dragon, abyss, storm, sakura). Pure CSS
 * animations on transform/opacity; particle positions come from a seeded
 * PRNG so the markup is deterministic (SSR-safe, stable across renders).
 *
 * The layer sits at z-index -1 inside <body>: above the body background,
 * below all content, and never intercepts pointer events.
 */

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gen<T>(seed: number, count: number, make: (r: () => number, i: number) => T): T[] {
  const r = mulberry32(seed)
  return Array.from({ length: count }, (_, i) => make(r, i))
}

type Vars = CSSProperties & Record<`--${string}`, string | number>

/* ---------------- particle sets (deterministic) ---------------- */

const STARS = gen(11, 30, (r) => ({
  left: r() * 100,
  top: r() * 100,
  size: 1 + r() * 1.8,
  delay: r() * 6,
  dur: 2.4 + r() * 4.2,
  big: false,
}))
const BIG_STARS = gen(12, 7, (r) => ({
  left: r() * 100,
  top: r() * 90,
  size: 2.6 + r() * 1.6,
  delay: r() * 5,
  dur: 3 + r() * 3,
  big: true,
}))

const SNOW = gen(21, 14, (r) => ({
  left: r() * 100,
  size: 2.5 + r() * 4,
  delay: r() * 14,
  dur: 9 + r() * 9,
  sway: 20 + r() * 50,
  opacity: 0.35 + r() * 0.5,
  gustDelay: r() * 0.9,
}))
/** Detailed six-armed flakes (drawn as inline SVG, larger than the dots). */
const FLAKES = gen(22, 10, (r) => ({
  left: r() * 100,
  size: 10 + r() * 12,
  delay: r() * 16,
  dur: 12 + r() * 10,
  sway: 24 + r() * 40,
  opacity: 0.5 + r() * 0.45,
  gustDelay: r() * 0.9,
}))
/** Swirling wind wisps (flowing tails that curl up), swept in with the gust. */
const WISPS = [
  { design: 'curl', top: 20, width: 310, delay: 0.2, strength: 0.85 },
  { design: 'wave', top: 46, width: 350, delay: 0.9, strength: 0.6 },
  { design: 'curl', top: 68, width: 230, delay: 1.5, strength: 0.5 },
] as const

const WISP_PATHS: Record<'curl' | 'wave', { d: string; w: number }[]> = {
  curl: [
    { d: 'M4 58 C50 50 110 42 165 38', w: 2.4 },
    { d: 'M18 70 C70 64 130 56 182 50', w: 1.9 },
    { d: 'M0 44 C46 36 100 30 150 28', w: 1.5 },
    // tails flow into a curling loop, like a gust folding over itself
    { d: 'M150 28 C196 18 242 24 246 44 C249 61 220 71 204 60 C192 52 199 35 216 38', w: 2.8 },
  ],
  wave: [
    { d: 'M2 40 C50 16 110 56 170 32 C205 18 240 26 258 36', w: 2.8 },
    { d: 'M10 52 C60 30 120 64 180 44 C212 32 240 38 256 46', w: 2 },
    { d: 'M0 28 C48 8 108 44 168 22 C200 10 236 16 254 24', w: 1.4 },
  ],
}

const LEAVES = gen(31, 11, (r) => ({
  left: r() * 100,
  size: 9 + r() * 9,
  delay: r() * 16,
  dur: 11 + r() * 9,
  sway: 30 + r() * 60,
  spin: r() > 0.5 ? 1 : -1,
}))
const FIREFLIES = gen(32, 9, (r) => ({
  left: 5 + r() * 90,
  top: 25 + r() * 65,
  delay: r() * 7,
  dur: 4 + r() * 5,
  dx: -30 + r() * 60,
  dy: -20 + r() * 40,
}))

const FIRE_EMBERS = gen(41, 22, (r) => ({
  left: r() * 100,
  size: 2.5 + r() * 3.5,
  delay: r() * 7,
  dur: 4.5 + r() * 4.5,
  dx: -40 + r() * 80,
}))
// (One big central flame erupts every 25s — see .tb-big-flame in CSS.)

const DRAGON_EMBERS = gen(51, 13, (r) => ({
  left: r() * 100,
  size: 2.5 + r() * 3,
  delay: r() * 9,
  dur: 7 + r() * 6,
  dx: -30 + r() * 60,
}))
const SMOKE = gen(52, 5, (r) => ({
  left: 10 + r() * 80,
  size: 130 + r() * 130,
  delay: r() * 12,
  dur: 17 + r() * 10,
}))

const SPRAY = gen(61, 16, (r) => ({
  left: r() * 100,
  top: r() * 100,
  size: 2 + r() * 4,
  delay: r() * 8,
  dur: 7 + r() * 9,
  hue: [340, 190, 55, 280][Math.floor(r() * 4)]!,
}))

const ORBS = gen(71, 6, (r) => ({
  left: 5 + r() * 90,
  top: 10 + r() * 60,
  size: 5 + r() * 8,
  delay: r() * 6,
  dur: 7 + r() * 7,
}))

const BUBBLES = gen(81, 24, (r) => ({
  left: r() * 100,
  size: 3 + r() * 7,
  delay: r() * 12,
  dur: 8 + r() * 9,
  dx: -30 + r() * 60,
}))
const FISH = gen(82, 8, (r, i) => ({
  top: 12 + r() * 72,
  size: 9 + r() * 9,
  delay: r() * 24,
  dur: 17 + r() * 17,
  ltr: i % 2 === 0,
}))
const PLANKTON = gen(83, 14, (r) => ({
  left: r() * 100,
  top: r() * 100,
  delay: r() * 8,
  dur: 5 + r() * 6,
  dx: -14 + r() * 28,
  dy: -18 + r() * 36,
}))
const KELP = gen(84, 7, (r, i) => ({
  left: 2 + i * 14.5 + r() * 7,
  height: 70 + r() * 90,
  delay: r() * 5,
  dur: 5.5 + r() * 4,
}))

const RAIN = gen(91, 34, (r) => ({
  left: -5 + r() * 112,
  height: 42 + r() * 42,
  delay: r() * 3,
  dur: 0.9 + r() * 0.9,
  opacity: 0.18 + r() * 0.4,
}))
const STORM_CLOUDS = gen(92, 4, (r, i) => ({
  left: -15 + i * 28 + r() * 12,
  top: -14 + r() * 16,
  size: 260 + r() * 220,
  delay: r() * 30,
  dur: 38 + r() * 34,
}))

const PETALS = gen(101, 22, (r) => ({
  left: r() * 100,
  size: 7 + r() * 7,
  delay: r() * 14,
  dur: 9 + r() * 8,
  sway: 40 + r() * 70,
  spin: r() > 0.5 ? 1 : -1,
}))
const HAZE = gen(102, 3, (r, i) => ({
  left: 5 + i * 32 + r() * 10,
  top: 8 + r() * 40,
  size: 200 + r() * 160,
  delay: r() * 18,
  dur: 26 + r() * 18,
}))

/* ---------------- per-theme layers ---------------- */

function renderLayers(theme: string): ReactNode | null {
  switch (theme) {
    case 'space':
      return (
        <>
          <div className="tb-nebula tb-nebula-1" />
          <div className="tb-nebula tb-nebula-2" />
          {[...STARS, ...BIG_STARS].map((s, i) => (
            <span
              key={i}
              className={`tb-star${s.big ? ' big' : ''}`}
              style={{
                left: `${s.left}%`,
                top: `${s.top}%`,
                width: s.size,
                height: s.size,
                animationDelay: `-${s.delay}s`,
                animationDuration: `${s.dur}s`,
              }}
            />
          ))}
          <span className="tb-shooting" style={{ top: '14%', animationDelay: '3s', animationDuration: '9s' } as Vars} />
          <span className="tb-shooting" style={{ top: '52%', animationDelay: '8.5s', animationDuration: '13s' } as Vars} />
        </>
      )
    case 'polar':
      return (
        <>
          <div className="tb-aurora tb-aurora-1" />
          <div className="tb-aurora tb-aurora-2" />
          {/* the gust wrapper shoves each fall sideways every 16s */}
          {SNOW.map((s, i) => (
            <span
              key={i}
              className="tb-gust"
              style={{ left: `${s.left}%`, animationDelay: `${s.gustDelay}s` }}
            >
              <span
                className="tb-snow"
                style={
                  {
                    width: s.size,
                    height: s.size,
                    opacity: s.opacity,
                    animationDelay: `-${s.delay}s`,
                    animationDuration: `${s.dur}s`,
                    '--sway': `${s.sway}px`,
                  } as Vars
                }
              />
            </span>
          ))}
          {FLAKES.map((f, i) => (
            <span
              key={i}
              className="tb-gust"
              style={{ left: `${f.left}%`, animationDelay: `${f.gustDelay}s` }}
            >
              <svg
                className="tb-flake"
                width={f.size}
                height={f.size}
                viewBox="0 0 24 24"
                style={
                  {
                    opacity: f.opacity,
                    animationDelay: `-${f.delay}s`,
                    animationDuration: `${f.dur}s`,
                    '--sway': `${f.sway}px`,
                  } as Vars
                }
              >
                <g stroke="#eef6ff" strokeWidth="1.5" strokeLinecap="round" fill="none">
                  {[0, 60, 120].map((a) => (
                    <line key={a} x1="12" y1="2" x2="12" y2="22" transform={`rotate(${a} 12 12)`} />
                  ))}
                  {[0, 60, 120, 180, 240, 300].map((a) => (
                    <path
                      key={a}
                      d="M12 4.5 L9.6 7.2 M12 4.5 L14.4 7.2"
                      transform={`rotate(${a} 12 12)`}
                    />
                  ))}
                </g>
              </svg>
            </span>
          ))}
          {WISPS.map((w, i) => (
            <svg
              key={i}
              className="tb-wisp"
              viewBox="0 0 260 90"
              width={w.width}
              height={(w.width * 90) / 260}
              style={{ top: `${w.top}%`, animationDelay: `${w.delay}s` }}
            >
              <defs>
                {/* tails fade out behind the head of the gust */}
                <linearGradient id={`tb-wgr-${i}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#dbeeff" stopOpacity="0" />
                  <stop offset="0.4" stopColor="#dbeeff" stopOpacity="0.45" />
                  <stop offset="0.85" stopColor="#f2f9ff" stopOpacity="1" />
                  <stop offset="1" stopColor="#f2f9ff" stopOpacity="0.75" />
                </linearGradient>
              </defs>
              <g
                fill="none"
                stroke={`url(#tb-wgr-${i})`}
                strokeLinecap="round"
                opacity={w.strength}
              >
                {WISP_PATHS[w.design].map((p, j) => (
                  <path key={j} d={p.d} strokeWidth={p.w} />
                ))}
              </g>
            </svg>
          ))}
        </>
      )
    case 'jungle':
      return (
        <>
          <div className="tb-canopy" />
          {LEAVES.map((l, i) => (
            <span
              key={i}
              className="tb-leaf"
              style={
                {
                  left: `${l.left}%`,
                  width: l.size,
                  height: l.size * 0.8,
                  animationDelay: `-${l.delay}s`,
                  animationDuration: `${l.dur}s`,
                  '--sway': `${l.sway}px`,
                  '--spin': l.spin,
                } as Vars
              }
            />
          ))}
          {FIREFLIES.map((f, i) => (
            <span
              key={i}
              className="tb-firefly"
              style={
                {
                  left: `${f.left}%`,
                  top: `${f.top}%`,
                  animationDelay: `-${f.delay}s`,
                  animationDuration: `${f.dur}s`,
                  '--dx': `${f.dx}px`,
                  '--dy': `${f.dy}px`,
                } as Vars
              }
            />
          ))}
        </>
      )
    case 'fire':
      return (
        <>
          <div className="tb-heat" />
          <div className="tb-heat-surge" />
          {/* the 25s eruption: burst envelope outside, raging licks inside */}
          <div className="tb-big-flame">
            <span className="tb-big-flame-body">
              <span className="tb-big-flame-inner" />
              <span className="tb-big-flame-core" />
            </span>
          </div>
          {FIRE_EMBERS.map((e, i) => (
            <span
              key={i}
              className="tb-ember"
              style={
                {
                  left: `${e.left}%`,
                  width: e.size,
                  height: e.size,
                  animationDelay: `-${e.delay}s`,
                  animationDuration: `${e.dur}s`,
                  '--dx': `${e.dx}px`,
                } as Vars
              }
            />
          ))}
        </>
      )
    case 'dragon':
      return (
        <>
          <div className="tb-lair-glow" />
          {SMOKE.map((s, i) => (
            <span
              key={i}
              className="tb-smoke"
              style={{
                left: `${s.left}%`,
                width: s.size,
                height: s.size,
                animationDelay: `-${s.delay}s`,
                animationDuration: `${s.dur}s`,
              }}
            />
          ))}
          {DRAGON_EMBERS.map((e, i) => (
            <span
              key={i}
              className="tb-ember dragon"
              style={
                {
                  left: `${e.left}%`,
                  width: e.size,
                  height: e.size,
                  animationDelay: `-${e.delay}s`,
                  animationDuration: `${e.dur}s`,
                  '--dx': `${e.dx}px`,
                } as Vars
              }
            />
          ))}
        </>
      )
    case 'street':
      return (
        <>
          <div className="tb-paint tb-paint-1" />
          <div className="tb-paint tb-paint-2" />
          <div className="tb-paint tb-paint-3" />
          {SPRAY.map((s, i) => (
            <span
              key={i}
              className="tb-spray"
              style={
                {
                  left: `${s.left}%`,
                  top: `${s.top}%`,
                  width: s.size,
                  height: s.size,
                  animationDelay: `-${s.delay}s`,
                  animationDuration: `${s.dur}s`,
                  '--h': s.hue,
                } as Vars
              }
            />
          ))}
        </>
      )
    case 'future':
      return (
        <>
          <div className="tb-grid-wrap">
            <div className="tb-grid" />
          </div>
          <div className="tb-scanline" />
          {ORBS.map((o, i) => (
            <span
              key={i}
              className="tb-orb"
              style={{
                left: `${o.left}%`,
                top: `${o.top}%`,
                width: o.size,
                height: o.size,
                animationDelay: `-${o.delay}s`,
                animationDuration: `${o.dur}s`,
              }}
            />
          ))}
        </>
      )
    case 'abyss':
      return (
        <>
          <div className="tb-ray tb-ray-1" />
          <div className="tb-ray tb-ray-2" />
          <div className="tb-ray tb-ray-3" />
          <div className="tb-abyss-floor" />
          {KELP.map((k, i) => (
            <span
              key={i}
              className="tb-kelp"
              style={{
                left: `${k.left}%`,
                height: k.height,
                animationDelay: `-${k.delay}s`,
                animationDuration: `${k.dur}s`,
              }}
            />
          ))}
          {FISH.map((f, i) => (
            <span
              key={i}
              className={`tb-fish${f.ltr ? '' : ' rtl'}`}
              style={{
                top: `${f.top}%`,
                width: f.size * 2.4,
                height: f.size,
                animationDelay: `-${f.delay}s`,
                animationDuration: `${f.dur}s`,
              }}
            />
          ))}
          {BUBBLES.map((b, i) => (
            <span
              key={i}
              className="tb-bubble"
              style={
                {
                  left: `${b.left}%`,
                  width: b.size,
                  height: b.size,
                  animationDelay: `-${b.delay}s`,
                  animationDuration: `${b.dur}s`,
                  '--dx': `${b.dx}px`,
                } as Vars
              }
            />
          ))}
          {PLANKTON.map((p, i) => (
            <span
              key={i}
              className="tb-plankton"
              style={
                {
                  left: `${p.left}%`,
                  top: `${p.top}%`,
                  animationDelay: `-${p.delay}s`,
                  animationDuration: `${p.dur}s`,
                  '--dx': `${p.dx}px`,
                  '--dy': `${p.dy}px`,
                } as Vars
              }
            />
          ))}
        </>
      )
    case 'storm':
      return (
        <>
          <div className="tb-flash tb-flash-1" />
          <div className="tb-flash tb-flash-2" />
          <span className="tb-bolt tb-bolt-1" />
          <span className="tb-bolt tb-bolt-2" />
          {STORM_CLOUDS.map((c, i) => (
            <span
              key={i}
              className="tb-storm-cloud"
              style={{
                left: `${c.left}%`,
                top: `${c.top}%`,
                width: c.size,
                height: c.size * 0.45,
                animationDelay: `-${c.delay}s`,
                animationDuration: `${c.dur}s`,
              }}
            />
          ))}
          {RAIN.map((d, i) => (
            <span
              key={i}
              className="tb-rain"
              style={{
                left: `${d.left}%`,
                height: d.height,
                opacity: d.opacity,
                animationDelay: `-${d.delay}s`,
                animationDuration: `${d.dur}s`,
              }}
            />
          ))}
        </>
      )
    case 'sakura':
      return (
        <>
          <div className="tb-sakura-glow" />
          {HAZE.map((h, i) => (
            <span
              key={i}
              className="tb-haze"
              style={{
                left: `${h.left}%`,
                top: `${h.top}%`,
                width: h.size,
                height: h.size * 0.6,
                animationDelay: `-${h.delay}s`,
                animationDuration: `${h.dur}s`,
              }}
            />
          ))}
          {PETALS.map((p, i) => (
            <span
              key={i}
              className="tb-petal"
              style={
                {
                  left: `${p.left}%`,
                  width: p.size,
                  height: p.size * 0.85,
                  animationDelay: `-${p.delay}s`,
                  animationDuration: `${p.dur}s`,
                  '--sway': `${p.sway}px`,
                  '--spin': p.spin,
                } as Vars
              }
            />
          ))}
          <span className="tb-butterfly tb-butterfly-1">
            <span className="tb-wing l" />
            <span className="tb-wing r" />
          </span>
          <span className="tb-butterfly tb-butterfly-2">
            <span className="tb-wing l" />
            <span className="tb-wing r" />
          </span>
        </>
      )
    default:
      return null
  }
}

export function ThemeBackdrop() {
  const [theme, setTheme] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    const el = document.documentElement
    const read = () => setTheme(el.dataset.theme ?? 'amber')
    read()
    const observer = new MutationObserver(read)
    observer.observe(el, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  // Stop the GPU work (blurred layers, compositing) while the tab is hidden.
  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden)
    onVisibility()
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  if (!theme) return null
  const layers = renderLayers(theme)
  if (!layers) return null

  return (
    <div
      className={`theme-backdrop tb-${theme}${paused ? ' paused' : ''}`}
      aria-hidden="true"
    >
      {layers}
    </div>
  )
}
