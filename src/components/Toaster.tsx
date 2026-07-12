import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'

type ToastKind = 'default' | 'success' | 'error'

interface Toast {
  id: number
  message: string
  kind: ToastKind
}

interface ToastAPI {
  toast: (message: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastAPI>({ toast: () => {} })

export function useToast(): ToastAPI {
  return useContext(ToastContext)
}

const TOAST_DURATION_MS = 3800

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const toast = useCallback((message: string, kind: ToastKind = 'default') => {
    const id = nextId.current++
    setToasts((prev) => [...prev.slice(-2), { id, message, kind }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, TOAST_DURATION_MS)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Live region stays mounted so assistive tech announces every toast,
          including the first one. */}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast${t.kind !== 'default' ? ` ${t.kind}` : ''}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
