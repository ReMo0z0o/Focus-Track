import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { getProfile, updateProfile } from '@/lib/sessions.functions'
import {
  DEFAULT_REMINDER_SOUND,
  REMINDER_SOUNDS,
  ambienceEnabled,
  playReminderSound,
  setAmbienceEnabled,
  startAmbience,
  stopAmbience,
} from '@/lib/audio'
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

  const [username, setUsername] = useState('')
  const [threshold, setThreshold] = useState(120)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [reminderSound, setReminderSound] = useState(DEFAULT_REMINDER_SOUND)
  const [hydrated, setHydrated] = useState(false)
  // device-level, so it lives in localStorage rather than the profile
  const [ambience, setAmbience] = useState(false)
  const [streetTheme, setStreetTheme] = useState(false)

  useEffect(() => {
    setAmbience(ambienceEnabled())
    setStreetTheme(document.documentElement.dataset.theme === 'street')
    const el = document.documentElement
    const read = () => setStreetTheme(el.dataset.theme === 'street')
    const observer = new MutationObserver(read)
    observer.observe(el, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  // Populate the form once the profile arrives (only the first time, so we
  // don't clobber in-progress edits on refetch).
  useEffect(() => {
    if (profileQuery.data && !hydrated) {
      setUsername(profileQuery.data.username ?? '')
      setThreshold(profileQuery.data.idle_threshold_seconds)
      setSoundEnabled(profileQuery.data.sound_enabled)
      setReminderSound(profileQuery.data.reminder_sound ?? DEFAULT_REMINDER_SOUND)
      setHydrated(true)
    }
  }, [profileQuery.data, hydrated])

  const saveMutation = useMutation({
    mutationFn: () => {
      const nextUsername = username.trim().toLowerCase()
      // Only send username when it actually changed — a pre-migration DB has
      // no username column, so an unconditional write would break every save.
      const usernameChanged =
        nextUsername.length > 0 &&
        nextUsername !== (profileQuery.data?.username ?? '')
      // Same guard as username: only send when changed so a pre-migration
      // DB (no reminder_sound column) can still save the other settings.
      const soundChanged =
        reminderSound !==
        (profileQuery.data?.reminder_sound ?? DEFAULT_REMINDER_SOUND)
      return updateProfileFn({
        data: {
          ...(usernameChanged ? { username: nextUsername } : {}),
          ...(soundChanged ? { reminder_sound: reminderSound } : {}),
          idle_threshold_seconds: threshold,
          sound_enabled: soundEnabled,
        },
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
      toast('Settings saved', 'success')
    },
    onError: (err) =>
      toast(
        err instanceof Error && err.message && !/fetch/i.test(err.message)
          ? err.message
          : 'Could not save settings.',
        'error',
      ),
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
            <label htmlFor="username">Username</label>
            <p
              style={{
                fontSize: '0.82rem',
                color: 'var(--text-faint)',
                marginBottom: '0.4rem',
              }}
            >
              Your public handle — friends add you with it. 3–24 characters:
              lowercase letters, digits, "_", "." or "-".
            </p>
            <input
              id="username"
              className="input"
              type="text"
              maxLength={24}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              pattern="[a-z0-9_.\-]{3,24}"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="ada.lovelace"
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

          <div
            className={`field sound-picker${soundEnabled ? '' : ' muted'}`}
            style={{ marginTop: '1.2rem' }}
          >
            <label id="reminder-sound-label">Reminder sound</label>
            <p
              style={{
                fontSize: '0.82rem',
                color: 'var(--text-faint)',
                marginBottom: '0.6rem',
              }}
            >
              Pick the sound that calls you back — click one to hear it.
            </p>
            <div
              className="sound-grid"
              role="radiogroup"
              aria-labelledby="reminder-sound-label"
            >
              {REMINDER_SOUNDS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={reminderSound === s.id}
                  className={`sound-chip${reminderSound === s.id ? ' active' : ''}`}
                  title={s.description}
                  onClick={() => {
                    setReminderSound(s.id)
                    playReminderSound(s.id)
                  }}
                >
                  <SpeakerIcon />
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          {streetTheme && (
            <div className="toggle-row" style={{ marginTop: '1.6rem' }}>
              <div className="toggle-text">
                <div className="t-label">Warehouse ambience</div>
                <div className="t-sub">
                  Steady white noise under the Street Art theme — nothing with a
                  pitch to it. Off by default.
                </div>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={ambience}
                  onChange={(e) => {
                    const on = e.target.checked
                    setAmbience(on)
                    setAmbienceEnabled(on)
                    // browsers only start audio from a real gesture — this is it
                    if (on) startAmbience()
                    else stopAmbience()
                  }}
                  aria-label="Warehouse ambience"
                />
                <span className="track-el" />
                <span className="thumb" />
              </label>
            </div>
          )}
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

function SpeakerIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 9.5 H8 L13 5 V19 L8 14.5 H4 Z" fill="currentColor" stroke="none" />
      <path d="M16.5 9 C17.8 10.6 17.8 13.4 16.5 15" />
      <path d="M19 6.5 C21.4 9.4 21.4 14.6 19 17.5" />
    </svg>
  )
}
