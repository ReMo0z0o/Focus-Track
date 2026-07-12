import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { getProfile, updateProfile } from '@/lib/sessions.functions'
import { useToast } from '@/components/Toaster'

export const Route = createFileRoute('/_authenticated/settings')({
  component: SettingsPage,
})

const THRESHOLD_MIN = 60
const THRESHOLD_MAX = 900
const THRESHOLD_STEP = 30

const PRESETS = [
  { label: '1 min', value: 60 },
  { label: '2 min', value: 120 },
  { label: '5 min', value: 300 },
  { label: '10 min', value: 600 },
  { label: '15 min', value: 900 },
]

function fmtThreshold(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s === 0 ? `${m} min` : `${m} min ${s.toString().padStart(2, '0')}s`
}

function SettingsPage() {
  const toast = useToast().toast
  const queryClient = useQueryClient()
  const getProfileFn = useServerFn(getProfile)
  const updateProfileFn = useServerFn(updateProfile)

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: () => getProfileFn(),
  })

  const [displayName, setDisplayName] = useState('')
  const [threshold, setThreshold] = useState(120)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [hydrated, setHydrated] = useState(false)

  // Populate the form once the profile arrives (only the first time, so we
  // don't clobber in-progress edits on refetch).
  useEffect(() => {
    if (profileQuery.data && !hydrated) {
      setDisplayName(profileQuery.data.display_name ?? '')
      setThreshold(profileQuery.data.idle_threshold_seconds)
      setSoundEnabled(profileQuery.data.sound_enabled)
      setHydrated(true)
    }
  }, [profileQuery.data, hydrated])

  const saveMutation = useMutation({
    mutationFn: () =>
      updateProfileFn({
        data: {
          display_name: displayName,
          idle_threshold_seconds: threshold,
          sound_enabled: soundEnabled,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
      toast('Settings saved', 'success')
    },
    onError: () => toast('Could not save settings.', 'error'),
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    saveMutation.mutate()
  }

  if (profileQuery.isLoading) {
    return (
      <div className="loading-screen">
        <span className="spinner" aria-hidden="true" />
        Loading settings…
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <h1 className="page-title">Settings</h1>
      <p className="page-sub">Tune how FocusGuard watches over your sessions.</p>

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="field">
            <label htmlFor="displayName">Display name</label>
            <input
              id="displayName"
              className="input"
              type="text"
              maxLength={80}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How should we call you?"
            />
          </div>

          <div className="field" style={{ marginTop: '1.4rem' }}>
            <label htmlFor="threshold">
              Idle threshold — <strong>{fmtThreshold(threshold)}</strong>
            </label>
            <p
              style={{
                fontSize: '0.82rem',
                color: 'var(--text-faint)',
                marginBottom: '0.6rem',
              }}
            >
              How long you can go without activity before FocusGuard asks if
              you're still there.
            </p>
            <input
              id="threshold"
              className="range"
              type="range"
              min={THRESHOLD_MIN}
              max={THRESHOLD_MAX}
              step={THRESHOLD_STEP}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
            <div className="preset-row">
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className={`preset${threshold === p.value ? ' active' : ''}`}
                  onClick={() => setThreshold(p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="toggle-row" style={{ marginTop: '1.6rem' }}>
            <div className="toggle-text">
              <div className="t-label">Sound on reminders</div>
              <div className="t-sub">
                A soft chime when an inactivity check or pause kicks in.
              </div>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
                aria-label="Sound on reminders"
              />
              <span className="track-el" />
              <span className="thumb" />
            </label>
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-lg mt-2"
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? 'Saving…' : 'Save settings'}
        </button>
      </form>
    </div>
  )
}
