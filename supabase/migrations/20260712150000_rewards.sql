-- Unlockable rewards: selected theme & avatar, plus persistent milestone
-- high-water marks (best grade / streak / badge tiers / session count) so
-- unlocked rewards never regress with recent form.

alter table public.profiles
  add column if not exists theme text not null default 'amber'
    check (char_length(theme) <= 40),
  add column if not exists avatar text not null default 'spark'
    check (char_length(avatar) <= 40),
  add column if not exists milestones jsonb not null default '{}'::jsonb;
