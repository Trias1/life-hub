-- Undoes 0041_backup_cron_job.sql: stops the hourly backup trigger. Not a migration: run it by hand.
-- The extensions and the Vault secret stay (remove the secret in Project Settings > Vault if unused).
select cron.unschedule('lifehub-backups') where exists (select 1 from cron.job where jobname = 'lifehub-backups');
