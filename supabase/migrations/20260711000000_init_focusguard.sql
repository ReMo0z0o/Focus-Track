-- FocusGuard initial schema: profiles, focus_sessions, RLS, signup trigger.

-- ------------------------------------------------------------------
-- profiles
-- ------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 80),
  idle_threshold_seconds integer not null default 120
    check (idle_threshold_seconds between 60 and 900),
  sound_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can delete their own profile"
  on public.profiles for delete
  using (auth.uid() = id);

-- ------------------------------------------------------------------
-- focus_sessions
-- ------------------------------------------------------------------

create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  focus_seconds integer not null default 0 check (focus_seconds >= 0),
  idle_seconds integer not null default 0 check (idle_seconds >= 0),
  resumes_count integer not null default 0 check (resumes_count >= 0),
  created_at timestamptz not null default now()
);

create index focus_sessions_user_started_idx
  on public.focus_sessions(user_id, started_at desc);

alter table public.focus_sessions enable row level security;

create policy "Users can view their own sessions"
  on public.focus_sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own sessions"
  on public.focus_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own sessions"
  on public.focus_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own sessions"
  on public.focus_sessions for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------------
-- auto-create a profile on signup
-- ------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)), 80)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
