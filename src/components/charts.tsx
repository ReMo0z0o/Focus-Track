import { useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { APP_LOCALE, fmtDuration } from '@/lib/stats'

/**
 * Hand-rolled SVG charts. Series colors are validated for the dark surface
 * (#141926): focus #c98500, pause #5f8ee0 — see docs/design notes.
 * Marks carry color; all text uses text tokens.
 */
export const CHART_FOCUS = '#c98500'
export const CHART_PAUSE = '#5f8ee0'

const W = 520
const H = 200
const PAD = { top: 12, right: 10, bottom: 24, left: 36 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom

interface TooltipState {
  x: number
  y: number
  content: ReactNode
}

function ChartShell({
  children,
  tooltip,
  ariaLabel,
}: {
  children: ReactNode
  tooltip: TooltipState | null
  ariaLabel: string
}) {
  return (
    <div style={{ position: 'relative' }}>
      <svg
        className="chart-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={ariaLabel}
      >
        {children}
      </svg>
      {tooltip && (
        <div
          style={{
            position: 'absolute',
            left: `${(tooltip.x / W) * 100}%`,
            top: `${(tooltip.y / H) * 100}%`,
            transform: `translate(${tooltip.x > W * 0.62 ? '-108%' : '10px'}, -50%)`,
            background: 'var(--surface-2)',
            border: '1px solid var(--border-strong)',
            borderRadius: '8px',
            padding: '0.45rem 0.7rem',
            fontSize: '0.78rem',
            lineHeight: 1.45,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            boxShadow: '0 6px 18px rgba(0,0,0,0.4)',
            zIndex: 5,
          }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  )
}

function yGridLines(
  ticks: number[],
  yScale: (v: number) => number,
  format: (v: number) => string,
) {
  return ticks.map((t) => (
    <g key={t}>
      <line
        className="grid-line"
        x1={PAD.left}
        x2={W - PAD.right}
        y1={yScale(t)}
        y2={yScale(t)}
        strokeWidth="1"
      />
      <text
        className="axis-label"
        x={PAD.left - 6}
        y={yScale(t)}
        textAnchor="end"
        dominantBaseline="central"
      >
        {format(t)}
      </text>
    </g>
  ))
}

/* ------------------------------------------------------------------ */
/* Concentration line chart (single series → no legend)                */
/* ------------------------------------------------------------------ */

export function ConcentrationChart({
  points,
}: {
  points: { date: Date; value: number }[]
}) {
  const [hover, setHover] = useState<number | null>(null)

  const n = points.length
  const xAt = (i: number) =>
    PAD.left + (n <= 1 ? PLOT_W / 2 : (i / (n - 1)) * PLOT_W)
  const yAt = (v: number) => PAD.top + PLOT_H - (v / 100) * PLOT_H

  const path = useMemo(() => {
    if (n === 0) return ''
    return points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(p.value).toFixed(1)}`)
      .join(' ')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points])

  const area = useMemo(() => {
    if (n === 0) return ''
    return `${path} L${xAt(n - 1).toFixed(1)},${yAt(0)} L${xAt(0).toFixed(1)},${yAt(0)} Z`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, n])

  if (n === 0 || points.every((p) => p.value === 0)) {
    return <div className="chart-empty">No concentration data yet — finish a session to see it here.</div>
  }

  const hovered = hover !== null ? points[hover] : undefined
  const labelEvery = n > 20 ? 7 : n > 10 ? 3 : 1

  const tooltip: TooltipState | null = hovered
    ? {
        x: xAt(hover!),
        y: yAt(hovered.value),
        content: (
          <>
            <strong>{hovered.value}%</strong> concentration
            <br />
            <span style={{ color: 'var(--text-muted)' }}>
              {hovered.date.toLocaleDateString(APP_LOCALE, { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </>
        ),
      }
    : null

  return (
    <ChartShell
      tooltip={tooltip}
      ariaLabel={`Concentration score per day over the last ${n} days`}
    >
      {yGridLines([0, 25, 50, 75, 100], yAt, (v) => `${v}`)}

      <path d={area} fill={CHART_FOCUS} opacity="0.1" />
      <path
        d={path}
        fill="none"
        stroke={CHART_FOCUS}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* crosshair */}
      {hover !== null && hovered && (
        <>
          <line
            x1={xAt(hover)}
            x2={xAt(hover)}
            y1={PAD.top}
            y2={PAD.top + PLOT_H}
            stroke="var(--border-strong)"
            strokeWidth="1"
          />
          <circle
            cx={xAt(hover)}
            cy={yAt(hovered.value)}
            r="5"
            fill={CHART_FOCUS}
            stroke="var(--surface)"
            strokeWidth="2"
          />
        </>
      )}

      {/* x labels */}
      {points.map((p, i) =>
        i % labelEvery === 0 ? (
          <text
            key={i}
            className="axis-label"
            x={xAt(i)}
            y={H - 6}
            textAnchor="middle"
          >
            {p.date.toLocaleDateString(APP_LOCALE, { day: 'numeric', month: n > 10 ? undefined : 'short' })}
          </text>
        ) : null,
      )}

      {/* hover hit bands (wider than the marks) */}
      {points.map((_, i) => {
        const half = n <= 1 ? PLOT_W / 2 : PLOT_W / (n - 1) / 2
        return (
          <rect
            key={i}
            x={xAt(i) - half}
            y={PAD.top}
            width={half * 2}
            height={PLOT_H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onTouchStart={() => setHover(i)}
          />
        )
      })}
    </ChartShell>
  )
}

/* ------------------------------------------------------------------ */
/* Focus vs pause stacked bars (two series → legend)                   */
/* ------------------------------------------------------------------ */

export interface StackedBucket {
  label: string
  /** Longer label for the tooltip. */
  detail: string
  focus: number
  idle: number
  /**
   * Sessions started in this bucket. Omitted by the hourly view, where a
   * session spanning several hours would be counted in only one of them.
   */
  sessions?: number
}

export function FocusPauseChart({ buckets }: { buckets: StackedBucket[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const n = buckets.length
  const max = Math.max(...buckets.map((b) => b.focus + b.idle), 1)

  // Round the axis top to a clean duration step.
  const steps = [
    900, 1800, 3600, 2 * 3600, 4 * 3600, 6 * 3600, 8 * 3600, 12 * 3600, 24 * 3600,
  ]
  const top = steps.find((s) => s >= max) ?? Math.ceil(max / 3600) * 3600
  const yAt = (v: number) => PAD.top + PLOT_H - (v / top) * PLOT_H

  if (buckets.every((b) => b.focus === 0 && b.idle === 0)) {
    return <div className="chart-empty">Nothing recorded in this period yet.</div>
  }

  const band = PLOT_W / n
  const barW = Math.min(24, Math.max(3, band * 0.62))
  const GAP = 2 // surface gap between stacked segments

  const ticks = [0, top / 2, top]
  const fmtTick = (v: number) =>
    v === 0 ? '0' : v >= 3600 ? `${Math.round((v / 3600) * 10) / 10}h` : `${Math.round(v / 60)}m`

  const hovered = hover !== null ? buckets[hover] : undefined
  const labelEvery = n > 20 ? (n > 24 ? 7 : 6) : n > 10 ? 3 : 1

  const tooltip: TooltipState | null =
    hovered && hover !== null
      ? {
          x: PAD.left + band * hover + band / 2,
          y: yAt(hovered.focus + hovered.idle),
          content: (
            <>
              <strong>{hovered.detail}</strong>
              <br />
              <span style={{ color: 'var(--text-muted)' }}>Focus</span>{' '}
              {fmtDuration(hovered.focus)}
              <br />
              <span style={{ color: 'var(--text-muted)' }}>Pause</span>{' '}
              {fmtDuration(hovered.idle)}
              {hovered.sessions !== undefined && (
                <>
                  <br />
                  <span style={{ color: 'var(--text-muted)' }}>Sessions</span>{' '}
                  {hovered.sessions}
                </>
              )}
            </>
          ),
        }
      : null

  return (
    <div ref={wrapRef}>
      <ChartShell tooltip={tooltip} ariaLabel="Focus versus pause time per period">
        {yGridLines(ticks, yAt, fmtTick)}

        {buckets.map((b, i) => {
          const cx = PAD.left + band * i + band / 2
          const x = cx - barW / 2
          const focusH = (b.focus / top) * PLOT_H
          const idleH = (b.idle / top) * PLOT_H
          const baseline = PAD.top + PLOT_H
          const focusY = baseline - focusH
          const idleY = focusY - (idleH > 0 ? GAP : 0) - idleH
          const r = Math.min(4, barW / 2)
          return (
            <g key={i} opacity={hover === null || hover === i ? 1 : 0.45}>
              {/* focus segment: square baseline, rounded only if it is the data end */}
              {b.focus > 0 && (
                <path
                  d={
                    b.idle > 0
                      ? `M${x},${baseline} V${focusY} H${x + barW} V${baseline} Z`
                      : `M${x},${baseline} V${focusY + r} Q${x},${focusY} ${x + r},${focusY} H${x + barW - r} Q${x + barW},${focusY} ${x + barW},${focusY + r} V${baseline} Z`
                  }
                  fill={CHART_FOCUS}
                />
              )}
              {b.idle > 0 && (
                <path
                  d={`M${x},${idleY + idleH} V${idleY + r} Q${x},${idleY} ${x + r},${idleY} H${x + barW - r} Q${x + barW},${idleY} ${x + barW},${idleY + r} V${idleY + idleH} Z`}
                  fill={CHART_PAUSE}
                />
              )}
            </g>
          )
        })}

        {/* x labels */}
        {buckets.map((b, i) =>
          i % labelEvery === 0 ? (
            <text
              key={i}
              className="axis-label"
              x={PAD.left + band * i + band / 2}
              y={H - 6}
              textAnchor="middle"
            >
              {b.label}
            </text>
          ) : null,
        )}

        {/* hover hit bands — touch selects, since taps have no hover */}
        {buckets.map((_, i) => (
          <rect
            key={i}
            x={PAD.left + band * i}
            y={PAD.top}
            width={band}
            height={PLOT_H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onTouchStart={() => setHover(i)}
          />
        ))}
      </ChartShell>

      <div className="chart-legend">
        <span>
          <span className="swatch" style={{ background: CHART_FOCUS }} />
          Focus
        </span>
        <span>
          <span className="swatch" style={{ background: CHART_PAUSE }} />
          Pause
        </span>
      </div>
    </div>
  )
}
