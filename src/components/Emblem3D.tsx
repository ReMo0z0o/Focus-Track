import { useEffect, useRef } from 'react'
import { GradeEmblem, HEX_POINTS, HEX_VIEW } from '@/components/GradeEmblem'
import { GRADE_NAMES } from '@/lib/stats'

/**
 * A real-3D take on the grade emblem: the hexagonal badge is extruded into
 * a prism with CSS 3D transforms — front face (the emblem), a back face,
 * and six computed side faces. Click & drag (or touch) to spin it on both
 * axes, with inertia; it slowly auto-rotates while idle.
 */

const DEPTH = 18
/** Max tilt on the X axis, degrees. */
const MAX_TILT = 80
const DRAG_SENSITIVITY = 0.45
const IDLE_SPIN_DEG_PER_S = 14
const FRICTION = 0.94

interface SideFace {
  length: number
  cx: number
  cy: number
  angleDeg: number
  /** 0..1 pseudo-lighting factor from the face orientation. */
  light: number
}

function buildSideFaces(scale: number): SideFace[] {
  const faces: SideFace[] = []
  for (let i = 0; i < HEX_POINTS.length; i++) {
    const [x1, y1] = HEX_POINTS[i]!
    const [x2, y2] = HEX_POINTS[(i + 1) % HEX_POINTS.length]!
    const dx = (x2 - x1) * scale
    const dy = (y2 - y1) * scale
    const length = Math.hypot(dx, dy)
    const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI
    // Light from the top-left: faces whose outward normal points up get more.
    const nx = dy / length
    const ny = -dx / length
    const light = 0.5 + 0.35 * -ny + 0.15 * -nx
    faces.push({
      length,
      cx: ((x1 + x2) / 2) * scale,
      cy: ((y1 + y2) / 2) * scale,
      angleDeg,
      light: Math.min(1, Math.max(0, light)),
    })
  }
  return faces
}

export function Emblem3D({
  level,
  width = 190,
  locked = false,
}: {
  level: number
  width?: number
  locked?: boolean
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const state = useRef({
    rx: -12,
    ry: 24,
    vy: 0,
    dragging: false,
    interacted: false,
    lastX: 0,
    lastY: 0,
  })

  const scale = width / HEX_VIEW.w
  const height = Math.round(HEX_VIEW.h * scale)
  const faces = buildSideFaces(scale)

  /* Animation loop: idle spin + inertia. Transforms are written straight to
     the DOM node — no React state per frame. */
  useEffect(() => {
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let last = performance.now()
    const loop = (t: number) => {
      const dt = Math.min(64, t - last)
      last = t
      const s = state.current
      if (!s.dragging) {
        if (Math.abs(s.vy) > 0.02) {
          s.ry += s.vy * (dt / 16)
          s.vy *= FRICTION
        } else if (!s.interacted && !reduceMotion) {
          s.ry += (IDLE_SPIN_DEG_PER_S * dt) / 1000
        }
      }
      if (stageRef.current) {
        stageRef.current.style.transform = `rotateX(${s.rx}deg) rotateY(${s.ry}deg)`
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = state.current
    s.dragging = true
    s.interacted = true
    s.vy = 0
    s.lastX = e.clientX
    s.lastY = e.clientY
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = state.current
    if (!s.dragging) return
    const dx = e.clientX - s.lastX
    const dy = e.clientY - s.lastY
    s.lastX = e.clientX
    s.lastY = e.clientY
    s.ry += dx * DRAG_SENSITIVITY
    s.rx = Math.max(-MAX_TILT, Math.min(MAX_TILT, s.rx - dy * DRAG_SENSITIVITY))
    s.vy = dx * DRAG_SENSITIVITY
  }

  const endDrag = () => {
    state.current.dragging = false
  }

  return (
    <div
      className={`emblem3d grade-${level}${locked ? ' locked' : ''}`}
      style={{ width, height }}
      role="img"
      aria-label={`${GRADE_NAMES[level]} emblem in 3D — drag to rotate`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={endDrag}
    >
      <div className="emblem3d-stage" ref={stageRef}>
        {/* front */}
        <div
          className="emblem3d-face front"
          style={{ transform: `translateZ(${DEPTH / 2}px)` }}
        >
          <GradeEmblem level={level} width={width} />
        </div>

        {/* back */}
        <div
          className="emblem3d-face back"
          style={{ transform: `rotateY(180deg) translateZ(${DEPTH / 2}px)` }}
        >
          <svg viewBox={`0 0 ${HEX_VIEW.w} ${HEX_VIEW.h}`} width={width} height={height}>
            <polygon
              points={HEX_POINTS.map((p) => p.join(',')).join(' ')}
              className="back-fill"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <circle cx="60" cy="66" r="22" className="back-ring" strokeWidth="3" fill="none" />
            <path
              d="M60 44 a22 22 0 0 1 20.5 14"
              className="back-arc"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx="60" cy="66" r="7" className="back-dot" />
          </svg>
        </div>

        {/* core slab hides see-through at grazing angles */}
        <div className="emblem3d-core" style={{ width, height }}>
          <svg viewBox={`0 0 ${HEX_VIEW.w} ${HEX_VIEW.h}`} width={width} height={height}>
            <polygon
              points={HEX_POINTS.map((p) => p.join(',')).join(' ')}
              className="core-fill"
            />
          </svg>
        </div>

        {/* extruded sides */}
        {faces.map((f, i) => (
          <div
            key={i}
            className="emblem3d-side"
            style={{
              width: f.length + 1,
              height: DEPTH,
              left: f.cx,
              top: f.cy,
              transform: `translate(-50%, -50%) rotateZ(${f.angleDeg}deg) rotateX(90deg)`,
              filter: `brightness(${0.45 + f.light * 0.65})`,
            }}
          />
        ))}
      </div>

      <div className="emblem3d-shadow" aria-hidden="true" />
    </div>
  )
}
