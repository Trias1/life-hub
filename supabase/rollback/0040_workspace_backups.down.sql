-- Undoes 0040_workspace_backups.sql. Not a migration: run it by hand only if 0040 has to be reverted.
-- The backup files already in Google Drive stay there; only the schedule and the list are removed.
-- Also stop the hourly job if it was set up: select cron.unschedule('lifehub-backups');
begin;

drop table if exists public.workspace_backups;
drop table if exists public.workspace_backup_settings;

commit;
