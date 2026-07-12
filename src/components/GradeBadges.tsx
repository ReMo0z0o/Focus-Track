import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  APP_LOCALE,
  CONCENTRATION_BADGE_THRESHOLDS,
  DAILY_GOAL_SECONDS,
  GRADE_NAMES,
  GRADE_THRESHOLDS,
  RATIO_BADGE_THRESHOLDS,
  TIER_NAMES,
  addDays,
  aggregateConcentration,
  concentrationBadgeLevel,
  dailyBuckets,
  filterSince,
  fmtDuration,
  fmtPercent,
  gradeLevel,
  qualifiedDaysLast30,
  ratioBadgeLevel,
  startOfDay,
  streakDays,
  summarize,
} from '@/lib/stats'
import type { SessionRow } from '@/lib/stats'

/**
 * Gamified grade & badges section: rank emblem with rising embers, a
 * six-step progression track, a streak card with the last 7 days, and
 * metallic tier medals. Pure presentation — all thresholds and formulas
 * live in lib/stats.
 */

/* ------------------------------------------------------------------ */
/* Count-up hook (respects prefers-reduced-motion)                     */
/* ------------------------------------------------------------------ */

function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0)
  // Latest rendered value, so a target change eases from where we are.
  // No "already ran" guard: the effect must stay idempotent so React's
  // dev-mode double-invocation (setup/cleanup/setup) still animates.
  const fromRef = useRef(0)

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      fromRef.current = target
      setValue(target)
      return
    }
    let raf = 0
    const from = fromRef.current
    const start = performance.now()
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs)
      const eased = 1 - Math.pow(1 - p, 3)
      const next = Math.round(from + (target - from) * eased)
      fromRef.current = next
      setValue(next)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs])

  return value
}

/* ------------------------------------------------------------------ */
/* Main section                                                        */
/* ------------------------------------------------------------------ */

export function GradeBadges({
  sessions,
  now,
}: {
  sessions: SessionRow[]
  now: Date
}) {
  const grade = gradeLevel(sessions, now)
  const qualified = qualifiedDaysLast30(sessions, now)
  const streak = streakDays(sessions, now)
  const concLevel = concentrationBadgeLevel(sessions, now)
  const concValue = aggregateConcentration(sessions, 3, now)
  const ratioLevel = ratioBadgeLevel(sessions, now)
  const last3 = summarize(filterSince(sessions, addDays(startOfDay(now), -2)))

  const last7 = dailyBuckets(sessions, 7, now).map((b) => ({
    key: b.key,
    letter: b.date.toLocaleDateString(APP_LOCALE, { weekday: 'narrow' }),
    hit: b.focus >= DAILY_GOAL_SECONDS,
    isToday: b.key === dailyBuckets(sessions, 1, now)[0]!.key,
  }))

  return (
    <section className="card mt-3 gamify-card" aria-label="Grade and badges">
      <div className="gamify-head">
        <h2 className="card-title" style={{ marginBottom: 0 }}>
          Grade &amp; badges
        </h2>
        <span className="gamify-sub">grade: last 30 days · badges: last 3 days</span>
      </div>

      <div className="gamify-grid">
        <GradeCard grade={grade} qualified={qualified} />
        <StreakCard streak={streak} last7={last7} />
        <MedalCard
          className="anim-3"
          tier={concLevel}
          tierPrefix="c"
          title="Concentration"
          icon={<TargetIcon />}
          statLine={
            <>
              <CountUpValue value={concValue} /> pts — avg uninterrupted run vs
              the 2h target
            </>
          }
          progress={concentrationProgress(concValue, concLevel)}
          nextHint={
            CONCENTRATION_BADGE_THRESHOLDS[concLevel + 1] !== undefined
              ? `${TIER_NAMES[concLevel + 1]} at ${CONCENTRATION_BADGE_THRESHOLDS[concLevel + 1]}+ pts`
              : 'Top tier — laser focus.'
          }
        />
        <MedalCard
          className="anim-4"
          tier={ratioLevel}
          tierPrefix="c"
          title="Pause ratio"
          icon={<ScaleIcon />}
          statLine={
            last3.focus > 0 ? (
              <>
                {fmtPercent(last3.ratio)} pause per focus — lower is better
              </>
            ) : (
              <>Log some focus time to earn this badge</>
            )
          }
          progress={ratioProgress(last3, ratioLevel)}
          nextHint={
            last3.focus > 0 && RATIO_BADGE_THRESHOLDS[ratioLevel + 1] !== undefined
              ? `${TIER_NAMES[ratioLevel + 1]} below ${fmtPercent(RATIO_BADGE_THRESHOLDS[ratioLevel + 1]!)}`
              : last3.focus > 0
                ? 'Top tier — barely a pause.'
                : `Reach ${fmtDuration(DAILY_GOAL_SECONDS)} of focus to get rated`
          }
        />
      </div>
    </section>
  )
}

