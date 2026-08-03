alter table public.notes add column if not exists folder text not null default 'General';
alter table public.notes add column if not exists tags text[] not null default '{}';
alter table public.notes add column if not exists is_favorite boolean not null default false;
alter table public.notes add column if not exists archived_at timestamptz;
create index if not exists notes_workspace_folder_idx on public.notes(workspace_id, folder);

alter table public.bookmarks add column if not exists collection text not null default 'General';
alter table public.bookmarks add column if not exists tags text[] not null default '{}';
alter table public.bookmarks add column if not exists is_favorite boolean not null default false;
alter table public.bookmarks add column if not exists archived_at timestamptz;
create index if not exists bookmarks_workspace_collection_idx on public.bookmarks(workspace_id, collection);

alter table public.calendar_events add column if not exists recurrence_rule text;
alter table public.calendar_events add column if not exists color text not null default 'indigo';
alter table public.calendar_events add column if not exists reminder_minutes integer check (reminder_minutes between 0 and 10080);

alter table public.files add column if not exists folder text not null default 'General';
alter table public.files add column if not exists is_favorite boolean not null default false;
alter table public.files add column if not exists trashed_at timestamptz;
create index if not exists files_workspace_folder_idx on public.files(workspace_id, folder);

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists bio text not null default '';
create unique index if not exists profiles_username_unique_idx on public.profiles(username) where username is not null;
