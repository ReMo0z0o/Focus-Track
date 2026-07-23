import { useEffect, useRef, useState } from 'react'
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
/** A whole meteor shower instead of the former lonely pair. */
const SHOOTS = gen(13, 7, (r) => ({
  top: 4 + r() * 66,
  delay: r() * 12,
  dur: 5.5 + r() * 8,
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
/** Lianas hanging from the canopy, swaying in the breeze. */
const LIANAS = gen(33, 5, (r, i) => ({
  left: 6 + i * 20 + r() * 8,
  len: 30 + r() * 24,
  delay: r() * 3,
  dur: 4.5 + r() * 2.5,
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
          {SHOOTS.map((s, i) => (
            <span
              key={i}
              className="tb-shooting"
              style={{
                top: `${s.top}%`,
                animationDelay: `${s.delay}s`,
                animationDuration: `${s.dur}s`,
              }}
            />
          ))}
          {/* the 10s comet: glowing head, twin gradient tails */}
          <span className="tb-comet">
            <span className="tb-comet-tail dust" />
            <span className="tb-comet-tail" />
            <span className="tb-comet-head" />
          </span>
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
          {LIANAS.map((l, i) => (
            <svg
              key={i}
              className="tb-liana"
              viewBox="0 0 40 300"
              width={26}
              preserveAspectRatio="none"
              style={{
                left: `${l.left}%`,
                height: `${l.len}vh`,
                animationDelay: `-${l.delay}s`,
                animationDuration: `${l.dur}s`,
              }}
            >
              <path
                d="M20 0 C27 55 12 130 22 205 C27 255 16 280 20 300"
                stroke="#3f6d2c"
                strokeWidth="4.5"
                fill="none"
              />
              {[36, 88, 140, 196, 248].map((y, j) => (
                <g key={j} fill="#4d8a35">
                  <ellipse cx="12" cy={y} rx="8" ry="3.2" transform={`rotate(-28 12 ${y})`} />
                  <ellipse cx="28" cy={y + 20} rx="8" ry="3.2" transform={`rotate(28 28 ${y + 20})`} />
                </g>
              ))}
            </svg>
          ))}
          <JungleMonkey />
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
          <AnglerFish />
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
    <>
      <div
        className={`theme-backdrop tb-${theme}${paused ? ' paused' : ''}`}
        aria-hidden="true"
      >
        {layers}
      </div>
      {/* The dragon lives outside the backdrop so it can rise above the
          pause modal when it comes to sleep on it. */}
      {theme === 'dragon' && <DragonLayer />}
    </>
  )
}

/* ================================================================== */
/* Scripted creatures                                                  */
/* ================================================================== */

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

/* ---------------- jungle: the swinging monkey ---------------- */

function MonkeySvg() {
  return (
    <svg className="tb-monkey" viewBox="0 0 64 84" width="52" height="68">
      {/* vine bit in the hand */}
      <path d="M32 0 L32 10" stroke="#4a7a33" strokeWidth="2.6" strokeLinecap="round" />
      {/* raised arm */}
      <path d="M32 6 C30 16 28 24 31 33" stroke="#6b4527" strokeWidth="5" fill="none" strokeLinecap="round" />
      <circle cx="32" cy="5.5" r="4" fill="#6b4527" />
      {/* tail */}
      <path
        d="M36 62 C48 66 55 58 50 49 C46 43 39 46 41 51"
        stroke="#6b4527"
        strokeWidth="4.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* body + belly */}
      <ellipse cx="32" cy="48" rx="11" ry="14" fill="#7a5230" />
      <ellipse cx="32" cy="52" rx="6.5" ry="8.5" fill="#c9a97e" />
      {/* tucked legs */}
      <path
        d="M25 58 C22 64 24 70 30 70 M39 58 C42 64 40 70 34 70"
        stroke="#6b4527"
        strokeWidth="4.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* free arm */}
      <path d="M36 38 C42 44 44 50 42 55" stroke="#6b4527" strokeWidth="5" fill="none" strokeLinecap="round" />
      {/* head */}
      <circle cx="24.5" cy="22" r="3.4" fill="#7a5230" />
      <circle cx="39.5" cy="22" r="3.4" fill="#7a5230" />
      <circle cx="32" cy="25" r="9.5" fill="#7a5230" />
      <path d="M25.5 27 a7 7 0 0 1 13 0 a7.5 7.5 0 0 1 -13 0" fill="#c9a97e" />
      <ellipse cx="32" cy="23.5" rx="5.5" ry="4" fill="#c9a97e" />
      <circle cx="29.5" cy="23" r="1.2" fill="#2c1c10" />
      <circle cx="34.5" cy="23" r="1.2" fill="#2c1c10" />
      <path d="M30 28.5 Q32 30 34 28.5" stroke="#2c1c10" strokeWidth="1.1" fill="none" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Every so often a monkey crosses the canopy, swinging vine to vine.
 * Direction is random; the pendulum swing runs on a nested element so it
 * composes with the bouncy crossing path.
 */
function JungleMonkey() {
  const [trip, setTrip] = useState<{ id: number; dir: 1 | -1; dur: number } | null>(null)

  useEffect(() => {
    if (prefersReducedMotion()) return
    let alive = true
    let timer: number
    const plan = (delay: number) => {
      timer = window.setTimeout(() => {
        if (!alive) return
        const dur = 8.5 + Math.random() * 3
        setTrip({ id: Date.now(), dir: Math.random() < 0.5 ? 1 : -1, dur })
        timer = window.setTimeout(() => {
          if (!alive) return
          setTrip(null)
          plan(9000 + Math.random() * 15000)
        }, dur * 1000)
      }, delay)
    }
    plan(3000)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [])

  if (!trip) return null
  return (
    <span
      key={trip.id}
      className="tb-monkey-flip"
      style={trip.dir === -1 ? { transform: 'scaleX(-1)' } : undefined}
    >
      <span className="tb-monkey-track" style={{ animationDuration: `${trip.dur}s` }}>
        <span className="tb-monkey-swing" style={{ animationDuration: `${trip.dur / 8}s` }}>
          <MonkeySvg />
        </span>
      </span>
    </span>
  )
}

/* ---------------- abyss: the anglerfish hunt ---------------- */

const ANGLER_W = 170
const ANGLER_H = 95
/** Lure position in the (left-facing) angler SVG, scaled to element px. */
const LURE_X = 21
const LURE_Y = 22

function AnglerSvg({ biting }: { biting: boolean }) {
  return (
    <svg
      className={`tb-angler${biting ? ' biting' : ''}`}
      viewBox="0 0 160 90"
      width={ANGLER_W}
      height={ANGLER_H}
    >
      {/* lure rod + bioluminescent esca */}
      <path
        d="M52 24 C42 10 30 8 20 19"
        stroke="#22333f"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      />
      <circle className="tb-lure-glow" cx="20" cy="21" r="8" fill="#9ff2ea" />
      <circle cx="20" cy="21" r="2.6" fill="#eafffb" />
      {/* tail + body */}
      <path
        d="M14 52 C22 34 46 26 74 28 C102 30 120 38 130 48 C138 56 146 58 154 53 C151 63 142 66 133 61 C121 71 98 77 72 75 C46 73 22 66 14 52 Z"
        fill="#15212d"
        stroke="rgba(120, 205 ,215, 0.35)"
        strokeWidth="1.2"
      />
      {/* dorsal spines */}
      <path
        d="M62 28 L58 18 M76 28 L74 17 M92 31 L92 20"
        stroke="#22333f"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* belly sheen */}
      <path d="M26 58 C46 68 86 72 116 64 C96 72 56 72 34 64 Z" fill="#1f3242" opacity="0.9" />
      {/* pectoral fin */}
      <path className="tb-angler-fin" d="M84 58 C92 64 94 72 90 80 C82 74 78 66 80 58 Z" fill="#22333f" />
      {/* mouth cavity + upper teeth */}
      <path d="M14 52 C22 44 34 41 46 44 L46 56 C32 60 20 58 14 52 Z" fill="#070d13" />
      <path
        d="M20 46.5 L22 52 L25 46 L28 51.5 L31 45.5 L34 51 L38 45.5 L40 50"
        stroke="#dff2f4"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
      {/* lower jaw (snaps shut on the bite) */}
      <g className="tb-angler-jaw">
        <path d="M14 53 C24 60 36 62 48 58 C40 68 24 68 14 60 Z" fill="#15212d" stroke="rgba(120,205,215,0.3)" strokeWidth="1" />
        <path
          d="M20 57 L22 51.5 M27 59 L29 53 M35 60 L36 54.5"
          stroke="#dff2f4"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </g>
      {/* eye */}
      <circle cx="54" cy="40" r="3.2" fill="#b7dbe4" />
      <circle cx="54.8" cy="40.5" r="1.4" fill="#0a1218" />
    </svg>
  )
}

function PreySvg() {
  return (
    <svg viewBox="0 0 34 16" width="30" height="14">
      <path
        d="M4 8 C9 3 18 2 25 8 C18 14 9 13 4 8 Z"
        fill="#8fd0d8"
        opacity="0.9"
      />
      <path d="M25 8 L32 3 L32 13 Z" fill="#6fb3bd" opacity="0.85" />
      <circle cx="9" cy="7" r="1.2" fill="#12222b" />
    </svg>
  )
}

/**
 * A deep-sea anglerfish wanders the dark at random, lamp pulsing. Every
 * 18 seconds a small fish is drawn to the light — and snapped up.
 */
function AnglerFish() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const state = useRef({ x: 0, y: 0, tx: 0, ty: 0, facing: -1, dwell: 0, hunting: false })
  const [prey, setPrey] = useState<{ id: number; sx: number; sy: number; lx: number; ly: number } | null>(null)
  const [biting, setBiting] = useState(false)

  useEffect(() => {
    const s = state.current
    const W = () => window.innerWidth
    const H = () => window.innerHeight
    const pick = () => {
      s.tx = W() * (0.06 + Math.random() * 0.6)
      s.ty = H() * (0.16 + Math.random() * 0.55)
    }
    s.x = W() * 0.35
    s.y = H() * 0.4
    pick()

    const write = () => {
      if (wrapRef.current) {
        wrapRef.current.style.transform = `translate3d(${s.x}px, ${s.y}px, 0) scaleX(${
          s.facing === 1 ? -1 : 1
        })`
      }
    }
    if (prefersReducedMotion()) {
      write()
      return
    }

    let raf = 0
    let last = performance.now()
    const loop = (t: number) => {
      const dt = Math.min(64, t - last)
      last = t
      if (!document.hidden && !s.hunting) {
        const dx = s.tx - s.x
        const dy = s.ty - s.y
        const d = Math.hypot(dx, dy)
        if (d < 12) {
          s.dwell -= dt
          if (s.dwell <= 0) {
            pick()
            s.dwell = 1200 + Math.random() * 2600
          }
        } else {
          const sp = 44 * (dt / 1000)
          s.x += (dx / d) * sp
          s.y += (dy / d) * sp
          if (Math.abs(dx) > 26) s.facing = dx < 0 ? -1 : 1
        }
      }
      write()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const hunt = window.setInterval(() => {
      if (document.hidden || s.hunting) return
      s.hunting = true
      const lampX = s.x + (s.facing === 1 ? ANGLER_W - LURE_X : LURE_X)
      const lampY = s.y + LURE_Y
      const fromLeft = s.facing !== 1
      const sx = lampX + (fromLeft ? -1 : 1) * (230 + Math.random() * 120)
      const sy = lampY - 60 + Math.random() * 120
      setPrey({ id: Date.now(), sx, sy, lx: lampX, ly: lampY })
      window.setTimeout(() => setBiting(true), 3300)
      window.setTimeout(() => setPrey(null), 3650)
      window.setTimeout(() => {
        setBiting(false)
        s.hunting = false
      }, 4400)
    }, 18000)

    return () => {
      cancelAnimationFrame(raf)
      clearInterval(hunt)
    }
  }, [])

  return (
    <>
      <div ref={wrapRef} className="tb-angler-wrap">
        <div className="tb-angler-bob">
          <AnglerSvg biting={biting} />
        </div>
      </div>
      {prey && <Prey key={prey.id} {...prey} />}
      {biting && (
        <span
          className="tb-gulp"
          style={{ transform: `translate3d(${state.current.x + (state.current.facing === 1 ? ANGLER_W - 30 : 30)}px, ${state.current.y + 50}px, 0)` }}
        >
          <i />
          <i />
          <i />
        </span>
      )}
    </>
  )
}

function Prey({ sx, sy, lx, ly }: { sx: number; sy: number; lx: number; ly: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const flip = lx > sx ? -1 : 1 // svg faces left; flip when swimming right
    el.style.transform = `translate3d(${sx}px, ${sy}px, 0) scaleX(${flip})`
    void el.getBoundingClientRect()
    el.style.transition = 'transform 3.2s cubic-bezier(0.45, 0.1, 0.55, 1)'
    el.style.transform = `translate3d(${lx - 14}px, ${ly + 10}px, 0) scaleX(${flip})`
  }, [sx, sy, lx, ly])
  return (
    <span ref={ref} className="tb-prey">
      <PreySvg />
    </span>
  )
}

/* ---------------- dragon: roams, then naps on the pause modal ---------------- */

const DRAGON_W = 190
const DRAGON_H = 132

function DragonFlySvg() {
  return (
    <svg className="tb-dragon-fly" viewBox="0 0 190 132">
      {/* far wing */}
      <g className="dw-wing far">
        <path
          d="M98 58 C86 30 94 10 124 4 C114 18 114 30 120 40 C130 34 142 34 152 40 C134 44 118 52 110 62 Z"
          fill="#8f2a20"
        />
      </g>
      {/* tail */}
      <g className="dw-tail">
        <path
          d="M128 72 C150 76 166 86 178 102 C170 100 164 102 160 106 C158 98 146 88 126 82 Z"
          fill="#b03a2e"
        />
        <path d="M174 98 L190 106 L176 114 Z" fill="#8f2a20" />
      </g>
      {/* body */}
      <path
        d="M52 62 C64 50 86 46 104 52 C122 58 132 68 130 78 C118 88 92 90 72 82 C58 76 50 70 52 62 Z"
        fill="#c8473a"
      />
      <path
        d="M58 70 C72 80 100 84 122 78 C112 86 88 88 70 82 C62 78 58 74 58 70 Z"
        fill="#e8a765"
        opacity="0.9"
      />
      {/* tucked legs */}
      <path
        d="M84 84 C82 92 86 96 92 96 M106 84 C106 92 110 96 116 94"
        stroke="#8f2a20"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      {/* neck */}
      <path
        d="M52 62 C40 56 30 48 26 38 C24 32 26 26 32 24 C42 20 52 26 56 36 C60 46 58 56 52 62 Z"
        fill="#c8473a"
      />
      {/* head */}
      <path
        d="M34 24 C24 16 12 16 3 23 C10 26 14 29 16 33 C10 35 6 39 4 44 C15 46 27 43 33 37 C36 33 36 28 34 24 Z"
        fill="#c8473a"
      />
      {/* horns */}
      <path d="M30 22 C34 13 43 8 52 9 C45 15 40 21 38 27 Z" fill="#f2d8a0" />
      <path d="M38 27 C44 21 52 18 59 20 C53 24 48 29 45 34 Z" fill="#e9c184" />
      {/* eye */}
      <circle cx="19" cy="29" r="2.7" fill="#ffd166" />
      <circle cx="19" cy="29" r="1.1" fill="#5c1010" />
      {/* near wing */}
      <g className="dw-wing near">
        <path
          d="M88 56 C70 24 78 2 116 -2 L114 6 C106 10 102 17 104 26 C115 16 131 14 145 20 C131 24 121 32 117 42 C130 40 142 44 150 52 C132 54 112 58 100 66 Z"
          fill="#e2604f"
        />
        <path
          d="M100 60 C96 42 100 26 112 16"
          stroke="#8f2a20"
          strokeWidth="2"
          fill="none"
          opacity="0.55"
        />
      </g>
    </svg>
  )
}

function DragonSleepSvg() {
  return (
    <svg className="tb-dragon-sleep" viewBox="0 0 190 132">
      <g className="ds-breathe">
        {/* tail curled around the front */}
        <path
          d="M44 120 C26 120 14 112 16 101 C18 93 28 91 34 97 C30 99 26 103 30 107 C36 113 52 114 66 112"
          fill="none"
          stroke="#b03a2e"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <path d="M17 99 L3 92 L12 106 Z" fill="#8f2a20" />
        {/* body mound */}
        <path d="M44 120 C42 92 62 74 94 74 C126 74 148 93 150 120 Z" fill="#c8473a" />
        {/* folded wing */}
        <path
          d="M74 86 C86 62 118 58 140 74 C122 70 102 78 94 92 C88 100 84 110 86 120 C76 110 70 98 74 86 Z"
          fill="#e2604f"
        />
        <path d="M140 74 C148 82 152 92 152 102" stroke="#8f2a20" strokeWidth="2.5" fill="none" opacity="0.55" />
        {/* resting head */}
        <path d="M28 120 C26 105 38 95 56 95 C71 95 81 103 83 113 C83 117 81 120 77 120 Z" fill="#c8473a" />
        <path d="M28 113 C18 113 9 115 5 120 L30 120 Z" fill="#c8473a" />
        {/* horn */}
        <path d="M54 95 C56 86 63 80 71 78 C67 86 65 92 65 97 Z" fill="#f2d8a0" />
        {/* closed eye + snout line */}
        <path d="M34 107 Q40 111 46 107" stroke="#5c1010" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <circle cx="10" cy="116" r="1.2" fill="#5c1010" opacity="0.7" />
        {/* belly */}
        <path d="M54 120 C62 110 86 106 106 110 C126 113 142 117 148 120 Z" fill="#e8a765" opacity="0.85" />
      </g>
      {/* nostril smoke */}
      <circle className="ds-smoke" cx="8" cy="110" r="3" fill="#d9c4bb" />
      {/* Zzz */}
      <g className="ds-zzz" fill="#ffd9b0" fontWeight="700">
        <text className="z1" x="88" y="60" fontSize="13">
          z
        </text>
        <text className="z2" x="102" y="46" fontSize="17">
          z
        </text>
        <text className="z3" x="120" y="30" fontSize="21">
          z
        </text>
      </g>
    </svg>
  )
}

type DragonMode = 'roam' | 'approach' | 'sleep' | 'depart'

/**
 * The lair's dragon. It cruises the background on random waypoints; when
 * the pause modal opens it swoops over, curls up on the popup's rim and
 * sleeps until the session resumes, then flies off.
 */
function DragonLayer() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const flipRef = useRef<HTMLDivElement>(null)
  const modeRef = useRef<DragonMode>('roam')
  const [mode, setMode] = useState<DragonMode>('roam')
  const [reduced] = useState(prefersReducedMotion)

  useEffect(() => {
    if (reduced) return
    const s = { x: 0, y: 0, tx: 0, ty: 0, facing: -1, dwell: 0 }
    const W = () => window.innerWidth
    const H = () => window.innerHeight
    const pickRoam = () => {
      s.tx = W() * (0.04 + Math.random() * 0.76)
      s.ty = H() * (0.05 + Math.random() * 0.6)
    }
    s.x = W() * 0.68
    s.y = H() * 0.22
    pickRoam()
    const switchMode = (m: DragonMode) => {
      modeRef.current = m
      setMode(m)
    }

    const perch = () => {
      const modal = document.querySelector('.modal-overlay .modal')
      if (!modal) return null
      const r = modal.getBoundingClientRect()
      return { x: r.left + r.width / 2 - DRAGON_W / 2, y: r.top - DRAGON_H + 14 }
    }

    // Poll for the pause modal — cheap, and robust to any provider layout.
    const watch = window.setInterval(() => {
      const p = perch()
      const m = modeRef.current
      if (p && (m === 'roam' || m === 'depart')) {
        s.tx = p.x
        s.ty = p.y
        switchMode('approach')
      } else if (p && m === 'approach') {
        s.tx = p.x
        s.ty = p.y
      } else if (p && m === 'sleep') {
        s.x = p.x
        s.y = p.y
      } else if (!p && (m === 'sleep' || m === 'approach')) {
        pickRoam()
        switchMode('depart')
      }
    }, 350)

    let raf = 0
    let last = performance.now()
    const loop = (t: number) => {
      const dt = Math.min(64, t - last)
      last = t
      const m = modeRef.current
      if (!document.hidden && m !== 'sleep') {
        const dx = s.tx - s.x
        const dy = s.ty - s.y
        const d = Math.hypot(dx, dy)
        if (d < 10) {
          if (m === 'approach') {
            s.x = s.tx
            s.y = s.ty
            s.facing = -1
            switchMode('sleep')
          } else if (m === 'depart') {
            switchMode('roam')
          } else {
            s.dwell -= dt
            if (s.dwell <= 0) {
              pickRoam()
              s.dwell = 900 + Math.random() * 2400
            }
          }
        } else {
          const speed = m === 'roam' ? 62 : 300
          const sp = speed * (dt / 1000)
          s.x += (dx / d) * sp
          s.y += (dy / d) * sp
          if (Math.abs(dx) > 40) s.facing = dx < 0 ? -1 : 1
        }
      }
      if (wrapRef.current) {
        wrapRef.current.style.transform = `translate3d(${s.x}px, ${s.y}px, 0)`
      }
      if (flipRef.current) {
        flipRef.current.style.transform = `scaleX(${s.facing === 1 ? -1 : 1})`
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      clearInterval(watch)
      cancelAnimationFrame(raf)
    }
  }, [reduced])

  if (reduced) return null
  return (
    <div ref={wrapRef} className={`tb-dragon-layer mode-${mode}`} aria-hidden="true">
      <div ref={flipRef} className="tb-dragon-flip">
        <div className="tb-dragon-bob">
          <DragonFlySvg />
          <DragonSleepSvg />
        </div>
      </div>
    </div>
  )
}