function concentrationProgress(value: number, level: number): number | null {
  const next = CONCENTRATION_BADGE_THRESHOLDS[level + 1]
  if (next === undefined) return 1
  const current = CONCENTRATION_BADGE_THRESHOLDS[level] ?? 0
  return Math.min(1, Math.max(0, (value - current) / (next - current)))
}

function ratioProgress(
  last3: { focus: number; ratio: number },
  level: number,
): number | null {
  if (last3.focus <= 0) return 0
  const next = RATIO_BADGE_THRESHOLDS[level + 1]
  if (next === undefined) return 1
  if (last3.ratio <= 0) return 1
  // Closeness to the next (lower-is-better) threshold.
  return Math.min(1, Math.max(0.04, next / last3.ratio))
}

function CountUpValue({ value }: { value: number }) {
  return <strong>{useCountUp(value)}</strong>
}

/* ------------------------------------------------------------------ */
/* Grade card: emblem + progression track                              */
/* ------------------------------------------------------------------ */

const EMBERS = [
  { left: '32%', delay: '0s', duration: '3.4s', size: 5 },
  { left: '48%', delay: '1.1s', duration: '2.8s', size: 4 },
  { left: '62%', delay: '0.5s', duration: '3.8s', size: 5 },
  { left: '40%', delay: '2.2s', duration: '3.1s', size: 3 },
  { left: '56%', delay: '1.7s', duration: '2.6s', size: 4 },
  { left: '68%', delay: '2.8s', duration: '3.5s', size: 3 },
]

function GradeCard({ grade, qualified }: { grade: number; qualified: number }) {
  const nextAt = GRADE_THRESHOLDS[grade + 1]
  const shownDays = useCountUp(qualified)
  const progress =
    nextAt !== undefined ? Math.min(1, qualified / nextAt) : 1
  const emberCount = Math.min(EMBERS.length, grade + 1)

  return (
    <div className={`grade-card grade-${grade} anim-1`}>
      <div className="emblem-zone" aria-hidden="true">
        {EMBERS.slice(0, emberCount).map((e, i) => (
          <span
            key={i}
            className="ember"
            style={{
              left: e.left,
              width: e.size,
              height: e.size,
              animationDelay: e.delay,
              animationDuration: e.duration,
            }}
          />
        ))}
        <GradeEmblem level={grade} />
      </div>

      <div className="grade-name">{GRADE_NAMES[grade]}</div>
      <div className="grade-rank">Grade {grade + 1} of {GRADE_NAMES.length}</div>

      <div className="grade-days">
        <span className="big">{shownDays}</span> focused day{qualified === 1 ? '' : 's'}{' '}
        <span className="dim">/ last 30</span>
      </div>

      <div
        className="meter tier-meter"
        role="progressbar"
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={
          nextAt !== undefined
            ? `Progress to ${GRADE_NAMES[grade + 1]}`
            : 'Top grade reached'
        }
      >
        <span style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="grade-next">
        {nextAt !== undefined ? (
          <>
            Next: <strong>{GRADE_NAMES[grade + 1]}</strong> at {nextAt} days with{' '}
            {fmtDuration(DAILY_GOAL_SECONDS)}+ of focus
          </>
        ) : (
          <>Top grade — keep the light on.</>
        )}
      </div>

      <TierTrack level={grade} />
    </div>
  )
}

function TierTrack({ level }: { level: number }) {
  return (
    <div
      className="tier-track"
      role="img"
      aria-label={`Grade ladder: ${GRADE_NAMES[level]}, step ${level + 1} of ${GRADE_NAMES.length}`}
    >
      {GRADE_NAMES.map((name, i) => (
        <div
          key={name}
          className={`tier-node${i <= level ? ' done' : ''}${i === level ? ' current' : ''}`}
          title={
            i === 0
              ? `${name} — starting grade`
              : `${name} — ${GRADE_THRESHOLDS[i]}+ focused days`
          }
        >
          <span className="dot" />
          <span className="t-name">{name}</span>
        </div>
      ))}
    </div>
  )
}

