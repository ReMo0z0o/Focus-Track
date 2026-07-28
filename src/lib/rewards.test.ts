import { describe, expect, it } from 'vitest'
import {
  AVATARS,
  EMPTY_MILESTONES,
  THEMES,
  computeMilestones,
  isUnlocked,
  mergeMilestones,
  milestonesEqual,
  normalizeMilestones,
  unlockLabel,
  unlockProgress,
} from './rewards'
import type { SessionRow } from './stats'

const NOW = new Date('2026-07-12T15:00:00')

let counter = 0
function session(startedAt: string, focus: number, idle = 0, resumes = 0): SessionRow {
  return {
    id: `s-${counter++}`,
    started_at: new Date(startedAt).toISOString(),
    ended_at: new Date(startedAt).toISOString(),
    focus_seconds: focus,
    idle_seconds: idle,
    resumes_count: resumes,
  }
}

describe('normalizeMilestones', () => {
  it('defaults garbage to zeroed milestones', () => {
    expect(normalizeMilestones(null)).toEqual(EMPTY_MILESTONES)
    expect(normalizeMilestones('nope')).toEqual(EMPTY_MILESTONES)
    expect(normalizeMilestones({ grade: 'x', streak: -4 })).toEqual(EMPTY_MILESTONES)
  })

  it('keeps known keys, clamps and floors', () => {
    const m = normalizeMilestones({ grade: 3.9, streak: 2, junk: 99 })
    expect(m.grade).toBe(3)
    expect(m.streak).toBe(2)
    expect('junk' in m).toBe(false)
  })

  it('clamps badge tiers to the 0-5 ladder', () => {
    const m = normalizeMilestones({ concTier: 9, ratioTier: -1, weekTier: 7 })
    expect(m.concTier).toBe(5)
    expect(m.ratioTier).toBe(0)
    expect(m.weekTier).toBe(5)
  })
})

describe('computeMilestones + merge', () => {
  it('computes from sessions and merges as high-water marks', () => {
    const sessions = [
      session('2026-07-12T09:00:00', 7200),
      session('2026-07-11T09:00:00', 7200),
    ]
    const current = computeMilestones(sessions, NOW)
    expect(current.grade).toBe(1) // 2 qualified days -> Kindling
    expect(current.streak).toBe(2)
    expect(current.sessions).toBe(2)
    expect(current.concTier).toBe(5) // two perfect 2h runs
    expect(current.weekTier).toBe(0) // 4h this week — Bronze needs 6h

    const stored = normalizeMilestones({ grade: 3, streak: 1, sessions: 40 })
    const merged = mergeMilestones(stored, current)
    expect(merged.grade).toBe(3) // regression doesn't lower it
    expect(merged.streak).toBe(2)
    expect(merged.sessions).toBe(40)
    expect(milestonesEqual(merged, stored)).toBe(false)
  })

  it('weekTier reflects focus hours over the last 7 days', () => {
    // 3 days × 12h inside the window -> 36h -> Diamond
    const sessions = [
      session('2026-07-12T08:00:00', 12 * 3600),
      session('2026-07-10T08:00:00', 12 * 3600),
      session('2026-07-08T08:00:00', 12 * 3600),
    ]
    expect(computeMilestones(sessions, NOW).weekTier).toBe(5)
  })
})

