import type { ReactNode } from 'react'
import { DEFAULT_AVATAR } from '@/lib/rewards'

/**
 * Hand-drawn avatar glyphs. Each avatar is a colored disc (per-id gradient
 * set in CSS via the `.av-<id>` class) with a simple SVG figure on top.
 *
 * Parts tagged with `avp avp-*` classes carry a tiny looping animation
 * (blink, ear twitch, tail sway…) defined in styles.css. Base poses are the
 * natural resting state, so prefers-reduced-motion simply shows a still
 * portrait.
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
        className="avp avp-pulse"
        d="M24 8 L27.5 20.5 L40 24 L27.5 27.5 L24 40 L20.5 27.5 L8 24 L20.5 20.5 Z"
        fill="#fff6e0"
      />
      <circle className="avp avp-twinkle" cx="24" cy="24" r="3.4" fill="#ffd782" />
    </Glyph>
  ),
  moon: (
    <Glyph>
      <path
        d="M30 8 A17 17 0 1 0 40 30 A13.5 13.5 0 0 1 30 8 Z"
        fill="#eef2ff"
      />
      <circle className="avp avp-twinkle" cx="33" cy="14" r="2" fill="#ffe9b8" />
      <circle
        className="avp avp-twinkle"
        style={{ animationDelay: '-1.2s' }}
        cx="38"
        cy="20"
        r="1.3"
        fill="#ffe9b8"
      />
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
        className="avp avp-flicker"
        d="M24 17 C27 21 30 23.5 30 28.5 A6 6 0 0 1 18 28.5 C18 23.5 21 21 24 17 Z"
        fill="#fff3ea"
      />
    </Glyph>
  ),
  target: (
    <Glyph>
      <circle cx="24" cy="24" r="15" fill="none" stroke="#ffffff" strokeWidth="3" opacity="0.9" />
      <circle cx="24" cy="24" r="8.5" fill="none" stroke="#ffffff" strokeWidth="3" opacity="0.65" />
      <circle className="avp avp-pulse" cx="24" cy="24" r="3" fill="#fff" />
    </Glyph>
  ),
  zen: (
    <Glyph>
      <path
        className="avp avp-sway"
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
        className="avp avp-flicker"
        d="M24 15 C27.5 19.5 31.5 22.5 31.5 28.5 A7.5 7.5 0 0 1 16.5 28.5 C16.5 22.5 20.5 19.5 24 15 Z"
        fill="#fff4dd"
      />
      <circle className="avp avp-pulse" cx="24" cy="30" r="3" fill="#ffca66" />
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
      <g className="avp avp-blink" style={{ animationDelay: '-0.7s' }}>
        <circle cx="17.5" cy="23" r="2.6" fill="#1d2433" />
        <circle cx="30.5" cy="23" r="2.6" fill="#1d2433" />
      </g>
      <path d="M24 27 L21.5 32 L26.5 32 Z" fill="#ffca66" />
      <path d="M12 14 L17 9 L19 15 Z M36 14 L31 9 L29 15 Z" fill="#fff" opacity="0.7" />
    </Glyph>
  ),
  hourglass: (
    <Glyph>
      <g className="avp avp-sway">
        <path
          d="M15 9 H33 V13 C33 18 27 21 27 24 C27 27 33 30 33 35 V39 H15 V35 C15 30 21 27 21 24 C21 21 15 18 15 13 Z"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.8"
          strokeLinejoin="round"
        />
        <path d="M19 35.5 C20.5 32.5 27.5 32.5 29 35.5 L29 36.5 H19 Z" fill="#ffe2a3" />
        <path
          className="avp avp-flicker"
          d="M20.5 14 H27.5 C27 16.5 25 18 24 18.6 C23 18 21 16.5 20.5 14 Z"
          fill="#ffe2a3"
        />
      </g>
    </Glyph>
  ),
  phoenix: (
    <Glyph>
      <path
        className="avp avp-pulse"
        d="M24 8 C31 15 38 19 37 29 A13.5 13.5 0 0 1 24 41"
        fill="none"
        stroke="#ffe3c4"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <path
        className="avp avp-pulse"
        style={{ animationDelay: '-1.5s' }}
        d="M24 8 C17 15 10 19 11 29 A13.5 13.5 0 0 0 24 41"
        fill="none"
        stroke="#ffc9a3"
        strokeWidth="3.4"
        strokeLinecap="round"
        opacity="0.8"
      />
      <path
        className="avp avp-flicker"
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
      {/* opacity-only glimmer: the facet shares the crown outline, so a
          scale twinkle would poke past the silhouette */}
      <path className="avp avp-glimmer" d="M15 12 H33 L28 21 H20 Z" fill="#ffffff" />
      <path d="M7 21 H41 L24 40 Z" fill="none" stroke="#ffffff" strokeWidth="0.8" opacity="0.6" />
    </Glyph>
  ),
  keeper: (
    <Glyph>
      <path d="M20 18 H28 L30 38 H18 Z" fill="#fff2d6" />
      <path d="M19.5 24 H28.5 M19 30 H29" stroke="#c9a25e" strokeWidth="1.6" />
      <rect x="19" y="12" width="10" height="6" rx="1.5" fill="#ffd66f" />
      <path className="avp avp-pulse" d="M19 12 L8 8 L8 16 Z" fill="#ffe9b0" opacity="0.75" />
      <path
        className="avp avp-pulse"
        style={{ animationDelay: '-1.5s' }}
        d="M29 12 L40 8 L40 16 Z"
        fill="#ffe9b0"
        opacity="0.75"
      />
      <path d="M17 38 H31 L32 41 H16 Z" fill="#e8d3a4" />
    </Glyph>
  ),
  /* ---- animated characters ---- */
  cat: (
    <Glyph>
      <g className="avp avp-ear" style={{ animationDelay: '-2.4s' }}>
        <path d="M12 17 L15 5.5 L22 12.5 Z" fill="#f4e9db" />
        <path d="M13.6 14.6 L15.5 8.5 L19.5 12.4 Z" fill="#f3a7b8" />
      </g>
      <path d="M36 17 L33 5.5 L26 12.5 Z" fill="#f4e9db" />
      <path d="M34.4 14.6 L32.5 8.5 L28.5 12.4 Z" fill="#f3a7b8" />
      <circle cx="24" cy="26" r="13" fill="#f4e9db" />
      <g className="avp avp-blink" style={{ animationDelay: '-1.9s' }}>
        <ellipse cx="19" cy="24.5" rx="2" ry="2.7" fill="#2c3145" />
        <ellipse cx="29" cy="24.5" rx="2" ry="2.7" fill="#2c3145" />
      </g>
      <path d="M22.6 29.5 H25.4 L24 31.3 Z" fill="#f37e9b" />
      <path
        d="M24 31.3 Q22.5 33.6 20.5 32.6 M24 31.3 Q25.5 33.6 27.5 32.6"
        fill="none"
        stroke="#8c7f6d"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path
        d="M8.5 26 L15 26.5 M9 30.5 L15.2 29.5 M39.5 26 L33 26.5 M39 30.5 L32.8 29.5"
        stroke="#cbbfae"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.8"
      />
    </Glyph>
  ),
  frog: (
    <Glyph>
      <ellipse className="avp avp-puff" cx="24" cy="36" rx="5.2" ry="3.6" fill="#d9efad" />
      <path
        d="M9.5 21 C13 17.5 35 17.5 38.5 21 C40 27 35 35.5 24 35.5 C13 35.5 8 27 9.5 21 Z"
        fill="#79b83f"
      />
      <circle cx="15.5" cy="13.5" r="6" fill="#79b83f" />
      <circle cx="32.5" cy="13.5" r="6" fill="#79b83f" />
      <circle cx="15.5" cy="13" r="4" fill="#fdfcf5" />
      <circle cx="32.5" cy="13" r="4" fill="#fdfcf5" />
      <g className="avp avp-blink" style={{ animationDelay: '-3.4s' }}>
        <circle cx="15.5" cy="13.4" r="1.8" fill="#26301c" />
        <circle cx="32.5" cy="13.4" r="1.8" fill="#26301c" />
      </g>
      <path
        d="M15.5 26 Q24 32 32.5 26"
        fill="none"
        stroke="#26301c"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="13.8" cy="27.5" r="1.9" fill="#e5928f" opacity="0.75" />
      <circle cx="34.2" cy="27.5" r="1.9" fill="#e5928f" opacity="0.75" />
    </Glyph>
  ),
  bunny: (
    <Glyph>
      <ellipse cx="18" cy="11" rx="3.9" ry="9.2" fill="#fdf4f7" transform="rotate(-8 18 11)" />
      <ellipse cx="18" cy="11.6" rx="2" ry="6.2" fill="#f5b8cd" transform="rotate(-8 18 11.6)" />
      <g className="avp avp-flop" style={{ animationDelay: '-1.2s' }}>
        <ellipse cx="30" cy="11" rx="3.9" ry="9.2" fill="#fdf4f7" transform="rotate(8 30 11)" />
        <ellipse cx="30" cy="11.6" rx="2" ry="6.2" fill="#f5b8cd" transform="rotate(8 30 11.6)" />
      </g>
      <circle cx="24" cy="28" r="11.8" fill="#fdf4f7" />
      <g className="avp avp-blink" style={{ animationDelay: '-0.9s' }}>
        <circle cx="19.5" cy="26.5" r="1.9" fill="#3a2e33" />
        <circle cx="28.5" cy="26.5" r="1.9" fill="#3a2e33" />
      </g>
      <path d="M22.8 30.5 H25.2 L24 32 Z" fill="#f08bab" />
      <rect x="22.2" y="32.6" width="3.6" height="3.4" rx="1" fill="#fff" stroke="#e3d3d9" strokeWidth="0.7" />
      <circle cx="15.5" cy="30" r="2" fill="#f5b8cd" opacity="0.65" />
      <circle cx="32.5" cy="30" r="2" fill="#f5b8cd" opacity="0.65" />
    </Glyph>
  ),
  fox: (
    // the Deep Jungle companion, straight from the theme's sprite
    <span className="av-live av-live-monkey" />
  ),
  astro: (
    <Glyph>
      <g className="avp avp-bob">
        <path d="M15 43 C15 36.5 18 33.5 24 33.5 C30 33.5 33 36.5 33 43 Z" fill="#e6ecf7" />
        <rect x="21.4" y="36.5" width="5.2" height="3.4" rx="1" fill="#9fb4d8" />
        <circle cx="24" cy="21" r="12.2" fill="#f4f8ff" />
        <ellipse cx="24" cy="21.5" rx="8.6" ry="7.4" fill="#233150" />
        <path
          d="M18.5 18.5 C20 16.8 23 16.2 25.5 17"
          stroke="#7ea0d8"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
          opacity="0.9"
        />
      </g>
      <path
        className="avp avp-twinkle"
        d="M39 8.5 L40 11 L42.5 12 L40 13 L39 15.5 L38 13 L35.5 12 L38 11 Z"
        fill="#fff"
      />
    </Glyph>
  ),
  panda: (
    <Glyph>
      <circle cx="13" cy="12.5" r="4.6" fill="#20242e" />
      <circle cx="35" cy="12.5" r="4.6" fill="#20242e" />
      <circle cx="24" cy="26" r="13.2" fill="#fbfaf6" />
      <ellipse cx="18.4" cy="23.5" rx="4" ry="4.9" fill="#20242e" transform="rotate(-14 18.4 23.5)" />
      <ellipse cx="29.6" cy="23.5" rx="4" ry="4.9" fill="#20242e" transform="rotate(14 29.6 23.5)" />
      <g className="avp avp-blink-slow" style={{ animationDelay: '-2.8s' }}>
        <circle cx="18.8" cy="23.2" r="1.4" fill="#fbfaf6" />
        <circle cx="29.2" cy="23.2" r="1.4" fill="#fbfaf6" />
      </g>
      <path d="M22.6 30 H25.4 L24 31.8 Z" fill="#20242e" />
      <path
        d="M24 31.8 Q24 33.6 21.8 34 M24 31.8 Q24 33.6 26.2 34"
        stroke="#20242e"
        strokeWidth="1.1"
        fill="none"
        strokeLinecap="round"
      />
    </Glyph>
  ),
  penguin: (
    <Glyph>
      <ellipse cx="19.5" cy="41" rx="3.4" ry="1.7" fill="#ffb347" />
      <ellipse cx="28.5" cy="41" rx="3.4" ry="1.7" fill="#ffb347" />
      <g className="avp avp-waddle">
        <path d="M13.5 22 C11 24 10 28 10.8 32 C12.5 30.5 13.8 28 14.3 25 Z" fill="#232c3f" />
        <path d="M34.5 22 C37 24 38 28 37.2 32 C35.5 30.5 34.2 28 33.7 25 Z" fill="#232c3f" />
        <ellipse cx="24" cy="26" rx="11" ry="14.5" fill="#2b3450" />
        <ellipse cx="24" cy="28.5" rx="7.5" ry="10.5" fill="#f7fbff" />
        <circle cx="20.2" cy="17" r="2.4" fill="#fff" />
        <circle cx="27.8" cy="17" r="2.4" fill="#fff" />
        <g className="avp avp-blink" style={{ animationDelay: '-4s' }}>
          <circle cx="20.2" cy="17.2" r="1.2" fill="#101623" />
          <circle cx="27.8" cy="17.2" r="1.2" fill="#101623" />
        </g>
        <path d="M24 19.5 L21.2 22.2 L26.8 22.2 Z" fill="#ffb347" />
      </g>
    </Glyph>
  ),
  wizard: (
    <Glyph>
      <circle cx="24" cy="26.5" r="8.2" fill="#f0cfa8" />
      <g className="avp avp-blink" style={{ animationDelay: '-1.3s' }}>
        <circle cx="20.8" cy="25" r="1.5" fill="#33261c" />
        <circle cx="27.2" cy="25" r="1.5" fill="#33261c" />
      </g>
      <path d="M24 26.5 L24 28.6" stroke="#d8ab77" strokeWidth="1.4" strokeLinecap="round" />
      <path
        d="M15.5 28 C15.5 36 19 40.5 24 40.5 C29 40.5 32.5 36 32.5 28 C30 31 27 31.8 24 31.8 C21 31.8 18 31 15.5 28 Z"
        fill="#f4f2ec"
      />
      <g className="avp avp-sway" style={{ transformOrigin: '50% 90%' }}>
        <path d="M24 3.5 L32.5 19.5 L15.5 19.5 Z" fill="#4b3591" />
        <ellipse cx="24" cy="19.8" rx="12.2" ry="3" fill="#5c43ad" />
        <path
          className="avp avp-twinkle"
          d="M24.6 9.5 L25.4 11.6 L27.5 12.4 L25.4 13.2 L24.6 15.3 L23.8 13.2 L21.7 12.4 L23.8 11.6 Z"
          fill="#ffe49a"
        />
      </g>
    </Glyph>
  ),
  monk: (
    <Glyph>
      <g className="avp avp-bob">
        <ellipse
          className="avp avp-pulse"
          cx="24"
          cy="7.5"
          rx="6.4"
          ry="1.9"
          fill="none"
          stroke="#ffe9b3"
          strokeWidth="1.4"
        />
        <circle cx="15.6" cy="19" r="1.7" fill="#eec39a" />
        <circle cx="32.4" cy="19" r="1.7" fill="#eec39a" />
        <circle cx="24" cy="19" r="8.6" fill="#eec39a" />
        <path
          d="M19.2 19.5 Q20.8 21 22.4 19.5 M25.6 19.5 Q27.2 21 28.8 19.5"
          stroke="#5d4632"
          strokeWidth="1.3"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M22.5 23.4 Q24 24.6 25.5 23.4"
          stroke="#5d4632"
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="round"
        />
        <path d="M12.5 43 C12.5 33.5 17 28.5 24 28.5 C31 28.5 35.5 33.5 35.5 43 Z" fill="#c2542f" />
        <path d="M24 28.5 C27 30.5 28.5 33.5 28 43 L24 43 Z" fill="#a84424" />
      </g>
    </Glyph>
  ),
  ninja: (
    <Glyph>
      <circle cx="24" cy="25" r="13.5" fill="#262c3e" stroke="#9aa6c2" strokeWidth="1" opacity="0.9" />
      <rect x="10.5" y="16.5" width="27" height="4" rx="2" fill="#d8474b" />
      <g className="avp avp-sway">
        <path d="M36 18.5 L43 15 L41 20.5 Z" fill="#d8474b" />
        <path d="M36 18.5 L43.5 20 L40 24 Z" fill="#b03a3e" />
      </g>
      <path
        d="M12.5 22.5 C17 21 31 21 35.5 22.5 C35.8 26.5 32 29.5 24 29.5 C16 29.5 12.2 26.5 12.5 22.5 Z"
        fill="#ecc99c"
      />
      <g className="avp avp-dart">
        <ellipse cx="19" cy="25" rx="1.9" ry="2.4" fill="#1c2130" />
        <ellipse cx="29" cy="25" rx="1.9" ry="2.4" fill="#1c2130" />
      </g>
      <path
        d="M15.8 21.8 L21.5 20.8 M32.2 21.8 L26.5 20.8"
        stroke="#1c2130"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </Glyph>
  ),
  koala: (
    <Glyph>
      <g className="avp avp-ear" style={{ animationDelay: '-3.1s' }}>
        <circle cx="10.5" cy="15" r="6.8" fill="#aab6c2" />
        <circle cx="10.5" cy="15" r="3.4" fill="#7d8896" />
      </g>
      <circle cx="37.5" cy="15" r="6.8" fill="#aab6c2" />
      <circle cx="37.5" cy="15" r="3.4" fill="#7d8896" />
      <circle cx="24" cy="26" r="13.5" fill="#c3ccd6" />
      <g className="avp avp-blink-slow" style={{ animationDelay: '-1.5s' }}>
        <circle cx="18.5" cy="23.5" r="1.7" fill="#2b3240" />
        <circle cx="29.5" cy="23.5" r="1.7" fill="#2b3240" />
      </g>
      <ellipse cx="24" cy="29.5" rx="3.6" ry="4.8" fill="#3a414f" />
      <ellipse cx="22.9" cy="27.8" rx="1" ry="1.6" fill="#5a6272" opacity="0.8" />
    </Glyph>
  ),
  bee: (
    <Glyph>
      <g className="avp avp-bob">
        {/* wings — static tilt on the wrapper, buzz on the ellipse itself */}
        <g transform="rotate(-30 13 20)">
          <ellipse className="avp avp-buzz" cx="13" cy="20" rx="8" ry="4.4" fill="rgba(240, 248, 255, 0.8)" />
        </g>
        <g transform="rotate(30 35 20)">
          <ellipse className="avp avp-buzz r" cx="35" cy="20" rx="8" ry="4.4" fill="rgba(240, 248, 255, 0.8)" />
        </g>
        {/* antennae */}
        <path
          d="M21 11.5 C20 9 18.5 7.5 16.5 7 M27 11.5 C28 9 29.5 7.5 31.5 7"
          stroke="#4a3b10"
          strokeWidth="1.3"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="16" cy="6.6" r="1.4" fill="#4a3b10" />
        <circle cx="32" cy="6.6" r="1.4" fill="#4a3b10" />
        {/* head */}
        <circle cx="24" cy="16.5" r="6.6" fill="#ffd44d" />
        <g className="avp avp-blink" style={{ animationDelay: '-2.9s' }}>
          <circle cx="21.6" cy="16" r="1.3" fill="#33280c" />
          <circle cx="26.4" cy="16" r="1.3" fill="#33280c" />
        </g>
        <path d="M22 19.2 Q24 20.8 26 19.2" stroke="#33280c" strokeWidth="1.1" fill="none" strokeLinecap="round" />
        {/* striped body */}
        <ellipse cx="24" cy="31" rx="9.5" ry="10.5" fill="#ffd44d" />
        <rect x="15.6" y="26.6" width="16.8" height="3.6" rx="1.8" fill="#3c2f0e" />
        <rect x="16.6" y="33" width="14.8" height="3.6" rx="1.8" fill="#3c2f0e" />
        {/* stinger */}
        <path d="M24 41.4 L22.4 44.2 L25.6 44.2 Z" fill="#3c2f0e" />
      </g>
    </Glyph>
  ),
  knight: (
    <Glyph>
      <g className="avp avp-sway" style={{ transformOrigin: '50% 100%', animationDuration: '2.6s' }}>
        <path d="M24 2.5 C20 6 18.5 9.5 19.5 13.5 L28.5 13.5 C29.5 9.5 28 6 24 2.5 Z" fill="#d8474b" />
      </g>
      <path
        d="M11.5 26 C11.5 15.5 16.5 10 24 10 C31.5 10 36.5 15.5 36.5 26 L36.5 36 C33 39.5 15 39.5 11.5 36 Z"
        fill="#c7d0e2"
      />
      <path
        d="M24 10 C16.5 10 11.5 15.5 11.5 26 L11.5 30 L15 30 L15 24 C15 17 18.5 13 24 12.6 Z"
        fill="#e6ecf7"
        opacity="0.7"
      />
      <rect x="22.4" y="9" width="3.2" height="5.5" rx="1.6" fill="#a8b3c9" />
      <rect x="14" y="23" width="20" height="3.6" rx="1.8" fill="#1c2130" />
      <g className="avp avp-dart">
        <circle cx="19.5" cy="24.8" r="1.2" fill="#9fdcff" />
        <circle cx="28.5" cy="24.8" r="1.2" fill="#9fdcff" />
      </g>
      <circle cx="20" cy="32" r="0.9" fill="#8a94ad" />
      <circle cx="24" cy="32.8" r="0.9" fill="#8a94ad" />
      <circle cx="28" cy="32" r="0.9" fill="#8a94ad" />
      <circle className="avp avp-twinkle" cx="31.5" cy="16" r="1.6" fill="#ffffff" />
    </Glyph>
  ),
  whale: (
    <Glyph>
      <g className="avp avp-bob">
        {/* spout — bursts every few seconds */}
        <g className="avp avp-spout">
          <path
            d="M22.5 13.5 C21 9.5 18.5 7.5 15.5 7.5 C18 6.3 20.6 6.8 22.3 8.6 C22 6.2 20.8 4.4 19 3.4 C22.3 3.7 24.6 6 24.5 9.4 C25.8 7.2 27.9 6.2 30.2 6.7 C27.3 7.8 25.4 9.9 24.8 13.5 Z"
            fill="#bfe3ff"
            opacity="0.9"
          />
        </g>
        {/* body */}
        <path
          d="M8 26.5 C8 19 15 14.5 23.5 14.5 C32 14.5 38.5 19.5 38.5 26.5 C38.5 31 35.5 34.5 30.5 34.5 L14.5 34.5 C10.5 34.5 8 31 8 26.5 Z"
          fill="#5b95c9"
        />
        {/* tail fluke */}
        <path
          d="M37.5 27.5 C39.5 24.5 42.5 23.4 45.3 24.6 C43.4 25.7 42.2 27.3 41.8 29.6 C40.2 28.4 38.7 28 37.5 28.3 Z"
          fill="#5b95c9"
        />
        {/* belly */}
        <path
          d="M10.3 30.8 C15 33.9 31 33.9 36.4 29.5 C35.2 32.6 33 34.5 30.5 34.5 L14.5 34.5 C12.6 34.5 11.2 33 10.3 30.8 Z"
          fill="#cfe6f5"
        />
        <g className="avp avp-blink" style={{ animationDelay: '-3.8s' }}>
          <circle cx="15.5" cy="24" r="1.6" fill="#12293d" />
        </g>
        <path d="M10.5 28 Q14 30 18 29" stroke="#3d6f9e" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      </g>
    </Glyph>
  ),
  dragonling: (
    // the Dragon's Lair dragon, wing-beat played from its sprite sheet
    <span className="av-live av-live-dragon" />
  ),
  sloth: (
    <Glyph>
      <g className="avp avp-sway" style={{ animationDuration: '7s' }}>
        <circle cx="24" cy="25" r="13.5" fill="#b59b7c" />
        <ellipse cx="24" cy="27" rx="9.5" ry="8" fill="#e3d3bb" />
        <path
          d="M13.5 21.5 C15.5 19.5 18 19.5 20 22 C18.5 24.5 15.5 24.7 13.5 23 Z"
          fill="#6d5942"
          transform="rotate(-14 17 22)"
        />
        <path
          d="M34.5 21.5 C32.5 19.5 30 19.5 28 22 C29.5 24.5 32.5 24.7 34.5 23 Z"
          fill="#6d5942"
          transform="rotate(14 31 22)"
        />
        <g
          className="avp avp-blink-slow"
          style={{ animationDuration: '8.8s', animationDelay: '-3.7s' }}
        >
          <circle cx="18" cy="22.3" r="1.5" fill="#2e2618" />
          <circle cx="30" cy="22.3" r="1.5" fill="#2e2618" />
        </g>
        <ellipse cx="24" cy="27.5" rx="2.4" ry="1.7" fill="#4a3c2a" />
        <path
          d="M20.5 31.5 Q24 34.5 27.5 31.5"
          stroke="#6d5942"
          strokeWidth="1.4"
          fill="none"
          strokeLinecap="round"
        />
      </g>
    </Glyph>
  ),
  polarbear: (
    <Glyph>
      {/* cold breath puffing from the muzzle */}
      <g className="avp avp-breath">
        <circle cx="12.5" cy="32.5" r="2.6" fill="#dff2fb" opacity="0.85" />
        <circle cx="8.5" cy="31" r="1.9" fill="#dff2fb" opacity="0.6" />
        <circle cx="10.5" cy="35.5" r="1.5" fill="#dff2fb" opacity="0.5" />
      </g>
      {/* ears */}
      <g className="avp avp-ear" style={{ animationDelay: '-1.1s' }}>
        <circle cx="13" cy="14" r="4.6" fill="#f4f8fa" />
        <circle cx="13" cy="14.5" r="2.2" fill="#b9cfd8" />
      </g>
      <circle cx="35" cy="14" r="4.6" fill="#f4f8fa" />
      <circle cx="35" cy="14.5" r="2.2" fill="#b9cfd8" />
      {/* head */}
      <circle cx="24" cy="26" r="13.2" fill="#f4f8fa" />
      {/* cheek fluff */}
      <path
        d="M12 30 C10.8 32 11 34 12.6 35.2 M36 30 C37.2 32 37 34 35.4 35.2"
        stroke="#d5e4ea"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
      />
      {/* eyes */}
      <g className="avp avp-blink" style={{ animationDelay: '-3s' }}>
        <circle cx="18.5" cy="23" r="1.9" fill="#22303a" />
        <circle cx="29.5" cy="23" r="1.9" fill="#22303a" />
      </g>
      {/* muzzle + nose + mouth */}
      <ellipse cx="24" cy="31" rx="6.8" ry="5.4" fill="#ffffff" />
      <ellipse cx="24" cy="29" rx="2.6" ry="1.9" fill="#22303a" />
      <path
        d="M24 31 Q24 33 22 33.6 M24 31 Q24 33 26 33.6"
        stroke="#22303a"
        strokeWidth="1.1"
        fill="none"
        strokeLinecap="round"
      />
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
