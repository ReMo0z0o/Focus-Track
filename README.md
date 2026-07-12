# FocusGuard

A focus timer that keeps you honest. Start a session and work — FocusGuard
watches for inactivity, gives you a **15-second grace window** to wave back,
then pauses the timer until you actually return. Focus time and pause time are
tracked separately, feeding daily/weekly/monthly stats, streaks, grades and
badges.

## How it works

1. **Start a session.** The focus clock starts counting.
2. **Idle detection.** When available (Chromium, secure context, permission
   granted) the native `IdleDetector` API notices system-wide keyboard/mouse
   activity and screen locks. Everywhere else an in-page fallback watches
   mouse/keyboard/touch/scroll events against your configurable threshold
   (1–15 min).
3. **Grace period.** On inactivity you get a 15-second countdown ring
   (plus an optional chime and a system notification). Move the mouse or click
   *"I'm here"* and nothing happened — the focus clock never stopped.
4. **Confirmed pause.** Miss the grace window (or press <kbd>P</kbd> for a
   manual pause) and the focus clock freezes; only pause time accumulates until
   you explicitly click **Resume**. Each confirmed resume is counted.
5. **Honest accounting.** The timer works on `Date.now()` deltas, so it stays
   correct through background-tab throttling. Gaps longer than 90s (machine
   sleep, frozen tab) are credited to pause time retroactively.

## Stats & gamification

- Period totals (day / week / month): focus, pause, sessions, pause-ratio, and
  a **concentration score** — your average uninterrupted focus run measured
  against a 2-hour target.
- Charts: concentration per day (7/14/30 days) and stacked focus-vs-pause bars
  (hourly for today, daily for week/month).
- **Grade** (Ember → Lighthouse): days with 2h+ of focus in the last 30 days.
- **Streak**: consecutive 2h+ days.
- **Badges** (Bronze → Diamond): 3-day concentration and 3-day pause-ratio.

## Stack

- [TanStack Start](https://tanstack.com/start) v1 — React 19, SSR, file-based
  routing, Vite 7.
- [Supabase](https://supabase.com) (Lovable Cloud) — email/password auth,
  Postgres with row-level security.
- Server functions (`createServerFn`) guarded by a `requireSupabaseAuth`
  middleware: the client attaches the session's access token, the server
  verifies it and queries through an RLS-scoped client.
- `@tanstack/react-query` for data fetching, Web Notifications + Web Audio for
  reminders.

## Getting started

```bash
npm install
cp .env.example .env   # fill in your Supabase URL + publishable key
npm run dev
```

Apply the database schema in `supabase/migrations/` to your project (Supabase
SQL editor or `supabase db push`). It creates `profiles` and `focus_sessions`
with per-user RLS policies and a trigger that provisions a profile on signup.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with SSR + HMR |
| `npm run build` | Production build (`.output/`) |
| `npm run start` | Serve the production build |
| `npm run test` | Unit tests (stats/aggregation logic) |
| `npm run typecheck` | `tsc --noEmit` |

## Project layout

```
src/
  routes/                    # file-based routes (createFileRoute)
    __root.tsx               # document shell, auth context, providers
    index.tsx                # landing page
    login.tsx                # email/password sign-in & sign-up
    _authenticated.tsx       # guarded layout + navigation
    _authenticated/app.tsx   # the focus session (grace/pause state machine)
    _authenticated/stats.tsx
    _authenticated/settings.tsx
  hooks/use-idle-detector.ts # native IdleDetector + fallback
  lib/
    sessions.functions.ts    # server functions (auth-guarded RPCs)
    supabase-auth.ts         # requireSupabaseAuth middleware
    stats.ts                 # pure aggregation & formatting (unit-tested)
    audio.ts                 # reminder chime (Web Audio)
  components/                # StatsView, charts, toasts, brand
  integrations/supabase/     # generated-style Supabase client + DB types
supabase/migrations/         # schema, RLS policies, signup trigger
```

## Notable design decisions

- **Grace ≠ pause.** The focus clock keeps running during the 15s grace
  window; cancelling it doesn't count as a resume. Only a confirmed pause
  freezes focus time — and it stays frozen until an explicit Resume, even if
  the mouse moves.
- **Sleep gap raised to 90s** (spec suggested 30s): Chrome throttles
  background-tab timers to one wake per minute, so a 30s cutoff would misfile
  minutes worked in another window as sleep. 90s cleanly separates throttling
  from real machine sleep.
- **Late-tick reclassification.** If the pause is confirmed late (throttled
  tab), the overshoot is moved from focus to pause so the books stay honest.
- **Manual pause is quiet** — chime only (if enabled), never a system
  notification.
