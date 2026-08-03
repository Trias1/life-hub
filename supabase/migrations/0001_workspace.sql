create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 80),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'admin', 'super_admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_id_idx on public.workspace_members(user_id);

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

create policy "profiles are readable by owner" on public.profiles for select using (auth.uid() = id);
create policy "profiles are writable by owner" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "workspace members can read workspaces" on public.workspaces for select using (exists (select 1 from public.workspace_members m where m.workspace_id = id and m.user_id = auth.uid()));
create policy "users can create workspaces" on public.workspaces for insert with check (auth.uid() = owner_id);
create policy "workspace admins can update workspaces" on public.workspaces for update using (exists (select 1 from public.workspace_members m where m.workspace_id = id and m.user_id = auth.uid() and m.role in ('admin', 'super_admin')));
create policy "members can read membership" on public.workspace_members for select using (user_id = auth.uid() or exists (select 1 from public.workspace_members m where m.workspace_id = workspace_id and m.user_id = auth.uid() and m.role in ('admin', 'super_admin')));
create policy "users can join own membership" on public.workspace_members for insert with check (user_id = auth.uid());
