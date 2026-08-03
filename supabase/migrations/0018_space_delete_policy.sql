drop policy if exists "creators can delete spaces" on public.spaces;

create policy "creators can delete spaces" on public.spaces
for delete using (creator_id = auth.uid());
