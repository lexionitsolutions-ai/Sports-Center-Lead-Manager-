begin;
alter table public.machines
 add column if not exists brand text not null default '' check(char_length(brand)<=80),
 add column if not exists series text not null default '' check(char_length(series)<=120),
 add column if not exists model_code text not null default '' check(char_length(model_code)<=80),
 add column if not exists source_url text not null default '' check(source_url='' or source_url ~ '^https://'),
 add column if not exists price_on_request boolean not null default false;
create unique index if not exists machines_source_url_unique on public.machines(source_url) where source_url<>'';
create unique index if not exists machines_brand_model_unique on public.machines(brand,model_code) where brand<>'' and model_code<>'';
commit;
