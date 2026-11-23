-- Existing workspaces: run once after schema.sql. Safe to rerun.
begin;
-- Replace legacy checks on status, including the old Won/amount relationship.
do $$
declare rule record;
begin
 for rule in select conname from pg_constraint
  where conrelid='public.inquiries'::regclass and contype='c'
   and pg_get_constraintdef(oid) ~ '\mstatus\M'
 loop execute format('alter table public.inquiries drop constraint %I',rule.conname); end loop;
end $$;
alter table public.inquiries alter column follow_up drop not null;
update public.inquiries set status=case status when 'Contacted' then 'Call done' when 'Won' then 'Converted' when 'Lost' then 'Not interested' else status end;
update public.inquiries set follow_up=null where status in ('Converted','Not interested');
alter table public.inquiries add constraint inquiries_status_check check(status in ('New','Call done','Interested','Call not received','Not interested','Converted','Quoted'));
alter table public.inquiries add constraint inquiries_amount_status_check check(status='Converted' or amount=0);
alter table public.inquiries add constraint inquiries_follow_up_status_check check(
 (status in ('Converted','Not interested') and follow_up is null) or
 (status not in ('Converted','Not interested') and follow_up is not null));
alter table public.inquiries drop constraint if exists inquiries_reason_check;
alter table public.inquiries add constraint inquiries_reason_check check(reason in ('Gym machinery','Professional gym setup','Home gym setup','School equipment','Sports equipment','Other'));
drop index if exists public.inquiries_follow_up_idx;
create index inquiries_follow_up_idx on public.inquiries(follow_up) where status not in ('Converted','Not interested');
commit;
