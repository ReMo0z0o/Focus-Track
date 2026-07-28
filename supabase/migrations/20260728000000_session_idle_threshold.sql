-- Record the idle threshold in effect when each session starts, so the
-- profile can show the user's *favorite* threshold (focus-weighted mode over
-- their last 3 worked days) instead of just the current setting.
-- Nullable: rows from before this migration simply don't vote.
alter table public.focus_sessions
  add column if not exists idle_threshold_seconds integer
  check (idle_threshold_seconds is null or idle_threshold_seconds between 60 and 900);
