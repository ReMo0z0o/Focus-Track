-- Selectable inactivity reminder sound (see src/lib/audio.ts for the
-- catalog; the value is a client-validated token, unknown ids fall back
-- to the default chime).

alter table public.profiles
  add column if not exists reminder_sound text not null default 'chime'
    check (char_length(reminder_sound) <= 40);
