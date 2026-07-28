import { describe, expect, it } from 'vitest'
import {
  ATTENTION_TIER_NICKNAMES,
  DEAD_AIR_TIER_NICKNAMES,
  HAUL_TIER_NICKNAMES,
  TIER_NAMES,
  canDeleteSession,
  concentrationBadgeLevel,
  dailyBuckets,
  favoriteIdleThreshold,
  fmtClock,
  fmtDuration,
  fmtSessions,
  gradeLevel,
  hourlyBuckets,
  lastWorkedDaysSessions,
  periodStart,
  qualifiedDaysLast30,
  ratioBadgeLevel,
  startOfDay,
  streakDays,
  summarize,
  weekHoursBadgeLevel,
} from './stats'
import type { SessionRow } from './stats'

const NOW = new Date('2026-07-11T15:30:00')

let counter = 0
function session(
  startedAt: string,
  focus: number,
  idle = 0,
  resumes = 0,
): SessionRow {
  return {
    id: `s-${counter++}`,
    started_at: new Date(startedAt).toISOString(),
    ended_at: new Date(startedAt).toISOString(),
    focus_seconds: focus,
    idle_seconds: idle,
    resumes_count: resumes,
  }
}

describe('fmtDuration', () => {
  it('formats seconds only', () => {
    expect(fmtDuration(0)).toBe('0s')
    expect(fmtDuration(42)).toBe('42s')
  })
  it('formats minutes with padded seconds', () => {
    expect(fmtDuration(5 * 60 + 9)).toBe('5m 09s')
    expect(fmtDuration(60)).toBe('1m 00s')
  })
  it('formats hours with padded minutes', () => {
    expect(fmtDuration(3600)).toBe('1h 00m')
    expect(fmtDuration(3600 + 5 * 60 + 30)).toBe('1h 05m')
  })
})

describe('fmtSessions', () => {
  it('pluralises everything but one', () => {
    expect(fmtSessions(0)).toBe('0 sessions')
    expect(fmtSessions(1)).toBe('1 session')
    expect(fmtSessions(4)).toBe('4 sessions')
  })
})

describe('fmtClock', () => {
  it('renders mm:ss below an hour', () => {
    expect(fmtClock(0)).toBe('00:00')
    expect(fmtClock(75)).toBe('01:15')
  })
  it('renders h:mm:ss above an hour', () => {
    expect(fmtClock(3600 + 62)).toBe('1:01:02')
  })
})

describe('periodStart', () => {
  it('day starts today at midnight', () => {
    expect(periodStart('day', NOW).getTime()).toBe(startOfDay(NOW).getTime())
  })
  it('week starts 6 days back, month 29 days back', () => {
    const week = periodStart('week', NOW)
    const month = periodStart('month', NOW)
    expect((startOfDay(NOW).getTime() - week.getTime()) / 86_400_000).toBe(6)
    expect((startOfDay(NOW).getTime() - month.getTime()) / 86_400_000).toBe(29)
  })
})

describe('summarize', () => {
  it('handles the empty case', () => {
    expect(summarize([])).toEqual({
      focus: 0,
      idle: 0,
      sessions: 0,
      ratio: 0,
      concentration: 0,
    })
  })

  it('sums totals and computes the ratio', () => {
    const t = summarize([
      session('2026-07-11T09:00:00', 3600, 600, 1),
      session('2026-07-11T14:00:00', 1800, 300, 0),
    ])
    expect(t.focus).toBe(5400)
    expect(t.idle).toBe(900)
    expect(t.sessions).toBe(2)
    expect(t.ratio).toBeCloseTo(900 / 5400)
  })

  it('computes concentration as avg run vs the 2h target', () => {
    // one session, 2 resumes -> 3 breaks; 3600s focus -> avgRun 1200s
    const t = summarize([session('2026-07-11T09:00:00', 3600, 0, 2)])
    expect(t.concentration).toBe(Math.round((1200 / 7200) * 100)) // 17
  })

  it('caps concentration at 100', () => {
    const t = summarize([session('2026-07-11T09:00:00', 10 * 3600, 0, 0)])
    expect(t.concentration).toBe(100)
  })
})

