-- Encrypted values (enc:1:...) are longer than the text they hold, and do not start with https://.
-- Widen the checks that would reject them. Plaintext keeps its original rules; no rows are changed.

begin;

do $$
declare
  target record;
begin
  for target in
    select c.conrelid::regclass as table_name, c.conname from pg_constraint c
    where c.contype = 'c' and (
      (c.conrelid = 'public.task_checklist_items'::regclass and pg_get_constraintdef(c.oid) like '%char_length(title)%')
      or (c.conrelid = 'public.task_comments'::regclass and pg_get_constraintdef(c.oid) like '%char_length(body)%')
      or (c.conrelid = 'public.bookmarks'::regclass and pg_get_constraintdef(c.oid) like '%https://%')
    )
  loop
    execute format('alter table %s drop constraint %I', target.table_name, target.conname);
  end loop;
end $$;

alter table public.task_checklist_items add constraint task_checklist_items_title_length
  check (char_length(title) between 1 and case when title like 'enc:1:%' then 2000 else 240 end);

alter table public.task_comments add constraint task_comments_body_length
  check (char_length(body) between 1 and case when body like 'enc:1:%' then 12000 else 4000 end);

alter table public.bookmarks add constraint bookmarks_url_https_or_encrypted
  check (url ~ '^https://' or url like 'enc:1:%');

commit;
