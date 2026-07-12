import {
  GRADE_NAMES,
  TIER_NAMES,
  concentrationBadgeLevel,
  gradeLevel,
  ratioBadgeLevel,
  streakDays,
} from '@/lib/stats'
import type { SessionRow } from '@/lib/stats'

/**
 * Unlockable rewards (themes & avatars), driven by persistent milestones.
 *
 * Milestones are high-water marks: once you have reached a grade, a streak
 * or a badge tier, the reward stays unlocked even if your recent form dips.
 * They are computed client-side from session data and merged into
 * `profiles.milestones` (cosmetic feature — client-trusted by design).
 */

/* ------------------------------------------------------------------ */
/* Milestones                                                          */
/* ------------------------------------------------------------------ */

export interface Milestones {
  /** Highest grade level reached (0-5). */
  grade: number
  /** Longest focus streak observed (days). */
  streak: number
  /** Most sessions seen in the rolling 60-day window. */
  sessions: number
  /** Best concentration badge tier (0-5). */
  concTier: number
  /** Best pause-ratio badge tier (0-5). */
  ratioTier: number
}

export const EMPTY_MILESTONES: Milestones = {
  grade: 0,
  streak: 0,
  sessions: 0,
  concTier: 0,
  ratioTier: 0,
}

const MILESTONE_KEYS = Object.keys(EMPTY_MILESTONES) as (keyof Milestones)[]

function clampCount(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(1_000_000, Math.floor(n))
}

/** Coerce an untrusted JSON value (profiles.milestones) into Milestones. */
export function normalizeMilestones(raw: unknown): Milestones {
  const source = (raw ?? {}) as Record<string, unknown>
  const out = { ...EMPTY_MILESTONES }
  for (const key of MILESTONE_KEYS) {
    out[key] = clampCount(source[key])
  }
  return out
}

/** Current milestone values from the session history. */
export function computeMilestones(sessions: SessionRow[], now: Date): Milestones {
  return {
    grade: gradeLevel(sessions, now),
    streak: streakDays(sessions, now),
    sessions: sessions.length,
    concTier: concentrationBadgeLevel(sessions, now),
    ratioTier: ratioBadgeLevel(sessions, now),
  }
}

/** Per-key maximum — milestones only ever go up. */
export function mergeMilestones(a: Milestones, b: Milestones): Milestones {
  const out = { ...EMPTY_MILESTONES }
  for (const key of MILESTONE_KEYS) {
    out[key] = Math.max(a[key], b[key])
  }
  return out
}

export function milestonesEqual(a: Milestones, b: Milestones): boolean {
  return MILESTONE_KEYS.every((key) => a[key] === b[key])
}

/* ------------------------------------------------------------------ */
/* Unlock conditions                                                   */
/* ------------------------------------------------------------------ */

export type UnlockCondition =
  | { kind: 'free' }
  | { kind: 'grade'; level: number }
  | { kind: 'streak'; days: number }
  | { kind: 'sessions'; count: number }
  | { kind: 'concTier'; tier: number }
  | { kind: 'ratioTier'; tier: number }
  | { kind: 'anyDiamond' }

export function isUnlocked(c: UnlockCondition, m: Milestones): boolean {
  switch (c.kind) {
    case 'free':
      return true
    case 'grade':
      return m.grade >= c.level
    case 'streak':
      return m.streak >= c.days
    case 'sessions':
      return m.sessions >= c.count
    case 'concTier':
      return m.concTier >= c.tier
    case 'ratioTier':
      return m.ratioTier >= c.tier
    case 'anyDiamond':
      return m.concTier >= 5 || m.ratioTier >= 5
  }
}

export function unlockLabel(c: UnlockCondition): string {
  switch (c.kind) {
    case 'free':
      return 'Yours from day one'
    case 'grade':
      return `Reach the ${GRADE_NAMES[c.level]} grade`
    case 'streak':
      return `Hold a ${c.days}-day focus streak`
    case 'sessions':
      return `Finish ${c.count} sessions`
    case 'concTier':
      return `Earn a ${TIER_NAMES[c.tier]} concentration badge`
    case 'ratioTier':
      return `Earn a ${TIER_NAMES[c.tier]} pause-ratio badge`
    case 'anyDiamond':
      return 'Earn any Diamond badge'
  }
}

/** 0..1 progress toward a condition (for locked-reward previews). */
export function unlockProgress(c: UnlockCondition, m: Milestones): number {
  const ratio = (have: number, need: number) =>
    need <= 0 ? 1 : Math.min(1, have / need)
  switch (c.kind) {
    case 'free':
      return 1
    case 'grade':
      return ratio(m.grade, c.level)
    case 'streak':
      return ratio(m.streak, c.days)
    case 'sessions':
      return ratio(m.sessions, c.count)
    case 'concTier':
      return ratio(m.concTier, c.tier)
    case 'ratioTier':
      return ratio(m.ratioTier, c.tier)
    case 'anyDiamond':
      return ratio(Math.max(m.concTier, m.ratioTier), 5)
  }
}

