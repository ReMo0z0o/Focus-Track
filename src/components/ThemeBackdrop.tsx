import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode, RefObject } from 'react'

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
const GOLD_SPARKS = gen(53, 8, (r) => ({
  left: 4 + r() * 92,
  bottom: 1 + r() * 9,
  delay: r() * 3.4,
  dur: 2.6 + r() * 2.2,
}))
const SMOKE = gen(52, 5, (r) => ({
  left: 10 + r() * 80,
  size: 130 + r() * 130,
  delay: r() * 12,
  dur: 17 + r() * 10,
}))

/* street art: an abandoned warehouse. 62 dust, 63 rubble, 64 tie holes. */
const DUST = gen(62, 22, (r, i) => ({
  // two thirds are seeded into the lit band so the lamp catches them
  left: i % 3 === 0 ? r() * 100 : 26 + r() * 48,
  top: 12 + r() * 76,
  size: 1 + r() * 1.6,
  delay: r() * 26,
  dur: 22 + r() * 26,
  dx: -30 + r() * 60,
  dy: -50 - r() * 60,
}))
const RUBBLE = gen(63, 15, (r) => ({
  left: r() * 100,
  w: 8 + r() * 26,
  h: 4 + r() * 9,
  tilt: -18 + r() * 36,
  lift: r() * 22,
  shade: 0.3 + r() * 0.45,
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
const VENT_EMBERS = gen(85, 9, (r) => ({
  left: 34 + r() * 60,
  delay: r() * 5,
  dur: 2.6 + r() * 2.4,
  dx: -16 + r() * 32,
}))
/** Hand-placed seafloor garden: coral clusters + anemones (left %, scale, mirror, variant). */
const CORALS = [
  { left: 2, scale: 1, flip: false, v: 0 },
  { left: 16, scale: 0.7, flip: true, v: 1 },
  { left: 44, scale: 0.78, flip: false, v: 1 },
  { left: 71, scale: 1.06, flip: true, v: 0 },
  { left: 89, scale: 0.85, flip: false, v: 1 },
]
const ANEMONES = [
  { left: 11, scale: 1, delay: 0 },
  { left: 81, scale: 0.8, delay: -2.1 },
]

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
          <div className="tb-moonray r1" />
          <div className="tb-moonray r2" />
          <div className="tb-moonray r3" />
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
          <div className="tb-mist m1" />
          <div className="tb-mist m2" />
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
          <JungleRiders />
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
          {/* cave mouth */}
          <svg className="tb-stalactites" viewBox="0 0 1200 110" preserveAspectRatio="none">
            <path
              d="M0 0 L1200 0 L1200 30 L1160 34 L1130 78 L1100 36 L1060 42 L1030 92 L1000 40 L950 34 L915 70 L880 32 L830 38 L800 104 L770 40 L720 34 L690 66 L650 30 L600 36 L570 88 L540 38 L490 32 L460 58 L420 30 L380 36 L350 96 L320 40 L270 32 L240 62 L200 30 L160 36 L130 80 L100 34 L60 40 L30 26 L0 32 Z"
              fill="#1a0d0b"
            />
            <path
              d="M0 0 L1200 0 L1200 20 L1150 24 L1115 52 L1080 24 L1020 28 L985 60 L950 24 L900 22 L860 46 L820 22 L760 26 L730 50 L700 24 L640 22 L610 44 L580 24 L520 22 L485 54 L450 24 L400 22 L370 42 L340 24 L280 22 L245 48 L210 24 L150 22 L120 40 L90 22 L40 26 L0 22 Z"
              fill="#241110"
            />
          </svg>
          {/* the hoard */}
          <svg className="tb-hoard" viewBox="0 0 1200 140" preserveAspectRatio="none">
            <path
              d="M0 140 L0 96 C60 76 140 70 220 82 C280 90 330 104 400 108 C480 76 560 64 660 74 C740 82 800 100 880 104 C960 86 1060 82 1200 98 L1200 140 Z"
              fill="#2e1d0d"
            />
            <path d="M120 96 C180 78 260 76 320 90 C280 97 200 98 120 96 Z" fill="#4a3114" opacity="0.9" />
            <path d="M560 78 C640 64 720 68 780 84 C700 89 620 87 560 78 Z" fill="#4a3114" opacity="0.9" />
            <path d="M900 104 C960 92 1030 90 1090 100 C1030 106 960 107 900 104 Z" fill="#40290f" opacity="0.9" />
          </svg>
          <div className="tb-hoard-glow" />
          {GOLD_SPARKS.map((g, i) => (
            <span
              key={i}
              className="tb-gold-spark"
              style={{
                left: `${g.left}%`,
                bottom: `${g.bottom}vh`,
                animationDelay: `-${g.delay}s`,
                animationDuration: `${g.dur}s`,
              }}
            />
          ))}
          {/* wall crystals */}
          {[
            { cls: 'c1', vb: '0 0 40 62' },
            { cls: 'c2', vb: '0 0 40 62' },
            { cls: 'c3', vb: '0 0 40 62' },
          ].map((c) => (
            <svg key={c.cls} className={`tb-crystal ${c.cls}`} viewBox={c.vb}>
              <polygon points="20,2 34,24 20,60 6,24" fill="#a3322a" />
              <polygon points="20,2 34,24 20,38" fill="#d8534a" opacity="0.85" />
              <polygon points="20,10 26,24 20,44 14,24" fill="#ff8a76" opacity="0.7" />
            </svg>
          ))}
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
          {/* the wall itself, on a slowly drifting deep plate */}
          <div className="tb-st-plate deep">
            <div className="tb-st-wall" />
            <div className="tb-st-grain" />
            <div className="tb-st-mottle" />
            <div className="tb-st-panels" />
            <div className="tb-st-stains" />
            <WallMarks />
            <div className="tb-st-baseshadow" />
          </div>
          {/* structure sits closer to camera and drifts a touch more */}
          <div className="tb-st-plate mid">
            <div className="tb-st-column" />
            <Ironwork />
          </div>
          <div className="tb-st-pool" />
          <div className="tb-st-cone" />
          <Lamp />
          <div className="tb-st-shaft" />
          <div className="tb-st-floor" />
          <Rubble />
          <div className="tb-st-fog f1" />
          <div className="tb-st-fog f2" />
          <div className="tb-st-fog f3" />
          {DUST.map((d, i) => (
            <span
              key={i}
              className="tb-st-dust"
              style={
                {
                  left: `${d.left}%`,
                  top: `${d.top}%`,
                  width: d.size,
                  height: d.size,
                  animationDelay: `-${d.delay}s`,
                  animationDuration: `${d.dur}s`,
                  '--dx': `${d.dx}px`,
                  '--dy': `${d.dy}px`,
                } as Vars
              }
            />
          ))}
          <div className="tb-st-vignette" />
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
          <RockLine />
          <div className="tb-abyss-floor" />
          <Vent />
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
          {CORALS.map((c, i) => (
            <span
              key={i}
              className="tb-coral"
              style={
                {
                  left: `${c.left}%`,
                  '--cs': c.scale,
                  '--cf': c.flip ? -1 : 1,
                } as Vars
              }
            >
              <CoralSvg variant={c.v} />
            </span>
          ))}
          {ANEMONES.map((a, i) => (
            <span
              key={i}
              className="tb-anemone"
              style={{ left: `${a.left}%`, '--cs': a.scale } as Vars}
            >
              <AnemoneSvg phase={a.delay} />
            </span>
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
      {theme === 'jungle' && <JunglePauseLayer />}
      {/* The writer paints on top of the wall but stays behind the UI. */}
      {theme === 'street' && <StreetLayer />}
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

/* ---------------- street art: the warehouse ---------------- */

/**
 * Cracks, water streaks and the faded scrawls of writers who came before —
 * the wall has a history before the first piece is ever sprayed.
 */
function WallMarks() {
  return (
    <svg
      className="tb-st-marks"
      viewBox="0 0 1200 800"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {/* cracks: a dark fissure with a lighter chipped lip alongside */}
      <g fill="none" strokeLinecap="round">
        <path
          d="M96 0 C104 62 88 96 100 148 C110 190 92 214 104 268"
          stroke="rgba(0,0,0,0.5)"
          strokeWidth="2.4"
        />
        <path
          d="M98 4 C106 64 90 98 102 150 C112 192 94 216 106 270"
          stroke="rgba(190,196,206,0.10)"
          strokeWidth="1"
        />
        <path
          d="M742 512 C766 546 758 588 786 626 C802 648 796 676 812 700"
          stroke="rgba(0,0,0,0.45)"
          strokeWidth="2"
        />
        <path
          d="M744 514 C768 548 760 590 788 628"
          stroke="rgba(190,196,206,0.09)"
          strokeWidth="0.9"
        />
        <path
          d="M1044 148 C1030 196 1052 232 1038 286"
          stroke="rgba(0,0,0,0.4)"
          strokeWidth="1.8"
        />
        <path d="M288 640 C336 656 372 648 420 664" stroke="rgba(0,0,0,0.35)" strokeWidth="1.6" />
      </g>
      {/* rust bleeding from an old fixing */}
      <g fill="rgba(126,74,40,0.16)">
        <path d="M352 96 L362 96 L370 300 L344 300 Z" />
        <path d="M968 60 L976 60 L982 214 L960 214 Z" />
      </g>
      <circle cx="357" cy="92" r="5" fill="rgba(20,14,10,0.7)" />
      <circle cx="972" cy="56" r="4" fill="rgba(20,14,10,0.7)" />
      {/* faded old tags — the wall is already someone's spot */}
      <g
        fill="none"
        stroke="rgba(14,15,18,0.55)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.5"
      >
        <path d="M44 430 L70 470 L44 470 M78 430 L104 470 L78 470 M112 428 L112 472 M112 450 L136 428" />
        <path d="M1104 352 C1088 340 1076 352 1084 368 C1092 384 1116 380 1120 364 C1124 346 1108 336 1094 344" />
        <path d="M1136 340 L1136 384 M1136 356 L1160 340 M1136 360 L1162 386" />
      </g>
      <g stroke="rgba(255,255,255,0.05)" strokeWidth="2" fill="none" opacity="0.6">
        <path d="M46 432 L72 472 M80 432 L106 472" />
      </g>
    </svg>
  )
}

/** Steel beam across the ceiling and the pipe run bracketed to the wall. */
function Ironwork() {
  return (
    <svg
      className="tb-st-iron"
      viewBox="0 0 1200 800"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="tbst-steel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b3037" />
          <stop offset="0.32" stopColor="#454c56" />
          <stop offset="0.55" stopColor="#22262c" />
          <stop offset="1" stopColor="#14171b" />
        </linearGradient>
        <linearGradient id="tbst-pipe" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b1e22" />
          <stop offset="0.3" stopColor="#4a5058" />
          <stop offset="0.52" stopColor="#2f343a" />
          <stop offset="1" stopColor="#121417" />
        </linearGradient>
        <linearGradient id="tbst-rust" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(140,78,40,0.55)" />
          <stop offset="1" stopColor="rgba(90,44,22,0.2)" />
        </linearGradient>
      </defs>
      {/* I-beam: web, two flanges, rivet line */}
      <rect x="0" y="18" width="1200" height="26" fill="url(#tbst-steel)" />
      <rect x="0" y="8" width="1200" height="12" fill="#3a4048" />
      <rect x="0" y="42" width="1200" height="13" fill="#1a1d22" />
      <rect x="0" y="55" width="1200" height="5" fill="rgba(0,0,0,0.55)" />
      <g fill="#5a626d">
        {Array.from({ length: 24 }, (_, i) => (
          <circle key={i} cx={26 + i * 50} cy="31" r="3.4" />
        ))}
      </g>
      <g fill="rgba(0,0,0,0.4)">
        {Array.from({ length: 24 }, (_, i) => (
          <circle key={i} cx={26 + i * 50} cy="32.6" r="3.4" />
        ))}
      </g>
      <rect x="0" y="24" width="1200" height="60" fill="url(#tbst-rust)" opacity="0.25" />
      {/* horizontal pipe with brackets */}
      <rect x="0" y="120" width="1200" height="19" fill="url(#tbst-pipe)" />
      <rect x="0" y="120" width="1200" height="3" fill="rgba(255,255,255,0.1)" />
      <g fill="#22262b">
        <rect x="150" y="114" width="16" height="31" rx="2" />
        <rect x="560" y="114" width="16" height="31" rx="2" />
        <rect x="980" y="114" width="16" height="31" rx="2" />
      </g>
      <g fill="rgba(126,74,40,0.4)">
        <rect x="330" y="120" width="52" height="19" />
        <rect x="742" y="120" width="38" height="19" />
      </g>
      {/* flange joints */}
      <g fill="#2c3137">
        <rect x="420" y="115" width="10" height="29" rx="1.5" />
        <rect x="860" y="115" width="10" height="29" rx="1.5" />
      </g>
      {/* conduit dropping down the right side */}
      <rect x="1136" y="139" width="13" height="500" fill="url(#tbst-pipe)" />
      <g fill="#22262b">
        <rect x="1130" y="250" width="25" height="12" rx="2" />
        <rect x="1130" y="470" width="25" height="12" rx="2" />
      </g>
    </svg>
  )
}

/**
 * The one working lamp in the hall. It drives `--lamp` on <html>, which
 * the cone, the pool of light, the vignette and the clock all read — so a
 * flicker dims the whole room, interface included.
 *
 * The schedule is deliberately aperiodic: gaps are power-shaped (mostly
 * short, occasionally half a minute of steady light) and each burst is
 * either a run of blips or a slow brown-out. Nothing repeats.
 */
const LAMP_GAP_MIN = 3800
const LAMP_GAP_MAX = 30000

function Lamp() {
  useEffect(() => {
    const root = document.documentElement
    if (prefersReducedMotion()) return

    let alive = true
    let timers: number[] = []
    let raf = 0
    let current = 1

    const set = (v: number) => {
      if (Math.abs(v - current) < 0.02) return
      current = v
      root.style.setProperty('--lamp', v.toFixed(3))
    }
    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        if (alive) fn()
      }, ms)
      timers.push(id)
      return id
    }
    const clear = () => {
      timers.forEach(clearTimeout)
      timers = []
      cancelAnimationFrame(raf)
      raf = 0
    }

    const blips = (left: number) => {
      if (left <= 0) {
        set(1)
        scheduleNext()
        return
      }
      set(0.05 + Math.random() * 0.4)
      later(() => {
        set(0.86 + Math.random() * 0.14)
        later(() => blips(left - 1), 40 + Math.random() * 220)
      }, 28 + Math.random() * 80)
    }

    const brownOut = () => {
      const dur = 320 + Math.random() * 380
      const start = performance.now()
      const step = (t: number) => {
        if (!alive) return
        const u = Math.min(1, (t - start) / dur)
        // dip to half and recover
        set(1 - 0.5 * Math.sin(u * Math.PI))
        if (u < 1) raf = requestAnimationFrame(step)
        else {
          set(1)
          scheduleNext()
        }
      }
      raf = requestAnimationFrame(step)
    }

    function scheduleNext() {
      if (!alive) return
      const gap = LAMP_GAP_MIN + Math.pow(Math.random(), 1.7) * (LAMP_GAP_MAX - LAMP_GAP_MIN)
      later(() => {
        if (document.hidden) {
          scheduleNext()
          return
        }
        if (Math.random() < 0.18) brownOut()
        else blips(1 + Math.floor(Math.random() * 4))
      }, gap)
    }

    const onVisibility = () => {
      if (document.hidden) {
        clear()
        set(1)
      } else if (!timers.length && !raf) {
        scheduleNext()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    scheduleNext()

    return () => {
      alive = false
      clear()
      document.removeEventListener('visibilitychange', onVisibility)
      // never leave a dimmed value behind for the next theme
      root.style.removeProperty('--lamp')
    }
  }, [])

  return (
    <svg className="tb-st-lamp" viewBox="0 0 120 96" aria-hidden="true">
      <defs>
        <radialGradient id="tbst-bulb" cx="50%" cy="50%">
          <stop offset="0" stopColor="#fff6e2" />
          <stop offset="0.55" stopColor="#ffd79a" />
          <stop offset="1" stopColor="rgba(255,180,90,0)" />
        </radialGradient>
        <linearGradient id="tbst-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3f47" />
          <stop offset="0.6" stopColor="#22262c" />
          <stop offset="1" stopColor="#15181c" />
        </linearGradient>
      </defs>
      {/* flex + stem */}
      <path d="M60 0 L60 18" stroke="#20242a" strokeWidth="3" />
      <rect x="56" y="16" width="8" height="8" rx="1.5" fill="#2a2f36" />
      {/* shade */}
      <path d="M60 22 C40 24 24 42 22 56 L98 56 C96 42 80 24 60 22 Z" fill="url(#tbst-shade)" />
      <ellipse cx="60" cy="56" rx="38" ry="6" fill="#0d0f12" />
      <path d="M30 46 C40 33 50 27 60 25" stroke="rgba(255,255,255,0.09)" strokeWidth="2" fill="none" />
      {/* bulb + its immediate halo */}
      <circle className="tb-st-glow" cx="60" cy="62" r="26" fill="url(#tbst-bulb)" />
      <circle className="tb-st-bulb" cx="60" cy="60" r="7.5" fill="#fff3d6" />
    </svg>
  )
}

/* ---------------- street art: the pieces ---------------- */

/**
 * Wildstyle lettering, built the way a writer builds it: a fat drop
 * shadow block, the fill, a highlight, then the outline on top — plus
 * drips that only start running once the paint is down.
 */
type PieceDef = {
  id: string
  w: number
  h: number
  /** Raster pieces are real artwork; SVG pieces recolour per slot. */
  src?: string
  render?: (p: { fill: string; glow: string }) => ReactNode
}

/** Drips hang off the bottom of the letters and grow after the sweep. */
function Drips({ at, fill }: { at: number[]; fill: string }) {
  return (
    <g className="tb-st-drips" fill={fill}>
      {at.map((x, i) => (
        <path
          key={i}
          className="tb-st-drip"
          style={{ animationDelay: `${i * 0.14}s` }}
          d={`M${x} 0 h5 v${16 + (i % 3) * 9} a2.5 2.5 0 0 1 -5 0 Z`}
        />
      ))}
    </g>
  )
}

const PIECES: PieceDef[] = [
  {
    /* The writer's own piece, lifted from the reference footage: the
       wall is desaturated concrete and the paint is not, so a saturation
       mask cuts it out cleanly. Five frames are merged because the
       artist stands in front of a different part of it in each one. */
    id: 'locked-in',
    w: 480,
    h: 240,
    src: '/tag-locked-in.webp',
  },
  {
    /* A throw-up: fat interlocking bubble forms, cast shadow, inner
       shadow, highlight and an outline — the shapes writers actually
       put up fast, not lettering. */
    id: 'throwup',
    w: 330,
    h: 150,
    render: ({ fill, glow }) => {
      const body =
        'M26 30 h54 a40 40 0 0 1 6 78 h-56 a34 34 0 0 1 -4 -78 Z M150 24 h48 a44 44 0 0 1 10 86 h-52 a38 38 0 0 1 -6 -86 Z M236 44 c26 -18 52 -6 54 18 c2 24 -22 40 -46 32'
      return (
        <>
          <path transform="translate(9 11)" d={body} fill="#08090b" opacity="0.9" />
          <path d={body} fill={fill} />
          <g fill="rgba(0,0,0,0.35)">
            <path d="M44 52 h32 a20 20 0 0 1 2 38 h-34 a18 18 0 0 1 0 -38 Z" />
            <path d="M170 46 h28 a22 22 0 0 1 4 44 h-30 a20 20 0 0 1 -2 -44 Z" />
          </g>
          <g stroke="rgba(255,255,255,0.6)" strokeWidth="5" fill="none" strokeLinecap="round">
            <path d="M36 42 C30 58 30 78 36 94" />
            <path d="M162 36 C154 56 154 80 162 100" />
          </g>
          <path d={body} fill="none" stroke={glow} strokeWidth="5" strokeLinejoin="round" />
          {/* the fat cap overspray around the edges */}
          <g fill={glow} opacity="0.3">
            <circle cx="18" cy="118" r="7" />
            <circle cx="300" cy="34" r="6" />
            <circle cx="120" cy="18" r="5" />
          </g>
          <g transform="translate(0 106)">
            <Drips at={[40, 96, 178, 248]} fill={fill} />
          </g>
        </>
      )
    },
  },
  {
    /* A hand-style tag: one flowing stroke, crowned. */
    id: 'crown-tag',
    w: 260,
    h: 150,
    render: ({ fill, glow }) => {
      const script =
        'M20 108 c16 -40 30 -54 40 -42 c10 12 -6 40 4 46 c10 6 22 -20 36 -36 c14 -16 26 -14 28 2 c2 16 -10 30 0 34 c10 4 26 -10 42 -32 c8 -11 18 -10 22 2'
      return (
        <>
          <path
            transform="translate(7 9)"
            d={script}
            stroke="#08090b"
            strokeWidth="15"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.9"
          />
          <path
            d={script}
            stroke={fill}
            strokeWidth="14"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={script}
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="3.5"
            fill="none"
            strokeLinecap="round"
            opacity="0.7"
          />
          {/* three-point crown, the writer's mark */}
          <path d="M66 52 L86 16 L108 46 L130 12 L152 44 L172 14 L166 60 L72 60 Z" fill={fill} />
          <path
            d="M66 52 L86 16 L108 46 L130 12 L152 44 L172 14 L166 60 L72 60 Z"
            fill="none"
            stroke={glow}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <g fill={glow} opacity="0.35">
            <circle cx="206" cy="90" r="5" />
            <circle cx="30" cy="60" r="4" />
          </g>
          <g transform="translate(0 104)">
            <Drips at={[54, 132, 196]} fill={fill} />
          </g>
        </>
      )
    },
  },
  {
    /* A blockbuster arrow with a splat — pure mark-making. */
    id: 'arrow',
    w: 280,
    h: 130,
    render: ({ fill, glow }) => {
      const arrow = 'M14 96 L150 30 L136 12 L214 22 L196 92 L180 72 L44 122 Z'
      return (
        <>
          <path transform="translate(8 10)" d={arrow} fill="#08090b" opacity="0.9" />
          <path d={arrow} fill={fill} />
          <path d={arrow} fill="none" stroke={glow} strokeWidth="5" strokeLinejoin="round" />
          <path d="M30 92 L146 38" stroke="rgba(255,255,255,0.5)" strokeWidth="5" strokeLinecap="round" />
          <g fill={fill} opacity="0.55">
            <circle cx="240" cy="52" r="10" />
            <circle cx="258" cy="74" r="6" />
            <circle cx="230" cy="82" r="4" />
            <circle cx="252" cy="34" r="4" />
          </g>
          <g transform="translate(0 112)">
            <Drips at={[52, 170]} fill={fill} />
          </g>
        </>
      )
    },
  },
]

/* ---------------- street art: the writer ---------------- */

/** Hooded, back to the room, can in hand — drawn as a silhouette. */
function ArtistSvg({
  armRef,
  nozzleRef,
}: {
  armRef?: RefObject<SVGGElement | null>
  nozzleRef?: RefObject<SVGCircleElement | null>
}) {
  return (
    <svg className="tb-st-artist-svg" viewBox="0 0 150 260" aria-hidden="true">
      <defs>
        <linearGradient id="tbst-hood" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0e1013" />
          <stop offset="0.62" stopColor="#1a1e23" />
          <stop offset="0.9" stopColor="#2b3138" />
          <stop offset="1" stopColor="#3a424b" />
        </linearGradient>
        <linearGradient id="tbst-jeans" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0b0d10" />
          <stop offset="0.7" stopColor="#171b21" />
          <stop offset="1" stopColor="#262c34" />
        </linearGradient>
      </defs>
      {/* legs */}
      <g className="sa-legs">
        <path className="sa-leg back" d="M56 168 L58 240 L74 240 L76 168 Z" fill="url(#tbst-jeans)" />
        <path className="sa-leg front" d="M80 168 L82 240 L98 240 L96 168 Z" fill="url(#tbst-jeans)" />
      </g>
      <path d="M52 238 h26 l3 10 h-32 Z" fill="#0a0c0e" />
      <path d="M78 238 h26 l3 10 h-32 Z" fill="#101317" />
      {/* torso: hoodie with the hood up */}
      <g className="sa-torso">
        <path
          d="M46 84 C46 62 60 48 76 48 C92 48 106 62 106 84 L112 168 C96 176 58 176 42 168 Z"
          fill="url(#tbst-hood)"
        />
        {/* hood */}
        <path
          d="M56 60 C56 34 70 20 78 20 C88 20 102 34 102 62 C94 52 66 50 56 60 Z"
          fill="#141820"
        />
        <path d="M60 58 C68 48 92 48 100 60 C92 68 68 68 60 58 Z" fill="#07080a" />
        {/* folds catching the lamp */}
        <path
          d="M96 92 C100 116 100 142 96 164 M62 96 C58 118 58 142 62 162"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="3"
          fill="none"
        />
        {/* the arm that paints — outer group places, inner group rotates */}
        <g className="sa-arm-anchor">
          <g className="sa-arm" ref={armRef}>
            <path d="M52 92 C34 96 24 108 20 122 L34 130 C40 118 46 110 58 106 Z" fill="#171b21" />
            <g className="sa-forearm">
              <path d="M22 118 C14 106 8 94 6 82 L20 76 C24 88 30 98 36 108 Z" fill="#1b2027" />
              {/* the can */}
              <g className="sa-can">
                <rect x="0" y="58" width="17" height="26" rx="3" fill="#c8ced6" />
                <rect x="0" y="58" width="17" height="7" rx="3" fill="#8f97a1" />
                <rect x="4" y="49" width="9" height="10" rx="2" fill="#2b3138" />
                <rect x="6" y="45" width="5" height="5" rx="1.5" fill="#454c56" />
                <circle className="sa-nozzle" cx="8.5" cy="44" r="1" fill="none" ref={nozzleRef} />
              </g>
            </g>
          </g>
        </g>
        {/* free hand */}
        <path d="M108 96 C118 112 120 132 116 150 L104 146 C108 130 106 112 100 100 Z" fill="#171b21" />
      </g>
    </svg>
  )
}

/** Broken concrete scattered along the foot of the wall. */
function Rubble() {
  return (
    <div className="tb-st-rubble">
      {RUBBLE.map((r, i) => (
        <span
          key={i}
          style={{
            left: `${r.left}%`,
            bottom: r.lift,
            width: r.w,
            height: r.h,
            transform: `rotate(${r.tilt}deg)`,
            background: `rgba(${Math.round(38 + r.shade * 40)}, ${Math.round(
              40 + r.shade * 42,
            )}, ${Math.round(45 + r.shade * 46)}, 0.95)`,
          }}
        />
      ))}
    </div>
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

const CLING_MS = 1050
const LEAP_MS = 700

type RiderState =
  | { phase: 'idle' }
  | { phase: 'cling'; liana: number; dir: 1 | -1 }
  | { phase: 'leap'; dir: 1 | -1 }

/**
 * The monkey is part of the scenery: invisible anchors replicate each
 * decor liana's exact sway (same keyframes, duration and delay, mounted
 * together so the phases match), and the monkey clings to their tips —
 * riding the real lianas — then leaps tip-to-tip every 16 seconds.
 */
function JungleRiders() {
  const tipRefs = useRef<(HTMLSpanElement | null)[]>([])
  const leapRef = useRef<HTMLSpanElement>(null)
  const [state, setState] = useState<RiderState>({ phase: 'idle' })

  useEffect(() => {
    if (prefersReducedMotion()) return
    for (const src of ['/monkey-swing.png', '/monkey-leap.png']) {
      const img = new Image()
      img.src = src
    }
    let alive = true
    const timers: number[] = []
    let raf = 0
    const later = (fn: () => void, ms: number) => {
      timers.push(
        window.setTimeout(() => {
          if (alive) fn()
        }, ms),
      )
    }
    const tipRect = (i: number) => tipRefs.current[i]?.getBoundingClientRect() ?? null

    // rAF arc that homes onto the (still swaying) target tip
    const leapTo = (
      from: { x: number; y: number },
      toIndex: number | null,
      dir: 1 | -1,
      exitX: number,
      then: () => void,
    ) => {
      const t0 = performance.now()
      const step = (t: number) => {
        if (!alive) return
        const u = Math.min(1, (t - t0) / LEAP_MS)
        let target = { x: exitX, y: from.y - 60 }
        if (toIndex !== null) {
          const r = tipRect(toIndex)
          if (r) target = { x: r.left + r.width / 2, y: r.top }
        }
        const x = from.x + (target.x - from.x) * u
        const y = from.y + (target.y - from.y) * u - 90 * 4 * u * (1 - u)
        if (leapRef.current) {
          leapRef.current.style.transform = `translate3d(${x - 32}px, ${y - 26}px, 0) scaleX(${dir})`
        }
        if (u < 1) raf = requestAnimationFrame(step)
        else then()
      }
      raf = requestAnimationFrame(step)
    }

    const crossing = () => {
      const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1
      const order = LIANAS.map((_, i) => i).sort(
        (a, b) => (LIANAS[a]!.left - LIANAS[b]!.left) * dir,
      )
      const W = window.innerWidth
      let k = 0

      const clingNext = () => {
        if (document.querySelector('.modal-overlay .modal')) {
          setState({ phase: 'idle' })
          return
        }
        setState({ phase: 'cling', liana: order[k]!, dir })
        later(() => {
          const r = tipRect(order[k]!)
          const from = r ? { x: r.left + r.width / 2, y: r.top } : { x: 0, y: 0 }
          k++
          setState({ phase: 'leap', dir })
          if (k < order.length) {
            leapTo(from, order[k]!, dir, 0, clingNext)
          } else {
            leapTo(from, null, dir, dir === 1 ? W + 90 : -90, () =>
              setState({ phase: 'idle' }),
            )
          }
        }, CLING_MS)
      }

      const first = tipRect(order[0]!)
      const entryY = (first?.top ?? 260) - 40
      setState({ phase: 'leap', dir })
      leapTo({ x: dir === 1 ? -80 : W + 80, y: entryY }, order[0]!, dir, 0, clingNext)
    }

    const cycle = () => {
      // hold the traverse while the pause companion hangs over the modal
      if (!document.querySelector('.modal-overlay .modal')) crossing()
      later(cycle, 16000)
    }
    later(cycle, 3000)

    return () => {
      alive = false
      timers.forEach(clearTimeout)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <>
      {LIANAS.map((l, i) => (
        <span
          key={i}
          className="tb-rider-anchor"
          style={{
            left: `${l.left}%`,
            height: `${l.len}vh`,
            animationDelay: `-${l.delay}s`,
            animationDuration: `${l.dur}s`,
          }}
        >
          <span
            className="tb-rider-tip"
            ref={(el) => {
              tipRefs.current[i] = el
            }}
          >
            {state.phase === 'cling' && state.liana === i && (
              <span
                className="tb-monkey-sprite"
                style={{ transform: `scaleX(${state.dir})` }}
              />
            )}
          </span>
        </span>
      ))}
      {state.phase === 'leap' && <span ref={leapRef} className="tb-monkey-leap" />}
    </>
  )
}

/**
 * Jungle pause companion: when the pause modal opens, the monkey rappels
 * down a vine right above the popup, hangs there swaying while you rest,
 * and climbs back up the moment you resume. Lives outside the backdrop
 * (fixed, z 120) so it can hang over the modal overlay.
 */
function JunglePauseLayer() {
  const [pause, setPause] = useState<{ x: number; h: number; leaving: boolean } | null>(null)
  const pauseRef = useRef(pause)
  const [reduced] = useState(prefersReducedMotion)

  useEffect(() => {
    if (reduced) return
    let out = 0
    const watch = window.setInterval(() => {
      const modal = document.querySelector('.modal-overlay .modal')
      const cur = pauseRef.current
      if (modal) {
        clearTimeout(out)
        const r = modal.getBoundingClientRect()
        const next = {
          x: Math.round(r.left + r.width / 2),
          h: Math.max(110, Math.round(r.top) - 24),
          leaving: false,
        }
        if (!cur || cur.x !== next.x || cur.h !== next.h || cur.leaving) {
          pauseRef.current = next
          setPause(next)
        }
      } else if (cur && !cur.leaving) {
        const next = { ...cur, leaving: true }
        pauseRef.current = next
        setPause(next)
        out = window.setTimeout(() => {
          pauseRef.current = null
          setPause(null)
        }, 780)
      }
    }, 350)
    return () => {
      clearInterval(watch)
      clearTimeout(out)
    }
  }, [reduced])

  if (reduced || !pause) return null
  return (
    <div className="tb-jungle-pause" style={{ left: pause.x }} aria-hidden="true">
      <div className={`tb-jp-drop${pause.leaving ? ' leaving' : ''}`}>
        <div className="tb-jp-sway" style={{ height: pause.h }}>
          <svg
            className="tb-jp-vine"
            viewBox="0 0 40 300"
            width={26}
            height={pause.h}
            preserveAspectRatio="none"
          >
            <path
              d="M20 0 C27 55 12 130 22 205 C27 255 16 280 20 300"
              stroke="#3f6d2c"
              strokeWidth="4.5"
              fill="none"
            />
            {[52, 118, 186, 248].map((y, j) => (
              <g key={j} fill="#4d8a35">
                <ellipse cx="12" cy={y} rx="8" ry="3.2" transform={`rotate(-28 12 ${y})`} />
                <ellipse cx="28" cy={y + 22} rx="8" ry="3.2" transform={`rotate(28 28 ${y + 22})`} />
              </g>
            ))}
          </svg>
          <span className="tb-monkey-sprite pause" />
        </div>
      </div>
    </div>
  )
}

/* ---------------- abyss: seafloor decor ---------------- */

/** Two staggered ridges of distant rock formations along the horizon. */
function RockLine() {
  return (
    <svg className="tb-rockline" viewBox="0 0 1200 190" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M0 190 L0 130 L70 96 L150 128 L230 84 L330 122 L420 70 L520 118 L600 92 L700 126 L790 78 L880 120 L980 96 L1060 130 L1140 104 L1200 126 L1200 190 Z"
        fill="#08151f"
        opacity="0.85"
      />
      <path
        d="M0 190 L0 156 L90 130 L200 158 L300 118 L420 152 L540 128 L660 156 L780 122 L900 150 L1020 130 L1120 158 L1200 140 L1200 190 Z"
        fill="#0c1e2b"
        opacity="0.9"
      />
    </svg>
  )
}

/** A coral cluster: branching coral + tube sponges (v0) or a sea fan (v1). */
function CoralSvg({ variant }: { variant: number }) {
  if (variant === 0) {
    return (
      <svg viewBox="0 0 120 90" width="100%" height="100%" aria-hidden="true">
        <ellipse cx="58" cy="87" rx="52" ry="7" fill="#0b1b26" />
        {/* branching coral */}
        <path
          d="M60 88 C58 70 60 56 52 42 M56 64 C48 56 44 48 44 38 M60 74 C66 62 70 52 68 40 M67 58 C73 52 77 46 78 38 M52 52 C46 48 42 44 40 44"
          stroke="#8a5a6e"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M60 88 C58 70 60 56 52 42 M56 64 C48 56 44 48 44 38 M60 74 C66 62 70 52 68 40 M67 58 C73 52 77 46 78 38"
          stroke="#a97487"
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
        />
        <g fill="#c9909f">
          <circle cx="52" cy="41" r="2.6" />
          <circle cx="44" cy="37" r="2.2" />
          <circle cx="68" cy="39" r="2.4" />
          <circle cx="78" cy="37" r="2" />
          <circle cx="40" cy="43" r="1.8" />
        </g>
        {/* tube sponges */}
        <g fill="#3d7d80">
          <path d="M92 88 C91 70 92 60 95 56 C98 60 99 70 98 88 Z" />
          <path d="M102 88 C101 66 102 54 105 50 C108 54 109 66 108 88 Z" />
          <path d="M84 88 C83.5 74 84 68 86.5 65 C89 68 89.5 74 89 88 Z" />
        </g>
        <g fill="#123236">
          <ellipse cx="95" cy="57" rx="1.8" ry="1.1" />
          <ellipse cx="105" cy="51" rx="1.8" ry="1.1" />
          <ellipse cx="86.5" cy="66" rx="1.4" ry="0.9" />
        </g>
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 120 90" width="100%" height="100%" aria-hidden="true">
      <ellipse cx="60" cy="87" rx="46" ry="6" fill="#0b1b26" />
      {/* sea fan */}
      <path
        d="M62 88 C40 72 32 50 40 26 C50 36 56 36 61 29 C66 36 72 36 82 27 C89 50 82 72 62 88 Z"
        fill="#5a4a74"
        opacity="0.9"
      />
      <path
        d="M62 86 C50 70 46 52 48 34 M62 86 C58 66 58 48 56 30 M62 86 C64 66 66 48 66 30 M62 86 C72 68 76 52 76 34 M50 62 C58 58 68 58 76 61 M46 46 C56 42 68 42 78 45"
        stroke="#8e7aa5"
        strokeWidth="1.4"
        fill="none"
        opacity="0.85"
      />
      {/* side branch coral */}
      <path
        d="M22 88 C22 76 24 68 20 60 M22 78 C27 72 29 66 28 60"
        stroke="#8a5a6e"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="20" cy="59" r="2.2" fill="#c9909f" />
      <circle cx="28" cy="59" r="1.9" fill="#c9909f" />
      {/* polyp glints */}
      <circle cx="48" cy="34" r="1.1" fill="#9fd8d0" opacity="0.8" />
      <circle cx="76" cy="36" r="1.1" fill="#9fd8d0" opacity="0.7" />
      <circle cx="66" cy="30" r="0.9" fill="#9fd8d0" opacity="0.75" />
    </svg>
  )
}

/** Anemone with slow-waving tentacles around a squat trunk. */
function AnemoneSvg({ phase = 0 }: { phase?: number }) {
  const tentacles = [
    { d: 'M40 50 C36 40 32 32 25 26', delay: 0 },
    { d: 'M40 50 C38 38 36 28 33 21', delay: -0.7 },
    { d: 'M40 50 C40 36 40 27 40 18', delay: -1.4 },
    { d: 'M40 50 C42 38 44 28 47 21', delay: -2.1 },
    { d: 'M40 50 C44 40 48 32 55 26', delay: -2.8 },
    { d: 'M40 50 C46 44 51 38 59 35', delay: -3.4 },
    { d: 'M40 50 C34 44 29 38 21 35', delay: -0.4 },
  ]
  return (
    <svg viewBox="0 0 80 70" width="100%" height="100%" aria-hidden="true">
      {tentacles.map((t, i) => (
        <path
          key={i}
          className="tb-tentacle"
          d={t.d}
          stroke="#c98299"
          strokeWidth="3.2"
          fill="none"
          strokeLinecap="round"
          style={{ animationDelay: `${t.delay + phase}s` }}
          opacity="0.9"
        />
      ))}
      <path d="M26 70 C25 56 31 47 40 47 C49 47 55 56 54 70 Z" fill="#74495c" />
      <path d="M28 66 C34 62 46 62 52 66 C46 64 34 64 28 66 Z" fill="#8e5c72" opacity="0.8" />
      <ellipse cx="40" cy="69" rx="18" ry="3" fill="#0b1b26" />
    </svg>
  )
}

/** Hydrothermal chimney with a pulsing magma seam and rising embers. */
function Vent() {
  return (
    <div className="tb-vent">
      <span className="tb-vent-glow" />
      <svg viewBox="0 0 140 110" width="100%" height="100%" aria-hidden="true">
        <path d="M14 110 L24 66 L38 46 L52 68 L60 110 Z" fill="#0a1620" />
        <path d="M56 110 L68 78 L82 62 L96 84 L104 110 Z" fill="#0d1b26" />
        <path d="M96 110 L104 88 L116 78 L128 92 L134 110 Z" fill="#0a1620" />
        {/* magma seams */}
        <path
          d="M38 50 L36 66 L42 82 M82 66 L78 82 L84 96"
          stroke="#ff8a4d"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
          opacity="0.75"
        />
      </svg>
      {VENT_EMBERS.map((e, i) => (
        <span
          key={i}
          className="tb-vent-ember"
          style={
            {
              left: e.left,
              animationDelay: `-${e.delay}s`,
              animationDuration: `${e.dur}s`,
              '--dx': `${e.dx}px`,
            } as Vars
          }
        />
      ))}
    </div>
  )
}

/* ---------------- abyss: the anglerfish hunt ---------------- */

const ANGLER_W = 210
const ANGLER_H = 130
/** Lure position in the (left-facing) angler SVG, scaled to element px. */
const LURE_X = 19
const LURE_Y = 23
/** Mouth interior in element px — where caught prey struggles. */
const MOUTH_X = 46
const MOUTH_Y = 82

/**
 * Deep-sea anglerfish after the user's reference art: wrinkled taupe-bronze
 * hide with warts and mottling, a bulging ring-lit eye, X scars, tall ragged
 * spine crest, rayed fan fins, a fleshy stalked esca — and a jutting underbite
 * whose curved needle fangs rise in front of the snout.
 */
function AnglerSvg({ biting }: { biting: boolean }) {
  return (
    <svg
      className={`tb-angler${biting ? ' biting' : ''}`}
      viewBox="0 0 200 124"
      width={ANGLER_W}
      height={ANGLER_H}
    >
      <defs>
        <linearGradient id="tbab-skin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4c443c" />
          <stop offset="0.45" stopColor="#625950" />
          <stop offset="1" stopColor="#7b6f63" />
        </linearGradient>
        <linearGradient id="tbab-fin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a4636" />
          <stop offset="1" stopColor="#332419" />
        </linearGradient>
        <linearGradient id="tbab-jaw" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#77695d" />
          <stop offset="1" stopColor="#52463c" />
        </linearGradient>
      </defs>
      {/* tail fan, ragged trailing edge over strong rays */}
      <path
        d="M156 52 C166 45 176 39 190 36 C186 46 184 54 185 62 L180 60 L183 70 L179 70 L183 82 L177 79 L181 92 L175 88 L178 101 C169 95 162 87 157 78 Z"
        fill="url(#tbab-fin)"
        fillOpacity="0.95"
      />
      <path
        d="M160 56 L186 42 M162 64 L182 58 M162 72 L180 74 M161 78 L176 90"
        stroke="#2c211a"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.8"
      />
      {/* dorsal crest: tall torn spines rising off the back */}
      <path
        d="M70 20 L78 4 L84 17 L92 2 L98 16 L108 4 L114 17 L124 9 L128 20 L138 14 L141 24 L150 20 L152 32 C124 18 96 16 70 20 Z"
        fill="url(#tbab-fin)"
        fillOpacity="0.92"
      />
      <path
        d="M78 5 L81 17 M92 3 L95 16 M108 5 L110 16 M124 10 L125 19 M138 15 L139 23"
        stroke="#6e5844"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.9"
      />
      {/* pelvic fin under the belly */}
      <path
        d="M56 106 C62 111 64 116 62 122 L58 117 L57 123 L52 116 C51 111 53 107.5 56 106 Z"
        fill="url(#tbab-fin)"
        fillOpacity="0.9"
      />
      {/* body: swollen head-mass, steep blunt snout, tapering peduncle */}
      <path
        d="M18 72 C14 60 16 46 26 34 C38 24 56 19 78 18 C104 17 128 24 146 36 C158 45 165 56 167 66 C168 74 167 82 163 90 C154 106 133 114 110 116 C86 118 60 112 42 100 C28 90 21 82 18 72 Z"
        fill="url(#tbab-skin)"
        stroke="rgba(120, 205, 215, 0.2)"
        strokeWidth="1"
      />
      {/* hide texture: mottling, wrinkle striations, warts, belly sheen */}
      <path d="M84 30 C98 25 112 27 122 34 C108 39 94 39 84 30 Z" fill="rgba(38, 32, 26, 0.45)" />
      <path d="M120 60 C132 56 144 60 150 68 C140 74 128 70 120 60 Z" fill="rgba(38, 32, 26, 0.35)" />
      <path d="M86 92 C96 88 108 90 114 96 C104 102 92 100 86 92 Z" fill="rgba(38, 32, 26, 0.3)" />
      <path
        d="M100 42 C103 58 103 78 98 96 M112 40 C116 58 116 80 111 100 M124 40 C129 58 129 80 124 100 M136 42 C141 58 141 78 137 96 M148 46 C152 60 152 76 148 90"
        stroke="rgba(42, 36, 30, 0.4)"
        strokeWidth="1.2"
        fill="none"
      />
      <path
        d="M60 44 C66 50 70 56 72 62 M50 36 C54 40 57 44 59 48"
        stroke="rgba(42, 36, 30, 0.4)"
        strokeWidth="1"
        fill="none"
      />
      <g fill="#8a7d6f" opacity="0.75">
        <circle cx="46" cy="30" r="1.6" />
        <circle cx="54" cy="25" r="1.2" />
        <circle cx="63" cy="31" r="1.9" />
        <circle cx="38" cy="40" r="1.3" />
        <circle cx="90" cy="54" r="1.4" />
        <circle cx="104" cy="32" r="1.2" />
        <circle cx="130" cy="44" r="1.5" />
        <circle cx="142" cy="56" r="1.1" />
        <circle cx="118" cy="78" r="1.3" />
        <circle cx="100" cy="68" r="1.1" />
      </g>
      <path d="M42 96 C70 110 110 112 140 100 C120 112 70 114 46 104 Z" fill="#8a7d6f" opacity="0.5" />
      {/* X scars */}
      <path
        d="M90 62 L98 70 M98 62 L90 70 M102 46 L109 53 M109 46 L102 53 M44 36 L49 41 M49 36 L44 41"
        stroke="#3f3129"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* nostril pit */}
      <circle cx="34" cy="50" r="2.2" fill="#241c16" />
      <path d="M31.6 48.4 A3 3 0 0 1 36.4 48.6" stroke="#7b6f63" strokeWidth="1" fill="none" />
      {/* mouth: the lip line sweeps from the snout up to a corner right
          below the eye — cavity dark, flesh-pink along the lip */}
      <path d="M14 56 C32 66 52 72 78 76 L80 86 C52 88 30 76 12 62 Z" fill="#150a0e" />
      <path d="M14 56 C32 66 52 72 78 76 L78.8 79.6 C54 76 32 68 13 59 Z" fill="#7d4a44" opacity="0.9" />
      {/* upper needle teeth, clearly hanging into the gape */}
      <path
        d="M21 60 L25.5 76 L28 62.5 Z M30 64.5 L34 81 L37 67 Z M39 68.5 L43 85 L46 70.5 Z M48 71.5 L51.5 87 L54.5 73.5 Z M57 74 L60 88 L62.5 75.5 Z M65 75.5 L67.5 87 L70 76.6 Z M71.5 76.4 L73.5 84 L75.5 77 Z"
        fill="#eae4d4"
      />
      {/* lower jaw: juts past the snout, long curved fangs rising in front
          of the face. Swings open on the hunt, snaps shut on the bite. */}
      <g className="tb-angler-jaw">
        <path
          d="M6 64 C24 80 48 86 78 82 C80 90 76 98 64 102 C46 107 24 100 14 88 C8.5 80 6 72 6 64 Z"
          fill="url(#tbab-jaw)"
          stroke="rgba(120, 205, 215, 0.18)"
          strokeWidth="1"
        />
        <path d="M7 66 C24 80 48 85 77 82 C54 88 28 84 8 70 Z" fill="#7d4a44" opacity="0.85" />
        <path
          d="M9 66 C8 56 9.5 45 13.5 35 C15 47 14.5 58 15 68 Z M17 70 C16.5 56 18.5 42 23.5 30 C25.5 44 24.5 60 25 73 Z M27 74 C27 62 29 50 33 41 C35 52 34 66 34.5 76.5 Z M40 77 C40 67 41.5 58 45 50 C47 60 46 70 46.5 79 Z M52 79.5 C52.5 71 54 63 57 57 C58.5 65 58 73 58.5 81 Z M63 81 C63.5 75 64.5 69 66.5 64 C68 70.5 67.5 76 68 81.5 Z M69.5 81.5 L71 74.5 L72.5 81.6 Z M73.5 81 L74.8 76 L76 80.8 Z"
          fill="#eae4d4"
        />
      </g>
      {/* bulging ring-lit eye above the mouth corner */}
      <circle cx="82" cy="54" r="14" fill="#2b2622" />
      <circle cx="82" cy="54" r="12" fill="#0a0c0f" />
      <circle cx="82" cy="54" r="12" fill="none" stroke="#a9b4b6" strokeWidth="2" opacity="0.8" />
      <circle cx="82" cy="54" r="9.8" fill="none" stroke="#6d7a7d" strokeWidth="0.9" opacity="0.5" />
      <circle cx="77" cy="48" r="3.4" fill="#eef4f4" />
      <circle cx="87" cy="59" r="1.6" fill="#eef4f4" opacity="0.8" />
      <path d="M74 63 A10 10 0 0 0 90 60" stroke="rgba(255, 255, 255, 0.18)" strokeWidth="1.5" fill="none" />
      {/* huge rayed pectoral fan */}
      <g className="tb-angler-fin">
        <path
          d="M118 80 C132 84 144 94 150 108 L144 105 L148 118 L140 112 L142 122 L132 116 L132 122 L122 112 C114 102 112 90 118 80 Z"
          fill="url(#tbab-fin)"
          fillOpacity="0.92"
        />
        <path
          d="M120 84 L146 106 M119 88 L140 114 M118 92 L132 120"
          stroke="#6e5844"
          strokeWidth="1"
          strokeLinecap="round"
          opacity="0.85"
        />
      </g>
      {/* fleshy illicium stalk + drooping esca */}
      <path
        d="M58 30 C50 16 40 8 28 8 C22 8 18 13 18 18"
        stroke="#8a6a5c"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M58 30 C50 16 40 8 28 8 C22 8 18 13 18 18"
        stroke="#b59182"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
        opacity="0.6"
      />
      <circle className="tb-lure-glow" cx="18.5" cy="21.5" r="10" fill="#cfeee8" />
      <path
        d="M18 14 C13.5 17 12.5 22.5 15.5 26.5 C19 30.5 24 28.5 24.5 23.5 C25 19 22 15.5 18 14 Z"
        fill="#f2fffb"
      />
      <circle cx="19" cy="22" r="3" fill="#fff" />
    </svg>
  )
}

/** The little bronze slimehead the esca reels in. */
function PreySvg() {
  return (
    <svg viewBox="0 0 44 26" width="40" height="24">
      <defs>
        <linearGradient id="tbab-prey" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5c4939" />
          <stop offset="1" stopColor="#2f251d" />
        </linearGradient>
      </defs>
      {/* forked tail with rays */}
      <path
        d="M30 13 C34 9 38 6.5 41.5 5.5 C40 9 39.5 11 39.5 13 C39.5 15 40 17 41.5 20.5 C38 19.5 34 17 30 13 Z"
        fill="#40332a"
      />
      <path d="M32 11 L39.5 7.5 M32 15 L39.5 18.5" stroke="#241c16" strokeWidth="0.7" opacity="0.8" />
      {/* deep round body */}
      <path
        d="M4 13 C7 6.5 14 3 21 3.5 C27 4 31.5 8 32.5 13 C31.5 18 27 22 21 22.5 C14 23 7 19.5 4 13 Z"
        fill="url(#tbab-prey)"
      />
      {/* spiny dorsal */}
      <path d="M12 4.5 L14 0.8 L16 4 L18.5 0.5 L20.5 3.8 L23 1.5 L24.5 4.5 Z" fill="#3a2d24" />
      {/* bronze flank sheen + pale belly */}
      <path d="M7 11 C13 8 21 7.5 28 10 C22 12 12 13 7 11 Z" fill="#7a614c" opacity="0.55" />
      <path d="M7 16 C13 19.5 21 20 28 17 C23 20.5 13 21 7 16 Z" fill="#8d7a66" opacity="0.5" />
      {/* fins */}
      <path d="M15 13 L20 17.5 L14 18.5 Z" fill="#3a2d24" opacity="0.9" />
      <path d="M13 20 L15.5 24.5 L18 20.5 Z" fill="#3a2d24" opacity="0.85" />
      <path d="M23 20 L25.5 24 L28 19 Z" fill="#3a2d24" opacity="0.85" />
      {/* gill plate, upturned mouth, ringed eye */}
      <path d="M12 7.5 C14.5 10 14.5 16 12 18.5" stroke="#2c211a" strokeWidth="1" fill="none" />
      <path d="M4.5 11.5 L8 12.5" stroke="#2c211a" strokeWidth="1" strokeLinecap="round" />
      <circle cx="9.5" cy="10.5" r="2.6" fill="#0d0f11" />
      <circle cx="9.5" cy="10.5" r="2.6" fill="none" stroke="#9aa5a6" strokeWidth="0.7" opacity="0.8" />
      <circle cx="8.6" cy="9.6" r="0.9" fill="#eef4f6" />
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
  const [prey, setPrey] = useState<{
    id: number
    sx: number
    sy: number
    lx: number
    ly: number
    mx: number
    my: number
  } | null>(null)
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
      const mouthX = s.x + (s.facing === 1 ? ANGLER_W - MOUTH_X : MOUTH_X)
      const mouthY = s.y + MOUTH_Y
      const fromLeft = s.facing !== 1
      const sx = lampX + (fromLeft ? -1 : 1) * (230 + Math.random() * 120)
      const sy = lampY - 60 + Math.random() * 120
      setPrey({ id: Date.now(), sx, sy, lx: lampX, ly: lampY, mx: mouthX, my: mouthY })
      window.setTimeout(() => setBiting(true), 3300)
      window.setTimeout(() => setPrey(null), 3900)
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
      {prey && <Prey key={prey.id} {...prey} doomed={biting} />}
      {biting && (
        <span
          className="tb-gulp"
          style={{ transform: `translate3d(${state.current.x + (state.current.facing === 1 ? ANGLER_W - MOUTH_X : MOUTH_X)}px, ${state.current.y + MOUTH_Y - 14}px, 0)` }}
        >
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
      )}
    </>
  )
}

function Prey({
  sx,
  sy,
  lx,
  ly,
  mx,
  my,
  doomed,
}: {
  sx: number
  sy: number
  lx: number
  ly: number
  mx: number
  my: number
  doomed: boolean
}) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const flip = lx > sx ? -1 : 1 // svg faces left; flip when swimming right
    el.style.transform = `translate3d(${sx}px, ${sy}px, 0) scaleX(${flip})`
    void el.getBoundingClientRect()
    el.style.transition = 'transform 3.2s cubic-bezier(0.45, 0.1, 0.55, 1)'
    // drift to the esca, hovering just above the waiting jaws
    el.style.transform = `translate3d(${lx - 12}px, ${ly + 30}px, 0) scaleX(${flip})`
  }, [sx, sy, lx, ly])
  useEffect(() => {
    const el = ref.current
    if (!el || !doomed) return
    // snatched: yanked into the gaping mouth, thrashing until the jaws shut
    const flip = lx > sx ? -1 : 1
    el.style.transition = 'transform 0.28s ease-in'
    el.style.transform = `translate3d(${mx - 18}px, ${my - 12}px, 0) scaleX(${flip})`
  }, [doomed, lx, sx, mx, my])
  return (
    <span ref={ref} className={`tb-prey${doomed ? ' doomed' : ''}`}>
      <PreySvg />
    </span>
  )
}

/* ---------------- street art: the writer's visit ---------------- */

/**
 * Where a piece can land. `lift` is how high the writer reaches for it,
 * so the wall doesn't end up with everything in one neat row.
 */
const WALL_SLOTS = [
  { x: 5, y: 44, s: 0.9, lift: 30 },
  { x: 34, y: 30, s: 1, lift: 210 },
  { x: 58, y: 46, s: 0.8, lift: 0 },
  { x: 20, y: 22, s: 0.72, lift: 260 },
]
/** Artist sprite box, and where the can sits inside it. */
const ART_W = 150
const ART_CAN_X = 10
const PIECE_INKS = [
  { fill: '#35d7f5', glow: '#ff4fa3' },
  { fill: '#ff8a2b', glow: '#35d7f5' },
  { fill: '#ff4fa3', glow: '#b6f24a' },
  { fill: '#b6f24a', glow: '#ff8a2b' },
]
const ART_GAP_MIN = 44_000
const ART_GAP_MAX = 82_000
const WALK_MS = 2600
const SHAKE_MS = 1100
const SPRAY_MS = 5200
const ADMIRE_MS = 1500
const EXIT_MS = 2400
const MIST_POOL = 18
const DROP_POOL = 8
const MAX_PIECES = 4
const PIECES_KEY = 'focusguard.street.pieces.v1'

type ArtPhase = 'idle' | 'enter' | 'shake' | 'spray' | 'admire' | 'exit'
type Placed = {
  id: number
  piece: number
  slot: number
  ink: number
  flip: boolean
  rot: number
  /** vh, measured off the can when the piece was painted */
  y?: number
}
type Particle = {
  alive: boolean
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
}

function readSaved(): Placed[] {
  try {
    const raw = localStorage.getItem(PIECES_KEY)
    if (!raw) return []
    const rows = JSON.parse(raw) as Placed[]
    if (!Array.isArray(rows)) return []
    return rows
      .filter((r) => typeof r?.piece === 'number' && typeof r?.slot === 'number')
      .slice(-MAX_PIECES)
  } catch {
    return []
  }
}

function saveSaved(rows: Placed[]) {
  try {
    localStorage.setItem(PIECES_KEY, JSON.stringify(rows.slice(-MAX_PIECES)))
  } catch {
    /* private mode, quota — the wall just won't persist */
  }
}

/**
 * Every minute or so a writer walks in, shakes a can, paints a piece and
 * leaves. The paint appears exactly where the nozzle passes because one
 * rAF drives the arm, the reveal mask and the mist together. Finished
 * pieces stay on the wall — and survive a reload.
 */
function StreetLayer() {
  const [reduced] = useState(prefersReducedMotion)
  const [pieces, setPieces] = useState<Placed[]>([])
  const [phase, setPhase] = useState<ArtPhase>('idle')
  const [active, setActive] = useState<(Placed & { from: -1 | 1 }) | null>(null)

  // the raster piece must be in cache before it is revealed
  useEffect(() => {
    if (reduced) return
    const img = new Image()
    img.src = '/tag-locked-in.webp'
  }, [reduced])

  const layerRef = useRef<HTMLDivElement>(null)
  const artistRef = useRef<HTMLDivElement>(null)
  const armRef = useRef<SVGGElement>(null)
  const nozzleRef = useRef<SVGCircleElement>(null)
  const pieceRef = useRef<HTMLSpanElement>(null)
  const mistRefs = useRef<(HTMLSpanElement | null)[]>([])
  const dropRefs = useRef<(HTMLSpanElement | null)[]>([])
  const phaseRef = useRef<ArtPhase>('idle')
  const activeRef = useRef<(Placed & { from: -1 | 1 }) | null>(null)

  // restore after mount so the first client render still matches the server
  useEffect(() => {
    const saved = readSaved()
    if (saved.length) setPieces(saved)
  }, [])

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])
  useEffect(() => {
    activeRef.current = active
  }, [active])

  useEffect(() => {
    if (reduced) return
    let alive = true
    let timers: number[] = []
    let raf = 0
    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        if (alive) fn()
      }, ms)
      timers.push(id)
      return id
    }

    const mist: Particle[] = Array.from({ length: MIST_POOL }, () => ({
      alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1,
    }))
    const drops: Particle[] = Array.from({ length: DROP_POOL }, () => ({
      alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1,
    }))

    const setArtistX = (x: number, flip: boolean) => {
      if (artistRef.current) {
        artistRef.current.style.transform = `translate3d(${x}px, 0, 0) scaleX(${flip ? -1 : 1})`
      }
    }

    /** One frame loop: walking, spraying and every particle. */
    const runSpray = (piece: Placed & { from: -1 | 1 }, onDone: () => void) => {
      const t0 = performance.now()
      let lastEmit = 0
      let lastDrop = 0
      let last = t0
      const ink = PIECE_INKS[piece.ink % PIECE_INKS.length]!

      // hang the piece off the can's real height, so paint lands where
      // the writer is actually reaching
      if (pieceRef.current && nozzleRef.current) {
        const n = nozzleRef.current.getBoundingClientRect()
        const h = pieceRef.current.getBoundingClientRect().height
        const lift = WALL_SLOTS[piece.slot % WALL_SLOTS.length]!.lift
        const top = Math.max(6, n.top + n.height / 2 - h * 0.55 - lift)
        pieceRef.current.style.top = `${top}px`
        piece.y = (top / window.innerHeight) * 100
      }

      const frame = (t: number) => {
        if (!alive) return
        const dt = Math.min(64, t - last) / 1000
        last = t
        const u = Math.min(1, (t - t0) / SPRAY_MS)
        // the hand wanders — never a mechanical wipe
        const s = Math.max(0, Math.min(1.06, u + 0.05 * Math.sin(u * 17)))

        pieceRef.current?.style.setProperty('--rv', `${s * 112 - 6}%`)
        if (armRef.current) armRef.current.style.transform = `rotate(${-10 + s * 36}deg)`

        // emit from wherever the nozzle actually is
        if (t - lastEmit > 55 && u < 1 && nozzleRef.current && layerRef.current) {
          lastEmit = t
          const n = nozzleRef.current.getBoundingClientRect()
          const dir = piece.from
          for (let k = 0; k < 2; k++) {
            const p = mist.find((m) => !m.alive)
            if (!p) break
            p.alive = true
            p.x = n.left + n.width / 2
            p.y = n.top + n.height / 2
            p.vx = dir * (30 + Math.random() * 70)
            p.vy = -24 + Math.random() * 48
            p.life = 0
            p.max = 0.7 + Math.random() * 0.4
            p.size = 5 + Math.random() * 9
          }
          if (t - lastDrop > 180) {
            lastDrop = t
            const d = drops.find((m) => !m.alive)
            if (d) {
              d.alive = true
              d.x = n.left + n.width / 2
              d.y = n.top + n.height / 2
              d.vx = dir * (10 + Math.random() * 40)
              d.vy = -30 + Math.random() * 20
              d.life = 0
              d.max = 0.5
              d.size = 2 + Math.random() * 2
            }
          }
        }

        const step = (arr: Particle[], refs: (HTMLSpanElement | null)[], gravity: number, grow: number) => {
          arr.forEach((p, i) => {
            const el = refs[i]
            if (!el) return
            if (!p.alive) {
              el.style.opacity = '0'
              return
            }
            p.life += dt
            if (p.life >= p.max) {
              p.alive = false
              el.style.opacity = '0'
              return
            }
            p.vy += gravity * dt
            p.x += p.vx * dt
            p.y += p.vy * dt
            const k = p.life / p.max
            el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) scale(${(0.4 + k * grow).toFixed(2)})`
            el.style.opacity = String((1 - k) * 0.5)
            el.style.width = `${p.size}px`
            el.style.height = `${p.size}px`
          })
        }
        step(mist, mistRefs.current, -6, 1.9)
        step(drops, dropRefs.current, 420, 0.2)
        if (mistRefs.current[0]) {
          mistRefs.current.forEach((el) => el && (el.style.background = ink.fill))
        }

        if (u < 1 || mist.some((m) => m.alive) || drops.some((d) => d.alive)) {
          raf = requestAnimationFrame(frame)
        } else {
          onDone()
        }
      }
      raf = requestAnimationFrame(frame)
    }

    const walk = (fromX: number, toX: number, ms: number, flip: boolean, onDone: () => void) => {
      const t0 = performance.now()
      const frame = (t: number) => {
        if (!alive) return
        const u = Math.min(1, (t - t0) / ms)
        const e = 1 - Math.pow(1 - u, 3)
        setArtistX(fromX + (toX - fromX) * e, flip)
        if (u < 1) raf = requestAnimationFrame(frame)
        else onDone()
      }
      raf = requestAnimationFrame(frame)
    }

    const fire = () => {
      if (!alive || phaseRef.current !== 'idle') return
      const used = new Set(pieces.map((p) => p.slot))
      const free = WALL_SLOTS.map((_, i) => i).filter((i) => !used.has(i))
      const slot = free.length
        ? free[Math.floor(Math.random() * free.length)]!
        : Math.floor(Math.random() * WALL_SLOTS.length)
      // the writer's own piece is the headline act; the rest fill in,
      // and nothing already up there gets painted twice
      const onWall = new Set(pieces.map((p) => p.piece))
      const fresh = PIECES.map((_, i) => i).filter((i) => !onWall.has(i))
      const pool = fresh.length ? fresh : PIECES.map((_, i) => i)
      const piece =
        pool.includes(0) && Math.random() < 0.45
          ? 0
          : pool[Math.floor(Math.random() * pool.length)]!
      const from: -1 | 1 = Math.random() < 0.5 ? -1 : 1
      const next = {
        id: performance.now(),
        piece,
        slot,
        ink: Math.floor(Math.random() * PIECE_INKS.length),
        flip: from === 1,
        rot: -1.5 + Math.random() * 3,
        from,
      }
      setActive(next)

      // stand where the can lands on the edge of the piece: entering from
      // the left puts the writer to its right, spraying back across it
      const slotDef = WALL_SLOTS[slot]!
      const def = PIECES[piece]!
      const pieceLeft = (window.innerWidth * slotDef.x) / 100
      const pieceRight = pieceLeft + def.w * slotDef.s
      const target =
        from === -1
          ? Math.min(window.innerWidth - ART_W, pieceRight - ART_CAN_X + 4)
          : Math.max(0, pieceLeft - (ART_W - ART_CAN_X) - 4)
      const off = from === -1 ? -180 : window.innerWidth + 40
      setPhase('enter')
      setArtistX(off, from === 1)
      walk(off, target, WALK_MS, from === 1, () => {
        setPhase('shake')
        later(() => {
          setPhase('spray')
          runSpray(next, () => {
            setPhase('admire')
            later(() => {
              setPhase('exit')
              const away = Math.random() < 0.5 ? -220 : window.innerWidth + 60
              walk(target, away, EXIT_MS, away > 0, () => {
                setPieces((prev) => {
                  const rows = [...prev.filter((p) => p.slot !== slot), next].slice(-MAX_PIECES)
                  saveSaved(rows)
                  return rows
                })
                setActive(null)
                setPhase('idle')
                scheduleNext()
              })
            }, ADMIRE_MS)
          })
        }, SHAKE_MS)
      })
    }

    function scheduleNext(overrideGap?: number) {
      if (!alive) return
      const gap = overrideGap ?? ART_GAP_MIN + Math.random() * (ART_GAP_MAX - ART_GAP_MIN)
      later(() => {
        // don't start a visit over the pause dialog; a piece already
        // being painted is allowed to finish
        if (document.hidden || document.querySelector('.modal-overlay .modal')) {
          scheduleNext(9000)
          return
        }
        fire()
        // now and then the writer comes back straight away
        if (Math.random() < 0.1) later(() => scheduleNext(12000 + Math.random() * 8000), 100)
      }, gap)
    }

    scheduleNext(9000 + Math.random() * 9000)

    if (import.meta.env.DEV) {
      ;(window as unknown as { __street?: unknown }).__street = {
        fire,
        clear: () => {
          setPieces([])
          saveSaved([])
        },
      }
    }

    return () => {
      alive = false
      timers.forEach(clearTimeout)
      timers = []
      cancelAnimationFrame(raf)
      if (import.meta.env.DEV) delete (window as unknown as { __street?: unknown }).__street
    }
    // `pieces` is read inside fire() through the closure on purpose: the
    // effect re-registers when the wall changes so slot picking stays fresh.
  }, [reduced, pieces])

  const renderPiece = (p: Placed, done: boolean) => {
    const def = PIECES[p.piece % PIECES.length]!
    const ink = PIECE_INKS[p.ink % PIECE_INKS.length]!
    const slot = WALL_SLOTS[p.slot % WALL_SLOTS.length]!
    // the paint appears from the edge the writer started at
    const rtl = !done && active?.from === -1
    return (
      <span
        key={p.id}
        ref={done ? undefined : pieceRef}
        className={`tb-st-piece${done ? ' done' : ''}${rtl ? ' rtl' : ''}${
          phase === 'admire' || done ? ' dripping' : ''
        }`}
        style={{
          left: `${slot.x}vw`,
          top: `${p.y ?? slot.y}vh`,
          width: def.w * slot.s,
          transform: `rotate(${p.rot}deg)`,
        }}
      >
        {def.src ? (
          <img src={def.src} alt="" width={def.w} height={def.h} draggable={false} />
        ) : (
          <svg viewBox={`0 0 ${def.w} ${def.h + 40}`} aria-hidden="true">
            {def.render?.(ink)}
          </svg>
        )}
      </span>
    )
  }

  if (reduced) {
    // saved work is scenery; only the choreography is motion
    return (
      <div className="tb-st-layer" aria-hidden="true">
        {pieces.map((p) => renderPiece(p, true))}
      </div>
    )
  }

  return (
    <div ref={layerRef} className="tb-st-layer" aria-hidden="true">
      {pieces.map((p) => renderPiece(p, true))}
      {active && renderPiece(active, false)}
      {active && (
        <div ref={artistRef} className="tb-st-artist" data-phase={phase}>
          <ArtistSvg armRef={armRef} nozzleRef={nozzleRef} />
        </div>
      )}
      {phase === 'spray' && (
        <>
          {Array.from({ length: MIST_POOL }, (_, i) => (
            <span
              key={`m${i}`}
              className="tb-st-mist"
              ref={(el) => {
                mistRefs.current[i] = el
              }}
            />
          ))}
          {Array.from({ length: DROP_POOL }, (_, i) => (
            <span
              key={`d${i}`}
              className="tb-st-drop"
              ref={(el) => {
                dropRefs.current[i] = el
              }}
            />
          ))}
        </>
      )}
    </div>
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
  const [burp, setBurp] = useState(false)
  const [reduced] = useState(prefersReducedMotion)

  // While asleep on the modal, wake for a flame burp every 60s.
  useEffect(() => {
    if (reduced || mode !== 'sleep') return
    const iv = window.setInterval(() => setBurp(true), 60000)
    return () => clearInterval(iv)
  }, [mode, reduced])

  useEffect(() => {
    if (!burp) return
    const t = window.setTimeout(() => setBurp(false), 1800)
    return () => clearTimeout(t)
  }, [burp])

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
      return { x: r.left + r.width / 2 - DRAGON_W / 2, y: r.top - DRAGON_H + 28 }
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
    <div
      ref={wrapRef}
      className={`tb-dragon-layer mode-${mode}${burp ? ' burping' : ''}`}
      aria-hidden="true"
    >
      <div ref={flipRef} className="tb-dragon-flip">
        <div className="tb-dragon-bob">
          <div className="tb-dragon-sprite fly" />
          {/* fire breath every 30s while airborne */}
          <span className="tb-dragon-fire" />
          <div className="tb-dragon-sprite sleep" />
          {burp && <span className="tb-dragon-burp" />}
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
