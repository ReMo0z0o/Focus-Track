import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { deleteSession, getRecentSessions } from '@/lib/sessions.functions'
import {
  APP_LOCALE,
  concentrationSeries,
  dailyBuckets,
  dayKey,
  filterSince,
  fmtDuration,
  fmtPercent,
  hourlyBuckets,
  periodStart,
  startOfDay,
  summarize,
} from '@/lib/stats'
import type { Period, SessionRow } from '@/lib/stats'
import { ConcentrationChart, FocusPauseChart } from '@/components/charts'
import type { StackedBucket } from '@/components/charts'
import { GradeBadges } from '@/components/GradeBadges'
import { useToast } from '@/components/Toaster'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
]

const CONCENTRATION_DAYS: Record<Period, number> = {
  day: 7,
  week: 14,
  month: 30,
}

export function StatsView() {
  const toast = useToast().toast
  const queryClient = useQueryClient()
  const getRecentSessionsFn = useServerFn(getRecentSessions)
  const deleteSessionFn = useServerFn(deleteSession)

  const [period, setPeriod] = useState<Period>('week')

  const sessionsQuery = useQuery({
    queryKey: ['sessions'],
    queryFn: () => getRecentSessionsFn(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSessionFn({ data: { id } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
      toast('Session deleted')
    },
    onError: () => toast('Could not delete the session.', 'error'),
  })

  const sessions = sessionsQuery.data ?? []
  const now = new Date()

  const inPeriod = useMemo(
    () => filterSince(sessions, periodStart(period, now)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions, period],
  )

  const totals = useMemo(() => summarize(inPeriod), [inPeriod])

  const concentrationPoints = useMemo(
    () => concentrationSeries(sessions, CONCENTRATION_DAYS[period], now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions, period],
  )

  const stackedBuckets = useMemo<StackedBucket[]>(() => {
    if (period === 'day') {
      return hourlyBuckets(inPeriod, now).map((b) => ({
        label: `${b.hour}h`,
        detail: `${b.hour}:00 – ${b.hour + 1}:00`,
        focus: b.focus,
        idle: b.idle,
      }))
    }
    const days = period === 'week' ? 7 : 30
    return dailyBuckets(inPeriod, days, now).map((b) => ({
      label:
        days === 7
          ? b.date.toLocaleDateString(APP_LOCALE, { weekday: 'short' })
          : `${b.date.getDate()}`,
      detail: b.date.toLocaleDateString(APP_LOCALE, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      focus: b.focus,
      idle: b.idle,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inPeriod, period])

  if (sessionsQuery.isLoading) {
    return (
      <div className="loading-screen">
        <span className="spinner" aria-hidden="true" />
        Crunching your numbers…
      </div>
    )
  }

  if (sessionsQuery.isError) {
    return (
      <div className="chart-empty">
        Couldn't load your sessions.{' '}
        <button
          type="button"
          style={{ color: 'var(--accent-strong)', textDecoration: 'underline' }}
          onClick={() => void sessionsQuery.refetch()}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="stats-header-row">
        <div>
          <h1 className="page-title">Statistics</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Focus vs. pause, honestly accounted.
          </p>
        </div>
        <div className="seg-control" role="group" aria-label="Period">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={period === p.key}
              className={period === p.key ? 'active' : ''}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* period totals */}
      <div className="tile-grid">
        <div className="tile">
          <div className="tile-label">Focus</div>
          <div className="tile-value accent">{fmtDuration(totals.focus)}</div>
        </div>
        <div className="tile">
          <div className="tile-label">Pause</div>
          <div className="tile-value pause">{fmtDuration(totals.idle)}</div>
        </div>
        <div className="tile">
          <div className="tile-label">Sessions</div>
          <div className="tile-value">{totals.sessions}</div>
        </div>
        <div className="tile">
          <div className="tile-label">Pause / focus</div>
          <div className="tile-value">{fmtPercent(totals.ratio)}</div>
          <div className="tile-hint">lower is better</div>
        </div>
        <div className="tile">
          <div className="tile-label">Concentration</div>
          <div className="tile-value">{totals.concentration}</div>
          <div className="tile-hint">avg run vs 2h target</div>
        </div>
      </div>

      {/* charts */}
      <div className="charts-grid">
        <div className="card">
          <h2 className="card-title">
            Concentration — last {CONCENTRATION_DAYS[period]} days
          </h2>
          <ConcentrationChart points={concentrationPoints} />
        </div>
        <div className="card">
          <h2 className="card-title">
            Focus vs pause —{' '}
            {period === 'day' ? 'today by hour' : period === 'week' ? 'last 7 days' : 'last 30 days'}
          </h2>
          <FocusPauseChart buckets={stackedBuckets} />
        </div>
      </div>

      <GradeBadges sessions={sessions} now={now} />

      <SessionList
        sessions={sessions}
        now={now}
        onDelete={(id) => deleteMutation.mutate(id)}
        deletingId={deleteMutation.isPending ? (deleteMutation.variables ?? null) : null}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Session list                                                        */
/* ------------------------------------------------------------------ */

function SessionList({
  sessions,
  now,
  onDelete,
  deletingId,
}: {
  sessions: SessionRow[]
  now: Date
  onDelete: (id: string) => void
  deletingId: string | null
}) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const groups = useMemo(() => {
    const byDay = new Map<string, { label: string; rows: SessionRow[] }>()
    const todayKey = dayKey(startOfDay(now))
    const yesterdayKey = dayKey(new Date(startOfDay(now).getTime() - 86_400_000))
    for (const s of sessions) {
      const d = new Date(s.started_at)
      const key = dayKey(d)
      if (!byDay.has(key)) {
        const label =
          key === todayKey
            ? 'Today'
            : key === yesterdayKey
              ? 'Yesterday'
              : d.toLocaleDateString(APP_LOCALE, {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })
        byDay.set(key, { label, rows: [] })
      }
      byDay.get(key)!.rows.push(s)
    }
    return [...byDay.values()]
  }, [sessions, now])

  if (sessions.length === 0) {
    return (
      <div className="card mt-3">
        <h2 className="card-title">Sessions</h2>
        <div className="chart-empty">
          No sessions yet. Start one from the Session page.
        </div>
      </div>
    )
  }

  return (
    <div className="session-table">
      <h2 className="card-title mt-3">Sessions ({sessions.length})</h2>
      {groups.map((g) => (
        <div key={g.label}>
          <div className="day-group-label">{g.label}</div>
          {g.rows.map((s) => (
            <div key={s.id} className="session-row">
              <span className="time">
                {new Date(s.started_at).toLocaleTimeString(APP_LOCALE, {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <span className="metric focus">
                {fmtDuration(s.focus_seconds)}
                <small>focus</small>
              </span>
              <span className="metric pause">
                {fmtDuration(s.idle_seconds)}
                <small>pause</small>
              </span>
              <span className="resumes">
                {s.ended_at === null
                  ? 'in progress'
                  : `${s.resumes_count} resume${s.resumes_count === 1 ? '' : 's'}`}
              </span>
              <span className="spacer" />
              {confirmingId === s.id ? (
                <>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={deletingId === s.id}
                    autoFocus
                    onClick={() => {
                      onDelete(s.id)
                      setConfirmingId(null)
                    }}
                  >
                    Confirm delete
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setConfirmingId(null)}
                  >
                    Keep
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={deletingId === s.id}
                  onClick={() => setConfirmingId(s.id)}
                >
                  {deletingId === s.id ? 'Deleting…' : 'Delete'}
                </button>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
