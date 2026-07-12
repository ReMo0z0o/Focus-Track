-- Security hardening for the friendships UPDATE path.
-- Safe to run whether or not 20260713000000_friends.sql already applied the
-- corrected version (idempotent).
--
-- The original "Addressee can accept requests" policy pinned only
-- addressee_id and status in WITH CHECK. Because WITH CHECK cannot inspect
-- the OLD row, a caller who legitimately owns a pending row (as addressee)
-- could PATCH it to rewrite requester_id to an arbitrary victim and set
-- status='accepted', forging an accepted friendship and gaining read access
-- to the victim's focus_sessions. We fix this two ways:
--   1. Column-level UPDATE privilege: authenticated users may only write
--      status and responded_at, never the identity columns.
--   2. The policy USING clause now requires the row to still be pending.

drop policy if exists "Addressee can accept requests" on public.friendships;

create policy "Addressee can accept requests"
  on public.friendships for update
  using (auth.uid() = addressee_id and status = 'pending')
  with check (auth.uid() = addressee_id and status = 'accepted');

revoke update on public.friendships from authenticated;
grant update (status, responded_at) on public.friendships to authenticated;
