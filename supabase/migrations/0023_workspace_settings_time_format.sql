alter table public.workspace_settings
add column if not exists time_format text not null default '24-hour'
check (time_format in ('24-hour', '12-hour'));

update public.workspace_settings
set language = case when lower(language) in ('id', 'id-id', 'bahasa indonesia') then 'Bahasa Indonesia' else 'English' end
where language not in ('English', 'Bahasa Indonesia');

update public.workspace_settings
set date_format = 'DD/MM/YYYY'
where date_format not in ('DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD');

alter table public.workspace_settings alter column language set default 'English';
alter table public.workspace_settings alter column date_format set default 'DD/MM/YYYY';

insert into public.workspace_settings (workspace_id)
select workspace.id from public.workspaces workspace
on conflict (workspace_id) do nothing;

update public.workspace_members member
set role = 'super_admin', updated_at = now()
from public.workspaces workspace
where workspace.id = member.workspace_id and workspace.owner_id = member.user_id and member.role <> 'super_admin';

create or replace function public.create_workspace(workspace_name text, workspace_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid := gen_random_uuid();
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into public.workspaces (id, owner_id, name, slug)
  values (new_workspace_id, current_user_id, btrim(workspace_name), workspace_slug);

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, current_user_id, 'super_admin');

  insert into public.workspace_settings (workspace_id)
  values (new_workspace_id);

  insert into public.profiles (id, active_workspace_id)
  values (current_user_id, new_workspace_id)
  on conflict (id) do update set active_workspace_id = excluded.active_workspace_id, updated_at = now();

  return new_workspace_id;
end;
$$;

revoke all on function public.create_workspace(text, text) from public;
grant execute on function public.create_workspace(text, text) to authenticated;
