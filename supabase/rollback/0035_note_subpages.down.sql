-- Undoes 0035_note_subpages.sql. Not a migration: run it by hand only if 0035 has to be reverted.
-- Sub-pages become ordinary top-level notes again; no note is deleted.
begin;

drop trigger if exists notes_check_parent on public.notes;
drop function if exists public.check_note_parent();
drop index if exists public.notes_parent_idx;
alter table public.notes drop constraint if exists notes_parent_not_self;
alter table public.notes drop constraint if exists notes_parent_fk;
alter table public.notes drop constraint if exists notes_id_workspace_key;
alter table public.notes drop column if exists parent_id;

commit;