describe('buckets', () => {
  it('assigns sessions to their local start day', () => {
    const buckets = dailyBuckets(
      [
        session('2026-07-11T09:00:00', 100),
        session('2026-07-10T23:59:00', 50),
        session('2026-06-01T10:00:00', 999), // outside window
      ],
      7,
      NOW,
    )
    expect(buckets).toHaveLength(7)
    expect(buckets[6]!.focus).toBe(100) // today is last
    expect(buckets[5]!.focus).toBe(50)
    expect(buckets.reduce((a, b) => a + b.focus, 0)).toBe(150)
  })

  it('assigns hourly buckets for the given day only', () => {
    const buckets = hourlyBuckets(
      [
        session('2026-07-11T09:15:00', 100, 10),
        session('2026-07-11T09:45:00', 200, 20),
        session('2026-07-10T09:00:00', 999),
      ],
      NOW,
    )
    expect(buckets).toHaveLength(24)
    expect(buckets[9]!.focus).toBe(300)
    expect(buckets[9]!.idle).toBe(30)
    expect(buckets.reduce((a, b) => a + b.focus, 0)).toBe(300)
  })

  it('spreads a session spanning hours proportionally', () => {
    // 09:50 + 1200s of focus -> 600s in hour 9, 600s in hour 10
    const buckets = hourlyBuckets([session('2026-07-11T09:50:00', 1200)], NOW)
    expect(buckets[9]!.focus).toBe(600)
    expect(buckets[10]!.focus).toBe(600)
    expect(buckets[9]!.idle).toBe(0)
  })
})

describe('grade & streak', () => {
  const goodDay = (day: string) => session(`${day}T09:00:00`, 2 * 3600)

  it('counts qualified days over the last 30', () => {
    const sessions = [
      goodDay('2026-07-11'),
      goodDay('2026-07-10'),
      session('2026-07-09T09:00:00', 3600), // not enough
    ]
    expect(qualifiedDaysLast30(sessions, NOW)).toBe(2)
  })

  it('maps qualified days to grade levels (0,1,3,7,14,25)', () => {
    expect(gradeLevel([], NOW)).toBe(0)
    expect(gradeLevel([goodDay('2026-07-11')], NOW)).toBe(1)
    const threeDays = [
      goodDay('2026-07-11'),
      goodDay('2026-07-10'),
      goodDay('2026-07-09'),
    ]
    expect(gradeLevel(threeDays, NOW)).toBe(2)
  })

  it('streak counts today only once the goal is met', () => {
    const withoutToday = [goodDay('2026-07-10'), goodDay('2026-07-09')]
    expect(streakDays(withoutToday, NOW)).toBe(2)
    expect(streakDays([...withoutToday, goodDay('2026-07-11')], NOW)).toBe(3)
  })

  it('streak breaks on a gap', () => {
    const sessions = [goodDay('2026-07-10'), goodDay('2026-07-08')]
    expect(streakDays(sessions, NOW)).toBe(1)
  })
})

describe('badge naming', () => {
  const LADDERS = [
    ATTENTION_TIER_NICKNAMES,
    DEAD_AIR_TIER_NICKNAMES,
    HAUL_TIER_NICKNAMES,
  ]

  it('every badge has one nickname per tier', () => {
    for (const ladder of LADDERS) {
      expect(ladder).toHaveLength(TIER_NAMES.length)
      expect(ladder.every((n) => n.trim().length > 0)).toBe(true)
    }
  })

  it('no nickname is shared between two badges', () => {
    const all = LADDERS.flat()
    expect(new Set(all).size).toBe(all.length)
  })
})

