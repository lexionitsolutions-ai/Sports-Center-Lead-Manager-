-- Run after schema.sql and followups.sql. One Sports Center business number per deployment.
begin;
create table public.agent_settings (
 id boolean primary key default true check(id),
 enabled boolean not null default false,
 followup_time time not null default '10:00' check(followup_time >= '09:00' and followup_time < '18:00'),
 missed_calls_enabled boolean not null default false,
 worker_seen_at timestamptz,
 sending_enabled boolean not null default false
);
insert into public.agent_settings(id) values(true);
create table public.agent_conversations (
 id uuid primary key default gen_random_uuid(),
 phone text not null unique check(phone ~ '^[1-9][0-9]{7,14}$'),
 name text not null default '',
 inquiry_id uuid references public.inquiries(id) on delete restrict,
 consent boolean not null default false,
 consent_note text not null default '',
 opted_out boolean not null default false,
 mode text not null default 'agent' check(mode in ('agent','human')),
 pending_date date,
 last_inbound_at timestamptz,
 last_outbound_at timestamptz,
 revision integer not null default 0,
 created_at timestamptz not null default now()
);
create table public.agent_events (
 event_id text primary key,
 created_at timestamptz not null default now()
);
create table public.agent_messages (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.agent_conversations(id),
 provider_id text not null unique,
 body text not null,
 occurred_at timestamptz not null default now(),
 handled boolean not null default false
);
create table public.agent_outbox (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.agent_conversations(id),
 dedupe_key text not null unique,
 provider_id text not null unique default ('SC' || replace(gen_random_uuid()::text,'-','')),
 kind text not null check(kind in ('followup','reply','manual','missed_call')),
 body text not null check(length(body) between 1 and 5000),
 state text not null default 'queued' check(state in ('queued','sending','sent','failed','uncertain','cancelled')),
 revision integer not null,
 follow_up date,
 run_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 sent_at timestamptz,
 error text not null default ''
);
create table public.agent_tasks (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.agent_conversations(id),
 title text not null,
 done boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.agent_calls (
 call_id text primary key,
 phone text,
 accepted boolean not null default false,
 ended_at timestamptz,
 reason text not null default '',
 created_at timestamptz not null default now()
);
create index agent_messages_pending on public.agent_messages(occurred_at) where not handled;
create index agent_outbox_pending on public.agent_outbox(run_at) where state='queued';

-- Clients can only read operational history. Queue writes and event processing are RPC-only.
alter table public.agent_settings enable row level security;
alter table public.agent_conversations enable row level security;
alter table public.agent_events enable row level security;
alter table public.agent_messages enable row level security;
alter table public.agent_outbox enable row level security;
alter table public.agent_tasks enable row level security;
alter table public.agent_calls enable row level security;
create policy agent_settings_admin on public.agent_settings for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy agent_conversations_read on public.agent_conversations for select to authenticated using(public.is_admin());
create policy agent_messages_read on public.agent_messages for select to authenticated using(public.is_admin());
create policy agent_outbox_read on public.agent_outbox for select to authenticated using(public.is_admin());
create policy agent_tasks_read on public.agent_tasks for select to authenticated using(public.is_admin());
create policy agent_tasks_update on public.agent_tasks for update to authenticated using(public.is_admin()) with check(public.is_admin());
revoke all on public.agent_settings,public.agent_conversations,public.agent_events,public.agent_messages,public.agent_outbox,public.agent_tasks,public.agent_calls from anon,authenticated;
grant select on public.agent_settings to authenticated;
grant update(enabled,followup_time,missed_calls_enabled) on public.agent_settings to authenticated;
grant select on public.agent_conversations,public.agent_messages,public.agent_outbox,public.agent_tasks to authenticated;
grant update(done) on public.agent_tasks to authenticated;
grant all on public.agent_settings,public.agent_conversations,public.agent_events,public.agent_messages,public.agent_outbox,public.agent_tasks,public.agent_calls to service_role;
grant select on public.inquiries to service_role;

create function public.agent_normalize_phone(p_phone text) returns text language plpgsql immutable set search_path=public as $$
declare v text;
begin
 if p_phone !~ '^\+?[0-9 ()-]+$' then return null; end if;
 v:=regexp_replace(p_phone,'[^0-9]','','g');
 if v ~ '^0[6-9][0-9]{9}$' then v:=substring(v from 2); end if;
 if v ~ '^[6-9][0-9]{9}$' then v:='91'||v; end if;
 if v !~ '^[1-9][0-9]{7,14}$' then return null; end if;
 return v;
end; $$;

create function public.agent_inquiry_changed() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if old.phone is distinct from new.phone or old.follow_up is distinct from new.follow_up or old.status is distinct from new.status then
   update public.agent_outbox set state='cancelled' where state='queued' and conversation_id in (select id from public.agent_conversations where inquiry_id=new.id);
   update public.agent_conversations set revision=revision+1,pending_date=null,
     consent=case when public.agent_normalize_phone(new.phone) is distinct from phone then false else consent end,
     inquiry_id=case when public.agent_normalize_phone(new.phone) is distinct from phone then null else inquiry_id end
   where inquiry_id=new.id;
 end if;
 return new;
end; $$;
create trigger agent_inquiry_changed after update of phone,follow_up,status on public.inquiries for each row execute function public.agent_inquiry_changed();

create function public.agent_enroll(p_inquiry uuid,p_note text) returns uuid language plpgsql security definer set search_path=public as $$
declare i public.inquiries; c public.agent_conversations; v_phone text;
begin
 if not public.is_admin() then raise exception 'Administrator required'; end if;
 select * into strict i from public.inquiries where id=p_inquiry;
 v_phone:=public.agent_normalize_phone(i.phone);
 if v_phone is null then raise exception 'Invalid WhatsApp number'; end if;
 if length(trim(p_note)) < 5 or length(p_note)>500 then raise exception 'Record how and when the customer agreed to follow-ups'; end if;
 insert into public.agent_conversations(phone,name) values(v_phone,i.name) on conflict(phone) do nothing;
 select * into strict c from public.agent_conversations where phone=v_phone for update;
 if c.opted_out then raise exception 'Customer opted out. Do not re-enrol without a new consent review'; end if;
 if c.inquiry_id is not null and c.inquiry_id<>i.id then raise exception 'This number is linked to another inquiry. Review that conversation first'; end if;
 update public.agent_conversations set inquiry_id=i.id,name=i.name,consent=true,consent_note=trim(p_note),revision=revision+1 where id=c.id;
 return c.id;
end; $$;

create function public.agent_control(p_conversation uuid,p_mode text,p_stop boolean default false) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'Administrator required'; end if;
 if p_mode not in ('human','agent') then raise exception 'Invalid mode'; end if;
 perform 1 from public.agent_conversations where id=p_conversation for update;
 update public.agent_conversations set mode=p_mode,opted_out=opted_out or p_stop,consent=case when p_stop then false else consent end,pending_date=null,revision=revision+1 where id=p_conversation;
 update public.agent_outbox set state='cancelled' where conversation_id=p_conversation and state='queued';
 update public.agent_messages set handled=true where conversation_id=p_conversation and not handled;
end; $$;

create function public.agent_send_manual(p_conversation uuid,p_body text) returns uuid language plpgsql security definer set search_path=public as $$
declare c public.agent_conversations; v_id uuid;
begin
 if not public.is_admin() then raise exception 'Administrator required'; end if;
 select * into strict c from public.agent_conversations where id=p_conversation for update;
 if c.opted_out then raise exception 'Customer has opted out'; end if;
 if length(trim(p_body)) not between 1 and 5000 then raise exception 'Enter a message within 5,000 characters'; end if;
 update public.agent_conversations set mode='human',pending_date=null,revision=revision+1 where id=c.id returning * into c;
 update public.agent_messages set handled=true where conversation_id=c.id;
 update public.agent_outbox set state='cancelled' where conversation_id=c.id and state='queued';
 insert into public.agent_outbox(conversation_id,dedupe_key,kind,body,revision) values(c.id,'manual:'||gen_random_uuid(),'manual',trim(p_body),c.revision) returning id into v_id;
 return v_id;
end; $$;

-- Accept normalized events only from the authenticated backend. Never persist instance tokens/raw payloads.
create function public.agent_receive(p_event jsonb) returns void language plpgsql security definer set search_path=public as $$
declare c public.agent_conversations; v_type text:=p_event->>'type'; v_id text:=p_event->>'id'; v_phone text:=p_event->>'phone'; v_time timestamptz; v_count integer;
begin
 insert into public.agent_events(event_id) values(v_id) on conflict do nothing;
 get diagnostics v_count = row_count;
 if v_count=0 then return; end if;
 if v_type='call' then
   insert into public.agent_calls(call_id,phone,accepted,ended_at,reason)
   values(p_event->>'call_id',v_phone,p_event->>'state'='CallAccept',case when p_event->>'state'='CallTerminate' then now() end,coalesce(p_event->>'reason',''))
   on conflict(call_id) do update set phone=coalesce(excluded.phone,agent_calls.phone),accepted=agent_calls.accepted or excluded.accepted,ended_at=coalesce(excluded.ended_at,agent_calls.ended_at),reason=case when excluded.reason<>'' then excluded.reason else agent_calls.reason end;
   return;
 end if;
 if v_type not in ('message','outbound_echo') then return; end if;
 if v_phone !~ '^[1-9][0-9]{7,14}$' then raise exception 'Invalid phone'; end if;
 -- Our stable outbound IDs distinguish agent echoes from a person typing in WhatsApp.
 if v_type='outbound_echo' and exists(select 1 from public.agent_outbox where provider_id=p_event->>'provider_id') then return; end if;
 insert into public.agent_conversations(phone) values(v_phone) on conflict(phone) do nothing;
 select * into strict c from public.agent_conversations where phone=v_phone for update;
 if v_type='outbound_echo' then
   update public.agent_conversations set mode='human',pending_date=null,revision=revision+1 where id=c.id;
   update public.agent_outbox set state='cancelled' where conversation_id=c.id and state='queued';
   insert into public.agent_outbox(conversation_id,dedupe_key,provider_id,kind,body,revision,state,sent_at) values(c.id,'echo:'||v_id,p_event->>'provider_id','manual',p_event->>'text',c.revision+1,'sent',now());
   return;
 end if;
 v_time:=coalesce((p_event->>'occurred_at')::timestamptz,now());
 if v_time>now()+interval '5 minutes' then raise exception 'Future message timestamp'; end if;
 insert into public.agent_messages(conversation_id,provider_id,body,occurred_at) values(c.id,p_event->>'provider_id',p_event->>'text',v_time);
 update public.agent_conversations set last_inbound_at=greatest(last_inbound_at,v_time),revision=revision+1 where id=c.id;
 update public.agent_outbox set state='cancelled' where conversation_id=c.id and state='queued' and kind<>'manual';
 -- STOP takes effect at ingestion, even with automation paused or the worker offline.
 if coalesce((p_event->>'stop')::boolean,false) or lower(trim(p_event->>'text')) ~ '^(stop|unsubscribe|opt out|remove me|do not contact|don''t contact|stop messaging|stop messages)[.![:space:]]*$' then
   update public.agent_conversations set opted_out=true,consent=false,pending_date=null where id=c.id;
   update public.agent_outbox set state='cancelled' where conversation_id=c.id and state='queued';
 end if;
end; $$;

create function public.agent_apply_reply(p_message uuid,p_revision integer,p_action jsonb) returns boolean language plpgsql security definer set search_path=public as $$
declare c public.agent_conversations; m public.agent_messages; v_kind text:=p_action->>'kind'; v_date date; v_count integer;
begin
 select * into strict m from public.agent_messages where id=p_message;
 select * into strict c from public.agent_conversations where id=m.conversation_id for update;
 select * into strict m from public.agent_messages where id=p_message for update;
 if m.handled or c.revision<>p_revision or exists(select 1 from public.agent_messages newer where newer.conversation_id=c.id and not newer.handled and newer.occurred_at>m.occurred_at) then return false; end if;
 update public.agent_messages set handled=true where conversation_id=c.id and not handled and occurred_at<=m.occurred_at;
 if c.mode='human' or c.opted_out or not (select enabled from public.agent_settings where id) or m.occurred_at<now()-interval '23 hours' then return true; end if;
 if v_kind='schedule_proposal' then
   v_date:=(p_action->>'date')::date;
   if v_date<=(now() at time zone 'Asia/Kolkata')::date or v_date>(now() at time zone 'Asia/Kolkata')::date+365 then raise exception 'Invalid date'; end if;
   update public.agent_conversations set pending_date=v_date where id=c.id;
 elsif v_kind='schedule_confirm' then
   if c.pending_date is null or c.pending_date::text<>p_action->>'date' or c.pending_date<=(now() at time zone 'Asia/Kolkata')::date then raise exception 'Date confirmation expired'; end if;
   update public.inquiries set follow_up=c.pending_date where id=c.inquiry_id and status not in ('Converted','Not interested');
   get diagnostics v_count = row_count;
   if v_count=0 then
     p_action:=jsonb_build_object('kind','handoff','task','Review follow-up date: inquiry changed','text','I’ll ask Mayuri to confirm the next step with you.');
     update public.agent_conversations set mode='human' where id=c.id;
     insert into public.agent_tasks(conversation_id,title) values(c.id,'Review follow-up date: inquiry changed');
   end if;
   update public.agent_conversations set pending_date=null where id=c.id;
 elsif v_kind='not_interested' then
   update public.inquiries set status='Not interested',follow_up=null,amount=0 where id=c.inquiry_id and status<>'Converted';
   update public.agent_conversations set consent=false,pending_date=null,mode='human' where id=c.id;
 elsif v_kind='handoff' then
   update public.agent_conversations set mode='human',pending_date=null where id=c.id;
   insert into public.agent_tasks(conversation_id,title) values(c.id,p_action->>'task');
 end if;
 select * into strict c from public.agent_conversations where id=c.id;
 if length(coalesce(p_action->>'text',''))>0 then
   insert into public.agent_outbox(conversation_id,dedupe_key,kind,body,revision) values(c.id,'reply:'||m.id,'reply',p_action->>'text',c.revision) on conflict do nothing;
 end if;
 return true;
end; $$;

create function public.agent_schedule(p_now timestamptz default now()) returns void language plpgsql security definer set search_path=public as $$
begin
 if not (select enabled from public.agent_settings where id) then return; end if;
 insert into public.agent_outbox(conversation_id,dedupe_key,kind,body,revision,follow_up)
 select c.id,'followup:'||i.id||':'||i.follow_up,'followup',
 'Hi '||i.name||', this is Sports Center’s assistant helping Mayuri Pathak. We’re following up on your '||lower(case when i.reason='Other' then i.other_reason else i.reason end)||' enquiry as discussed. Have you had a chance to review your requirements? How can we help with the next step? Reply here, or reply STOP to stop follow-ups.',c.revision,i.follow_up
 from public.agent_conversations c join public.inquiries i on i.id=c.inquiry_id cross join public.agent_settings s
 where c.consent and not c.opted_out and c.mode='agent' and i.status not in ('Converted','Not interested')
 and public.agent_normalize_phone(i.phone)=c.phone
 and i.follow_up=(p_now at time zone 'Asia/Kolkata')::date
 and (p_now at time zone 'Asia/Kolkata')::time>=s.followup_time and (p_now at time zone 'Asia/Kolkata')::time<'18:00'
 and not exists(select 1 from public.agent_messages m where m.conversation_id=c.id and not m.handled)
 and (c.last_inbound_at is null or c.last_inbound_at<(p_now at time zone 'Asia/Kolkata')::date::timestamp at time zone 'Asia/Kolkata')
 on conflict(dedupe_key) do nothing;
 -- Calls must explicitly end with a missed outcome. Give acceptance events time to arrive.
 insert into public.agent_outbox(conversation_id,dedupe_key,kind,body,revision)
 select c.id,'missed:'||a.call_id,'missed_call',
 'Hi, you’ve reached Sports Center. Mayuri Pathak couldn’t take your call just now. I’m her assistant. Please share your name and what you need help with here, or let us know a convenient callback time.',c.revision
 from public.agent_calls a join public.agent_conversations c on c.phone=a.phone cross join public.agent_settings s
 where s.missed_calls_enabled and not a.accepted and a.reason in ('timeout','missed')
 and a.ended_at<p_now-interval '30 seconds' and a.ended_at>p_now-interval '10 minutes'
 and c.consent and not c.opted_out and c.mode='agent'
 and (c.last_inbound_at is null or c.last_inbound_at<a.ended_at)
 and not exists(select 1 from public.agent_outbox o where o.conversation_id=c.id and o.kind='missed_call' and o.created_at>p_now-interval '1 hour')
 on conflict(dedupe_key) do nothing;
end; $$;

create function public.agent_claim(p_now timestamptz default now()) returns setof public.agent_outbox language plpgsql security definer set search_path=public as $$
declare j public.agent_outbox; c public.agent_conversations; s public.agent_settings;
begin
 -- A process crash or network timeout must never silently resend a possibly delivered message.
 update public.agent_outbox set state='uncertain',error='Worker interrupted during send. Check WhatsApp before sending again.' where state='sending' and run_at<p_now-interval '2 minutes';
 select * into s from public.agent_settings where id;
 for j in select * from public.agent_outbox where state='queued' and run_at<=p_now order by run_at for update skip locked limit 20 loop
   select * into c from public.agent_conversations where id=j.conversation_id for update;
   if c.opted_out or c.revision<>j.revision
      or (j.kind='followup' and (not c.consent or c.mode<>'agent' or not exists(select 1 from public.inquiries i where i.id=c.inquiry_id and i.follow_up=j.follow_up and i.status not in ('Converted','Not interested') and public.agent_normalize_phone(i.phone)=c.phone)))
      or (j.kind='missed_call' and (not c.consent or c.mode<>'agent' or not s.missed_calls_enabled or exists(select 1 from public.agent_calls a where 'missed:'||a.call_id=j.dedupe_key and a.accepted))) then
     update public.agent_outbox set state='cancelled' where id=j.id;
   elsif j.kind<>'manual' and not s.enabled then continue;
   elsif j.kind='followup' and (j.follow_up<>(p_now at time zone 'Asia/Kolkata')::date or (p_now at time zone 'Asia/Kolkata')::time>='18:00') then
     update public.agent_outbox set state='cancelled' where id=j.id;
   else
     update public.agent_outbox set state='sending',run_at=p_now where id=j.id returning * into j;
     return next j;
     return; -- One at a time; never hold a batch while making network calls.
   end if;
 end loop;
end; $$;

-- Browser roles cannot invoke worker RPCs or spoof incoming customer messages.
revoke all on function public.agent_normalize_phone(text),public.agent_enroll(uuid,text),public.agent_control(uuid,text,boolean),public.agent_send_manual(uuid,text),public.agent_receive(jsonb),public.agent_apply_reply(uuid,integer,jsonb),public.agent_schedule(timestamptz),public.agent_claim(timestamptz) from public,anon,authenticated;
revoke all on function public.agent_inquiry_changed() from public,anon,authenticated;
grant execute on function public.agent_enroll(uuid,text),public.agent_control(uuid,text,boolean),public.agent_send_manual(uuid,text) to authenticated;
grant execute on function public.agent_normalize_phone(text),public.agent_receive(jsonb),public.agent_apply_reply(uuid,integer,jsonb),public.agent_schedule(timestamptz),public.agent_claim(timestamptz) to service_role;
commit;