/** Hexagonal rank emblem with a layered flame that intensifies per grade. */
function GradeEmblem({ level }: { level: number }) {
  return (
    <svg
      className="grade-emblem"
      viewBox="0 0 120 132"
      width="128"
      height="141"
      role="img"
      aria-label={`${GRADE_NAMES[level]} emblem`}
    >
      {/* hex frame */}
      <polygon
        className="hex-outer"
        points="60,4 112,34 112,98 60,128 8,98 8,34"
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

/* ------------------------------------------------------------------ */
/* Streak card                                                         */
/* ------------------------------------------------------------------ */

function StreakCard({
  streak,
  last7,
}: {
  streak: number
  last7: { key: string; letter: string; hit: boolean; isToday: boolean }[]
}) {
  const shown = useCountUp(streak)
  const todayHit = last7[last7.length - 1]?.hit ?? false

  return (
    <div className={`streak-card anim-2${streak > 0 ? ' lit' : ''}`}>
      <div className="streak-main">
        <FlameIcon className="streak-flame" />
        <div>
          <div className="streak-count">
            <span className="big">{shown}</span> day{streak === 1 ? '' : 's'}
          </div>
          <div className="streak-label">
            {streak > 0 ? 'focus streak' : 'no streak yet'}
          </div>
        </div>
      </div>

      <div className="week-dots" aria-label="Daily 2-hour goal, last 7 days">
        {last7.map((d) => (
          <div
            key={d.key}
            className={`week-dot${d.hit ? ' hit' : ''}${d.isToday ? ' today' : ''}`}
            title={`${d.key}${d.hit ? ' — goal reached' : ''}`}
          >
            <span className="wd-fill">{d.hit ? '✓' : ''}</span>
            <span className="wd-letter">{d.letter}</span>
          </div>
        ))}
      </div>

      <div className="streak-hint">
        {todayHit
          ? 'Today’s 2h goal is in the bag ✓'
          : streak > 0
            ? `Hit ${fmtDuration(DAILY_GOAL_SECONDS)} today to keep the flame alive`
            : `Hit ${fmtDuration(DAILY_GOAL_SECONDS)} of focus in a day to light the flame`}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Medal cards                                                         */
/* ------------------------------------------------------------------ */

function MedalCard({
  tier,
  tierPrefix,
  title,
  icon,
  statLine,
  progress,
  nextHint,
  className = '',
}: {
  tier: number
  tierPrefix: string
  title: string
  icon: ReactNode
  statLine: ReactNode
  progress: number | null
  nextHint: string
  className?: string
}) {
  const locked = tier === 0
  return (
    <div className={`medal-card tier-${tierPrefix}${tier} ${className}`}>
      <div className={`medal${locked ? ' locked' : ''}`} aria-hidden="true">
        <span className="medal-disc">{locked ? <LockIcon /> : icon}</span>
        {!locked && <span className="medal-shine" />}
      </div>
      <div className="medal-info">
        <div className="m-title-row">
          <span className="m-title">{title}</span>
          <span className={`m-tier${locked ? ' locked' : ''}`}>
            {TIER_NAMES[tier]}
          </span>
        </div>
        <div className="m-stat">{statLine}</div>
        {progress !== null && (
          <div className="meter tier-meter" aria-hidden="true">
            <span style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}
        <div className="m-next">{nextHint}</div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

function FlameIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="42" height="42" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.5 C14.5 6 18 8.2 18 13 A6 6 0 0 1 6 13 C6 8.2 9.5 6 12 2.5 Z"
        fill="currentColor"
        opacity="0.32"
      />
      <path
        d="M12 8 C13.6 10.2 15.4 11.4 15.4 14 A3.4 3.4 0 0 1 8.6 14 C8.6 11.4 10.4 10.2 12 8 Z"
        fill="currentColor"
      />
    </svg>
  )
}

function TargetIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  )
}

function ScaleIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v16M4.5 20h15M7 7.5 4.5 13a2.8 2.8 0 0 0 5 0L7 7.5ZM17 7.5 14.5 13a2.8 2.8 0 0 0 5 0L17 7.5ZM5.5 7.5h13" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="5.5" y="11" width="13" height="9" rx="2" />
      <path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
    </svg>
  )
}