describe('favoriteIdleThreshold', () => {
  const withT = (startedAt: string, focus: number, threshold: number | null) => ({
    ...session(startedAt, focus),
    idle_threshold_seconds: threshold,
  })

  it('picks the threshold carrying the most focus over the last 3 worked days', () => {
    const sessions = [
      withT('2026-07-11T09:00:00', 3 * 3600, 120), // 3h at 2 min
      withT('2026-07-10T09:00:00', 2 * 3600, 300), // 2h at 5 min
      withT('2026-07-09T09:00:00', 2 * 3600, 300), // 2h at 5 min -> 4h total
    ]
    expect(favoriteIdleThreshold(sessions)).toBe(300)
  })

  it('only counts worked days with 2h+ of focus', () => {
    const sessions = [
      // 1h30 day at 5 min — real work, but under the 2h bar for this stat
      withT('2026-07-11T09:00:00', 1.5 * 3600, 300),
      withT('2026-07-08T09:00:00', 2 * 3600, 120),
      withT('2026-07-07T09:00:00', 2 * 3600, 120),
    ]
    expect(favoriteIdleThreshold(sessions)).toBe(120)
  })

  it('ignores pre-migration rows and returns null with no data', () => {
    expect(favoriteIdleThreshold([])).toBe(null)
    const unstamped = [withT('2026-07-11T09:00:00', 3 * 3600, null)]
    expect(favoriteIdleThreshold(unstamped)).toBe(null)
    // a stamped session next to unstamped ones still wins
    const mixed = [...unstamped, withT('2026-07-10T09:00:00', 2 * 3600, 180)]
    expect(favoriteIdleThreshold(mixed)).toBe(180)
  })

  it('breaks ties toward the most recently used threshold', () => {
    const sessions = [
      withT('2026-07-11T09:00:00', 2 * 3600, 300),
      withT('2026-07-10T09:00:00', 2 * 3600, 120),
    ]
    expect(favoriteIdleThreshold(sessions)).toBe(300)
  })
})

describe('canDeleteSession', () => {
  const at = (iso: string) => ({ ended_at: new Date(iso).toISOString() })

  it('allows deletion for 24h after the session ends', () => {
    expect(canDeleteSession(at('2026-07-11T15:00:00'), NOW)).toBe(true)
    // 23h59 old — still inside the window
    expect(canDeleteSession(at('2026-07-10T15:31:00'), NOW)).toBe(true)
  })

  it('locks the row once 24h have passed', () => {
    expect(canDeleteSession(at('2026-07-10T15:29:00'), NOW)).toBe(false)
    expect(canDeleteSession(at('2026-06-01T09:00:00'), NOW)).toBe(false)
  })

  it('keeps unclosed rows removable', () => {
    expect(canDeleteSession({ ended_at: null }, NOW)).toBe(true)
    expect(canDeleteSession({ ended_at: 'not-a-date' }, NOW)).toBe(true)
  })
})

describe('worked days pool', () => {
  it('keeps only days with 30+ minutes of focus, newest first', () => {
    const short = session('2026-07-11T09:00:00', 10 * 60) // 10 min — not a worked day
    const a = session('2026-07-08T09:00:00', 3600)
    const b = session('2026-07-05T09:00:00', 1800)
    const pool = lastWorkedDaysSessions([short, a, b], 3)
    expect(pool.map((s) => s.id)).toEqual([a.id, b.id])
  })

  it('caps the pool at the requested number of days', () => {
    const days = [
      session('2026-07-11T09:00:00', 3600),
      session('2026-07-10T09:00:00', 3600),
      session('2026-07-09T09:00:00', 3600),
      session('2026-07-01T09:00:00', 3600), // 4th most recent — dropped
    ]
    const pool = lastWorkedDaysSessions(days, 3)
    expect(pool).toHaveLength(3)
    expect(pool.map((s) => s.id)).not.toContain(days[3]!.id)
  })

  it('pools every session of a worked day, not just the qualifying one', () => {
    const morning = session('2026-07-11T09:00:00', 20 * 60)
    const evening = session('2026-07-11T20:00:00', 20 * 60)
    expect(lastWorkedDaysSessions([morning, evening], 3)).toHaveLength(2)
  })
})

