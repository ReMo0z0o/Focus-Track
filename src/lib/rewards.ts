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

/** Per-key upper bounds: grade and badge tiers live on a 0-5 ladder. */
const MILESTONE_MAX: Record<keyof Milestones, number> = {
  grade: 5,
  streak: 1_000_000,
  sessions: 1_000_000,
  concTier: 5,
  ratioTier: 5,
}

function clampCount(value: unknown, max: number): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(max, Math.floor(n))
}

/** Coerce an untrusted JSON value (profiles.milestones) into Milestones. */
export function normalizeMilestones(raw: unknown): Milestones {
  const source =
    raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const out = { ...EMPTY_MILESTONES }
  for (const key of MILESTONE_KEYS) {
    out[key] = clampCount(source[key], MILESTONE_MAX[key])
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
      // The sessions milestone counts a rolling 60-day window (high-water
      // mark), not a lifetime total — label it honestly.
      return `Log ${c.count} sessions within 60 days`
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
  /** Ships a full-screen animated backdrop (see ThemeBackdrop). */
  animated?: boolean
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
  /* ---- animated worlds — unlocked by feats, not grades ---- */
  {
    id: 'fire',
    name: 'Wildfire',
    tagline: 'Embers rise while you burn through work.',
    condition: { kind: 'streak', days: 3 },
    preview: { accent: '#ff6b1f', accentStrong: '#ff9c54', bg: '#130a06', surface: '#1e130e' },
    animated: true,
  },
  {
    id: 'jungle',
    name: 'Deep Jungle',
    tagline: 'Falling leaves and fireflies keep you company.',
    condition: { kind: 'sessions', count: 15 },
    preview: { accent: '#6fce4e', accentStrong: '#a4e87e', bg: '#0a120a', surface: '#13200f' },
    animated: true,
  },
  {
    id: 'polar',
    name: 'Polar Night',
    tagline: 'Snow drifts under a silent aurora.',
    condition: { kind: 'ratioTier', tier: 3 },
    preview: { accent: '#9fdcff', accentStrong: '#d3f0ff', bg: '#080e16', surface: '#101b28' },
    animated: true,
  },
  {
    id: 'street',
    name: 'Street Art',
    tagline: 'Neon paint in the back alley.',
    condition: { kind: 'concTier', tier: 3 },
    preview: { accent: '#ff5fa8', accentStrong: '#ff92c5', bg: '#0d0a10', surface: '#171021' },
    animated: true,
  },
  {
    id: 'space',
    name: 'Deep Space',
    tagline: 'Focus drifting among the stars.',
    condition: { kind: 'sessions', count: 40 },
    preview: { accent: '#8fa8ff', accentStrong: '#bac9ff', bg: '#05060f', surface: '#0f1322' },
    animated: true,
  },
  {
    id: 'future',
    name: 'Neon Future',
    tagline: 'The grid hums beneath your focus.',
    condition: { kind: 'streak', days: 7 },
    preview: { accent: '#22e0e8', accentStrong: '#7ff5f9', bg: '#060b12', surface: '#0c1520' },
    animated: true,
  },
  {
    id: 'dragon',
    name: 'Dragon’s Lair',
    tagline: 'Smoke and embers from a sleeping hoard.',
    condition: { kind: 'anyDiamond' },
    preview: { accent: '#ff5346', accentStrong: '#ff8a76', bg: '#120708', surface: '#1d0e10' },
    animated: true,
  },
  {
    id: 'abyss',
    name: 'The Abyss',
    tagline: 'Sunlight fades, focus deepens.',
    condition: { kind: 'sessions', count: 25 },
    preview: { accent: '#38c8c2', accentStrong: '#7fe6df', bg: '#04101a', surface: '#0a1c2b' },
    animated: true,
  },
  {
    id: 'storm',
    name: 'Thunderhead',
    tagline: 'Lightning outside, calm within.',
    condition: { kind: 'concTier', tier: 4 },
    preview: { accent: '#a5b8ff', accentStrong: '#d0dcff', bg: '#0a0d18', surface: '#141a2c' },
    animated: true,
  },
  {
    id: 'sakura',
    name: 'Sakura Drift',
    tagline: 'Petals fall, minutes bloom.',
    condition: { kind: 'streak', days: 14 },
    preview: { accent: '#ff9ec0', accentStrong: '#ffc7da', bg: '#150d13', surface: '#221521' },
    animated: true,
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
  /* ---- animated characters — humans & animals with a life of their own ---- */
  {
    id: 'cat',
    name: 'Alley Cat',
    tagline: 'Curious, quick, quietly watching.',
    condition: { kind: 'sessions', count: 5 },
  },
  {
    id: 'frog',
    name: 'Pond Frog',
    tagline: 'Patient on the lily pad.',
    condition: { kind: 'ratioTier', tier: 1 },
  },
  {
    id: 'bunny',
    name: 'Swift Bunny',
    tagline: 'Fast bursts, full attention.',
    condition: { kind: 'concTier', tier: 2 },
  },
  {
    id: 'fox',
    name: 'Night Fox',
    tagline: 'Sharp senses after sundown.',
    condition: { kind: 'streak', days: 5 },
  },
  {
    id: 'astro',
    name: 'Astronaut',
    tagline: 'Deep focus, zero gravity.',
    condition: { kind: 'grade', level: 3 },
  },
  {
    id: 'panda',
    name: 'Zen Panda',
    tagline: 'Unbothered. Focused. Bamboo.',
    condition: { kind: 'ratioTier', tier: 3 },
  },
  {
    id: 'penguin',
    name: 'Polar Penguin',
    tagline: 'Stands its ground, whatever the storm.',
    condition: { kind: 'concTier', tier: 3 },
  },
  {
    id: 'wizard',
    name: 'Time Wizard',
    tagline: 'Bends hours to their will.',
    condition: { kind: 'streak', days: 10 },
  },
  {
    id: 'monk',
    name: 'Still Monk',
    tagline: 'Breathes in, lets the noise go.',
    condition: { kind: 'ratioTier', tier: 4 },
  },
  {
    id: 'ninja',
    name: 'Focus Ninja',
    tagline: 'In and out without a sound.',
    condition: { kind: 'concTier', tier: 4 },
  },
  {
    id: 'koala',
    name: 'Drowsy Koala',
    tagline: 'Slow blinks, steady branches.',
    condition: { kind: 'grade', level: 2 },
  },
  {
    id: 'bee',
    name: 'Busy Bee',
    tagline: 'Small wings, serious output.',
    condition: { kind: 'sessions', count: 15 },
  },
  {
    id: 'knight',
    name: 'Focus Knight',
    tagline: 'Armor polished by routine.',
    condition: { kind: 'grade', level: 4 },
  },
  {
    id: 'whale',
    name: 'Deep Whale',
    tagline: 'Fifty dives and still surfacing.',
    condition: { kind: 'sessions', count: 50 },
  },
  {
    id: 'dragonling',
    name: 'Dragonling',
    tagline: 'Hatched from a diamond of pure focus.',
    condition: { kind: 'concTier', tier: 5 },
  },
  {
    id: 'sloth',
    name: 'Zen Sloth',
    tagline: 'Never hurries, never pauses.',
    condition: { kind: 'ratioTier', tier: 5 },
  },
]

export const AVATAR_IDS = AVATARS.map((a) => a.id)
