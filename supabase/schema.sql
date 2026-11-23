-- Run once in a new Supabase project's SQL Editor.
begin;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null check (length(trim(name)) > 0),
 role text not null check (role in ('admin','technician'))
);
create function public.is_admin() returns boolean language sql stable security definer
set search_path = public as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin'); $$;
create function public.is_technician() returns boolean language sql stable security definer
set search_path = public as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='technician'); $$;
revoke all on function public.is_admin() from public;
revoke all on function public.is_technician() from public;
grant execute on function public.is_admin(), public.is_technician() to authenticated;
create table public.inquiries (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(trim(name)) between 1 and 120),
 phone text not null check (phone ~ '^[+0-9][0-9 ()-]{6,19}$'),
 reason text not null check (reason in ('Gym machinery','Professional gym setup','Home gym setup','School equipment','Sports equipment','Other')),
 other_reason text not null default '',
 follow_up date,
 status text not null default 'New' check (status in ('New','Call done','Interested','Call not received','Not interested','Converted','Quoted')),
 amount numeric(14,2) not null default 0 check (amount>=0),
 notes text not null default '',
 created_at timestamptz not null default now(),
 check (reason <> 'Other' or length(trim(other_reason)) > 0),
 constraint inquiries_amount_status_check check (status = 'Converted' or amount = 0),
 constraint inquiries_follow_up_status_check check ((status in ('Converted','Not interested') and follow_up is null) or (status not in ('Converted','Not interested') and follow_up is not null))
);
create table public.gyms (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 1 and 160),
 contact text not null check(length(trim(contact)) > 0),
 phone text not null check (phone ~ '^[+0-9][0-9 ()-]{6,19}$'),
 location text not null check(length(trim(location)) > 0),
 amc_renewal date not null,
 created_at timestamptz not null default now()
);
create table public.visits (
 id uuid primary key default gen_random_uuid(),
 gym_id uuid not null references public.gyms(id) on delete restrict,
 technician_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
 technician_name text not null check(length(trim(technician_name)) > 0),
 reason text not null check(reason in ('Monthly AMC visit','Machinery issue')),
 issue text not null default '',
 visit_date date not null check(visit_date <= (now() at time zone 'Asia/Kolkata')::date),
 coverage text not null check(coverage in ('AMC','Chargeable')),
 charge numeric(14,2) not null default 0,
 amc_renewal date not null,
 notes text not null default '',
 created_at timestamptz not null default now(),
 check(reason <> 'Machinery issue' or length(trim(issue)) > 0),
 check((coverage='AMC' and charge=0) or (coverage='Chargeable' and charge>0))
);
create table public.deliveries (
 id uuid primary key default gen_random_uuid(),
 institution text not null check(length(trim(institution)) > 0),
 head text not null check(length(trim(head)) > 0),
 phone text not null check(phone ~ '^[+0-9][0-9 ()-]{6,19}$'),
 equipment text not null check(length(trim(equipment)) > 0),
 delivered_on date not null check(delivered_on <= (now() at time zone 'Asia/Kolkata')::date),
 amount numeric(14,2) not null default 0 check(amount>=0),
 created_at timestamptz not null default now()
);
create index inquiries_follow_up_idx on public.inquiries(follow_up) where status not in ('Converted','Not interested');
create index gyms_amc_renewal_idx on public.gyms(amc_renewal);
create index visits_gym_date_idx on public.visits(gym_id,visit_date desc);
create index visits_technician_idx on public.visits(technician_id);
alter table public.profiles enable row level security;
alter table public.inquiries enable row level security;
alter table public.gyms enable row level security;
alter table public.visits enable row level security;
alter table public.deliveries enable row level security;
-- Role assignment is SQL-only: clients cannot grant themselves permissions.
create policy profiles_read on public.profiles for select to authenticated using (id=auth.uid() or public.is_admin());
create policy inquiries_admin on public.inquiries for all to authenticated using (public.is_admin()) with check(public.is_admin());
create policy gyms_read on public.gyms for select to authenticated using(public.is_admin() or public.is_technician());
create policy gyms_admin_insert on public.gyms for insert to authenticated with check(public.is_admin());
create policy gyms_admin_update on public.gyms for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy gyms_admin_delete on public.gyms for delete to authenticated using(public.is_admin());
create policy visits_read on public.visits for select to authenticated using(public.is_admin() or (public.is_technician() and technician_id=auth.uid()));
create policy visits_insert on public.visits for insert to authenticated with check((public.is_admin() or public.is_technician()) and technician_id=auth.uid());
create policy visits_admin_update on public.visits for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy deliveries_admin on public.deliveries for all to authenticated using(public.is_admin()) with check(public.is_admin());
revoke all on public.profiles,public.inquiries,public.gyms,public.visits,public.deliveries from anon;
grant select on public.profiles to authenticated;
revoke insert,update,delete on public.profiles from authenticated;
grant select,insert,update,delete on public.inquiries,public.gyms,public.deliveries to authenticated;
grant select,insert,update on public.visits to authenticated;
commit;
-- Create users in Authentication > Users, then assign each UUID here:
-- insert into public.profiles(id,name,role) values ('USER_UUID','Mayuri Pathak','admin');
-- insert into public.profiles(id,name,role) values ('TECH_UUID','Ravi Kumar','technician');
