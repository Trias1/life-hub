create table public.notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 160),
  content text not null default '',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  assignee_id uuid references auth.users(id) on delete set null,
  title text not null check (char_length(title) between 1 and 160),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done', 'cancelled')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_date date,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_workspace_updated_idx on public.notes(workspace_id, updated_at desc);
create index tasks_workspace_status_idx on public.tasks(workspace_id, status);

alter table public.notes enable row level security;
alter table public.tasks enable row level security;

create policy "workspace members can read notes" on public.notes for select using (exists (select 1 from public.workspace_members m where m.workspace_id = notes.workspace_id and m.user_id = auth.uid()));
create policy "workspace members can create notes" on public.notes for insert with check (author_id = auth.uid() and exists (select 1 from public.workspace_members m where m.workspace_id = notes.workspace_id and m.user_id = auth.uid()));
create policy "authors can update notes" on public.notes for update using (author_id = auth.uid());

create policy "workspace members can read tasks" on public.tasks for select using (exists (select 1 from public.workspace_members m where m.workspace_id = tasks.workspace_id and m.user_id = auth.uid()));
create policy "workspace members can create tasks" on public.tasks for insert with check (exists (select 1 from public.workspace_members m where m.workspace_id = tasks.workspace_id and m.user_id = auth.uid()));
create policy "workspace members can update tasks" on public.tasks for update using (exists (select 1 from public.workspace_members m where m.workspace_id = tasks.workspace_id and m.user_id = auth.uid()));
