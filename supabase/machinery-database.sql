-- Run after quotations.sql. Safe for existing catalogs and quotations.
begin;
alter table public.machines add column if not exists length numeric(10,2) check(length > 0 and length <= 100000);
alter table public.machines add column if not exists breadth numeric(10,2) check(breadth > 0 and breadth <= 100000);
alter table public.machines add column if not exists height numeric(10,2) check(height > 0 and height <= 100000);
alter table public.machines add column if not exists dimension_unit text not null default 'cm' check(dimension_unit in ('cm','mm','in','m'));
alter table public.machines add column if not exists specifications text not null default '' check(char_length(specifications)<=3000);
alter table public.machines drop constraint if exists machines_category_check;
alter table public.machines add constraint machines_category_check check(category in ('Back','Biceps','Chest','Triceps','Shoulders','Abs','Legs','Dumbbells','Racks','Benches','Cardio','Accessories'));
-- Preserve old free-form dimensions. The editor parses common L x B x H values;
-- remaining legacy rows can be completed when edited.
alter table public.quotations alter column tax_rate set default 18;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('machinery-photos','machinery-photos',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
drop policy if exists machinery_photos_admin_insert on storage.objects;
drop policy if exists machinery_photos_admin_update on storage.objects;
drop policy if exists machinery_photos_admin_delete on storage.objects;
drop policy if exists machinery_photos_admin_read on storage.objects;
create policy machinery_photos_admin_insert on storage.objects for insert to authenticated
with check(bucket_id='machinery-photos' and public.is_admin());
create policy machinery_photos_admin_update on storage.objects for update to authenticated
using(bucket_id='machinery-photos' and public.is_admin()) with check(bucket_id='machinery-photos' and public.is_admin());
create policy machinery_photos_admin_delete on storage.objects for delete to authenticated
using(bucket_id='machinery-photos' and public.is_admin());
create policy machinery_photos_admin_read on storage.objects for select to authenticated
using(bucket_id='machinery-photos' and public.is_admin());
commit;
