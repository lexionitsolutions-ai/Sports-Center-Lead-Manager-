-- Existing workspaces: run once in Supabase SQL Editor after schema.sql.
begin;
create table public.machines (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 1 and 120),
 category text not null check(category in ('Back','Biceps','Chest','Triceps','Shoulders','Abs','Legs','Dumbbells','Racks','Benches','Cardio','Accessories')),
 dimensions text not null check(length(trim(dimensions)) between 1 and 120),
 length numeric(10,2) check(length > 0 and length <= 100000),
 breadth numeric(10,2) check(breadth > 0 and breadth <= 100000),
 height numeric(10,2) check(height > 0 and height <= 100000),
 dimension_unit text not null default 'cm' check(dimension_unit in ('cm','mm','in','m')),
 specifications text not null default '' check(char_length(specifications)<=3000),
 mrp numeric(14,2) not null check(mrp >= 0),
 price numeric(14,2) not null check(price >= 0 and price <= mrp),
 image_url text not null default '' check(image_url='' or image_url ~ '^https://'),
 created_at timestamptz not null default now()
);
create table public.quotations (
 id uuid primary key default gen_random_uuid(),
 number text not null unique check(length(trim(number)) between 1 and 60),
 customer_name text not null check(length(trim(customer_name)) between 1 and 160),
 customer_contact text not null default '',
 customer_phone text not null default '',
 customer_email text not null default '',
 customer_address text not null default '',
 issued_on date not null,
 valid_until date not null check(valid_until >= issued_on),
 items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items)>0),
 tax_rate numeric(5,2) not null default 18 check(tax_rate between 0 and 100),
 delivery_charge numeric(14,2) not null default 0 check(delivery_charge >= 0),
 notes text not null default '',
 created_at timestamptz not null default now()
);
-- Quote lines deliberately store a snapshot of machine details and prices.
create function public.validate_quotation_items() returns trigger language plpgsql
set search_path=public as $$
declare item jsonb;
begin
 for item in select value from jsonb_array_elements(new.items) loop
  if coalesce(length(trim(item->>'name')),0)=0
   or coalesce(jsonb_typeof(item->'price'),'null') <> 'number'
   or coalesce(jsonb_typeof(item->'mrp'),'null') <> 'number'
   or coalesce(jsonb_typeof(item->'quantity'),'null') <> 'number'
   then raise exception 'Invalid quotation item'; end if;
  if (item->>'price')::numeric < 0 or (item->>'mrp')::numeric < (item->>'price')::numeric
   or (item->>'quantity')::numeric not between 1 and 999
   or trunc((item->>'quantity')::numeric) <> (item->>'quantity')::numeric
   then raise exception 'Invalid quotation item pricing or quantity'; end if;
 end loop;
 return new;
end; $$;
create trigger quotation_items_check before insert or update on public.quotations for each row execute function public.validate_quotation_items();
alter table public.machines enable row level security;
alter table public.quotations enable row level security;
create policy machines_admin on public.machines for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy quotations_admin on public.quotations for all to authenticated using(public.is_admin()) with check(public.is_admin());
revoke all on public.machines,public.quotations from anon;
grant select,insert,update,delete on public.machines,public.quotations to authenticated;
commit;
