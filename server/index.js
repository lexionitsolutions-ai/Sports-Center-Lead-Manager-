import http from 'node:http';
import {pathToFileURL} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import {decideReply, normalizeEvolution, phoneNumber} from './agent-domain.js';
import {sameSecret, verifyTelephony, sendEvolution} from './transport.js';

export function loadConfig(env = process.env) {
  for (const key of ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','EVOLUTION_URL','EVOLUTION_INSTANCE_TOKEN','EVOLUTION_INSTANCE_ID','AGENT_WEBHOOK_SECRET']) {
    if (!env[key]) throw Error(`Missing ${key}`);
  }
  if (env.AGENT_WEBHOOK_SECRET.length<32) throw Error('AGENT_WEBHOOK_SECRET must contain at least 32 random characters');
  if (env.TELEPHONY_WEBHOOK_SECRET && env.TELEPHONY_WEBHOOK_SECRET.length<32) throw Error('TELEPHONY_WEBHOOK_SECRET must contain at least 32 random characters');
  const url = new URL(env.EVOLUTION_URL);
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname!=='/') throw Error('EVOLUTION_URL must be a server origin without credentials or path');
  if (url.protocol==='http:' && !['localhost','127.0.0.1','evolution'].includes(url.hostname)) throw Error('Use HTTPS for remote Evolution servers');
  const port = Number(env.PORT || 8787);
  if (!Number.isInteger(port) || port<1 || port>65535) throw Error('Invalid PORT');
  return {supabaseUrl:env.SUPABASE_URL, serviceKey:env.SUPABASE_SERVICE_ROLE_KEY,
    evolutionUrl:url.origin, evolutionToken:env.EVOLUTION_INSTANCE_TOKEN, instanceId:env.EVOLUTION_INSTANCE_ID,
    webhookSecret:env.AGENT_WEBHOOK_SECRET, telephonySecret:env.TELEPHONY_WEBHOOK_SECRET,
    sendsEnabled:env.AGENT_SEND_ENABLED==='true', port};
}
export async function rpc(db, name, params) {
  const result = await db.rpc(name,params);
  if (result.error) throw result.error;
  return result.data;
}
async function rows(query) {
  const result = await query;
  if (result.error) throw result.error;
  return result.data;
}
async function readBody(req) {
  const chunks=[];let size=0;
  for await (const chunk of req) {
    size+=chunk.length;
    if (size>262144) {const error=Error('Payload too large');error.status=413;throw error;}
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
export function createWebhookHandler({db,config}) {
  return async (req,res) => {
    const respond=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
    try {
      if (req.method==='GET' && req.url==='/health') return respond(200,{service:'sports-center-agent',sendingEnabled:config.sendsEnabled});
      if (req.method!=='POST') return respond(404,{error:'Not found'});
      let event;
      if (req.url.startsWith('/webhooks/evolution/')) {
        if (!sameSecret(req.url.slice('/webhooks/evolution/'.length),config.webhookSecret)) return respond(401,{error:'Unauthorized'});
        const raw = await readBody(req);
        let payload;try {payload=JSON.parse(raw);}catch{return respond(400,{error:'Invalid JSON'});}
        try {event=normalizeEvolution(payload,config.instanceId);}catch{return respond(403,{error:'Unexpected instance'});}
      } else if (req.url==='/webhooks/telephony') {
        const raw=await readBody(req);
        if (!verifyTelephony(raw,req.headers['x-agent-timestamp'],req.headers['x-agent-signature'],config.telephonySecret)) return respond(401,{error:'Unauthorized'});
        let payload;try {payload=JSON.parse(raw);}catch{return respond(400,{error:'Invalid JSON'});}
        const phone=phoneNumber(payload.phone), age=Date.now()-Date.parse(payload.occurredAt);
        if (!phone || !/^[\w:.-]{1,160}$/.test(payload.id || '') || !Number.isFinite(age) || age< -60000 || age>300000 || payload.event!=='call.missed') return respond(400,{error:'Invalid missed-call event'});
        event={id:`telephony:${payload.id}`,type:'call',call_id:`tel:${payload.id}`,phone,state:'CallTerminate',reason:'missed'};
      } else return respond(404,{error:'Not found'});
      if (event) await rpc(db,'agent_receive',{p_event:event});
      respond(200,{accepted:true}); // Only acknowledge after the durable database transaction commits.
    } catch (error) {
      console.error('Webhook processing failed',error.status || 'database_or_payload_error');
      respond(error.status || 503,{error:'Event not accepted; retry later'});
    }
  };
}

export async function runCycle({db,config,send=sendEvolution}) {
  await rows(db.from('agent_settings').update({worker_seen_at:new Date().toISOString(),sending_enabled:config.sendsEnabled}).eq('id',true));
  const settings=await rows(db.from('agent_settings').select('*').eq('id',true).single());
  if (settings.enabled) {
    const pending=await rows(db.from('agent_messages').select('*').eq('handled',false).order('occurred_at',{ascending:false}).limit(100));
    const seen=new Set();
    for (const message of pending) {
      if (seen.has(message.conversation_id)) continue;
      seen.add(message.conversation_id);
      const conversation=await rows(db.from('agent_conversations').select('*').eq('id',message.conversation_id).single());
      const inquiry=conversation.inquiry_id ? await rows(db.from('inquiries').select('*').eq('id',conversation.inquiry_id).single()) : null;
      const action=decideReply({text:message.body,conversation,inquiry});
      await rpc(db,'agent_apply_reply',{p_message:message.id,p_revision:conversation.revision,p_action:action});
    }
    await rpc(db,'agent_schedule',{});
  }
  if (!config.sendsEnabled) return;
  for(let count=0;count<3;count++) {
    const jobs=await rpc(db,'agent_claim',{});
    if (!jobs?.length) break;
    const job=jobs[0];
    const conversation=await rows(db.from('agent_conversations').select('*').eq('id',job.conversation_id).single());
    // Re-check just before the network request; a request already in flight cannot be recalled.
    const current=await rows(db.from('agent_settings').select('enabled,missed_calls_enabled').eq('id',true).single());
    if (conversation.opted_out || conversation.revision!==job.revision || (job.kind!=='manual' && !current.enabled) || (job.kind==='missed_call' && !current.missed_calls_enabled)) {
      await rows(db.from('agent_outbox').update({state:'cancelled'}).eq('id',job.id));continue;
    }
    const result=await send(config,job,conversation.phone);
    await rows(db.from('agent_outbox').update(result).eq('id',job.id));
    if (result.state==='sent') await rows(db.from('agent_conversations').update({last_outbound_at:result.sent_at}).eq('id',conversation.id));
  }
}

if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const config=loadConfig();
  const db=createClient(config.supabaseUrl,config.serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const server=http.createServer(createWebhookHandler({db,config}));
  server.requestTimeout=15000;server.headersTimeout=10000;
  let running=false,stopping=false;
  const tick=async()=>{
    if(running || stopping)return;running=true;
    try{await runCycle({db,config});}catch{console.error('Agent cycle failed. Check database migration, network and service credentials.');}finally{running=false;}
  };
  server.listen(config.port,'0.0.0.0',()=>console.log(`Sports Center agent listening on ${config.port}; sending ${config.sendsEnabled?'permitted':'disabled'}`));
  const timer=setInterval(tick,10000);tick();
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>{stopping=true;clearInterval(timer);server.close();setTimeout(()=>process.exit(0),25000).unref();});
}
