begin;
alter table public.profiles add column phone text unique check(phone ~ '^\+[1-9][0-9]{7,14}$');
grant select on public.profiles,public.inquiries to service_role;

-- Only the server's Auth Admin API can supply app_metadata. Public signup cannot set it.
-- Auth can insert a user before applying administrator metadata. Only trusted metadata
-- provisions a workspace profile; an unprovisioned Auth user has no workspace permissions.
create function public.provision_staff_profile() returns trigger language plpgsql security definer set search_path=public as $$
declare staff_role text:=new.raw_app_meta_data->>'sports_center_role';
begin
 if coalesce((new.raw_app_meta_data->>'sports_center_staff')::boolean,false) is not true
    or staff_role not in ('admin','technician')
    or coalesce(new.raw_app_meta_data->>'sports_center_phone','') !~ '^\+[1-9][0-9]{7,14}$'
    or length(trim(coalesce(new.raw_app_meta_data->>'sports_center_name',''))) not between 1 and 120 then
   return new;
 end if;
 insert into public.profiles(id,name,role,phone) values(new.id,trim(new.raw_app_meta_data->>'sports_center_name'),staff_role,new.raw_app_meta_data->>'sports_center_phone') on conflict(id) do nothing;
 return new;
end; $$;
revoke all on function public.provision_staff_profile() from public,anon,authenticated;
create trigger provision_sports_center_staff after insert or update of raw_app_meta_data on auth.users for each row execute function public.provision_staff_profile();
commit;
