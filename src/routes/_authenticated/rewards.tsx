import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import {
  getProfile,
  getRecentSessions,
  updateProfile,
} from '@/lib/sessions.functions'
import {
  AVATARS,
  DEFAULT_THEME,
  THEMES,
  computeMilestones,
  isUnlocked,
  mergeMilestones,
  normalizeMilestones,
  unlockLabel,
  unlockProgress,
} from '@/lib/rewards'
import type { Milestones } from '@/lib/rewards'
import { applyTheme } from '@/lib/theme'
import { GRADE_NAMES, GRADE_THRESHOLDS } from '@/lib/stats'
import { Emblem3D } from '@/components/Emblem3D'
import { Avatar } from '@/components/avatars'
import { useToast } from '@/components/Toaster'

export const Route = createFileRoute('/_authenticated/rewards')({
  component: RewardsPage,
})

function RewardsPage() {
  const toast = useToast().toast
  const queryClient = useQueryClient()
  const getProfileFn = useServerFn(getProfile)
  const getRecentSessionsFn = useServerFn(getRecentSessions)
  const updateProfileFn = useServerFn(updateProfile)

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: () => getProfileFn(),
  })
  const sessionsQuery = useQuery({
    queryKey: ['sessions'],
    queryFn: () => getRecentSessionsFn(),
  })

  const milestones: Milestones = useMemo(() => {
    const stored = normalizeMilestones(profileQuery.data?.milestones)
    if (!sessionsQuery.data) return stored
    return mergeMilestones(stored, computeMilestones(sessionsQuery.data, new Date()))
  }, [profileQuery.data?.milestones, sessionsQuery.data])

  const [viewedGrade, setViewedGrade] = useState<number | null>(null)
  const shownGrade = viewedGrade ?? milestones.grade

  const themeMutation = useMutation({
    mutationFn: (theme: string) => updateProfileFn({ data: { theme } }),
    onSuccess: (_result, theme) => {
      // Patch the cache right away: if a follow-up apply fails before the
      // refetch lands, the rollback below must see the theme that actually
      // saved, not a stale pre-mutation value.
      queryClient.setQueryData(['profile'], (old: unknown) =>
        old ? { ...(old as Record<string, unknown>), theme } : old,
      )
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
    onError: async () => {
      toast('Could not save the theme — is the latest database migration applied?', 'error')
      // Roll the optimistic application back to the server's truth so the
      // visible theme, localStorage and the "Applied" indicator stay
      // consistent (the local cache may be stale, so refetch first).
      const fresh = await profileQuery.refetch()
      applyTheme(fresh.data?.theme ?? profileQuery.data?.theme ?? DEFAULT_THEME)
    },
  })

  const avatarMutation = useMutation({
    mutationFn: (avatar: string) => updateProfileFn({ data: { avatar } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
    onError: () =>
      toast('Could not save the avatar — is the latest database migration applied?', 'error'),
  })

  const selectTheme = (id: string) => {
    applyTheme(id) // instant, optimistic
    themeMutation.mutate(id)
  }

  if (profileQuery.isLoading || sessionsQuery.isLoading) {
    return (
      <div className="loading-screen">
        <span className="spinner" aria-hidden="true" />
        Opening the trophy room…
      </div>
    )
  }

  const currentTheme = profileQuery.data?.theme ?? 'amber'
  const currentAvatar = profileQuery.data?.avatar ?? 'spark'
  const gradeUnlocked = shownGrade <= milestones.grade

  return (
    <div>
      <h1 className="page-title">Rewards</h1>
      <p className="page-sub">
        Focus earns more than stats — unlock themes, avatars and emblems as you
        climb the grades.
      </p>

      {/* ---------------- 3D emblem showcase ---------------- */}
      <section className="card showcase-card" aria-label="Grade emblems in 3D">
        <div className="showcase-viewer">
          <Emblem3D level={shownGrade} locked={!gradeUnlocked} />
          <span className="drag-hint">
            <DragIcon /> drag to rotate — flip it over
          </span>
        </div>
        <div className="showcase-info">
          <h2 className="card-title">Grade emblems</h2>
          <div className={`showcase-name grade-${shownGrade}`}>
            {GRADE_NAMES[shownGrade]}
          </div>
          <p className="showcase-status">
            {gradeUnlocked ? (
              shownGrade === milestones.grade ? (
                <>Your current emblem — earned and on display.</>
              ) : (
                <>Earned on your way up. It still spins for you.</>
              )
            ) : (
              <>
                Locked — reach <strong>{GRADE_NAMES[shownGrade]}</strong>
                {GRADE_THRESHOLDS[shownGrade] ? (
                  <>
                    {' '}
                    with {GRADE_THRESHOLDS[shownGrade]} focused day
                    {GRADE_THRESHOLDS[shownGrade] === 1 ? '' : 's'} (2h+) in 30
                    days.
                  </>
                ) : (
                  '.'
                )}
              </>
            )}
          </p>
          <div className="grade-picker" role="group" aria-label="Preview a grade emblem">
            {GRADE_NAMES.map((name, i) => (
              <button
                key={name}
                type="button"
                className={`grade-chip grade-${i}${i === shownGrade ? ' active' : ''}${
                  i <= milestones.grade ? ' owned' : ''
                }`}
                aria-pressed={i === shownGrade}
                aria-label={`${name} — ${i <= milestones.grade ? 'earned' : 'locked'}`}
                onClick={() => setViewedGrade(i)}
              >
                {i <= milestones.grade ? <CheckIcon /> : <LockIcon />}
                {name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- themes ---------------- */}
      <section className="card mt-3" aria-label="Unlockable themes">
        <div className="gamify-head">
          <h2 className="card-title" style={{ marginBottom: 0 }}>
            Themes
          </h2>
          <span className="gamify-sub">
            grades and feats unlock new looks — animated worlds included
          </span>
        </div>
        <div className="theme-grid">
          {THEMES.map((t) => {
            const unlocked = isUnlocked(t.condition, milestones)
            const applied = currentTheme === t.id
            return (
              <div
                key={t.id}
                className={`theme-card${unlocked ? '' : ' locked'}${applied ? ' applied' : ''}`}
              >
                <div
                  className="theme-preview"
                  style={{ background: t.preview.bg }}
                  aria-hidden="true"
                >
                  <div className="tp-window" style={{ background: t.preview.surface }}>
                    <span
                      className="tp-dot"
                      style={{
                        background: `linear-gradient(180deg, ${t.preview.accentStrong}, ${t.preview.accent})`,
                      }}
                    />
                    <span className="tp-line long" />
                    <span className="tp-line" />
                    <span
                      className="tp-pill"
                      style={{
                        background: `linear-gradient(180deg, ${t.preview.accentStrong}, ${t.preview.accent})`,
                      }}
                    />
                  </div>
                </div>
                <div className="theme-meta">
                  <div className="theme-name">
                    {t.name}
                    {t.animated && (
                      <span className="theme-anim-chip" title="Ships a full-screen animated backdrop">
                        <SparkleIcon /> Animated
                      </span>
                    )}
                  </div>
                  <div className="theme-tagline">{t.tagline}</div>
                  <div className="reward-unlock">
                    {unlocked ? (
                      <button
                        type="button"
                        className={`btn btn-sm ${applied ? 'btn-ghost' : 'btn-primary'}`}
                        disabled={applied || themeMutation.isPending}
                        onClick={() => selectTheme(t.id)}
                      >
                        {applied ? 'Applied ✓' : 'Apply'}
                      </button>
                    ) : (
                      <LockedHint condition={t.condition} milestones={milestones} />
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ---------------- avatars ---------------- */}
      <section className="card mt-3" aria-label="Unlockable avatars">
        <div className="gamify-head">
          <h2 className="card-title" style={{ marginBottom: 0 }}>
            Avatars
          </h2>
          <span className="gamify-sub">shown next to your name in the header</span>
        </div>
        <div className="avatar-grid">
          {AVATARS.map((a) => {
            const unlocked = isUnlocked(a.condition, milestones)
            const selected = currentAvatar === a.id
            return (
              <div
                key={a.id}
                className={`avatar-card${unlocked ? '' : ' locked'}${selected ? ' selected' : ''}`}
              >
                <div className="avatar-disc-wrap">
                  <Avatar id={a.id} size={64} locked={!unlocked} />
                  {!unlocked && (
                    <span className="avatar-lock" aria-hidden="true">
                      <LockIcon />
                    </span>
                  )}
                </div>
                <div className="avatar-name">{a.name}</div>
                <div className="avatar-tagline">{a.tagline}</div>
                <div className="reward-unlock">
                  {unlocked ? (
                    <button
                      type="button"
                      className={`btn btn-sm ${selected ? 'btn-ghost' : 'btn-primary'}`}
                      disabled={selected || avatarMutation.isPending}
                      onClick={() => avatarMutation.mutate(a.id)}
                    >
                      {selected ? 'In use ✓' : 'Use'}
                    </button>
                  ) : (
                    <LockedHint condition={a.condition} milestones={milestones} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function LockedHint({
  condition,
  milestones,
}: {
  condition: Parameters<typeof unlockLabel>[0]
  milestones: Milestones
}) {
  const progress = Math.round(unlockProgress(condition, milestones) * 100)
  return (
    <div className="locked-hint">
      <span className="lh-label">
        <LockIcon /> {unlockLabel(condition)}
      </span>
      <div
        className="meter"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progress: ${progress}%`}
      >
        <span style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <rect x="5.5" y="11" width="13" height="9" rx="2" />
      <path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 12.5 10 18 19.5 6.5" />
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l2.2 6.2L20 10l-5.8 1.8L12 18l-2.2-6.2L4 10l5.8-1.8L12 2z" />
    </svg>
  )
}

function DragIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" />
    </svg>
  )
}
