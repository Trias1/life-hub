-- Undoes 0041_backup_cron_job.sql: stops the hourly backup trigger. Not a migration: run it by hand.
-- The pg_cron / pg_net extensions stay enabled.
select cron.unschedule('lifehub-backups') where exists (select 1 from cron.job where jobname = 'lifehub-backups');
drop table if exists public.cron_call_tokens;
