create table public.files (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  uploader_id uuid not null references auth.users(id) on delete restrict, storage_path text not null unique,
  name text not null check (char_length(name) between 1 and 255), mime_type text not null, size_bytes bigint not null check (size_bytes >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade, type text not null, message text not null,
  is_read boolean not null default false, created_at timestamptz not null default now()
);
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null, action text not null, entity_type text not null, entity_id uuid, created_at timestamptz not null default now()
);
alter table public.files enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_logs enable row level security;
create policy "members can read files" on public.files for select using (exists (select 1 from public.workspace_members m where m.workspace_id = files.workspace_id and m.user_id = auth.uid()));
create policy "members can read own notifications" on public.notifications for select using (recipient_id = auth.uid());
create policy "users can update own notifications" on public.notifications for update using (recipient_id = auth.uid());
create policy "members can read activity" on public.activity_logs for select using (exists (select 1 from public.workspace_members m where m.workspace_id = activity_logs.workspace_id and m.user_id = auth.uid()));
