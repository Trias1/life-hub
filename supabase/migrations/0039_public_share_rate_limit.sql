-- Public share links (/api/shared/files/<token>) need no account, so the per-user limiter from
-- 0028/0030 can't cover them. This one counts per client: the server passes a SHA-256 hash of the
-- caller's IP (never the IP itself). Only the server (service role) can call it; rows older than a day
-- are cleaned up as new windows open, like request_rate_limits.
-- Apply after 0038.
begin;

create table if not exists public.public_request_limits (
  client_hash text not null check (client_hash ~ '^[0-9a-f]{64}$'),
  bucket text not null check (bucket in ('share-download')),
  window_start timestamptz not null,
  requests integer not null check (requests > 0),
  primary key (client_hash, bucket)
);
create index if not exists public_request_limits_window_start_idx on public.public_request_limits (window_start);
alter table public.public_request_limits enable row level security;
revoke all on public.public_request_limits from public, anon, authenticated, service_role;

create or replace function public.consume_public_rate_limit(p_bucket text, p_client_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_time_value timestamptz := clock_timestamp();
  current_window timestamptz := date_trunc('minute', current_time_value);
  capacity integer;
  consumed integer;
begin
  capacity := case p_bucket when 'share-download' then 30 else null end;
  if capacity is null then
    raise exception 'Invalid request bucket' using errcode = '22023';
  end if;
  if p_client_hash is null or p_client_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid client' using errcode = '22023';
  end if;

  insert into public.public_request_limits as limits (client_hash, bucket, window_start, requests)
  values (p_client_hash, p_bucket, current_window, 1)
  on conflict (client_hash, bucket) do update
  set window_start = greatest(limits.window_start, excluded.window_start),
      requests = case when limits.window_start < excluded.window_start then 1 else limits.requests + 1 end
  where limits.window_start < excluded.window_start or limits.requests < capacity
  returning requests into consumed;

  if consumed = 1 then
    delete from public.public_request_limits
    where (client_hash, bucket) in (
      select expired.client_hash, expired.bucket from public.public_request_limits expired
      where expired.window_start < current_window - interval '1 day'
      order by expired.window_start
      limit 32 for update skip locked
    );
  end if;
  return jsonb_build_object(
    'allowed', consumed is not null,
    'retry_after', case when consumed is not null then 0
      else greatest(1, ceil(extract(epoch from current_window + interval '1 minute' - current_time_value))::integer) end
  );
end;
$$;

revoke all on function public.consume_public_rate_limit(text, text) from public, anon, authenticated, service_role;
grant execute on function public.consume_public_rate_limit(text, text) to service_role;

commit;
