-- Undoes 0036_note_subpage_order.sql. Not a migration: run it by hand only if 0036 has to be reverted.
-- Sub-pages go back to creation order; no note is changed otherwise.
begin;

drop index if exists public.notes_parent_order_idx;
alter table public.notes drop constraint if exists notes_sort_order_range;
alter table public.notes drop column if exists sort_order;

commit;