/* ------------------------------------------------------------------ */
/* Themes                                                              */
/* ------------------------------------------------------------------ */

export interface ThemeDef {
  id: string
  name: string
  tagline: string
  condition: UnlockCondition
  /** Preview swatches (mirrors the CSS [data-theme] definitions). */
  preview: {
    accent: string
    accentStrong: string
    bg: string
    surface: string
  }
}

export const DEFAULT_THEME = 'amber'

export const THEMES: ThemeDef[] = [
  {
    id: 'amber',
    name: 'Midnight Amber',
    tagline: 'The original warm glow.',
    condition: { kind: 'free' },
    preview: { accent: '#f6ac3d', accentStrong: '#ffc46b', bg: '#0b0e14', surface: '#141926' },
  },
  {
    id: 'ember',
    name: 'Emberglow',
    tagline: 'Coals burning late into the night.',
    condition: { kind: 'grade', level: 1 },
    preview: { accent: '#ff7a59', accentStrong: '#ff9d82', bg: '#120c0c', surface: '#1d1416' },
  },
  {
    id: 'forest',
    name: 'Forest Focus',
    tagline: 'Deep work under a quiet canopy.',
    condition: { kind: 'grade', level: 2 },
    preview: { accent: '#4fd39a', accentStrong: '#7fe6b8', bg: '#0a100d', surface: '#121b16' },
  },
  {
    id: 'ocean',
    name: 'Ocean Deep',
    tagline: 'Calm currents, steady mind.',
    condition: { kind: 'grade', level: 3 },
    preview: { accent: '#55b9f0', accentStrong: '#8ad2ff', bg: '#090e15', surface: '#111a26' },
  },
  {
    id: 'violet',
    name: 'Royal Violet',
    tagline: 'Focus fit for a crown.',
    condition: { kind: 'grade', level: 4 },
    preview: { accent: '#a78bfa', accentStrong: '#c4b0ff', bg: '#0d0b15', surface: '#171426' },
  },
  {
    id: 'aurora',
    name: 'Lighthouse Aurora',
    tagline: 'The keeper’s light, always on.',
    condition: { kind: 'grade', level: 5 },
    preview: { accent: '#ffd98a', accentStrong: '#fff0c4', bg: '#0d0e12', surface: '#161a22' },
  },
]

export const THEME_IDS = THEMES.map((t) => t.id)

/* ------------------------------------------------------------------ */
/* Avatars                                                             */
/* ------------------------------------------------------------------ */

export interface AvatarDef {
  id: string
  name: string
  tagline: string
  condition: UnlockCondition
}

export const DEFAULT_AVATAR = 'spark'

export const AVATARS: AvatarDef[] = [
  {
    id: 'spark',
    name: 'Spark',
    tagline: 'Every fire starts somewhere.',
    condition: { kind: 'free' },
  },
  {
    id: 'moon',
    name: 'Night Shift',
    tagline: 'Quiet hours, clear mind.',
    condition: { kind: 'free' },
  },
  {
    id: 'wisp',
    name: 'Wisp',
    tagline: 'A flame finding its shape.',
    condition: { kind: 'grade', level: 1 },
  },
  {
    id: 'target',
    name: 'Marksman',
    tagline: 'Eyes on the bullseye.',
    condition: { kind: 'concTier', tier: 1 },
  },
  {
    id: 'zen',
    name: 'Ensō',
    tagline: 'Barely a pause, perfectly round.',
    condition: { kind: 'ratioTier', tier: 2 },
  },
  {
    id: 'flame',
    name: 'Flame Spirit',
    tagline: 'Three days without going out.',
    condition: { kind: 'streak', days: 3 },
  },
  {
    id: 'owl',
    name: 'Focus Owl',
    tagline: 'Ten sessions deep already.',
    condition: { kind: 'sessions', count: 10 },
  },
  {
    id: 'hourglass',
    name: 'Timekeeper',
    tagline: 'Twenty-five sessions and counting.',
    condition: { kind: 'sessions', count: 25 },
  },
  {
    id: 'phoenix',
    name: 'Phoenix',
    tagline: 'A week of fire, reborn daily.',
    condition: { kind: 'streak', days: 7 },
  },
  {
    id: 'diamond',
    name: 'Diamond Mind',
    tagline: 'Pressure made you brilliant.',
    condition: { kind: 'anyDiamond' },
  },
  {
    id: 'keeper',
    name: 'Lighthouse Keeper',
    tagline: 'You are the light now.',
    condition: { kind: 'grade', level: 5 },
  },
]

export const AVATAR_IDS = AVATARS.map((a) => a.id)
