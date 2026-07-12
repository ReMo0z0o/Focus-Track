import { Link } from '@tanstack/react-router'

/** Timer-in-a-shield mark: an open ring with a "guarded" tick of progress. */
export function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.28"
        strokeWidth="2.6"
      />
      <path
        d="M12 3 a9 9 0 0 1 8.6 6.3"
        stroke="#f6ac3d"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="3.1" fill="#f6ac3d" />
    </svg>
  )
}

export function Brand({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="brand" aria-label="FocusGuard home">
      <BrandMark />
      <span>FocusGuard</span>
    </Link>
  )
}
