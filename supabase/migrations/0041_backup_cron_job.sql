-- Hourly trigger for automatic backups (0040): at minute 5 of every hour, pg_cron asks production's
-- /api/backup/cron to run the backups that are due. The request carries "Authorization: Bearer
-- <CRON_SECRET>", read from Supabase Vault at run time, so the secret never sits in this file or in the
-- job definition.
--
-- BEFORE running this, the owner adds the secret once in the SQL editor (same value as CRON_SECRET in
-- Vercel), typing the value themselves:
--   select vault.create_secret('<the CRON_SECRET value>', 'lifehub_cron_secret');
-- Only production is called: demo shares this database, so calling both would back up twice.
-- Apply after 0040.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'lifehub_cron_secret') then
    raise exception 'Add the Vault secret "lifehub_cron_secret" first (see the comment at the top).';
  end if;
  if exists (select 1 from cron.job where jobname = 'lifehub-backups') then
    perform cron.unschedule('lifehub-backups');
  end if;
end
$$;

select cron.schedule(
  'lifehub-backups',
  '5 * * * *',
  $job$
    select net.http_get(
      url := 'https://lifehub.west-solutions.web.id/api/backup/cron',
      headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'lifehub_cron_secret')),
      timeout_milliseconds := 290000
    )
  $job$
);
