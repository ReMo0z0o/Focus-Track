-- Friends & usernames: display_name becomes a unique username, a friendships
-- table with request/accept flow, and RLS so accepted friends can read each
-- other's sessions (profiles become readable by any signed-in user so people
-- can be found by username).

-- ------------------------------------------------------------------
-- 1. display_name -> username (unique, normalized)
-- ------------------------------------------------------------------

alter table public.profiles rename column display_name to username;

-- Normalize existing values: lowercase, allowed charset, minimum length.
update public.profiles
set username = lower(regexp_replace(coalesce(username, ''), '[^a-zA-Z0-9_.-]', '', 'g'));

update public.profiles
set username = 'user_' || substr(id::text, 1, 6)
where username is null or char_length(username) < 3;

update public.profiles set username = left(username, 24)
where char_length(username) > 24;

-- Deduplicate collisions by suffixing part of the id.
with dupes as (
  select id,
         row_number() over (partition by username order by created_at, id) as rn
  from public.profiles
)
update public.profiles p
set username = left(p.username, 17) || '_' || substr(p.id::text, 1, 6)
from dupes d
where d.id = p.id and d.rn > 1;

alter table public.profiles
  alter column username set not null;

alter table public.profiles
  drop constraint if exists profiles_display_name_check;

alter table public.profiles
  add constraint profiles_username_format
    check (username ~ '^[a-z0-9_.-]{3,24}$');

create unique index profiles_username_key on public.profiles (username);

-- Profiles become readable by any signed-in user (username, avatar and
-- milestone high-water marks are the "public" social surface).
drop policy if exists "Users can view their own profile" on public.profiles;

create policy "Profiles are viewable by signed-in users"
  on public.profiles for select
  to authenticated
  using (true);

-- ------------------------------------------------------------------
-- 2. signup trigger generates a unique username
-- ------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  candidate text;
  attempt int := 0;
begin
  base := lower(regexp_replace(
    coalesce(
      new.raw_user_meta_data->>'username',
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)
    ),
    '[^a-zA-Z0-9_.-]', '', 'g'
  ));
  if base is null or char_length(base) < 3 then
    base := 'user_' || substr(new.id::text, 1, 6);
  end if;
  base := left(base, 24);

  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    attempt := attempt + 1;
    candidate := left(base, 17) || '_' || substr(md5(random()::text), 1, 6);
    exit when attempt > 10;
  end loop;

  insert into public.profiles (id, username)
  values (new.id, candidate);
  return new;
end;
$$;

-- ------------------------------------------------------------------
-- 3. friendships
-- ------------------------------------------------------------------

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);

-- One relationship per pair, regardless of direction.
create unique index friendships_pair_key
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create index friendships_addressee_idx on public.friendships (addressee_id, status);
create index friendships_requester_idx on public.friendships (requester_id, status);

alter table public.friendships enable row level security;

create policy "Members can view their friendships"
  on public.friendships for select
  using (auth.uid() in (requester_id, addressee_id));

create policy "Users can send friend requests"
  on public.friendships for insert
  with check (auth.uid() = requester_id and status = 'pending');

create policy "Addressee can accept requests"
  on public.friendships for update
  using (auth.uid() = addressee_id)
  with check (auth.uid() = addressee_id and status = 'accepted');

create policy "Members can remove their friendships"
  on public.friendships for delete
  using (auth.uid() in (requester_id, addressee_id));

-- ------------------------------------------------------------------
-- 4. accepted friends can read each other's sessions
-- ------------------------------------------------------------------

create policy "Friends can view sessions"
  on public.focus_sessions for select
  using (
    exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and (
          (f.requester_id = auth.uid() and f.addressee_id = focus_sessions.user_id)
          or (f.addressee_id = auth.uid() and f.requester_id = focus_sessions.user_id)
        )
    )
  );
