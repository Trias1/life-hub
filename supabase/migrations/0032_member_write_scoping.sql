-- Scope member writes to the rows they own. Before this, any workspace member could call PostgREST
-- directly (publishable key + their own session) to re-own and hard-delete other people's tasks, rewrite
-- or delete other people's comments, labels, file versions and share links, and add/answer RSVPs for
-- anyone. The app's server actions already enforce these rules; this makes the database agree.
-- Apply after 0031.
begin;

-- 1. Tasks: no forged creator on insert, and creator/workspace can't be reassigned afterwards
--    (re-owning a task was the way around the "creators can delete tasks" policy).
drop policy if exists "workspace members can create tasks" on public.tasks;
create policy "workspace members can create tasks" on public.tasks
for insert with check (
  created_by = auth.uid()
  and exists (select 1 from public.workspace_members member where member.workspace_id = tasks.workspace_id and member.user_id = auth.uid())
);

drop policy if exists "workspace members can update tasks" on public.tasks;
create policy "workspace members can update tasks" on public.tasks
for update
using (exists (select 1 from public.workspace_members member where member.workspace_id = tasks.workspace_id and member.user_id = auth.uid()))
with check (exists (select 1 from public.workspace_members member where member.workspace_id = tasks.workspace_id and member.user_id = auth.uid()));

-- Server-side jobs (service role, no auth.uid()) are exempt, e.g. "on delete set null" when a user is removed.
create or replace function public.prevent_owner_reassignment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.workspace_id is distinct from old.workspace_id
    or to_jsonb(new) ->> tg_argv[0] is distinct from to_jsonb(old) ->> tg_argv[0] then
    raise exception 'Owner and workspace cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_prevent_owner_reassignment on public.tasks;
create trigger tasks_prevent_owner_reassignment before update on public.tasks
for each row execute function public.prevent_owner_reassignment('created_by');

-- 2. Task comments: members read and add; only the author edits or deletes.
drop policy if exists "members manage task comments" on public.task_comments;
create policy "members read task comments" on public.task_comments
for select using (exists (select 1 from public.tasks task join public.workspace_members member on member.workspace_id = task.workspace_id where task.id = task_comments.task_id and member.user_id = auth.uid()));
create policy "members add task comments" on public.task_comments
for insert with check (author_id = auth.uid() and exists (select 1 from public.tasks task join public.workspace_members member on member.workspace_id = task.workspace_id where task.id = task_comments.task_id and member.user_id = auth.uid()));
create policy "authors update task comments" on public.task_comments
for update using (author_id = auth.uid()) with check (author_id = auth.uid() and exists (select 1 from public.tasks task join public.workspace_members member on member.workspace_id = task.workspace_id where task.id = task_comments.task_id and member.user_id = auth.uid()));
create policy "authors delete task comments" on public.task_comments
for delete using (author_id = auth.uid());

-- 3. Task labels: members read and create; the creator or a workspace admin edits or deletes.
drop policy if exists "members manage task labels" on public.task_labels;
create policy "members read task labels" on public.task_labels
for select using (exists (select 1 from public.workspace_members member where member.workspace_id = task_labels.workspace_id and member.user_id = auth.uid()));
create policy "members create task labels" on public.task_labels
for insert with check (created_by = auth.uid() and exists (select 1 from public.workspace_members member where member.workspace_id = task_labels.workspace_id and member.user_id = auth.uid()));
create policy "owners update task labels" on public.task_labels
for update
using (created_by = auth.uid() or exists (select 1 from public.workspace_members member where member.workspace_id = task_labels.workspace_id and member.user_id = auth.uid() and member.role in ('admin', 'super_admin')))
with check (exists (select 1 from public.workspace_members member where member.workspace_id = task_labels.workspace_id and member.user_id = auth.uid()));
create policy "owners delete task labels" on public.task_labels
for delete using (created_by = auth.uid() or exists (select 1 from public.workspace_members member where member.workspace_id = task_labels.workspace_id and member.user_id = auth.uid() and member.role in ('admin', 'super_admin')));

-- 4. File versions: the referenced file must be in the same workspace; only the uploader changes a version.
drop policy if exists "members manage file versions" on public.file_versions;
create policy "members read file versions" on public.file_versions
for select using (exists (select 1 from public.workspace_members member where member.workspace_id = file_versions.workspace_id and member.user_id = auth.uid()));
create policy "members add file versions" on public.file_versions
for insert with check (
  uploader_id = auth.uid()
  and exists (select 1 from public.workspace_members member where member.workspace_id = file_versions.workspace_id and member.user_id = auth.uid())
  and exists (select 1 from public.files file where file.id = file_versions.file_id and file.workspace_id = file_versions.workspace_id)
);
create policy "uploaders update file versions" on public.file_versions
for update using (uploader_id = auth.uid())
with check (uploader_id = auth.uid() and exists (select 1 from public.files file where file.id = file_versions.file_id and file.workspace_id = file_versions.workspace_id));
create policy "uploaders delete file versions" on public.file_versions
for delete using (uploader_id = auth.uid());

