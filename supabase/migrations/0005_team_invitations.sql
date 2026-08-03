create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  token_hash text not null unique,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index workspace_invitations_email_idx on public.workspace_invitations(lower(email));
alter table public.workspace_invitations enable row level security;
create policy "admins can read invitations" on public.workspace_invitations for select using (exists (select 1 from public.workspace_members m where m.workspace_id = workspace_invitations.workspace_id and m.user_id = auth.uid() and m.role in ('admin', 'super_admin')));
create policy "admins can create invitations" on public.workspace_invitations for insert with check (created_by = auth.uid() and exists (select 1 from public.workspace_members m where m.workspace_id = workspace_invitations.workspace_id and m.user_id = auth.uid() and m.role in ('admin', 'super_admin')));
