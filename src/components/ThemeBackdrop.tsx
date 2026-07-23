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
const FERNS = gen(34, 4, (r, i) => ({
  left: 4 + i * 26 + r() * 10,
  size: 95 + r() * 70,
  delay: r() * 4,
  dur: 5 + r() * 3,
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
          {/* distant canopy silhouettes */}
          <svg
            className="tb-treeline"
            viewBox="0 0 1200 200"
            preserveAspectRatio="none"
          >
            <path
              d="M0 200 L0 96 C40 70 90 82 130 60 C180 34 240 52 290 44 C340 36 380 60 430 56 C490 50 530 24 590 32 C650 40 690 70 750 62 C810 54 850 28 910 38 C970 48 1000 74 1060 66 C1110 60 1160 76 1200 62 L1200 200 Z"
              fill="#0a150a"
            />
            <path
              d="M0 200 L0 132 C60 112 110 124 160 106 C220 84 280 102 340 96 C400 90 440 112 500 106 C560 100 610 78 670 88 C730 98 770 122 830 114 C890 106 940 84 1000 94 C1060 104 1120 122 1200 108 L1200 200 Z"
              fill="#101f0e"
            />
          </svg>
          <div className="tb-canopy" />
          {/* hanging leaf fringe along the top */}
          <svg
            className="tb-canopy-fringe"
            viewBox="0 0 1200 90"
            preserveAspectRatio="none"
          >
            <path
              d="M0 0 L1200 0 L1200 26 C1160 44 1120 30 1080 46 C1030 66 990 36 940 50 C890 64 850 34 800 44 C750 54 710 70 660 52 C610 34 570 60 520 56 C470 52 430 30 380 42 C330 54 290 72 240 56 C190 40 150 62 100 52 C60 44 30 32 0 40 Z"
              fill="#122413"
            />
            <path
              d="M0 0 L1200 0 L1200 16 C1150 30 1100 20 1050 32 C1000 44 950 22 900 34 C850 46 800 24 750 30 C700 36 650 50 600 38 C550 26 500 44 450 40 C400 36 350 20 300 30 C250 40 200 50 150 40 C100 30 50 22 0 28 Z"
              fill="#1a3319"
            />
            {[70, 210, 380, 560, 730, 900, 1070].map((x, i) => (
              <g key={i} fill="#1a3319">
                <ellipse cx={x} cy={i % 2 ? 52 : 62} rx="26" ry="9" transform={`rotate(${i % 2 ? -14 : 12} ${x} ${i % 2 ? 52 : 62})`} />
                <ellipse cx={x + 30} cy={i % 2 ? 44 : 52} rx="20" ry="7" transform={`rotate(${i % 2 ? 18 : -16} ${x + 30} ${i % 2 ? 44 : 52})`} />
              </g>
            ))}
          </svg>
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
          {LEAVES.map((l, i) => (
            <svg
              key={i}
              className="tb-leaf"
              viewBox="0 0 24 24"
              width={l.size}
              height={l.size}
              style={
                {
                  left: `${l.left}%`,
                  animationDelay: `-${l.delay}s`,
                  animationDuration: `${l.dur}s`,
                  '--sway': `${l.sway}px`,
                  '--spin': l.spin,
                } as Vars
              }
            >
              <path d="M12 2 C18 6.5 20 13 12 22 C4 13 6 6.5 12 2 Z" fill="#5f9c43" />
              <path d="M12 4 L12 20" stroke="#3c6b28" strokeWidth="1" />
              <path
                d="M12 8 C14.5 8.5 16 10 16.5 12 M12 12.5 C9.5 13 8 14.5 7.5 16.5"
                stroke="#3c6b28"
                strokeWidth="0.7"
                fill="none"
              />
            </svg>
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
          {FERNS.map((f, i) => (
            <FernSvg
              key={i}
              style={{
                left: `${f.left}%`,
                width: f.size,
                animationDelay: `-${f.delay}s`,
                animationDuration: `${f.dur}s`,
              }}
            />
          ))}
          <JungleTree side="left" />
          <JungleTree side="right" />
          <JungleMonkey />
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

/* ---------------- jungle: scenery ---------------- */

function FernSvg({ style }: { style?: CSSProperties }) {
  return (
    <svg className="tb-fern" viewBox="0 0 120 100" style={style}>
      {[
        { d: 'M60 100 C54 72 40 52 22 40', tip: [22, 40], a: -40 },
        { d: 'M60 100 C60 66 58 42 61 22', tip: [61, 22], a: 0 },
        { d: 'M60 100 C66 72 80 52 98 42', tip: [98, 42], a: 40 },
      ].map((f, i) => (
        <g key={i}>
          <path d={f.d} stroke="#1c3a15" strokeWidth="3" fill="none" strokeLinecap="round" />
          {[0.3, 0.45, 0.6, 0.75, 0.9].map((t, j) => {
            const x = 60 + (f.tip[0]! - 60) * (t * t * 0.7 + t * 0.3)
            const y = 100 + (f.tip[1]! - 100) * t
            const size = 10 - j * 1.6
            return (
              <g key={j} fill="#254a1a">
                <ellipse
                  cx={x - 3}
                  cy={y}
                  rx={size}
                  ry={2.6}
                  transform={`rotate(${f.a - 42} ${x - 3} ${y})`}
                />
                <ellipse
                  cx={x + 3}
                  cy={y}
                  rx={size}
                  ry={2.6}
                  transform={`rotate(${f.a + 42} ${x + 3} ${y})`}
                />
              </g>
            )
          })}
          {/* tip leaflet */}
          <ellipse
            cx={f.tip[0]!}
            cy={f.tip[1]!}
            rx="5"
            ry="2.2"
            fill="#2f5d24"
            transform={`rotate(${f.a === 0 ? -90 : f.a} ${f.tip[0]} ${f.tip[1]})`}
          />
        </g>
      ))}
    </svg>
  )
}

/** Foliage cluster: layered ellipses, dark base with a moonlit rim. */
function Foliage({
  x,
  y,
  s,
  dur,
  delay,
}: {
  x: number
  y: number
  s: number
  dur: number
  delay: number
}) {
  return (
    // Outer group carries the static placement; the animated class lives on
    // an inner group so the CSS transform doesn't override the attribute.
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g
        className="tb-foliage"
        style={{ animationDuration: `${dur}s`, animationDelay: `-${delay}s` }}
      >
        <ellipse cx="0" cy="6" rx="66" ry="30" fill="#132a10" />
        <ellipse cx="-30" cy="-8" rx="44" ry="24" fill="#183417" />
        <ellipse cx="30" cy="-6" rx="46" ry="25" fill="#183417" />
        <ellipse cx="0" cy="-18" rx="40" ry="20" fill="#1e421a" />
        {/* moonlit rim */}
        <ellipse cx="-12" cy="-28" rx="22" ry="7" fill="#2f5d24" opacity="0.8" />
        <ellipse cx="24" cy="-22" rx="14" ry="5" fill="#2f5d24" opacity="0.6" />
        {/* leaf spikes breaking the blob silhouette */}
        <path
          d="M-58 -2 L-74 -12 L-56 -10 Z M52 -10 L70 -20 L54 -18 Z M-8 -34 L-2 -48 L4 -34 Z"
          fill="#1e421a"
        />
      </g>
    </g>
  )
}

/**
 * Foreground jungle tree: buttress roots, tapered trunk with bark lines,
 * two limbs, swaying foliage crowns and hanging moss.
 */
function JungleTree({ side }: { side: 'left' | 'right' }) {
  return (
    <svg
      className={`tb-tree ${side}`}
      viewBox="0 0 300 700"
      style={side === 'left' ? { left: '-3vw', height: '80vh' } : { right: '-4vw', height: '62vh' }}
    >
      {/* moss strands from the limbs */}
      {[
        { x: 196, y: 262, len: 90 },
        { x: 236, y: 252, len: 60 },
        { x: 84, y: 300, len: 74 },
      ].map((m, i) => (
        <g key={i} className="tb-moss" style={{ animationDelay: `-${i * 1.3}s` }}>
          <path
            d={`M${m.x} ${m.y} C${m.x + 6} ${m.y + m.len * 0.4} ${m.x - 5} ${m.y + m.len * 0.7} ${m.x + 2} ${m.y + m.len}`}
            stroke="#2c4a22"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
          <ellipse cx={m.x - 3} cy={m.y + m.len * 0.45} rx="5" ry="2" fill="#33531f" />
          <ellipse cx={m.x + 5} cy={m.y + m.len * 0.8} rx="5" ry="2" fill="#33531f" />
        </g>
      ))}
      {/* trunk with buttress roots */}
      <path
        d="M96 700 C102 640 108 560 112 470 C116 380 118 300 126 220 C130 180 138 150 150 132
           C162 150 168 180 170 220 C174 300 172 380 172 470 C172 560 176 640 182 700
           L214 700 C204 690 198 678 196 664 L226 700 L96 700 Z"
        fill="#241a12"
      />
      <path d="M96 700 L60 700 C78 686 88 672 94 656 C96 672 96 686 96 700 Z" fill="#241a12" />
      <path d="M182 700 L246 700 C222 688 210 674 204 656 C200 674 192 690 182 700 Z" fill="#1c130d" />
      {/* bark lines + rim light */}
      <path
        d="M126 640 C130 540 132 420 138 300 M158 660 C156 560 158 440 156 320"
        stroke="#17100a"
        strokeWidth="3"
        fill="none"
        opacity="0.8"
      />
      <path
        d="M112 470 C116 380 118 300 126 220"
        stroke="#3a2c1d"
        strokeWidth="4"
        fill="none"
        opacity="0.7"
      />
      {/* limbs */}
      <path
        d="M150 210 C176 196 206 264 238 256 L242 268 C206 282 170 226 152 236 Z"
        fill="#241a12"
      />
      <path d="M146 250 C120 244 100 288 76 296 L80 308 C106 302 126 262 148 264 Z" fill="#1c130d" />
      {/* crowns */}
      <Foliage x={150} y={96} s={1.15} dur={7} delay={0} />
      <Foliage x={248} y={222} s={0.72} dur={6.2} delay={2.1} />
      <Foliage x={64} y={272} s={0.6} dur={7.8} delay={3.6} />
    </svg>
  )
}

/* ---------------- jungle: the swinging monkey ---------------- */

/**
 * Every so often a monkey crosses the canopy, swinging vine to vine.
 * Direction is random; the pendulum swing runs on a nested element so it
 * composes with the bouncy crossing path.
 */
function JungleMonkey() {
  const [trip, setTrip] = useState<{ id: number; dir: 1 | -1; dur: number } | null>(null)

  useEffect(() => {
    if (prefersReducedMotion()) return
    const img = new Image()
    img.src = '/monkey-swing.png'
    let alive = true
    let spawnTimer: number
    let clearTimer: number
    // one crossing every 16 seconds, direction still random
    const plan = (delay: number) => {
      spawnTimer = window.setTimeout(() => {
        if (!alive) return
        const dur = 9 + Math.random() * 2.5
        setTrip({ id: Date.now(), dir: Math.random() < 0.5 ? 1 : -1, dur })
        clearTimer = window.setTimeout(() => {
          if (alive) setTrip(null)
        }, dur * 1000)
        plan(16000)
      }, delay)
    }
    plan(3000)
    return () => {
      alive = false
      clearTimeout(spawnTimer)
      clearTimeout(clearTimer)
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
          {/* the monkey from the reference video, leafy vine in hand */}
          <span className="tb-monkey-sprite" />
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

/* Sprite sheets cut frame-by-frame from the user's reference video —
   this IS that dragon. Fly: one full wing beat (11 frames @ 12fps);
   sleep: one breath (6 frames). */
const DRAGON_W = 220
const DRAGON_H = 177
const DRAGON_SHEETS = ['/dragon-fly.png', '/dragon-sleep.png']

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
    for (const src of DRAGON_SHEETS) {
      const img = new Image()
      img.src = src
    }
    const s = { x: 0, y: 0, tx: 0, ty: 0, facing: 1, dwell: 0 }
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
            s.facing = 1 // sleep frames face left natively — no flip
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
        // fly frames face right natively — mirror when heading left
        flipRef.current.style.transform = `scaleX(${s.facing === -1 ? -1 : 1})`
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
          <div className="tb-dragon-sprite fly" />
          <div className="tb-dragon-sprite sleep" />
          <span className="tb-dragon-zzz">
            <i>z</i>
            <i>z</i>
            <i>z</i>
          </span>
        </div>
      </div>
    </div>
  )
}
