create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  creator_id uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  creator_id uuid not null references auth.users(id) on delete restrict,
  url text not null check (url ~ '^https://'),
  title text not null check (char_length(title) between 1 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calendar_events enable row level security;
alter table public.bookmarks enable row level security;

create policy "members can read events" on public.calendar_events for select using (exists (select 1 from public.workspace_members m where m.workspace_id = calendar_events.workspace_id and m.user_id = auth.uid()));
create policy "members can create events" on public.calendar_events for insert with check (creator_id = auth.uid() and exists (select 1 from public.workspace_members m where m.workspace_id = calendar_events.workspace_id and m.user_id = auth.uid()));
create policy "members can read bookmarks" on public.bookmarks for select using (exists (select 1 from public.workspace_members m where m.workspace_id = bookmarks.workspace_id and m.user_id = auth.uid()));
create policy "members can create bookmarks" on public.bookmarks for insert with check (creator_id = auth.uid() and exists (select 1 from public.workspace_members m where m.workspace_id = bookmarks.workspace_id and m.user_id = auth.uid()));
