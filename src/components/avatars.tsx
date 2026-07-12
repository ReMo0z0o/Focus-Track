import type { ReactNode } from 'react'
import { DEFAULT_AVATAR } from '@/lib/rewards'

/**
 * Hand-drawn avatar glyphs. Each avatar is a colored disc (per-id gradient
 * set in CSS via the `.av-<id>` class) with a simple SVG figure on top.
 */

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true">
      {children}
    </svg>
  )
}

const GLYPHS: Record<string, ReactNode> = {
  spark: (
    <Glyph>
      <path
        d="M24 8 L27.5 20.5 L40 24 L27.5 27.5 L24 40 L20.5 27.5 L8 24 L20.5 20.5 Z"
        fill="#fff6e0"
      />
      <circle cx="24" cy="24" r="3.4" fill="#ffd782" />
    </Glyph>
  ),
  moon: (
    <Glyph>
      <path
        d="M30 8 A17 17 0 1 0 40 30 A13.5 13.5 0 0 1 30 8 Z"
        fill="#eef2ff"
      />
      <circle cx="33" cy="14" r="2" fill="#ffe9b8" />
      <circle cx="38" cy="20" r="1.3" fill="#ffe9b8" />
    </Glyph>
  ),
  wisp: (
    <Glyph>
      <path
        d="M24 7 C29 14 35 18 35 27 A11 11 0 0 1 13 27 C13 18 19 14 24 7 Z"
        fill="#ffd9c2"
        opacity="0.55"
      />
      <path
        d="M24 17 C27 21 30 23.5 30 28.5 A6 6 0 0 1 18 28.5 C18 23.5 21 21 24 17 Z"
        fill="#fff3ea"
      />
    </Glyph>
  ),
  target: (
    <Glyph>
      <circle cx="24" cy="24" r="15" fill="none" stroke="#ffffff" strokeWidth="3" opacity="0.9" />
      <circle cx="24" cy="24" r="8.5" fill="none" stroke="#ffffff" strokeWidth="3" opacity="0.65" />
      <circle cx="24" cy="24" r="3" fill="#fff" />
    </Glyph>
  ),
  zen: (
    <Glyph>
      <path
        d="M37 20 A14 14 0 1 0 39 27"
        fill="none"
        stroke="#f4fff9"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
    </Glyph>
  ),
  flame: (
    <Glyph>
      <path
        d="M24 6 C30 14 37 18 37 28 A13 13 0 0 1 11 28 C11 18 18 14 24 6 Z"
        fill="#ffe1b3"
        opacity="0.5"
      />
      <path
        d="M24 15 C27.5 19.5 31.5 22.5 31.5 28.5 A7.5 7.5 0 0 1 16.5 28.5 C16.5 22.5 20.5 19.5 24 15 Z"
        fill="#fff4dd"
      />
      <circle cx="24" cy="30" r="3" fill="#ffca66" />
    </Glyph>
  ),
  owl: (
    <Glyph>
      <path
        d="M12 14 Q24 8 36 14 L36 30 A12 12 0 0 1 12 30 Z"
        fill="#ffffff"
        opacity="0.16"
      />
      <circle cx="17.5" cy="23" r="6.5" fill="#fff" />
      <circle cx="30.5" cy="23" r="6.5" fill="#fff" />
      <circle cx="17.5" cy="23" r="2.6" fill="#1d2433" />
      <circle cx="30.5" cy="23" r="2.6" fill="#1d2433" />
      <path d="M24 27 L21.5 32 L26.5 32 Z" fill="#ffca66" />
      <path d="M12 14 L17 9 L19 15 Z M36 14 L31 9 L29 15 Z" fill="#fff" opacity="0.7" />
    </Glyph>
  ),
  hourglass: (
    <Glyph>
      <path
        d="M15 9 H33 V13 C33 18 27 21 27 24 C27 27 33 30 33 35 V39 H15 V35 C15 30 21 27 21 24 C21 21 15 18 15 13 Z"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
      <path d="M19 35.5 C20.5 32.5 27.5 32.5 29 35.5 L29 36.5 H19 Z" fill="#ffe2a3" />
      <path d="M20.5 14 H27.5 C27 16.5 25 18 24 18.6 C23 18 21 16.5 20.5 14 Z" fill="#ffe2a3" />
    </Glyph>
  ),
  phoenix: (
    <Glyph>
      <path
        d="M24 8 C31 15 38 19 37 29 A13.5 13.5 0 0 1 24 41"
        fill="none"
        stroke="#ffe3c4"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <path
        d="M24 8 C17 15 10 19 11 29 A13.5 13.5 0 0 0 24 41"
        fill="none"
        stroke="#ffc9a3"
        strokeWidth="3.4"
        strokeLinecap="round"
        opacity="0.8"
      />
      <path
        d="M24 16 C27.5 20.5 31 23 31 28.5 A7 7 0 0 1 17 28.5 C17 23 20.5 20.5 24 16 Z"
        fill="#fff3e4"
      />
      <circle cx="24" cy="12" r="2.2" fill="#fff" />
    </Glyph>
  ),
  diamond: (
    <Glyph>
      <path d="M15 12 H33 L41 21 L24 40 L7 21 Z" fill="#f4f9ff" opacity="0.92" />
      <path d="M15 12 L24 40 L7 21 Z" fill="#dceaff" />
      <path d="M33 12 L41 21 L24 40 Z" fill="#c3d9f8" />
      <path d="M15 12 H33 L28 21 H20 Z" fill="#ffffff" />
      <path d="M7 21 H41 L24 40 Z" fill="none" stroke="#ffffff" strokeWidth="0.8" opacity="0.6" />
    </Glyph>
  ),
  keeper: (
    <Glyph>
      <path d="M20 18 H28 L30 38 H18 Z" fill="#fff2d6" />
      <path d="M19.5 24 H28.5 M19 30 H29" stroke="#c9a25e" strokeWidth="1.6" />
      <rect x="19" y="12" width="10" height="6" rx="1.5" fill="#ffd66f" />
      <path d="M19 12 L8 8 L8 16 Z" fill="#ffe9b0" opacity="0.75" />
      <path d="M29 12 L40 8 L40 16 Z" fill="#ffe9b0" opacity="0.75" />
      <path d="M17 38 H31 L32 41 H16 Z" fill="#e8d3a4" />
    </Glyph>
  ),
}

export function Avatar({
  id,
  size = 40,
  locked = false,
}: {
  id: string
  size?: number
  locked?: boolean
}) {
  // Object.hasOwn so prototype-chain keys ('constructor', …) can't slip past.
  const known = Object.hasOwn(GLYPHS, id) ? id : DEFAULT_AVATAR
  return (
    <span
      className={`avatar av-${known}${locked ? ' locked' : ''}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {GLYPHS[known]}
    </span>
  )
}
