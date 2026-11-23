import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createHmac} from 'node:crypto';
import {decideReply, requestedDate, normalizeEvolution, phoneNumber, isStop, indiaDate} from '../server/agent-domain.js';
import {sameSecret, verifyTelephony, sendEvolution} from '../server/transport.js';
import {createWebhookHandler, loadConfig} from '../server/index.js';

const now=new Date('2026-11-23T05:00:00Z');
const inquiry={id:'i',status:'Interested'};
test('date requests use India day boundaries and require confirmation before rescheduling',()=>{
 assert.equal(indiaDate(new Date('2026-11-22T20:00:00Z')),'2026-11-23');
 assert.equal(requestedDate('tomorrow',now),'2026-11-24');
 assert.equal(requestedDate('next Monday',now),'2026-11-30');
 assert.equal(requestedDate('2026-02-30',now),null);
 assert.equal(requestedDate('2025-01-01',now),null);
 const proposed=decideReply({text:'Contact me tomorrow',inquiry,now});
 assert.equal(proposed.kind,'schedule_proposal');assert.equal(proposed.date,'2026-11-24');
 assert.equal(decideReply({text:'yes',conversation:{pending_date:proposed.date},inquiry,now}).kind,'schedule_confirm');
 assert.equal(decideReply({text:'yes',conversation:{pending_date:'2026-11-22'},inquiry,now}).kind,'handoff');
 assert.equal(decideReply({text:'yes',conversation:{pending_date:proposed.date},inquiry:{status:'Converted'},now}).kind,'handoff');
});
test('stop, human takeover and pricing requests never produce an uncontrolled sales response',()=>{
 for(const text of ['STOP','Please stop','Please stop contacting me','Don’t contact me again','unsubscribe me'])assert.equal(isStop(text),true,text);
 assert.equal(isStop('Where is the bus stop?'),false);
 assert.equal(decideReply({text:'STOP',conversation:{mode:'human'}}).kind,'stop');
 assert.equal(decideReply({text:'hello',conversation:{opted_out:true}}).text,'');
 assert.equal(decideReply({text:'hello',conversation:{mode:'human'}}).text,'');
 for(const text of ['Give me a discount','Please call me','What is the price?','[Media message]'])assert.equal(decideReply({text}).kind,'handoff');
});
test('Evolution payloads resolve telephone JIDs, ignore groups/LIDs and distinguish outgoing echoes',()=>{
 const payload={instanceId:'instance',event:'Message',data:{Info:{ID:'ABC',Sender:'919876543210@s.whatsapp.net',Chat:'919876543210@s.whatsapp.net',Timestamp:'2026-11-23T05:00:00Z'},Message:{conversation:'Hello'}}};
 assert.equal(normalizeEvolution(payload,'instance').phone,'919876543210');
 assert.throws(()=>normalizeEvolution(payload,'other'));
 assert.equal(normalizeEvolution({...payload,data:{...payload.data,Info:{...payload.data.Info,IsGroup:true}}},'instance'),null);
 assert.equal(phoneNumber('123456789012345@lid'),null);
 assert.equal(phoneNumber('09876543210'),'919876543210');
 assert.equal(phoneNumber('919876543210:5@s.whatsapp.net'),'919876543210');
 const nested={...payload,data:{...payload.data,Info:{ID:'AB2',MessageSource:{Sender:'001@lid',SenderAlt:'919876543210@s.whatsapp.net',Chat:'001@lid'}}}};
 assert.equal(normalizeEvolution(nested,'instance').phone,'919876543210');
 assert.equal(normalizeEvolution({...payload,data:{...payload.data,Info:{...payload.data.Info,IsFromMe:true}}},'instance').type,'outbound_echo');
 const call={instanceId:'instance',event:'CallTerminate',data:{CallID:'C1',CallCreator:'919876543210@s.whatsapp.net',Reason:'timeout'}};
 assert.equal(normalizeEvolution(call,'instance').reason,'timeout');
});
test('telephony authentication rejects tampering, expiry and missing secrets',()=>{
 const raw=Buffer.from('{"event":"call.missed"}'),time=String(Math.floor(+now/1000)),secret='x'.repeat(64);
 const signature=createHmac('sha256',secret).update(`${time}.`).update(raw).digest('hex');
 assert.equal(verifyTelephony(raw,time,signature,secret,+now),true);
 assert.equal(verifyTelephony(Buffer.from('{}'),time,signature,secret,+now),false);
 assert.equal(verifyTelephony(raw,time,signature,secret,+now+301000),false);
 assert.equal(verifyTelephony(raw,time,signature,undefined,+now),false);
 assert.equal(sameSecret('',''),false);
});
test('sending uses the instance key and stable ID, and never retries an uncertain result',async()=>{
 const config={evolutionUrl:'https://example.com',evolutionToken:'instance-key'},job={body:'Hello',provider_id:'SC123'};let calls=0;
 const sent=await sendEvolution(config,job,'919876543210',async(url,opts)=>{
  calls++;assert.equal(url,'https://example.com/send/text');assert.equal(opts.headers.apikey,'instance-key');
  assert.deepEqual(JSON.parse(opts.body),{number:'919876543210',text:'Hello',id:'SC123',delay:0});
  return {ok:true,json:async()=>({data:{Info:{ID:'SC123'}}})};
 });
 assert.equal(sent.state,'sent');assert.equal(calls,1);
 assert.equal((await sendEvolution(config,job,'919876543210',async()=>{calls++;throw Error('timeout');})).state,'uncertain');
 assert.equal(calls,2);
 assert.equal((await sendEvolution(config,job,'919876543210',async()=>({ok:false,status:401}))).state,'failed');
 assert.equal((await sendEvolution(config,job,'919876543210',async()=>({ok:false,status:500}))).state,'uncertain');
});
async function request(handler,body,url,headers={}) {
 const req=Readable.from([Buffer.from(body)]);req.method='POST';req.url=url;req.headers=headers;
 let status,result;
 await handler(req,{writeHead:s=>{status=s;},end:b=>{result=JSON.parse(b);}});
 return {status,result};
}
test('webhooks require the secret and instance, acknowledge only after durable storage, and exclude raw tokens',async()=>{
 const config={instanceId:'instance',webhookSecret:'s'.repeat(64)};let stored;
 const handler=createWebhookHandler({config,db:{rpc:async(name,args)=>{stored=args.p_event;return {data:null};}}});
 const payload=JSON.stringify({instanceId:'instance',instanceToken:'never-persist',event:'Message',data:{Info:{ID:'A',Sender:'919876543210@s.whatsapp.net'},Message:{conversation:'STOP'}}});
 assert.equal((await request(handler,payload,'/webhooks/evolution/wrong')).status,401);
 assert.equal((await request(handler,payload,`/webhooks/evolution/${config.webhookSecret}`)).status,200);
 assert.equal(stored.stop,true);assert.equal(JSON.stringify(stored).includes('never-persist'),false);
 assert.equal((await request(handler,'{',`/webhooks/evolution/${config.webhookSecret}`)).status,400);
 const broken=createWebhookHandler({config,db:{rpc:async()=>({error:Error('database unavailable')})}});
 assert.equal((await request(broken,payload,`/webhooks/evolution/${config.webhookSecret}`)).status,503);
});
test('server requires complete private configuration and sending is off by default',()=>{
 assert.throws(()=>loadConfig({}),/Missing SUPABASE_URL/);
 const env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'private',EVOLUTION_URL:'https://evolution.example.com',EVOLUTION_INSTANCE_TOKEN:'token',EVOLUTION_INSTANCE_ID:'instance',AGENT_WEBHOOK_SECRET:'x'.repeat(64)};
 assert.equal(loadConfig(env).sendsEnabled,false);
 assert.throws(()=>loadConfig({...env,EVOLUTION_URL:'http://remote.example.com'}),/HTTPS/);
 assert.throws(()=>loadConfig({...env,AGENT_WEBHOOK_SECRET:'short'}),/32 random/);
});