describe('badges', () => {
  it('concentration badge pools the last 3 worked days', () => {
    // 2h focus in one uninterrupted run each day -> avgRun 7200 -> 100
    const sessions = [
      session('2026-07-11T09:00:00', 7200),
      session('2026-07-10T09:00:00', 7200),
    ]
    expect(concentrationBadgeLevel(sessions)).toBe(5)
  })

  it('survives a vacation: worked days can be weeks apart', () => {
    // Last worked days are long before NOW — the badge holds anyway.
    const sessions = [
      session('2026-06-20T09:00:00', 7200),
      session('2026-06-19T09:00:00', 7200),
    ]
    expect(concentrationBadgeLevel(sessions)).toBe(5)
    expect(ratioBadgeLevel(sessions)).toBe(5)
  })

  it('a stray sub-30-minute day cannot dilute the badge', () => {
    const sessions = [
      session('2026-07-11T09:00:00', 10 * 60, 0, 4), // choppy 10-min doodle
      session('2026-07-05T09:00:00', 7200),
      session('2026-07-04T09:00:00', 7200),
    ]
    expect(concentrationBadgeLevel(sessions)).toBe(5)
  })

  it('only the 3 most recent worked days count', () => {
    const sessions = [
      session('2026-07-11T09:00:00', 3600, 0, 5), // avg run 600s each
      session('2026-07-10T09:00:00', 3600, 0, 5),
      session('2026-07-09T09:00:00', 3600, 0, 5),
      session('2026-07-01T09:00:00', 7200), // perfect day, but out of the pool
    ]
    // pooled: 10800s over 18 breaks -> avg run 600s -> 8 pts -> no badge
    expect(concentrationBadgeLevel(sessions)).toBe(0)
  })

  it('ratio badge rewards low idle/focus, requires some focus', () => {
    expect(ratioBadgeLevel([])).toBe(0)
    // ratio 0.04 -> Diamond (<= 0.2)
    const great = [session('2026-07-11T09:00:00', 10000, 400)]
    expect(ratioBadgeLevel(great)).toBe(5)
    // ratio 0.6 -> Silver (<= 0.7)
    const meh = [session('2026-07-11T09:00:00', 3600, 2160)]
    expect(ratioBadgeLevel(meh)).toBe(2)
    // ratio 0.9 -> Bronze (<= 1.0)
    const rough = [session('2026-07-11T09:00:00', 3600, 3240)]
    expect(ratioBadgeLevel(rough)).toBe(1)
  })

  it('ratio Diamond starts at 20% or below', () => {
    const at20 = [session('2026-07-11T09:00:00', 10000, 2000)]
    expect(ratioBadgeLevel(at20)).toBe(5)
    const above20 = [session('2026-07-11T09:00:00', 10000, 2100)]
    expect(ratioBadgeLevel(above20)).toBe(4)
  })

  it('week hours badge sums the last 7 calendar days', () => {
    const h = (n: number) => n * 3600
    expect(weekHoursBadgeLevel([], NOW)).toBe(0)
    // 5h59 of focus -> still nothing; 6h -> Bronze
    expect(
      weekHoursBadgeLevel([session('2026-07-11T08:00:00', h(6) - 60)], NOW),
    ).toBe(0)
    expect(weekHoursBadgeLevel([session('2026-07-11T08:00:00', h(6))], NOW)).toBe(1)
    // 36h spread across the window -> Diamond
    const big = [
      session('2026-07-05T08:00:00', h(12)),
      session('2026-07-08T08:00:00', h(12)),
      session('2026-07-11T08:00:00', h(12)),
    ]
    expect(weekHoursBadgeLevel(big, NOW)).toBe(5)
    // 8 days back is outside the window — this badge is calendar-based
    expect(weekHoursBadgeLevel([session('2026-07-03T08:00:00', h(36))], NOW)).toBe(0)
  })
})
