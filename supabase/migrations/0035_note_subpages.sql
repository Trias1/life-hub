-- Sub-pages: a note can sit under another note (parent_id), like pages inside pages.
-- The database keeps the tree sound no matter what the client sends:
--   * the parent is in the same workspace (composite foreign key),
--   * the parent belongs to the same author, so moving, archiving or trashing a page together
--     with its sub-pages never needs to touch someone else's notes,
--   * no note ends up under itself or under one of its own sub-pages,
--   * deleting a parent for good turns its remaining sub-pages into top-level notes.
-- Apply after 0034.
begin;

alter table public.notes add column if not exists parent_id uuid;
alter table public.notes drop constraint if exists notes_id_workspace_key;
alter table public.notes add constraint notes_id_workspace_key unique (id, workspace_id);
alter table public.notes drop constraint if exists notes_parent_fk;
alter table public.notes add constraint notes_parent_fk foreign key (parent_id, workspace_id)
  references public.notes (id, workspace_id) on delete set null (parent_id);
alter table public.notes drop constraint if exists notes_parent_not_self;
alter table public.notes add constraint notes_parent_not_self check (parent_id is null or parent_id <> id);
create index if not exists notes_parent_idx on public.notes (parent_id) where parent_id is not null;

-- Runs as the caller (no SECURITY DEFINER): the parent lookup goes through the same RLS as any read.
create or replace function public.check_note_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_author uuid;
  ancestor uuid := new.parent_id;
  depth integer := 0;
begin
  if new.parent_id is null then
    return new;
  end if;
  select n.author_id into parent_author from public.notes n where n.id = new.parent_id and n.workspace_id = new.workspace_id;
  if parent_author is null then
    raise exception 'Parent note not found' using errcode = '23503';
  end if;
  if parent_author <> new.author_id then
    raise exception 'Sub-pages can only go under your own notes' using errcode = '42501';
  end if;
  while ancestor is not null loop
    if ancestor = new.id then
      raise exception 'A note cannot go under itself or one of its sub-pages' using errcode = '23514';
    end if;
    depth := depth + 1;
    if depth > 10 then
      raise exception 'Sub-pages can be nested at most 10 levels deep' using errcode = '23514';
    end if;
    select n.parent_id into ancestor from public.notes n where n.id = ancestor;
  end loop;
  return new;
end
$$;
revoke all on function public.check_note_parent() from public;

drop trigger if exists notes_check_parent on public.notes;
create trigger notes_check_parent
  before insert or update of parent_id, author_id, workspace_id on public.notes
  for each row execute function public.check_note_parent();

commit;
