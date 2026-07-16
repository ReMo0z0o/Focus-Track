import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

/**
 * Full-screen animated backdrop for the "world" themes (fire, jungle,
 * polar, street, space, future, dragon). Pure CSS animations on
 * transform/opacity; particle positions come from a seeded PRNG so the
 * markup is deterministic (SSR-safe, stable across renders).
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

const SNOW = gen(21, 20, (r) => ({
  left: r() * 100,
  size: 2.5 + r() * 4,
  delay: r() * 14,
  dur: 9 + r() * 9,
  sway: 20 + r() * 50,
  opacity: 0.35 + r() * 0.5,
}))

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
          {SNOW.map((s, i) => (
            <span
              key={i}
              className="tb-snow"
              style={
                {
                  left: `${s.left}%`,
                  width: s.size,
                  height: s.size,
                  opacity: s.opacity,
                  animationDelay: `-${s.delay}s`,
                  animationDuration: `${s.dur}s`,
                  '--sway': `${s.sway}px`,
                } as Vars
              }
            />
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
