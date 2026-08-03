create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  creator_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 80),
  color text not null default 'indigo',
  icon text not null default 'folder',
  description text not null default '',
  is_favorite boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

alter table public.spaces enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'spaces' and policyname = 'members can read spaces') then
    create policy "members can read spaces" on public.spaces for select using (exists (select 1 from public.workspace_members m where m.workspace_id = spaces.workspace_id and m.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'spaces' and policyname = 'members can create spaces') then
    create policy "members can create spaces" on public.spaces for insert with check (creator_id = auth.uid() and exists (select 1 from public.workspace_members m where m.workspace_id = spaces.workspace_id and m.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'spaces' and policyname = 'creators can update spaces') then
    create policy "creators can update spaces" on public.spaces for update using (creator_id = auth.uid());
  end if;
end
$$;

create index if not exists spaces_workspace_created_idx on public.spaces(workspace_id, created_at);
