/**
 * Pure computation + formatting helpers for FocusGuard.
 * Everything here is side-effect free and unit-tested in stats.test.ts.
 */

export interface SessionRow {
  id: string
  started_at: string
  ended_at: string | null
  focus_seconds: number
  idle_seconds: number
  resumes_count: number
  /** Idle threshold in effect when the session started. Null on old rows. */
  idle_threshold_seconds?: number | null
}

export type Period = 'day' | 'week' | 'month'

/**
 * The app's UI language is English; pin date/time rendering to it too so
 * labels don't switch language with the browser locale.
 */
export const APP_LOCALE = 'en-US'

/** Average uninterrupted run of 2h == 100% concentration. */
export const TARGET_CONCENTRATION_SECONDS = 2 * 60 * 60

/** Daily focus goal used by grades, streaks and the goal ring. */
export const DAILY_GOAL_SECONDS = 2 * 60 * 60

/** A pause this long ends the session on its own — you have clearly left. */
export const MAX_PAUSE_SECONDS = 3 * 60 * 60

/** How many days of session detail the stats page lists. */
export const SESSION_LIST_DAYS = 5

/**
 * A closed session can be removed for 24 hours, then the history freezes:
 * long enough to undo a mistake, short enough that nobody can quietly
 * rewrite a month of stats.
 */
export const DELETE_WINDOW_MS = 24 * 60 * 60 * 1000

