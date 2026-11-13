-- Recovery codes for two-factor sign-in: if the phone with the authenticator is lost, one code
-- turns 2FA off so the owner can sign in with the password and set up a new authenticator.
-- Only SHA-256 hashes are stored (~79-bit random codes, salted with the user id), each code works
-- once, and the table is reachable only from the server with the service role: no client policy.
-- Apply after 0036.
begin;

create table if not exists public.mfa_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  used_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, code_hash)
);
create index if not exists mfa_recovery_codes_user_idx on public.mfa_recovery_codes (user_id) where used_at is null;

alter table public.mfa_recovery_codes enable row level security;
revoke all on table public.mfa_recovery_codes from anon, authenticated;

commit;
