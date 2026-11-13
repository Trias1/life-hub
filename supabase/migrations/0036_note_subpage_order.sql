-- Sub-pages can be put in any order (drag and drop in the Pages panel). Siblings sort by
-- sort_order, then by creation time; new sub-pages have no sort_order and go last.
-- Only the author can change it (the existing "authors can update notes" policy).
-- Apply after 0035.
begin;

alter table public.notes add column if not exists sort_order integer;
alter table public.notes drop constraint if exists notes_sort_order_range;
alter table public.notes add constraint notes_sort_order_range check (sort_order is null or sort_order between 0 and 100000);
create index if not exists notes_parent_order_idx on public.notes (parent_id, sort_order) where parent_id is not null;

commit;
