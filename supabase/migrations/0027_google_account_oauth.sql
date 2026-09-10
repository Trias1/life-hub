create table if not exists public.google_oauth_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_oauth_tokens enable row level security;
revoke all on public.google_oauth_tokens from anon, authenticated;
grant select, insert, update, delete on public.google_oauth_tokens to service_role;
