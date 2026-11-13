-- Hourly trigger for automatic backups (0040). At minute 5 of every hour, pg_cron creates a one-time
-- random token in public.cron_call_tokens and calls production's /api/backup/cron?token=<token>.
-- The route accepts the call only if it can delete that exact token (created in the last 10 minutes),
-- so a token works once and no shared secret has to be copied between Vercel and the database.
-- The route then runs the backups that are due. Only production is called: demo shares this database,
-- so calling both would back up twice.
-- Also removes the "lifehub_cron_secret" Vault entry from an earlier setup attempt (no longer used).
-- Apply after 0040.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table if not exists public.cron_call_tokens (
  token uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);
alter table public.cron_call_tokens enable row level security;
revoke all on public.cron_call_tokens from public, anon, authenticated;

delete from vault.secrets where name = 'lifehub_cron_secret';

do $$
begin
  if exists (select 1 from cron.job where jobname = 'lifehub-backups') then
    perform cron.unschedule('lifehub-backups');
  end if;
end
$$;

select cron.schedule(
  'lifehub-backups',
  '5 * * * *',
  $job$
    delete from public.cron_call_tokens where created_at < now() - interval '1 day';
    with issued as (insert into public.cron_call_tokens default values returning token)
    select net.http_get(
      url := 'https://lifehub.west-solutions.web.id/api/backup/cron?token=' || (select token from issued),
      timeout_milliseconds := 290000
    );
  $job$
);
