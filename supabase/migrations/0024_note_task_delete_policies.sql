drop policy if exists "authors can delete notes" on public.notes;
create policy "authors can delete notes" on public.notes
for delete using (
  author_id = auth.uid()
  and deleted_at is not null
  and exists (select 1 from public.workspace_members member where member.workspace_id = notes.workspace_id and member.user_id = auth.uid())
);

drop policy if exists "creators can delete tasks" on public.tasks;
create policy "creators can delete tasks" on public.tasks
for delete using (
  created_by = auth.uid()
  and deleted_at is not null
  and exists (select 1 from public.workspace_members member where member.workspace_id = tasks.workspace_id and member.user_id = auth.uid())
);

drop policy if exists "uploaders can delete file metadata" on public.files;
create policy "uploaders can delete file metadata" on public.files
for delete using (
  uploader_id = auth.uid()
  and trashed_at is not null
  and exists (select 1 from public.workspace_members member where member.workspace_id = files.workspace_id and member.user_id = auth.uid())
);
