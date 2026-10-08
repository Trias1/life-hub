begin;

create table public.request_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null check (bucket in ('search', 'upload', 'export', 'fetch-meta', 'oauth')),
  window_start timestamptz not null,
  requests integer not null check (requests > 0),
  primary key (user_id, bucket)
);
create index request_rate_limits_window_start_idx on public.request_rate_limits (window_start);
alter table public.request_rate_limits enable row level security;
revoke all on public.request_rate_limits from public, anon, authenticated, service_role;

create function public.consume_request_rate_limit(p_bucket text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_user uuid := auth.uid();
  current_time_value timestamptz := clock_timestamp();
  current_window timestamptz := date_trunc('minute', current_time_value);
  capacity integer;
  consumed integer;
begin
  if request_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  capacity := case p_bucket
    when 'search' then 60
    when 'upload' then 20
    when 'export' then 5
    when 'fetch-meta' then 20
    when 'oauth' then 10
    else null
  end;
  if capacity is null then
    raise exception 'Invalid request bucket' using errcode = '22023';
  end if;

  -- ponytail: fixed-minute windows allow boundary bursts; use a sliding window if needed.
  insert into public.request_rate_limits as limits (user_id, bucket, window_start, requests)
  values (request_user, p_bucket, current_window, 1)
  on conflict (user_id, bucket) do update
  set window_start = greatest(limits.window_start, excluded.window_start),
      requests = case when limits.window_start < excluded.window_start then 1 else limits.requests + 1 end
  where limits.window_start < excluded.window_start or limits.requests < capacity
  returning requests into consumed;

  if consumed = 1 then
    delete from public.request_rate_limits
    where (user_id, bucket) in (
      select expired.user_id, expired.bucket from public.request_rate_limits expired
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

revoke all on function public.consume_request_rate_limit(text) from public, anon, authenticated, service_role;
grant execute on function public.consume_request_rate_limit(text) to authenticated;

commit;
