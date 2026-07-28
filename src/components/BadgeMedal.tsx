import type { ReactNode } from 'react'
import {
  ATTENTION_BADGE_NAME,
  ATTENTION_TIER_NICKNAMES,
  DEAD_AIR_BADGE_NAME,
  DEAD_AIR_TIER_NICKNAMES,
  HAUL_BADGE_NAME,
  HAUL_TIER_NICKNAMES,
} from '@/lib/stats'

/**
 * The metallic badge disc, shared by the owner's stats page and the panel a
 * friend sees — so a badge always looks the same wherever it shows up.
 */

export type BadgeKind = 'attention' | 'deadAir' | 'haul'

export interface BadgeDef {
  kind: BadgeKind
  name: string
  /** Rank nicknames indexed by tier (0..5). */
  nicknames: string[]
}

export const ATTENTION_BADGE: BadgeDef = {
  kind: 'attention',
  name: ATTENTION_BADGE_NAME,
  nicknames: ATTENTION_TIER_NICKNAMES,
}

export const DEAD_AIR_BADGE: BadgeDef = {
  kind: 'deadAir',
  name: DEAD_AIR_BADGE_NAME,
  nicknames: DEAD_AIR_TIER_NICKNAMES,
}

export const HAUL_BADGE: BadgeDef = {
  kind: 'haul',
  name: HAUL_BADGE_NAME,
  nicknames: HAUL_TIER_NICKNAMES,
}

export const BADGES: BadgeDef[] = [ATTENTION_BADGE, DEAD_AIR_BADGE, HAUL_BADGE]

export function BadgeMedal({
  kind,
  tier,
  small = false,
}: {
  kind: BadgeKind
  tier: number
  /** Compact 44px disc for dense layouts like the friend panel. */
  small?: boolean
}) {
  const locked = tier === 0
  return (
    <div
      className={`medal${small ? ' sm' : ''}${locked ? ' locked' : ''}`}
      aria-hidden="true"
    >
      <span className="medal-disc">
        {locked ? <LockIcon /> : BADGE_ICONS[kind]}
      </span>
      {!locked && <span className="medal-shine" />}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

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

const BADGE_ICONS: Record<BadgeKind, ReactNode> = {
  attention: <TargetIcon />,
  deadAir: <ScaleIcon />,
  haul: <ClockIcon />,
}
