import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('agent migration enforces permissions, durable deduplication, scheduling and takeover',async t=>{
 const db=new PGlite();
 const query=async(sql,args=[]) => (await db.query(sql,args)).rows;
 const scalar=async(sql,args=[]) => Object.values((await query(sql,args))[0])[0];
 try{
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
   create schema auth; create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   grant usage on schema public,auth to authenticated,service_role,anon;
   grant execute on function auth.uid() to authenticated,service_role;`);
  await db.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/whatsapp-agent.sql',import.meta.url),'utf8'));
  const admin='00000000-0000-0000-0000-000000000001',tech='00000000-0000-0000-0000-000000000002';
  await query('insert into auth.users values($1),($2)',[admin,tech]);
  await query("insert into profiles values($1,'Mayuri','admin'),($2,'Technician','technician')",[admin,tech]);
  const day=await scalar("select (now() at time zone 'Asia/Kolkata')::date::text");
  const businessTime=day+'T05:00:00Z'; // 10:30 India, independent of the test host’s clock.
  const i=await scalar("insert into inquiries(name,phone,reason,follow_up) values('Rahul','9876543210','Gym machinery',$1) returning id",[day]);
  await query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);
  await db.exec('set role authenticated');
  const c=await scalar("select agent_enroll($1,'Agreed during inquiry today')",[i]);
  await t.test('administrators use controlled RPCs; technicians cannot read or enrol',async()=>{
   assert.equal(await scalar('select count(*)::integer from agent_conversations'),1);
   await assert.rejects(query("insert into agent_outbox(conversation_id,dedupe_key,kind,body,revision) values($1,'spoof','manual','hi',0)",[c]),/permission denied/);
   await assert.rejects(query("select agent_receive('{}')"),/permission denied/);
   await assert.rejects(query('update agent_settings set sending_enabled=true'),/permission denied/);
   await query("select set_config('request.jwt.claim.sub',$1,false)",[tech]);
   assert.equal(await scalar('select count(*)::integer from agent_conversations'),0);
   await assert.rejects(query("select agent_enroll($1,'No authorization')",[i]),/Administrator required/);
   await query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);
  });
  await db.exec('reset role');
  await t.test('follow-ups are opt-in, date-specific, once per date and within business hours',async()=>{
   await query('select agent_schedule($1)',[businessTime]);assert.equal(await scalar('select count(*)::integer from agent_outbox'),0);
   await query('update agent_settings set enabled=true');
   await query('select agent_schedule($1)',[day+'T02:00:00Z']);assert.equal(await scalar('select count(*)::integer from agent_outbox'),0);
   await query('select agent_schedule($1)',[businessTime]);await query('select agent_schedule($1)',[businessTime]);
   assert.equal(await scalar('select count(*)::integer from agent_outbox'),1);
   await query("update agent_outbox set run_at=$1",[businessTime]);
   await query("update inquiries set follow_up=follow_up+1 where id=$1",[i]);
   assert.equal((await query('select * from agent_claim($1)',[businessTime])).length,0);
   assert.equal(await scalar('select state from agent_outbox'),'cancelled');
   await query('update inquiries set follow_up=$1 where id=$2',[day,i]);
  });
  const receive=async(id,text,extra={})=>query('select agent_receive($1)',[{id:'message:'+id,provider_id:id,type:'message',phone:'919876543210',text,...extra}]);
  await t.test('duplicate webhooks are durable and a reply invalidates queued automation',async()=>{
   await receive('A','Contact me tomorrow');await receive('A','Contact me tomorrow');
   assert.equal(await scalar('select count(*)::integer from agent_messages'),1);
   const rev=await scalar('select revision from agent_conversations where id=$1',[c]);
   const m=await scalar("select id from agent_messages where provider_id='A'");
   const date=await scalar("select ((now() at time zone 'Asia/Kolkata')::date+1)::text");
   const action={kind:'schedule_proposal',date,text:'Please confirm '+date};
   assert.equal(await scalar('select agent_apply_reply($1,$2,$3)',[m,rev,action]),true);
   assert.equal(await scalar('select agent_apply_reply($1,$2,$3)',[m,rev,action]),false);
   assert.equal(await scalar("select count(*)::integer from agent_outbox where kind='reply'"),1);
   assert.equal(await scalar('select pending_date::text from agent_conversations where id=$1',[c]),date);
   await receive('B','yes');
   assert.equal(await scalar("select count(*)::integer from agent_outbox where kind='reply' and state='queued'"),0);
   const rev2=await scalar('select revision from agent_conversations where id=$1',[c]),m2=await scalar("select id from agent_messages where provider_id='B'");
   await scalar('select agent_apply_reply($1,$2,$3)',[m2,rev2,{kind:'schedule_confirm',date,text:'Confirmed '+date}]);
   assert.equal(await scalar('select follow_up::text from inquiries where id=$1',[i]),date);
  });
  await t.test('takeover cancels automation and ordinary outbound echoes pause the agent',async()=>{
   await query('select agent_control($1,$2)',[c,'human']);
   assert.equal(await scalar("select count(*)::integer from agent_outbox where state='queued'"),0);
   await query('select agent_control($1,$2)',[c,'agent']);
   await query('select agent_receive($1)',[{id:'message:H',provider_id:'H',type:'outbound_echo',phone:'919876543210',text:'Mayuri here'}]);
   assert.equal(await scalar('select mode from agent_conversations where id=$1',[c]),'human');
  });
  await t.test('worker claims a send once and interrupted sends become uncertain, never auto-retried',async()=>{
   await query('select agent_send_manual($1,$2)',[c,'Hello from Mayuri']);
   const jobs=await query('select * from agent_claim()');assert.equal(jobs.length,1);
   assert.equal((await query('select * from agent_claim()')).length,0);
   await query("update agent_outbox set run_at=now()-interval '3 minutes' where state='sending'");
   await query('select * from agent_claim()');
   assert.equal(await scalar("select state from agent_outbox where id=$1",[jobs[0].id]),'uncertain');
  });
  await t.test('answered calls are excluded and verified missed calls respect consent and opt-out',async()=>{
   await query('select agent_control($1,$2)',[c,'agent']);
   await query('update agent_settings set missed_calls_enabled=true');
   const call=async(id,state)=>query('select agent_receive($1)',[{id:state+id,type:'call',call_id:id,phone:'919876543210',state,reason:state==='CallTerminate'?'timeout':''}]);
   await call('answered','CallTerminate');await call('answered','CallAccept');
   await call('missed','CallTerminate');
   await query("select agent_schedule(now()+interval '45 seconds')");
   assert.equal(await scalar("select count(*)::integer from agent_outbox where kind='missed_call'"),1);
   await receive('STOP','Please stop contacting me',{stop:true});
   assert.equal(await scalar('select opted_out from agent_conversations where id=$1',[c]),true);
   assert.equal((await query('select * from agent_claim()')).length,0);
   await assert.rejects(query('select agent_send_manual($1,$2)',[c,'Unwanted']),/opted out/);
   await assert.rejects(query("select agent_enroll($1,'Attempted re-enrolment')",[i]),/opted out/);
  });
  await t.test('editing a customer number unlinks the old conversation and cancels its queued messages',async()=>{
   const i2=await scalar("insert into inquiries(name,phone,reason,follow_up) values('Priya','9823456781','Home gym setup',$1) returning id",[day]);
   const c2=await scalar("select agent_enroll($1,'Customer permission recorded today')",[i2]);
   await query('select agent_send_manual($1,$2)',[c2,'Pending reply']);
   await query("update agent_conversations set pending_date=current_date+2 where id=$1",[c2]);
   await query("update inquiries set phone='9890123456' where id=$1",[i2]);
   const row=(await query('select inquiry_id,consent,pending_date from agent_conversations where id=$1',[c2]))[0];
   assert.deepEqual(row,{inquiry_id:null,consent:false,pending_date:null});
   assert.equal(await scalar('select state from agent_outbox where conversation_id=$1',[c2]),'cancelled');
  });
 }finally{await db.close();}
});
