drop policy if exists "authors can update notes" on public.notes;
create policy "authors can update notes" on public.notes
for update using (
  author_id = auth.uid()
  and exists (
    select 1 from public.workspace_members member
    where member.workspace_id = notes.workspace_id and member.user_id = auth.uid()
  )
) with check (
  author_id = auth.uid()
  and exists (select 1 from public.workspace_members member where member.workspace_id = notes.workspace_id and member.user_id = auth.uid())
);

drop policy if exists "creators can update spaces" on public.spaces;
create policy "creators can update spaces" on public.spaces
for update using (
  creator_id = auth.uid()
  and exists (
    select 1 from public.workspace_members member
    where member.workspace_id = spaces.workspace_id and member.user_id = auth.uid()
  )
) with check (
  creator_id = auth.uid()
  and exists (select 1 from public.workspace_members member where member.workspace_id = spaces.workspace_id and member.user_id = auth.uid())
);

drop policy if exists "uploaders can update file metadata" on public.files;
create policy "uploaders can update file metadata" on public.files
for update using (
  uploader_id = auth.uid()
  and exists (
    select 1 from public.workspace_members member
    where member.workspace_id = files.workspace_id and member.user_id = auth.uid()
  )
) with check (
  uploader_id = auth.uid()
  and exists (select 1 from public.workspace_members member where member.workspace_id = files.workspace_id and member.user_id = auth.uid())
);