describe('unlock conditions', () => {
  const m = normalizeMilestones({
    grade: 2,
    streak: 3,
    sessions: 12,
    concTier: 1,
    ratioTier: 5,
  })

  it('evaluates each condition kind', () => {
    expect(isUnlocked({ kind: 'free' }, EMPTY_MILESTONES)).toBe(true)
    expect(isUnlocked({ kind: 'grade', level: 2 }, m)).toBe(true)
    expect(isUnlocked({ kind: 'grade', level: 3 }, m)).toBe(false)
    expect(isUnlocked({ kind: 'streak', days: 3 }, m)).toBe(true)
    expect(isUnlocked({ kind: 'sessions', count: 25 }, m)).toBe(false)
    expect(isUnlocked({ kind: 'concTier', tier: 1 }, m)).toBe(true)
    expect(isUnlocked({ kind: 'anyDiamond' }, m)).toBe(true)
  })

  it('anyDiamond counts a Diamond focus-hours badge too', () => {
    const weekOnly = normalizeMilestones({ weekTier: 5 })
    expect(isUnlocked({ kind: 'anyDiamond' }, weekOnly)).toBe(true)
    expect(
      unlockProgress({ kind: 'anyDiamond' }, normalizeMilestones({ weekTier: 4 })),
    ).toBeCloseTo(0.8)
    expect(isUnlocked({ kind: 'anyDiamond' }, EMPTY_MILESTONES)).toBe(false)
  })

  it('reports progress toward locked rewards', () => {
    expect(unlockProgress({ kind: 'sessions', count: 24 }, m)).toBeCloseTo(0.5)
    expect(unlockProgress({ kind: 'grade', level: 4 }, m)).toBeCloseTo(0.5)
    expect(unlockProgress({ kind: 'free' }, EMPTY_MILESTONES)).toBe(1)
  })

  it('labels are human-readable', () => {
    expect(unlockLabel({ kind: 'grade', level: 3 })).toContain('Torch')
    expect(unlockLabel({ kind: 'concTier', tier: 1 })).toContain('Bronze')
  })

  it('an "all" condition needs every part', () => {
    const both: Parameters<typeof isUnlocked>[0] = {
      kind: 'all',
      conditions: [{ kind: 'anyDiamond' }, { kind: 'grade', level: 5 }],
    }
    // Diamond badge but only grade 2 — the second gate is still shut.
    expect(isUnlocked(both, normalizeMilestones({ ratioTier: 5, grade: 2 }))).toBe(
      false,
    )
    // Lighthouse but no Diamond badge — same.
    expect(isUnlocked(both, normalizeMilestones({ grade: 5 }))).toBe(false)
    expect(
      isUnlocked(both, normalizeMilestones({ concTier: 5, grade: 5 })),
    ).toBe(true)
  })

  it('an "all" condition averages the progress of its parts', () => {
    const both: Parameters<typeof unlockProgress>[0] = {
      kind: 'all',
      conditions: [{ kind: 'anyDiamond' }, { kind: 'grade', level: 5 }],
    }
    // badge done (1) + grade 2 of 5 (0.4) -> 0.7
    expect(
      unlockProgress(both, normalizeMilestones({ weekTier: 5, grade: 2 })),
    ).toBeCloseTo(0.7)
    expect(unlockProgress(both, EMPTY_MILESTONES)).toBe(0)
  })

  it('the Dragon’s Lair theme demands a Diamond badge and Lighthouse', () => {
    const dragon = THEMES.find((t) => t.id === 'dragon')!
    const diamondOnly = normalizeMilestones({ concTier: 5, grade: 4 })
    expect(isUnlocked(dragon.condition, diamondOnly)).toBe(false)
    expect(
      isUnlocked(dragon.condition, normalizeMilestones({ concTier: 5, grade: 5 })),
    ).toBe(true)
    expect(unlockLabel(dragon.condition)).toBe(
      'Earn any Diamond badge + reach the Lighthouse grade',
    )
  })
})

describe('reward catalogs', () => {
  it('theme and avatar ids are unique and defaults exist', () => {
    const themeIds = THEMES.map((t) => t.id)
    const avatarIds = AVATARS.map((a) => a.id)
    expect(new Set(themeIds).size).toBe(themeIds.length)
    expect(new Set(avatarIds).size).toBe(avatarIds.length)
    expect(themeIds).toContain('amber')
    expect(avatarIds).toContain('spark')
  })

  it('every user starts with at least one unlocked theme and avatar', () => {
    expect(THEMES.some((t) => isUnlocked(t.condition, EMPTY_MILESTONES))).toBe(true)
    expect(AVATARS.some((a) => isUnlocked(a.condition, EMPTY_MILESTONES))).toBe(true)
  })
})
