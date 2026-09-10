alter table public.profiles add column if not exists avatar_workspace_id uuid references public.workspaces(id) on delete set null;
create index if not exists profiles_avatar_workspace_idx on public.profiles(avatar_workspace_id) where avatar_workspace_id is not null;
