import { describe, expect, it } from 'vitest'
import {
  aggregateConcentration,
  concentrationBadgeLevel,
  dailyBuckets,
  fmtClock,
  fmtDuration,
  gradeLevel,
  hourlyBuckets,
  periodStart,
  qualifiedDaysLast30,
  ratioBadgeLevel,
  startOfDay,
  streakDays,
  summarize,
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

  it('assigns hourly buckets by start hour for the given day only', () => {
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

describe('badges', () => {
  it('concentration badge pools the last 3 days', () => {
    // 2h focus in one uninterrupted run each day -> avgRun 7200 -> 100
    const sessions = [
      session('2026-07-11T09:00:00', 7200),
      session('2026-07-10T09:00:00', 7200),
    ]
    expect(aggregateConcentration(sessions, 3, NOW)).toBe(100)
    expect(concentrationBadgeLevel(sessions, NOW)).toBe(5)
  })

  it('concentration badge ignores sessions older than 3 days', () => {
    const sessions = [session('2026-07-01T09:00:00', 7200)]
    expect(aggregateConcentration(sessions, 3, NOW)).toBe(0)
    expect(concentrationBadgeLevel(sessions, NOW)).toBe(0)
  })

  it('ratio badge rewards low idle/focus, requires some focus', () => {
    expect(ratioBadgeLevel([], NOW)).toBe(0)
    // ratio 0.04 -> best tier (<= 0.05)
    const great = [session('2026-07-11T09:00:00', 10000, 400)]
    expect(ratioBadgeLevel(great, NOW)).toBe(5)
    // ratio 0.6 -> <= 1.0 tier (level 1)
    const meh = [session('2026-07-11T09:00:00', 1000, 600)]
    expect(ratioBadgeLevel(meh, NOW)).toBe(1)
  })
})
