create table if not exists public.note_versions (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  editor_id uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 160),
  content text not null default '',
  created_at timestamptz not null default now()
);

alter table public.note_versions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'note_versions' and policyname = 'workspace members can read note versions') then
    create policy "workspace members can read note versions" on public.note_versions for select using (
      exists (select 1 from public.workspace_members member where member.workspace_id = note_versions.workspace_id and member.user_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'note_versions' and policyname = 'authors can create note versions') then
    create policy "authors can create note versions" on public.note_versions for insert with check (
      editor_id = auth.uid() and exists (
        select 1 from public.notes note where note.id = note_versions.note_id and note.author_id = auth.uid() and note.workspace_id = note_versions.workspace_id
      )
    );
  end if;
end
$$;

create index if not exists note_versions_note_created_idx on public.note_versions(note_id, created_at desc);
