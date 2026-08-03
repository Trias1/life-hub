alter table public.notifications add column if not exists archived_at timestamptz;
alter table public.notifications add column if not exists priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent'));
alter table public.notifications add column if not exists actor_id uuid references auth.users(id) on delete set null;
alter table public.notifications add column if not exists resource_type text;
alter table public.notifications add column if not exists resource_id uuid;
alter table public.notifications add column if not exists resource_name text;
alter table public.notifications add column if not exists link text;
create index if not exists notifications_recipient_feed_idx on public.notifications(recipient_id, archived_at, is_read, created_at desc);

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname = 'users can delete own notifications') then
    create policy "users can delete own notifications" on public.notifications for delete using (recipient_id = auth.uid());
  end if;
end
$$;
