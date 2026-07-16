import { useId } from 'react'
import { GRADE_NAMES } from '@/lib/stats'

/** Pointy-top hexagon outline shared by the 2D emblem and the 3D prism. */
export const HEX_POINTS: [number, number][] = [
  [60, 4],
  [112, 34],
  [112, 98],
  [60, 128],
  [8, 98],
  [8, 34],
]

export const HEX_VIEW = { w: 120, h: 132 }

const OUTER = HEX_POINTS.map((p) => p.join(',')).join(' ')
// Inner edge of the metal bezel — the recessed plate that cradles the gem.
const PLATE = '60,14 103,39 103,93 60,118 17,93 17,39'

// Twinkling sparkle positions (kept inside the viewBox so they aren't clipped).
const SPARKLES = [
  { x: 90, y: 30, r: 2.6, delay: '0s' },
  { x: 30, y: 44, r: 2.0, delay: '1.1s' },
  { x: 96, y: 84, r: 2.3, delay: '0.6s' },
  { x: 22, y: 88, r: 1.8, delay: '1.8s' },
  { x: 74, y: 18, r: 1.6, delay: '2.4s' },
  { x: 60, y: 112, r: 2.0, delay: '3.0s' },
]

/**
 * Jewellery-grade rank emblem: a faceted metal bezel cradling a cut
 * gem-flame that licks and dances. Richness scales with the grade —
 * more flame layers, sparkles, a halo and light beams at the top ranks.
 * `width < 60` renders a compact version (just bezel + animated flame) so
 * small badges stay legible.
 */
