alter table public.files add column if not exists google_file_id text;
alter table public.files add column if not exists storage_provider text not null default 'google-drive';
alter table public.profiles add column if not exists avatar_google_file_id text;

create unique index if not exists files_google_file_id_idx on public.files(google_file_id) where google_file_id is not null;
create index if not exists profiles_avatar_google_file_id_idx on public.profiles(avatar_google_file_id) where avatar_google_file_id is not null;
