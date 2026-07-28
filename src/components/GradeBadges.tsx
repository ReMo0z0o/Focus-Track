import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import {
  APP_LOCALE,
  ATTENTION_BADGE_NAME,
  ATTENTION_TIER_NICKNAMES,
  CONCENTRATION_BADGE_THRESHOLDS,
  DAILY_GOAL_SECONDS,
  DEAD_AIR_BADGE_NAME,
  DEAD_AIR_TIER_NICKNAMES,
  HAUL_BADGE_NAME,
  HAUL_TIER_NICKNAMES,
  GRADE_NAMES,
  GRADE_THRESHOLDS,
  RATIO_BADGE_THRESHOLDS,
  TIER_NAMES,
  WEEK_HOURS_BADGE_THRESHOLDS,
  addDays,
  concentrationBadgeLevel,
  dailyBuckets,
  filterSince,
  fmtDuration,
  fmtPercent,
  gradeLevel,
  lastWorkedDaysSessions,
  qualifiedDaysLast30,
  ratioBadgeLevel,
  startOfDay,
  streakDays,
  summarize,
  weekHoursBadgeLevel,
} from '@/lib/stats'
import type { SessionRow } from '@/lib/stats'
import { GradeEmblem } from '@/components/GradeEmblem'

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
  const concLevel = concentrationBadgeLevel(sessions)
  const ratioLevel = ratioBadgeLevel(sessions)
  // Same pool the badge levels are computed from, so the numbers on the
  // cards always match the medal they sit next to.
  const worked3 = summarize(lastWorkedDaysSessions(sessions, 3))
  const weekLevel = weekHoursBadgeLevel(sessions, now)
  const weekFocus = summarize(
    filterSince(sessions, addDays(startOfDay(now), -6)),
  ).focus

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
        <span className="gamify-sub">
          grade: last 30 days · badges: last 3 worked days · hours: last 7 days
          ·{' '}
          <Link to="/rewards" className="gamify-link">
            view rewards →
          </Link>
        </span>
      </div>

      <div className="gamify-grid">
        <GradeCard grade={grade} qualified={qualified} />
        <StreakCard streak={streak} last7={last7} />
        <MedalCard
          className="anim-3"
          tier={concLevel}
          tierPrefix="c"
          title={ATTENTION_BADGE_NAME}
          nicknames={ATTENTION_TIER_NICKNAMES}
          icon={<TargetIcon />}
          statLine={
            <>
              <CountUpValue value={worked3.concentration} /> pts — avg
              uninterrupted run vs the 2h target
            </>
          }
          progress={ladderProgress(
            worked3.concentration,
            concLevel,
            CONCENTRATION_BADGE_THRESHOLDS,
          )}
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
          title={DEAD_AIR_BADGE_NAME}
          nicknames={DEAD_AIR_TIER_NICKNAMES}
          icon={<ScaleIcon />}
          statLine={
            worked3.focus > 0 ? (
              <>
                {fmtPercent(worked3.ratio)} pause per focus — lower is better
              </>
            ) : (
              <>Log some focus time to earn this badge</>
            )
          }
          progress={ratioProgress(worked3, ratioLevel)}
          nextHint={
            worked3.focus > 0 && RATIO_BADGE_THRESHOLDS[ratioLevel + 1] !== undefined
              ? `${TIER_NAMES[ratioLevel + 1]} below ${fmtPercent(RATIO_BADGE_THRESHOLDS[ratioLevel + 1]!)}`
              : worked3.focus > 0
                ? 'Top tier — barely a pause.'
                : `Reach ${fmtDuration(DAILY_GOAL_SECONDS)} of focus to get rated`
          }
        />
        <MedalCard
          className="anim-5 wide"
          tier={weekLevel}
          tierPrefix="c"
          title={HAUL_BADGE_NAME}
          nicknames={HAUL_TIER_NICKNAMES}
          icon={<ClockIcon />}
          statLine={
            <>
              <strong>{fmtDuration(weekFocus)}</strong> of focus over the last
              7 days
            </>
          }
          progress={ladderProgress(
            weekFocus / 3600,
            weekLevel,
            WEEK_HOURS_BADGE_THRESHOLDS,
          )}
          nextHint={
            WEEK_HOURS_BADGE_THRESHOLDS[weekLevel + 1] !== undefined
              ? `${TIER_NAMES[weekLevel + 1]} at ${WEEK_HOURS_BADGE_THRESHOLDS[weekLevel + 1]}h+ this week`
              : 'Top tier — a monumental week.'
          }
        />
      </div>
    </section>
  )
}

/** Linear progress between the current rung and the next one. */
function ladderProgress(
  value: number,
  level: number,
  thresholds: number[],
): number | null {
  const next = thresholds[level + 1]
  if (next === undefined) return 1
  const current = thresholds[level] ?? 0
  return Math.min(1, Math.max(0, (value - current) / (next - current)))
}

function ratioProgress(
  worked3: { focus: number; ratio: number },
  level: number,
): number | null {
  if (worked3.focus <= 0) return 0
  const next = RATIO_BADGE_THRESHOLDS[level + 1]
  if (next === undefined) return 1
  if (worked3.ratio <= 0) return 1
  // Closeness to the next (lower-is-better) threshold.
  return Math.min(1, Math.max(0.04, next / worked3.ratio))
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
  nicknames,
  icon,
  statLine,
  progress,
  nextHint,
  className = '',
}: {
  tier: number
  tierPrefix: string
  title: string
  /** Rank nicknames indexed by tier (0..5). */
  nicknames: string[]
  icon: ReactNode
  statLine: ReactNode
  progress: number | null
  nextHint: string
  className?: string
}) {
  const locked = tier === 0
  return (
    <div className={`medal-card tier-${tierPrefix}${tier} ${className}`}>
      <div className="medal-col">
        <div className={`medal${locked ? ' locked' : ''}`} aria-hidden="true">
          <span className="medal-disc">{locked ? <LockIcon /> : icon}</span>
          {!locked && <span className="medal-shine" />}
        </div>
        <span className={`m-material${locked ? ' locked' : ''}`}>
          {locked ? 'Unranked' : TIER_NAMES[tier]}
        </span>
      </div>
      <div className="medal-info">
        <div className="m-title-row">
          <span className="m-title">{title}</span>
          <span className={`m-nick${locked ? ' locked' : ''}`}>
            {nicknames[tier]}
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

function ClockIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3.2 1.9" />
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
