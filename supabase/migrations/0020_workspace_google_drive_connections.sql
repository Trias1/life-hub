create table if not exists public.workspace_google_drive_connections (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  refresh_token text not null,
  root_folder_id text,
  connected_by uuid not null references auth.users(id) on delete restrict,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workspace_google_drive_connections enable row level security;

revoke all on public.workspace_google_drive_connections from anon, authenticated;
grant select, insert, update, delete on public.workspace_google_drive_connections to service_role;
