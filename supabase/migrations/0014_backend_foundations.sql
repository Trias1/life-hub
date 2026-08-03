alter table public.profiles add column if not exists active_workspace_id uuid references public.workspaces(id) on delete set null;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists website text;
alter table public.profiles add column if not exists location text;
alter table public.profiles add column if not exists timezone text not null default 'UTC';
alter table public.profiles add column if not exists language text not null default 'en';
alter table public.profiles add column if not exists job_title text;
alter table public.profiles add column if not exists company text;
create index if not exists profiles_active_workspace_idx on public.profiles(active_workspace_id);

create table if not exists public.workspace_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  timezone text not null default 'UTC',
  language text not null default 'en',
  date_format text not null default 'MMM d, yyyy',
  storage_limit_bytes bigint not null default 107374182400 check (storage_limit_bytes > 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_enabled boolean not null default true,
  push_enabled boolean not null default true,
  desktop_enabled boolean not null default true,
  digest_enabled boolean not null default false,
  mentions_enabled boolean not null default true,
  tasks_enabled boolean not null default true,
  calendar_enabled boolean not null default true,
  notes_enabled boolean not null default true,
  files_enabled boolean not null default true,
  bookmarks_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.workspace_settings enable row level security;
alter table public.notification_preferences enable row level security;

drop policy if exists "users can join own membership" on public.workspace_members;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles are creatable by owner') then
    create policy "profiles are creatable by owner" on public.profiles for insert with check (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'workspace_members' and policyname = 'workspace admins can update memberships') then
    create policy "workspace admins can update memberships" on public.workspace_members for update using (
      exists (select 1 from public.workspace_members admin_member where admin_member.workspace_id = workspace_members.workspace_id and admin_member.user_id = auth.uid() and admin_member.role in ('admin', 'super_admin'))
    ) with check (
      exists (select 1 from public.workspace_members admin_member where admin_member.workspace_id = workspace_members.workspace_id and admin_member.user_id = auth.uid() and admin_member.role in ('admin', 'super_admin'))
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'workspace_members' and policyname = 'workspace admins can remove memberships') then
    create policy "workspace admins can remove memberships" on public.workspace_members for delete using (
      exists (select 1 from public.workspace_members admin_member where admin_member.workspace_id = workspace_members.workspace_id and admin_member.user_id = auth.uid() and admin_member.role in ('admin', 'super_admin'))
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'bookmarks' and policyname = 'creators can update bookmarks') then
    create policy "creators can update bookmarks" on public.bookmarks for update using (creator_id = auth.uid()) with check (creator_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'calendar_events' and policyname = 'creators can update events') then
    create policy "creators can update events" on public.calendar_events for update using (creator_id = auth.uid()) with check (creator_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'calendar_events' and policyname = 'creators can delete events') then
    create policy "creators can delete events" on public.calendar_events for delete using (creator_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'files' and policyname = 'members can create file metadata') then
    create policy "members can create file metadata" on public.files for insert with check (
      uploader_id = auth.uid() and exists (select 1 from public.workspace_members member where member.workspace_id = files.workspace_id and member.user_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'files' and policyname = 'uploaders can update file metadata') then
    create policy "uploaders can update file metadata" on public.files for update using (uploader_id = auth.uid()) with check (uploader_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'activity_logs' and policyname = 'members can create activity') then
    create policy "members can create activity" on public.activity_logs for insert with check (
      actor_id = auth.uid() and exists (select 1 from public.workspace_members member where member.workspace_id = activity_logs.workspace_id and member.user_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname = 'members can create notifications') then
    create policy "members can create notifications" on public.notifications for insert with check (
      exists (select 1 from public.workspace_members actor_member where actor_member.workspace_id = notifications.workspace_id and actor_member.user_id = auth.uid())
      and exists (select 1 from public.workspace_members recipient_member where recipient_member.workspace_id = notifications.workspace_id and recipient_member.user_id = notifications.recipient_id)
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'workspace_settings' and policyname = 'members can read workspace settings') then
    create policy "members can read workspace settings" on public.workspace_settings for select using (
      exists (select 1 from public.workspace_members member where member.workspace_id = workspace_settings.workspace_id and member.user_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'workspace_settings' and policyname = 'admins can manage workspace settings') then
    create policy "admins can manage workspace settings" on public.workspace_settings for all using (
      exists (select 1 from public.workspace_members member where member.workspace_id = workspace_settings.workspace_id and member.user_id = auth.uid() and member.role in ('admin', 'super_admin'))
    ) with check (
      exists (select 1 from public.workspace_members member where member.workspace_id = workspace_settings.workspace_id and member.user_id = auth.uid() and member.role in ('admin', 'super_admin'))
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notification_preferences' and policyname = 'users can manage own notification preferences') then
    create policy "users can manage own notification preferences" on public.notification_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end
$$;

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
  where token_hash = invitation_token_hash and accepted_at is null and expires_at > now()
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

grant execute on function public.accept_workspace_invitation(text) to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'workspace_invitations' and policyname = 'admins can delete invitations') then
    create policy "admins can delete invitations" on public.workspace_invitations for delete using (
      exists (select 1 from public.workspace_members member where member.workspace_id = workspace_invitations.workspace_id and member.user_id = auth.uid() and member.role in ('admin', 'super_admin'))
    );
  end if;
end
$$;

create or replace function public.create_workspace(workspace_name text, workspace_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid := gen_random_uuid();
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into public.workspaces (id, owner_id, name, slug)
  values (new_workspace_id, current_user_id, workspace_name, workspace_slug);

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, current_user_id, 'admin');

  insert into public.profiles (id, active_workspace_id)
  values (current_user_id, new_workspace_id)
  on conflict (id) do update set active_workspace_id = excluded.active_workspace_id, updated_at = now();

  return new_workspace_id;
end;
$$;

grant execute on function public.create_workspace(text, text) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
end
$$;
