import { DEFAULT_THEME, THEME_IDS } from '@/lib/rewards'

const STORAGE_KEY = 'focusguard.theme'

/**
 * Apply a color theme by stamping `data-theme` on <html> and remembering it
 * in localStorage so the next page load paints correctly before the profile
 * arrives (see the inline boot script in __root.tsx).
 */
export function applyTheme(themeId: string): void {
  if (typeof document === 'undefined') return
  const id = THEME_IDS.includes(themeId) ? themeId : DEFAULT_THEME
  if (id === DEFAULT_THEME) {
    delete document.documentElement.dataset.theme
  } else {
    document.documentElement.dataset.theme = id
  }
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // best effort
  }
}

/**
 * Inline <script> body that restores the saved theme before first paint.
 * Kept dependency-free and tiny; mirrored by applyTheme above.
 */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)});if(t&&t!=='${DEFAULT_THEME}')document.documentElement.dataset.theme=t}catch(e){}`