export function GradeEmblem({
  level,
  width = 128,
}: {
  level: number
  width?: number
}) {
  const rawId = useId()
  const uid = rawId.replace(/[^a-zA-Z0-9]/g, '')
  const g = (name: string) => `${name}-${uid}`
  const url = (name: string) => `url(#${g(name)})`

  const rich = width >= 60

  return (
    <svg
      className={`grade-emblem${rich ? '' : ' compact'}`}
      viewBox={`0 0 ${HEX_VIEW.w} ${HEX_VIEW.h}`}
      width={width}
      height={Math.round((width * HEX_VIEW.h) / HEX_VIEW.w)}
      role="img"
      aria-label={`${GRADE_NAMES[level]} emblem`}
    >
      <defs>
        {/* polished metal bezel — double highlight for a brushed-gold sheen */}
        <linearGradient id={g('metal')} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="var(--tier-hi)" />
          <stop offset="0.28" stopColor="var(--tier)" />
          <stop offset="0.5" stopColor="var(--tier-lo)" />
          <stop offset="0.72" stopColor="var(--tier)" />
          <stop offset="1" stopColor="var(--tier-hi)" />
        </linearGradient>
        {/* recessed inner plate */}
        <radialGradient id={g('plate')} cx="0.5" cy="0.42" r="0.75">
          <stop offset="0" stopColor="color-mix(in srgb, var(--tier-lo) 55%, #05070b)" />
          <stop offset="1" stopColor="#05070b" />
        </radialGradient>
        {/* gem-flame body */}
        <linearGradient id={g('gem')} x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0" stopColor="var(--tier-hi)" />
          <stop offset="0.45" stopColor="var(--tier)" />
          <stop offset="1" stopColor="var(--tier-lo)" />
        </linearGradient>
        {/* halo + core radials */}
        <radialGradient id={g('halo')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="var(--tier)" stopOpacity="0.55" />
          <stop offset="0.55" stopColor="var(--tier)" stopOpacity="0.14" />
          <stop offset="1" stopColor="var(--tier)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={g('core')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fffdf6" />
          <stop offset="0.6" stopColor="var(--tier-hi)" />
          <stop offset="1" stopColor="var(--tier)" stopOpacity="0" />
        </radialGradient>
        {/* moving light glint across the metal */}
        <linearGradient id={g('sheen')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.7" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <filter id={g('soft')} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
        <clipPath id={g('clipHex')}>
          <polygon points={OUTER} />
        </clipPath>
      </defs>

      {/* ambient halo behind the medal (top grades) */}
      {rich && level >= 4 && (
        <circle className="em-halo" cx="60" cy="66" r="60" fill={url('halo')} />
      )}

      {/* light beams radiating from behind the jewel (top grade) */}
      {rich && level >= 5 && (
        <g className="em-beams" fill="var(--tier-hi)">
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <path
              key={a}
              d="M60 66 L56 6 L64 6 Z"
              transform={`rotate(${a} 60 66)`}
            />
          ))}
        </g>
      )}

      {/* --- metal bezel --- */}
      <polygon
        className="em-bezel"
        points={OUTER}
        fill={url('metal')}
        stroke="var(--tier-lo)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {/* bright top rim */}
      <polygon
        className="em-rim"
        points={OUTER}
        fill="none"
        stroke="var(--tier-hi)"
        strokeWidth="1"
        strokeLinejoin="round"
        opacity="0.6"
      />
      {/* bezel corner facets catching light */}
      {rich &&
        HEX_POINTS.map((p, i) => {
          const next = HEX_POINTS[(i + 1) % HEX_POINTS.length]!
          const prev = HEX_POINTS[(i + HEX_POINTS.length - 1) % HEX_POINTS.length]!
          const mid = (a: number[], b: number[]) => [
            a[0]! + (b[0]! - a[0]!) * 0.32,
            a[1]! + (b[1]! - a[1]!) * 0.32,
          ]
          const m1 = mid(p, next)
          const m2 = mid(p, prev)
          return (
            <polygon
              key={i}
              className="em-facet-corner"
              points={`${p[0]},${p[1]} ${m1[0]},${m1[1]} ${m2[0]},${m2[1]}`}
              fill="var(--tier-hi)"
              opacity={i % 2 === 0 ? 0.35 : 0.18}
            />
          )
        })}
      {/* recessed plate */}
      <polygon
        className="em-plate"
        points={PLATE}
        fill={url('plate')}
        stroke="color-mix(in srgb, var(--tier) 30%, transparent)"
        strokeWidth="1"
        strokeLinejoin="round"
      />

      {/* --- the gem-flame --- */}
      <g className="em-flame" style={{ transformOrigin: '60px 101px' }}>
        {/* soft aura */}
        <path
          className="em-aura"
          filter={url('soft')}
          fill="var(--tier)"
          d="M60 28 C72 44 84 55 84 72 C84 90 73 102 60 102 C47 102 36 90 36 72 C36 55 48 44 60 28 Z"
        />
        {/* faceted gem body */}
        <g className="em-gem">
          <path
            fill={url('gem')}
            d="M60 30 C71 45 83 55 83 72 C83 89 72 101 60 101 C48 101 37 89 37 72 C37 55 49 45 60 30 Z"
          />
          {/* cut facets */}
          <polygon className="em-facet-bright" points="60,36 67,72 60,96 53,72" fill="var(--tier-hi)" />
          <polygon className="em-facet-mid" points="60,37 53,72 42,67" fill="var(--tier-hi)" opacity="0.45" />
          <polygon className="em-facet-mid" points="60,37 67,72 78,67" fill="var(--tier-lo)" opacity="0.4" />
          <polygon className="em-facet-dark" points="53,72 60,96 45,84" fill="var(--tier-lo)" opacity="0.55" />
          <polygon className="em-facet-dark" points="67,72 60,96 75,84" fill="var(--tier-lo)" opacity="0.4" />
          {/* specular glint on the crown */}
          <ellipse className="em-spec" cx="54" cy="50" rx="2.6" ry="6" fill="#fffdf6" opacity="0.75" />
        </g>
        {/* inner flame (grade >= 1) */}
        {level >= 1 && (
          <path
            className="em-inner"
            fill="var(--tier-hi)"
            d="M60 50 C67 60 74 66 74 77 C74 88 68 95 60 95 C52 95 46 88 46 77 C46 66 53 60 60 50 Z"
          />
        )}
        {/* hot core (grade >= 3) */}
        {level >= 3 && <circle className="em-core" cx="60" cy="82" r="8" fill={url('core')} />}
        {/* dancing tip spark */}
        <circle className="em-tip" cx="60" cy="31" r="2.2" fill="#fffdf6" />
      </g>

      {/* moving glint sweeping the metal (grade >= 2) */}
      {rich && level >= 2 && (
        <g clipPath={url('clipHex')}>
          <rect className="em-glint" x="-34" y="0" width="30" height="132" fill={url('sheen')} />
        </g>
      )}

      {/* twinkling sparkles */}
      {rich &&
        SPARKLES.slice(0, Math.max(0, level)).map((s, i) => (
          <g
            key={i}
            className="em-sparkle"
            transform={`translate(${s.x} ${s.y})`}
            style={{ animationDelay: s.delay }}
          >
            <path
              d={`M0 ${-s.r * 2} L${s.r * 0.5} ${-s.r * 0.5} L${s.r * 2} 0 L${s.r * 0.5} ${s.r * 0.5} L0 ${s.r * 2} L${-s.r * 0.5} ${s.r * 0.5} L${-s.r * 2} 0 L${-s.r * 0.5} ${-s.r * 0.5} Z`}
              fill="#fffdf6"
            />
          </g>
        ))}

      {/* inlaid grade gems */}
      {rich && (
        <g className="em-pips">
          {GRADE_NAMES.map((_, i) => (
            <circle
              key={i}
              cx={35 + i * 10}
              cy={112}
              r={i <= level ? 2.9 : 2.2}
              className={i <= level ? 'em-pip on' : 'em-pip'}
              fill={i <= level ? 'var(--tier-hi)' : 'rgba(233,236,244,0.12)'}
            />
          ))}
        </g>
      )}
    </svg>
  )
}
