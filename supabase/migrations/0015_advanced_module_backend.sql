alter table public.notes add column if not exists space_id uuid references public.spaces(id) on delete set null;
alter table public.tasks add column if not exists space_id uuid references public.spaces(id) on delete set null;
alter table public.tasks add column if not exists description text not null default '';
alter table public.tasks add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.tasks add column if not exists completed_at timestamptz;
alter table public.files add column if not exists space_id uuid references public.spaces(id) on delete set null;
create index if not exists notes_space_idx on public.notes(space_id);
create index if not exists tasks_space_idx on public.tasks(space_id);
create index if not exists files_space_idx on public.files(space_id);

create table if not exists public.task_labels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  color text not null default 'indigo',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table if not exists public.task_label_assignments (
  task_id uuid not null references public.tasks(id) on delete cascade,
  label_id uuid not null references public.task_labels(id) on delete cascade,
  primary key (task_id, label_id)
);

create table if not exists public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 240),
  is_completed boolean not null default false,
  position integer not null default 0,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (task_id, file_id)
);

create table if not exists public.calendar_event_attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.calendar_events(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  email text,
  response text not null default 'pending' check (response in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  check (user_id is not null or email is not null),
  unique (event_id, email)
);

create table if not exists public.file_versions (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.files(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  uploader_id uuid not null references auth.users(id) on delete restrict,
  storage_path text not null unique,
  name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.file_shares (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.files(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete cascade,
  token_hash text unique,
  permission text not null default 'view' check (permission in ('view', 'edit')),
  expires_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (recipient_id is not null or token_hash is not null)
);

alter table public.task_labels enable row level security;
alter table public.task_label_assignments enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_attachments enable row level security;
alter table public.calendar_event_attendees enable row level security;
alter table public.file_versions enable row level security;
alter table public.file_shares enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'task_labels' and policyname = 'members manage task labels') then
    create policy "members manage task labels" on public.task_labels for all using (exists (select 1 from public.workspace_members member where member.workspace_id = task_labels.workspace_id and member.user_id = auth.uid())) with check (created_by = auth.uid() and exists (select 1 from public.workspace_members member where member.workspace_id = task_labels.workspace_id and member.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'task_label_assignments' and policyname = 'members manage task label assignments') then
    create policy "members manage task label assignments" on public.task_label_assignments for all using (exists (select 1 from public.tasks task join public.workspace_members member on member.workspace_id = task.workspace_id where task.id = task_label_assignments.task_id and member.user_id = auth.uid())) with check (exists (select 1 from public.tasks task join public.workspace_members member on member.workspace_id = task.workspace_id where task.id = task_label_assignments.task_id and member.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'task_checklist_items' and policyname = 'members manage task checklist items') then
    create policy "members manage task checklist items" on public.task_checklist_items for all using (exists (select 1 from public.tasks task join public.workspace_members member on member.workspace_id = task.workspace_id where task.id = task_checklist_items.task_id and member.user_id = auth.uid())) with check (created_by = auth.uid() and exists (select 1 from public.tasks task join public.workspace_members member on member.workspace_id = task.workspace_id where task.id = task_checklist_items.task_id and member.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'task_comments' and policyname = 'members manage task comments') then
    create policy "members manage task comments" on public.task_comments for all using (exists (select 1 from public.tasks task join public.workspace_members member on member.workspace_id = task.workspace_id where task.id = task_comments.task_id and member.user_id = auth.uid())) with check (author_id = auth.uid() and exists (select 1 from public.tasks task join public.workspace_members member on member.workspace_id = task.workspace_id where task.id = task_comments.task_id and member.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'task_attachments' and policyname = 'members manage task attachments') then
    create policy "members manage task attachments" on public.task_attachments for all using (exists (select 1 from public.tasks task join public.workspace_members member on member.workspace_id = task.workspace_id where task.id = task_attachments.task_id and member.user_id = auth.uid())) with check (created_by = auth.uid() and exists (select 1 from public.tasks task join public.workspace_members member on member.workspace_id = task.workspace_id where task.id = task_attachments.task_id and member.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'calendar_event_attendees' and policyname = 'event members manage attendees') then
    create policy "event members manage attendees" on public.calendar_event_attendees for all using (exists (select 1 from public.calendar_events event join public.workspace_members member on member.workspace_id = event.workspace_id where event.id = calendar_event_attendees.event_id and member.user_id = auth.uid())) with check (exists (select 1 from public.calendar_events event join public.workspace_members member on member.workspace_id = event.workspace_id where event.id = calendar_event_attendees.event_id and member.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'file_versions' and policyname = 'members manage file versions') then
    create policy "members manage file versions" on public.file_versions for all using (exists (select 1 from public.workspace_members member where member.workspace_id = file_versions.workspace_id and member.user_id = auth.uid())) with check (uploader_id = auth.uid() and exists (select 1 from public.workspace_members member where member.workspace_id = file_versions.workspace_id and member.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'file_shares' and policyname = 'members manage file shares') then
    create policy "members manage file shares" on public.file_shares for all using (exists (select 1 from public.workspace_members member where member.workspace_id = file_shares.workspace_id and member.user_id = auth.uid())) with check (created_by = auth.uid() and exists (select 1 from public.workspace_members member where member.workspace_id = file_shares.workspace_id and member.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'files' and policyname = 'uploaders can delete file metadata') then
    create policy "uploaders can delete file metadata" on public.files for delete using (uploader_id = auth.uid());
  end if;
end
$$;

create index if not exists task_labels_workspace_idx on public.task_labels(workspace_id);
create index if not exists task_checklist_task_idx on public.task_checklist_items(task_id, position);
create index if not exists task_comments_task_idx on public.task_comments(task_id, created_at);
create index if not exists calendar_attendees_event_idx on public.calendar_event_attendees(event_id);
create index if not exists file_versions_file_idx on public.file_versions(file_id, created_at desc);
create index if not exists file_shares_file_idx on public.file_shares(file_id);
