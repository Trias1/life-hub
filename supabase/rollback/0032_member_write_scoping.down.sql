-- Undoes 0032_member_write_scoping.sql and restores the 0031 state exactly (policies copied from
-- 0002, 0015 and 0029). Not a migration: run it by hand only if 0032 has to be reverted.
begin;

drop trigger if exists tasks_prevent_owner_reassignment on public.tasks;
drop trigger if exists calendar_event_attendees_limit_self_update on public.calendar_event_attendees;
drop function if exists public.prevent_owner_reassignment();
drop function if exists public.limit_attendee_self_update();

drop policy if exists "workspace members can create tasks" on public.tasks;
drop policy if exists "workspace members can update tasks" on public.tasks;
create policy "workspace members can create tasks" on public.tasks for insert with check (exists (select 1 from public.workspace_members m where m.workspace_id = tasks.workspace_id and m.user_id = auth.uid()));
create policy "workspace members can update tasks" on public.tasks for update using (exists (select 1 from public.workspace_members m where m.workspace_id = tasks.workspace_id and m.user_id = auth.uid()));

drop policy if exists "members read task comments" on public.task_comments;
drop policy if exists "members add task comments" on public.task_comments;
drop policy if exists "authors update task comments" on public.task_comments;
drop policy if exists "authors delete task comments" on public.task_comments;
create policy "members manage task comments" on public.task_comments for all using (exists (select 1 from public.tasks task join public.workspace_members member on member.workspace_id = task.workspace_id where task.id = task_comments.task_id and member.user_id = auth.uid())) with check (author_id = auth.uid() and exists (select 1 from public.tasks task join public.workspace_members member on member.workspace_id = task.workspace_id where task.id = task_comments.task_id and member.user_id = auth.uid()));

drop policy if exists "members read task labels" on public.task_labels;
drop policy if exists "members create task labels" on public.task_labels;
drop policy if exists "owners update task labels" on public.task_labels;
drop policy if exists "owners delete task labels" on public.task_labels;
create policy "members manage task labels" on public.task_labels for all using (exists (select 1 from public.workspace_members member where member.workspace_id = task_labels.workspace_id and member.user_id = auth.uid())) with check (created_by = auth.uid() and exists (select 1 from public.workspace_members member where member.workspace_id = task_labels.workspace_id and member.user_id = auth.uid()));

drop policy if exists "members read file versions" on public.file_versions;
drop policy if exists "members add file versions" on public.file_versions;
drop policy if exists "uploaders update file versions" on public.file_versions;
drop policy if exists "uploaders delete file versions" on public.file_versions;
create policy "members manage file versions" on public.file_versions for all using (exists (select 1 from public.workspace_members member where member.workspace_id = file_versions.workspace_id and member.user_id = auth.uid())) with check (uploader_id = auth.uid() and exists (select 1 from public.workspace_members member where member.workspace_id = file_versions.workspace_id and member.user_id = auth.uid()));

drop policy if exists "members read file shares" on public.file_shares;
drop policy if exists "members create file shares" on public.file_shares;
drop policy if exists "owners revoke file shares" on public.file_shares;
create policy "members manage file shares" on public.file_shares for all using (exists (select 1 from public.workspace_members member where member.workspace_id = file_shares.workspace_id and member.user_id = auth.uid())) with check (created_by = auth.uid() and exists (select 1 from public.workspace_members member where member.workspace_id = file_shares.workspace_id and member.user_id = auth.uid()));

drop policy if exists "members read event attendees" on public.calendar_event_attendees;
drop policy if exists "creators add event attendees" on public.calendar_event_attendees;
drop policy if exists "creators or attendees update event attendees" on public.calendar_event_attendees;
drop policy if exists "creators remove event attendees" on public.calendar_event_attendees;
create policy "event members manage attendees" on public.calendar_event_attendees for all using (exists (select 1 from public.calendar_events event join public.workspace_members member on member.workspace_id = event.workspace_id where event.id = calendar_event_attendees.event_id and member.user_id = auth.uid())) with check (exists (select 1 from public.calendar_events event join public.workspace_members member on member.workspace_id = event.workspace_id where event.id = calendar_event_attendees.event_id and member.user_id = auth.uid()));

drop function if exists public.is_fellow_workspace_member(uuid, uuid);
-- current_user_confirmed_email keeps its grants: authenticated already had EXECUTE before 0032.

create or replace function public.accept_workspace_invitation(invitation_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.workspace_invitations%rowtype;
  current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null or current_email = '' then
    raise exception 'You must sign in to accept this invitation.' using errcode = '42501';
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
-- 0032 revoked these; before it, PUBLIC and anon could execute (Supabase default privileges).
grant execute on function public.accept_workspace_invitation(text) to public, anon;

commit;