export function canDeleteSession(
  session: Pick<SessionRow, 'ended_at'>,
  now: Date,
): boolean {
  // Never closed (the running session, or a row orphaned by a crash): the
  // window hasn't started, so it stays removable.
  if (!session.ended_at) return true
  const ended = new Date(session.ended_at).getTime()
  if (!Number.isFinite(ended)) return true
  return now.getTime() - ended < DELETE_WINDOW_MS
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

export function fmtDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`
  return `${s}s`
}

/** Clock-style display for the live timer: `mm:ss` or `h:mm:ss`. */
export function fmtClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = m.toString().padStart(2, '0')
  const ss = s.toString().padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** "1 session" / "4 sessions" — pluralised in one place. */
export function fmtSessions(count: number): string {
  return `${count} session${count === 1 ? '' : 's'}`
}

export function fmtPercent(ratio: number): string {
  const pct = Math.round(ratio * 100)
  // A near-zero focus total can make the pause ratio explode; cap the
  // display so the tile stays legible.
  return pct > 999 ? '999%+' : `${pct}%`
}

/* ------------------------------------------------------------------ */
/* Date helpers (all local time)                                       */
/* ------------------------------------------------------------------ */

export function startOfDay(d: Date): Date {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  return out
}

export function addDays(d: Date, days: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + days)
  return out
}

export function dayKey(d: Date): string {
  const y = d.getFullYear()
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Inclusive start of the selected period: today, 6 days back, 29 days back. */
export function periodStart(period: Period, now: Date): Date {
  const today = startOfDay(now)
  if (period === 'day') return today
  if (period === 'week') return addDays(today, -6)
  return addDays(today, -29)
}

export function filterSince(sessions: SessionRow[], since: Date): SessionRow[] {
  const t = since.getTime()
  return sessions.filter((s) => new Date(s.started_at).getTime() >= t)
}

/* ------------------------------------------------------------------ */
/* Aggregates                                                          */
/* ------------------------------------------------------------------ */

export interface PeriodTotals {
  focus: number
  idle: number
  sessions: number
  /** idle / focus — lower is better. 0 when there is no focus time. */
  ratio: number
  /** 0..100 — average uninterrupted focus run vs the 2h target. */
  concentration: number
}

export function summarize(sessions: SessionRow[]): PeriodTotals {
  let focus = 0
  let idle = 0
  let breaks = 0
  for (const s of sessions) {
    focus += s.focus_seconds
    idle += s.idle_seconds
    breaks += Math.max(1, s.resumes_count + 1)
  }
  const ratio = focus > 0 ? idle / focus : 0
  const avgRun = breaks > 0 ? focus / breaks : 0
  const concentration =
    focus > 0
      ? Math.min(100, Math.round((avgRun / TARGET_CONCENTRATION_SECONDS) * 100))
      : 0
  return { focus, idle, sessions: sessions.length, ratio, concentration }
}

/** Sum of focus_seconds per local day over the last `days` days (oldest first). */
export interface DayBucket {
  date: Date
  key: string
  focus: number
  idle: number
  sessions: SessionRow[]
}

export function dailyBuckets(
  sessions: SessionRow[],
  days: number,
  now: Date,
): DayBucket[] {
  const buckets: DayBucket[] = []
  const byKey = new Map<string, DayBucket>()
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(startOfDay(now), -i)
    const bucket: DayBucket = {
      date,
      key: dayKey(date),
      focus: 0,
      idle: 0,
      sessions: [],
    }
    buckets.push(bucket)
    byKey.set(bucket.key, bucket)
  }
  for (const s of sessions) {
    const bucket = byKey.get(dayKey(new Date(s.started_at)))
    if (!bucket) continue
    bucket.focus += s.focus_seconds
    bucket.idle += s.idle_seconds
    bucket.sessions.push(s)
  }
  return buckets
}

export interface HourBucket {
  hour: number
  focus: number
  idle: number
}

/**
 * 24 hourly buckets for the given local day. A session's time is spread
 * proportionally over the hours it spans (approximating its duration as
 * focus + idle), so a 3-hour session doesn't pile up in its start hour.
 */
export function hourlyBuckets(sessions: SessionRow[], day: Date): HourBucket[] {
  const dayStart = startOfDay(day).getTime()
  const dayEnd = dayStart + 24 * 3_600_000
  const buckets: HourBucket[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    focus: 0,
    idle: 0,
  }))
  for (const s of sessions) {
    const total = s.focus_seconds + s.idle_seconds
    if (total <= 0) continue
    const start = new Date(s.started_at).getTime()
    const end = start + total * 1000
    if (end <= dayStart || start >= dayEnd) continue
    const focusShare = s.focus_seconds / total
    let cursor = Math.max(start, dayStart)
    const clampedEnd = Math.min(end, dayEnd)
    while (cursor < clampedEnd) {
      const hourIdx = Math.floor((cursor - dayStart) / 3_600_000)
      const hourEnd = dayStart + (hourIdx + 1) * 3_600_000
      const sliceSeconds = (Math.min(hourEnd, clampedEnd) - cursor) / 1000
      const bucket = buckets[hourIdx]
      if (bucket) {
        bucket.focus += sliceSeconds * focusShare
        bucket.idle += sliceSeconds * (1 - focusShare)
      }
      cursor = Math.min(hourEnd, clampedEnd)
    }
  }
  for (const b of buckets) {
    b.focus = Math.round(b.focus)
    b.idle = Math.round(b.idle)
  }
  return buckets
}

/** Per-day concentration score for the line chart (oldest first). */
export function concentrationSeries(
  sessions: SessionRow[],
  days: number,
  now: Date,
): { date: Date; value: number }[] {
  return dailyBuckets(sessions, days, now).map((b) => ({
    date: b.date,
    value: summarize(b.sessions).concentration,
  }))
}

/* ------------------------------------------------------------------ */
/* Grades, streaks & badges                                            */
/* ------------------------------------------------------------------ */

/** Generic threshold ladder: returns the highest level whose threshold is met. */
function ladder(value: number, thresholds: number[]): number {
  let level = 0
  thresholds.forEach((t, i) => {
    if (value >= t) level = i
  })
  return level
}

export const GRADE_THRESHOLDS = [0, 1, 3, 7, 14, 25]
export const GRADE_NAMES = [
  'Ember',
  'Kindling',
  'Flame',
  'Torch',
  'Beacon',
  'Lighthouse',
]

/** The medal material, shown under each badge disc. */
export const TIER_NAMES = [
  '—',
  'Bronze',
  'Silver',
  'Gold',
  'Platinum',
  'Diamond',
]

/** Medal material for a tier — an unearned badge says so in words. */
export function tierMaterial(tier: number): string {
  return tier <= 0 ? 'Unranked' : (TIER_NAMES[tier] ?? '—')
}

/** Badge display names — used by the stats cards and friend panels alike. */
export const ATTENTION_BADGE_NAME = 'Attention Span'
export const DEAD_AIR_BADGE_NAME = 'Dead Air'
export const HAUL_BADGE_NAME = 'Weekly Haul'

/**
 * Rank nicknames, one ladder per badge (index = tier 0..5). Each badge gets
 * its own vocabulary — no nickname is ever shared between two ladders — and
 * the bottom rungs are meant to sting a little.
 */
export const ATTENTION_TIER_NICKNAMES = [
  'Goldfish',
  'Channel Surfer',
  'Slow Burner',
  'Deep Diver',
  'Tunnel Vision',
  'Monolith',
]

export const DEAD_AIR_TIER_NICKNAMES = [
  'Couch Bound',
  'Snack Runner',
  'Clock Watcher',
  'Short Breather',
  'Tight Ship',
  'Airtight',
]

export const HAUL_TIER_NICKNAMES = [
  'Empty Cart',
  'Light Load',
  'Full Cart',
  'Heavy Freight',
  'Cargo Ship',
  'Freight Train',
]

export const CONCENTRATION_BADGE_THRESHOLDS = [0, 20, 40, 60, 80, 95]
/** Descending: lower idle/focus ratio is better. Diamond at 20% or below. */
export const RATIO_BADGE_THRESHOLDS = [999, 1.0, 0.7, 0.5, 0.35, 0.2]
/** Hours of focus over the last 7 calendar days. */
export const WEEK_HOURS_BADGE_THRESHOLDS = [0, 6, 12, 20, 28, 36]

/** A local day counts as "worked" once it holds 30 minutes of focus. */
export const WORKED_DAY_MIN_FOCUS_SECONDS = 30 * 60

/** Number of days within the last 30 with at least 2h of focus. */
export function qualifiedDaysLast30(sessions: SessionRow[], now: Date): number {
  return dailyBuckets(sessions, 30, now).filter(
    (b) => b.focus >= DAILY_GOAL_SECONDS,
  ).length
}

/** Grade level (0..5) from qualified days over the last 30. */
export function gradeLevel(sessions: SessionRow[], now: Date): number {
  return ladder(qualifiedDaysLast30(sessions, now), GRADE_THRESHOLDS)
}

/**
 * Consecutive days ending today (or yesterday, if today hasn't reached the
 * goal yet) with at least 2h of focus per day.
 */
export function streakDays(sessions: SessionRow[], now: Date): number {
  const focusByDay = new Map<string, number>()
  for (const s of sessions) {
    const key = dayKey(new Date(s.started_at))
    focusByDay.set(key, (focusByDay.get(key) ?? 0) + s.focus_seconds)
  }
  const today = startOfDay(now)
  let streak = 0
  let cursor = today
  // Today only counts if the goal is already met; otherwise start yesterday.
  if ((focusByDay.get(dayKey(cursor)) ?? 0) >= DAILY_GOAL_SECONDS) {
    streak = 1
  }
  cursor = addDays(today, -1)
  while ((focusByDay.get(dayKey(cursor)) ?? 0) >= DAILY_GOAL_SECONDS) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

/**
 * Sessions of the user's `count` most recent worked days (a local day with at
 * least 30 minutes of focus), pooled into one array. Calendar gaps are
 * invisible here, so the concentration and ratio badges survive a vacation —
 * and a stray 5-minute session on a day off can't drag the pool down.
 */
export function lastWorkedDaysSessions(
  sessions: SessionRow[],
  count: number,
  minFocusSeconds: number = WORKED_DAY_MIN_FOCUS_SECONDS,
): SessionRow[] {
  const byDay = new Map<string, { focus: number; sessions: SessionRow[] }>()
  for (const s of sessions) {
    const key = dayKey(new Date(s.started_at))
    let day = byDay.get(key)
    if (!day) {
      day = { focus: 0, sessions: [] }
      byDay.set(key, day)
    }
    day.focus += s.focus_seconds
    day.sessions.push(s)
  }
  return [...byDay.entries()]
    .filter(([, day]) => day.focus >= minFocusSeconds)
    .sort(([a], [b]) => (a < b ? 1 : -1)) // day keys sort newest first
    .slice(0, count)
    .flatMap(([, day]) => day.sessions)
}

/**
 * The user's favorite idle threshold: over the last 3 worked days of at
 * least 2h of focus, each session votes for its recorded threshold with a
 * weight of its focus seconds — the heaviest threshold wins (ties go to the
 * most recently used one). Null when nothing qualifies yet: too few solid
 * days, or only pre-migration rows with no threshold recorded.
 */
export function favoriteIdleThreshold(sessions: SessionRow[]): number | null {
  const pool = lastWorkedDaysSessions(sessions, 3, DAILY_GOAL_SECONDS)
  const weight = new Map<number, number>()
  const lastUsed = new Map<number, number>()
  for (const s of pool) {
    const t = s.idle_threshold_seconds
    if (typeof t !== 'number' || !Number.isFinite(t) || t <= 0) continue
    weight.set(t, (weight.get(t) ?? 0) + s.focus_seconds)
    const started = new Date(s.started_at).getTime()
    lastUsed.set(t, Math.max(lastUsed.get(t) ?? 0, started))
  }
  let best: number | null = null
  for (const [t, w] of weight) {
    if (best === null) {
      best = t
      continue
    }
    const bw = weight.get(best)!
    if (w > bw || (w === bw && (lastUsed.get(t) ?? 0) > (lastUsed.get(best) ?? 0))) {
      best = t
    }
  }
  return best
}

/** "2 min" / "2.5 min" — threshold values are minute-scaled. */
export function fmtThresholdMinutes(seconds: number): string {
  const minutes = seconds / 60
  return `${Number.isInteger(minutes) ? minutes : minutes.toFixed(1)} min`
}

/** Concentration badge level (0..5) from the last 3 worked days. */
export function concentrationBadgeLevel(sessions: SessionRow[]): number {
  return ladder(
    summarize(lastWorkedDaysSessions(sessions, 3)).concentration,
    CONCENTRATION_BADGE_THRESHOLDS,
  )
}

/** Ratio badge level (0..5) from the last 3 worked days — lower is better. */
export function ratioBadgeLevel(sessions: SessionRow[]): number {
  const totals = summarize(lastWorkedDaysSessions(sessions, 3))
  if (totals.focus <= 0) return 0
  let level = 0
  RATIO_BADGE_THRESHOLDS.forEach((t, i) => {
    if (totals.ratio <= t) level = i
  })
  return level
}

/** Focus-hours badge level (0..5) from the last 7 calendar days. */
export function weekHoursBadgeLevel(sessions: SessionRow[], now: Date): number {
  const { focus } = summarize(
    filterSince(sessions, addDays(startOfDay(now), -6)),
  )
  return ladder(focus / 3600, WEEK_HOURS_BADGE_THRESHOLDS)
}
