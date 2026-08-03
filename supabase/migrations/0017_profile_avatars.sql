insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

drop policy if exists "users can read own avatars" on storage.objects;
drop policy if exists "users can upload own avatars" on storage.objects;
drop policy if exists "users can delete own avatars" on storage.objects;
drop policy if exists "profiles are creatable by owner" on public.profiles;

create policy "users can read own avatars" on storage.objects
for select using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users can upload own avatars" on storage.objects
for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users can delete own avatars" on storage.objects
for delete using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "profiles are creatable by owner" on public.profiles
for insert with check (auth.uid() = id);