-- 5. File shares: links can't be re-owned or have their expiry lifted. No update policy at all;
--    the creator, the file's uploader or a workspace admin can revoke.
drop policy if exists "members manage file shares" on public.file_shares;
create policy "members read file shares" on public.file_shares
for select using (exists (select 1 from public.workspace_members member where member.workspace_id = file_shares.workspace_id and member.user_id = auth.uid()));
create policy "members create file shares" on public.file_shares
for insert with check (
  created_by = auth.uid()
  and exists (select 1 from public.workspace_members member where member.workspace_id = file_shares.workspace_id and member.user_id = auth.uid())
  and exists (select 1 from public.files file where file.id = file_shares.file_id and file.workspace_id = file_shares.workspace_id)
);
create policy "owners revoke file shares" on public.file_shares
for delete using (
  created_by = auth.uid()
  or exists (select 1 from public.files file where file.id = file_shares.file_id and file.uploader_id = auth.uid())
  or exists (select 1 from public.workspace_members member where member.workspace_id = file_shares.workspace_id and member.user_id = auth.uid() and member.role in ('admin', 'super_admin'))
);

-- 6. Event attendees: the event creator adds/removes (members only); an attendee may answer their own RSVP.
-- The RSVP policy below runs as the caller; this function only ever returns the caller's own email.
grant execute on function public.current_user_confirmed_email() to authenticated;

-- Members can only read their own membership row, so a policy can't see whether another user is a
-- member. This answers only "are the caller and this user both members of this workspace", which
-- reveals nothing outside the caller's own workspaces.
create or replace function public.is_fellow_workspace_member(target_workspace_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.workspace_members me where me.workspace_id = target_workspace_id and me.user_id = auth.uid())
    and exists (select 1 from public.workspace_members other where other.workspace_id = target_workspace_id and other.user_id = target_user_id)
$$;
revoke all on function public.is_fellow_workspace_member(uuid, uuid) from public, anon;
grant execute on function public.is_fellow_workspace_member(uuid, uuid) to authenticated;

drop policy if exists "event members manage attendees" on public.calendar_event_attendees;
create policy "members read event attendees" on public.calendar_event_attendees
for select using (exists (select 1 from public.calendar_events event join public.workspace_members member on member.workspace_id = event.workspace_id where event.id = calendar_event_attendees.event_id and member.user_id = auth.uid()));
create policy "creators add event attendees" on public.calendar_event_attendees
for insert with check (
  exists (select 1 from public.calendar_events event where event.id = calendar_event_attendees.event_id and event.creator_id = auth.uid()
    and exists (select 1 from public.workspace_members member where member.workspace_id = event.workspace_id and member.user_id = auth.uid()))
  and (user_id is null or exists (select 1 from public.calendar_events event where event.id = calendar_event_attendees.event_id and public.is_fellow_workspace_member(event.workspace_id, calendar_event_attendees.user_id)))
);
create policy "creators or attendees update event attendees" on public.calendar_event_attendees
for update
using (
  exists (select 1 from public.calendar_events event where event.id = calendar_event_attendees.event_id and event.creator_id = auth.uid())
  or user_id = auth.uid()
  or (user_id is null and lower(email) = public.current_user_confirmed_email())
)
with check (exists (select 1 from public.calendar_events event join public.workspace_members member on member.workspace_id = event.workspace_id where event.id = calendar_event_attendees.event_id and member.user_id = auth.uid()));
create policy "creators remove event attendees" on public.calendar_event_attendees
for delete using (
  exists (select 1 from public.calendar_events event where event.id = calendar_event_attendees.event_id and event.creator_id = auth.uid())
  or user_id = auth.uid()
);

-- An attendee answering an RSVP may only change the response, not who the row is for.
create or replace function public.limit_attendee_self_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if not exists (select 1 from public.calendar_events event where event.id = old.event_id and event.creator_id = auth.uid())
    and (new.event_id is distinct from old.event_id or new.user_id is distinct from old.user_id or new.email is distinct from old.email) then
    raise exception 'Only the event creator can change attendees' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists calendar_event_attendees_limit_self_update on public.calendar_event_attendees;
create trigger calendar_event_attendees_limit_self_update before update on public.calendar_event_attendees
for each row execute function public.limit_attendee_self_update();

-- 7. Emailed-link acceptance: trust only a confirmed email (as the inbox flow already does) and pin search_path.
create or replace function public.accept_workspace_invitation(invitation_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.workspace_invitations%rowtype;
  current_email text := coalesce(public.current_user_confirmed_email(), '');
begin
  if auth.uid() is null or current_email = '' then
    raise exception 'Confirm your email and sign in to accept this invitation.' using errcode = '42501';
  end if;

  select * into invitation
  from public.workspace_invitations
  where token_hash = invitation_token_hash and accepted_at is null and declined_at is null and expires_at > now()
  for update;

  if invitation.id is null or lower(invitation.email) <> current_email then
    raise exception 'This invitation is invalid or expired.' using errcode = '22023';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (invitation.workspace_id, auth.uid(), invitation.role)
  on conflict (workspace_id, user_id) do nothing;

  insert into public.profiles (id, active_workspace_id)
  values (auth.uid(), invitation.workspace_id)
  on conflict (id) do update set active_workspace_id = coalesce(public.profiles.active_workspace_id, excluded.active_workspace_id), updated_at = now();

  update public.workspace_invitations set accepted_at = now() where id = invitation.id;

  return invitation.workspace_id;
end;
$$;

revoke all on function public.accept_workspace_invitation(text) from public, anon;
grant execute on function public.accept_workspace_invitation(text) to authenticated;

commit;
