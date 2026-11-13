-- Automatic workspace backups (Settings > Backup).
--  * workspace_backup_settings: the owner's schedule (off / daily / weekly / monthly, hour in WIB) and
--    how many backups to keep. Members can see it; only the workspace owner can change it.
--  * workspace_backups: one row per backup file written to the workspace's Google Drive. Only the owner
--    sees them; rows are written by the server (service role).
-- The schedule is driven by an hourly pg_cron job that calls /api/backup/cron on production with the
-- CRON_SECRET kept in Supabase Vault (secret name "lifehub_cron_secret", added by the owner by hand).
-- The backup itself is built on the server; encrypted note/task/bookmark columns stay encrypted.
-- Apply after 0039.
begin;

create table if not exists public.workspace_backup_settings (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  frequency text not null default 'off' check (frequency in ('off', 'daily', 'weekly', 'monthly')),
  hour smallint not null default 2 check (hour between 0 and 23),
  weekday smallint not null default 0 check (weekday between 0 and 6),
  month_day smallint not null default 1 check (month_day between 1 and 28),
  keep_count smallint not null default 14 check (keep_count in (7, 14, 30)),
  last_run_at timestamptz,
  last_status text check (last_status in ('ok', 'failed')),
  last_error text check (char_length(last_error) <= 300),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.workspace_backup_settings enable row level security;

drop policy if exists "members can read backup settings" on public.workspace_backup_settings;
create policy "members can read backup settings" on public.workspace_backup_settings
  for select to authenticated
  using (public.is_workspace_member(workspace_id));
drop policy if exists "owners can create backup settings" on public.workspace_backup_settings;
create policy "owners can create backup settings" on public.workspace_backup_settings
  for insert to authenticated
  with check (updated_by = (select auth.uid()) and exists (select 1 from public.workspace_members m where m.workspace_id = workspace_backup_settings.workspace_id and m.user_id = (select auth.uid()) and m.role = 'super_admin'));
drop policy if exists "owners can change backup settings" on public.workspace_backup_settings;
create policy "owners can change backup settings" on public.workspace_backup_settings
  for update to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = workspace_backup_settings.workspace_id and m.user_id = (select auth.uid()) and m.role = 'super_admin'))
  with check (updated_by = (select auth.uid()) and exists (select 1 from public.workspace_members m where m.workspace_id = workspace_backup_settings.workspace_id and m.user_id = (select auth.uid()) and m.role = 'super_admin'));
-- Run state is the server's: the owner may write the schedule columns only, not the "last run" record.
revoke insert, update on public.workspace_backup_settings from authenticated;
grant insert (workspace_id, frequency, hour, weekday, month_day, keep_count, updated_by, updated_at) on public.workspace_backup_settings to authenticated;
grant update (frequency, hour, weekday, month_day, keep_count, updated_by, updated_at) on public.workspace_backup_settings to authenticated;

create table if not exists public.workspace_backups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  drive_file_id text not null check (drive_file_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  file_name text not null check (char_length(file_name) <= 200),
  size_bytes bigint not null check (size_bytes >= 0),
  trigger text not null check (trigger in ('scheduled', 'manual')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (drive_file_id)
);
create index if not exists workspace_backups_workspace_idx on public.workspace_backups (workspace_id, created_at desc);
alter table public.workspace_backups enable row level security;
drop policy if exists "owners can read backups" on public.workspace_backups;
create policy "owners can read backups" on public.workspace_backups
  for select to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = workspace_backups.workspace_id and m.user_id = (select auth.uid()) and m.role = 'super_admin'));
revoke insert, update, delete on public.workspace_backups from anon, authenticated;
revoke all on public.workspace_backup_settings from anon;
revoke all on public.workspace_backups from anon;

-- Same 2FA rule as every other table (0034): no data for an enrolled account before the code step.
drop policy if exists "require 2fa when enrolled" on public.workspace_backup_settings;
create policy "require 2fa when enrolled" on public.workspace_backup_settings as restrictive for all to authenticated
  using ((select public.mfa_requirement_met())) with check ((select public.mfa_requirement_met()));
drop policy if exists "require 2fa when enrolled" on public.workspace_backups;
create policy "require 2fa when enrolled" on public.workspace_backups as restrictive for all to authenticated
  using ((select public.mfa_requirement_met())) with check ((select public.mfa_requirement_met()));

commit;
