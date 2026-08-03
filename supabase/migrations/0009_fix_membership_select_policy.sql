drop policy if exists "members can read membership" on public.workspace_members;
create policy "users can read own membership" on public.workspace_members
for select using (user_id = auth.uid());
