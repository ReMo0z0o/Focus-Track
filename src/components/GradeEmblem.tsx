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

/** Hexagonal rank emblem with a layered flame that intensifies per grade. */
export function GradeEmblem({
  level,
  width = 128,
}: {
  level: number
  width?: number
}) {
  return (
    <svg
      className="grade-emblem"
      viewBox={`0 0 ${HEX_VIEW.w} ${HEX_VIEW.h}`}
      width={width}
      height={Math.round((width * HEX_VIEW.h) / HEX_VIEW.w)}
      role="img"
      aria-label={`${GRADE_NAMES[level]} emblem`}
    >
      {/* hex frame */}
      <polygon
        className="hex-outer"
        points={HEX_POINTS.map((p) => p.join(',')).join(' ')}
        fill="none"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <polygon
        className="hex-inner"
        points="60,14 103,39 103,93 60,118 17,93 17,39"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* flame — outer, inner, core */}
      <g className="flame">
        <path
          className="flame-outer"
          d="M60 32 C70 46 82 54 82 71 C82 88 72 98 60 100 C48 98 38 88 38 71 C38 54 50 46 60 32 Z"
        />
        {level >= 1 && (
          <path
            className="flame-inner"
            d="M60 52 C66 61 73 66 73 76 C73 87 67 93 60 94 C53 93 47 87 47 76 C47 66 54 61 60 52 Z"
          />
        )}
        {level >= 3 && <circle className="flame-core" cx="60" cy="80" r="6.5" />}
        {level >= 5 && (
          <g className="beam">
            <path d="M60 6 L64 26 L56 26 Z" />
            <path d="M14 37 L32 47 L28 53 Z" />
            <path d="M106 37 L88 47 L92 53 Z" />
          </g>
        )}
      </g>
      {/* level pips */}
      <g className="pips">
        {GRADE_NAMES.map((_, i) => (
          <circle
            key={i}
            cx={35 + i * 10}
            cy={112}
            r="2.6"
            className={i <= level ? 'pip on' : 'pip'}
          />
        ))}
      </g>
    </svg>
  )
}
