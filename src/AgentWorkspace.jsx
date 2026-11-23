import React, {useEffect, useState} from 'react';
import {MessageCircle, RefreshCw, Send, UserRound, Bot, CheckCircle2} from 'lucide-react';
import {supabase} from './store';
import {whatsappNumber} from './whatsapp';
import {decideReply, indiaDate, isStop} from '../server/agent-domain';
import './agent.css';

const DEMO_KEY='sports-center-agent-demo-v1';
const initialDemo=()=>{
 try {const saved=JSON.parse(localStorage.getItem(DEMO_KEY));if(saved)return saved;}catch{/* Start a fresh demo. */}
 return {settings:{enabled:false,followup_time:'10:00',missed_calls_enabled:false},conversations:[],messages:[],outbox:[],tasks:[]};
};
const checked=async query=>{const result=await query;if(result.error)throw result.error;return result.data;};
const stamp=value=>value?new Date(value).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';
export default function AgentWorkspace({inquiries,onRefresh}) {
 const [demo,setDemo]=useState(initialDemo),[settings,setSettings]=useState(null),[conversations,setConversations]=useState([]),[messages,setMessages]=useState([]),[outbox,setOutbox]=useState([]),[tasks,setTasks]=useState([]);
 const [selected,setSelected]=useState(''),[inquiryId,setInquiryId]=useState(''),[note,setNote]=useState(''),[consent,setConsent]=useState(false),[draft,setDraft]=useState(''),[sample,setSample]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0);
 useEffect(()=>{if(!supabase)localStorage.setItem(DEMO_KEY,JSON.stringify(demo));},[demo]);
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try {
    if(!supabase){setSettings(demo.settings);setConversations(demo.conversations);setMessages(demo.messages.filter(m=>m.conversation_id===selected));setOutbox(demo.outbox.filter(m=>m.conversation_id===selected));setTasks(demo.tasks.filter(t=>t.conversation_id===selected));return;}
    const [s,c,ms,os,ts]=await Promise.all([
     checked(supabase.from('agent_settings').select('*').eq('id',true).single()),
     checked(supabase.from('agent_conversations').select('*').order('created_at',{ascending:false}).limit(200)),
     selected?checked(supabase.from('agent_messages').select('*').eq('conversation_id',selected).order('occurred_at',{ascending:false}).limit(100)):[],
     selected?checked(supabase.from('agent_outbox').select('*').eq('conversation_id',selected).order('created_at',{ascending:false}).limit(100)):[],
     selected?checked(supabase.from('agent_tasks').select('*').eq('conversation_id',selected).order('created_at',{ascending:false}).limit(100)):[]
    ]);
    if(active){setSettings(s);setConversations(c);setMessages(ms);setOutbox(os);setTasks(ts);setError('');}
   }catch{if(active)setError('Could not load WhatsApp agent data. Apply supabase/whatsapp-agent.sql and check your admin access and connection.');}
  };
  load();const interval=supabase?setInterval(load,10000):null;
  return()=>{active=false;clearInterval(interval);};
 },[selected,refresh,demo]);
 const conversation=conversations.find(c=>c.id===selected), linked=inquiries.find(i=>i.id===conversation?.inquiry_id);
 const online=settings?.worker_seen_at && Date.now()-Date.parse(settings.worker_seen_at)<90000;
 async function act(fn){setBusy(true);setError('');setNotice('');try{await fn();setRefresh(n=>n+1);}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function configure(patch){
  if(supabase)await checked(supabase.from('agent_settings').update(patch).eq('id',true));
  else setDemo(d=>({...d,settings:{...d.settings,...patch}}));
 }
 async function enroll(e){e.preventDefault();await act(async()=>{
  if(!consent || note.trim().length<5)throw Error('Confirm permission and record how the customer agreed.');
  if(supabase){const id=await checked(supabase.rpc('agent_enroll',{p_inquiry:inquiryId,p_note:note.trim()}));setSelected(id);}
  else {
   const i=inquiries.find(i=>i.id===inquiryId);if(!i)throw Error('Choose an inquiry.');
   const phone=whatsappNumber(i.phone),existing=demo.conversations.find(c=>c.phone===phone);
   if(existing?.opted_out)throw Error('Customer opted out. A new consent review is required.');
   if(existing?.inquiry_id && existing.inquiry_id!==i.id)throw Error('This number is linked to another inquiry.');
   const c={mode:'agent',created_at:new Date().toISOString(),...existing,id:existing?.id||crypto.randomUUID(),phone,name:i.name,inquiry_id:i.id,consent:true,consent_note:note.trim()};
   setDemo(d=>({...d,conversations:[c,...d.conversations.filter(x=>x.id!==c.id)]}));setSelected(c.id);
  }
  setNote('');setConsent(false);setNotice('Inquiry enrolled. Follow-ups use its saved date, between the chosen time and 6 pm India time.');
 });}
 async function control(mode,stop=false){await act(async()=>{
  if(supabase)await checked(supabase.rpc('agent_control',{p_conversation:selected,p_mode:mode,p_stop:stop}));
  else setDemo(d=>({...d,conversations:d.conversations.map(c=>c.id===selected?{...c,mode,opted_out:c.opted_out||stop,consent:stop?false:c.consent,pending_date:null}:c)}));
 });}
 async function send(e){e.preventDefault();await act(async()=>{
  if(supabase)await checked(supabase.rpc('agent_send_manual',{p_conversation:selected,p_body:draft}));
  else setDemo(d=>({...d,conversations:d.conversations.map(c=>c.id===selected?{...c,mode:'human'}:c),outbox:[...d.outbox,{id:crypto.randomUUID(),conversation_id:selected,body:draft,kind:'manual',state:'preview',created_at:new Date().toISOString()}]}));
  setDraft('');setNotice(supabase?'Message queued. Sending a manual reply takes over this conversation.':'Demo preview saved. No WhatsApp message was sent.');
 });}
 function simulate(e){e.preventDefault();act(async()=>{
  const now=new Date().toISOString(),m={id:crypto.randomUUID(),conversation_id:selected,body:sample,occurred_at:now};
  const action=demo.settings.enabled||isStop(sample)?decideReply({text:sample,conversation,inquiry:linked}):{kind:'skip',text:''};
  setDemo(d=>({...d,messages:[...d.messages,m],conversations:d.conversations.map(c=>c.id===selected?{...c,last_inbound_at:now,...(action.kind==='stop'?{opted_out:true,consent:false}:{}),...(action.kind==='schedule_proposal'?{pending_date:action.date}:{}),...(action.kind==='schedule_confirm'?{pending_date:null}:{}),...(['handoff','not_interested'].includes(action.kind)?{mode:'human'}:{}),...(action.text?{last_outbound_at:now}:{})}:c),
   tasks:action.task?[...d.tasks,{id:crypto.randomUUID(),conversation_id:selected,title:action.task,done:false,created_at:now}]:d.tasks,
   outbox:action.text&&d.settings.enabled?[...d.outbox,{id:crypto.randomUUID(),conversation_id:selected,body:action.text,kind:'reply',state:'preview',created_at:now}]:d.outbox}));
  setSample('');setNotice(action.kind==='schedule_confirm'?`Preview: would reschedule the inquiry to ${action.date}. Demo inquiries are unchanged.`:'Demo reply recorded. No message was sent.');
 });}
 const timeline=[...messages.map(m=>({...m,direction:'in',time:m.occurred_at})),...outbox.map(m=>({...m,direction:'out',time:m.created_at}))].sort((a,b)=>a.time.localeCompare(b.time));
 return <div className="agent-workspace">
  <section className="card agent-settings">
   <div className="agent-heading"><div><h2><Bot size={21}/> Follow-up assistant</h2><p>Follow up on the saved date. Collect replies. Bring Mayuri into the conversation.</p></div><button className="button secondary compact" disabled={busy} onClick={()=>act(async()=>{setRefresh(n=>n+1);await onRefresh?.();})}><RefreshCw size={15}/>Refresh</button></div>
   <div className="agent-status" role="status">{!supabase?'Demo preview · no messages are sent':!online?'Worker offline or not configured':settings.sending_enabled?'Worker online · sending permitted':'Worker online · sending disabled'}{supabase&&' · Powered by Evolution Go'}</div>
   {settings&&<div className="agent-setting-fields"><label><input type="checkbox" checked={settings.enabled} disabled={busy} onChange={e=>act(()=>configure({enabled:e.target.checked}))}/> Enable automatic replies and follow-ups</label><label>Follow-up time (India)<input type="time" min="09:00" max="17:59" value={settings.followup_time.slice(0,5)} disabled={busy} onChange={e=>{const value=e.target.value;if(value>='09:00'&&value<'18:00')act(()=>configure({followup_time:value}));}}/></label><label><input type="checkbox" checked={settings.missed_calls_enabled} disabled={busy} onChange={e=>act(()=>configure({missed_calls_enabled:e.target.checked}))}/> Missed-call replies (enable after call testing)</label></div>}
   <p className="agent-help">One follow-up per inquiry/date, from the chosen time until 6 pm. Customer replies pause that day’s reminder. STOP blocks further messages. Calls need verified events and recorded messaging permission.</p>
  </section>
  {error&&<div className="form-error" role="alert">{error}</div>}{notice&&<div className="info-note" role="status">{notice}</div>}
  <details className="card agent-enrol"><summary>Enrol an inquiry for WhatsApp follow-ups</summary><form onSubmit={enroll}><label>Inquiry<select value={inquiryId} required onChange={e=>setInquiryId(e.target.value)}><option value="">Choose an inquiry</option>{inquiries.filter(i=>!['Converted','Not interested'].includes(i.status)).map(i=><option value={i.id} key={i.id}>{i.name} · {i.phone} · {i.follow_up}</option>)}</select></label><label>Permission record<input value={note} required minLength={5} maxLength={500} onChange={e=>setNote(e.target.value)} placeholder="e.g. Customer agreed on WhatsApp on 23 Nov"/></label><label className="agent-check"><input type="checkbox" checked={consent} required onChange={e=>setConsent(e.target.checked)}/> Customer agreed to receive follow-ups</label><button className="button primary" disabled={busy}>Enrol inquiry</button></form></details>
  <div className="agent-inbox">
   <aside className="card agent-contacts"><h2><MessageCircle size={18}/> Conversations</h2><p>Latest 200 conversations</p>{conversations.length===0&&<div className="empty"><p>Enrol an inquiry, or wait for an incoming WhatsApp message after setup.</p></div>}{conversations.map(c=><button key={c.id} className={selected===c.id?'selected':''} disabled={busy} onClick={()=>{setSelected(c.id);setDraft('');setNotice('');}}><strong>{c.name||`+${c.phone}`}</strong><span>+{c.phone}</span><small>{c.opted_out?'Opted out':c.mode==='human'?'Mayuri’s attention':'Assistant active'}{c.consent?' · Follow-ups enabled':''}</small></button>)}</aside>
   <section className="card agent-chat">{!conversation?<div className="empty"><MessageCircle size={28}/><h3>Choose a conversation</h3><p>Replies and callback tasks appear here.</p></div>:<>
    <div className="agent-chat-heading"><div><h2>{conversation.name||'New customer'}</h2><p>+{conversation.phone}{linked?` · ${linked.reason} · Next: ${linked.follow_up||'Closed'}`:' · Not linked to an inquiry'}</p></div><div className="agent-actions"><button className="button secondary compact" disabled={busy||conversation.opted_out} onClick={()=>control(conversation.mode==='human'?'agent':'human')}>{conversation.mode==='human'?<Bot size={15}/>:<UserRound size={15}/>} {conversation.mode==='human'?'Resume assistant':'Take over'}</button><button className="text-button" disabled={busy||conversation.opted_out} onClick={()=>control('human',true)}>Stop messages</button></div></div>
    {conversation.opted_out&&<div className="info-note">This customer opted out. Sending and automation are blocked.</div>}
    {conversation.pending_date&&<div className="info-note">Awaiting customer confirmation for {conversation.pending_date}.</div>}
    <div className="agent-tasks">{tasks.filter(t=>!t.done).map(t=><div key={t.id}><span>{t.title}</span><button className="text-button" disabled={busy} onClick={()=>act(async()=>{if(supabase)await checked(supabase.from('agent_tasks').update({done:true}).eq('id',t.id));else setDemo(d=>({...d,tasks:d.tasks.map(x=>x.id===t.id?{...x,done:true}:x)}));})}><CheckCircle2 size={14}/>Done</button></div>)}</div>
    <div className="agent-timeline" aria-label="Conversation history">{!timeline.length&&<p className="agent-help">No messages yet. Follow-up date: {linked?.follow_up||'not scheduled'}. Today: {indiaDate()}.</p>}{timeline.map(m=><article key={m.id} className={`agent-bubble ${m.direction}`}><small>{m.direction==='in'?'Customer':m.kind==='manual'?'Mayuri':'Assistant'} · {stamp(m.time)}{m.state?` · ${m.state==='sent'?'Sent to WhatsApp':m.state}`:''}</small><p>{m.body}</p>{m.error&&<strong className="agent-send-error">{m.error}</strong>}</article>)}</div>
    <form className="agent-compose" onSubmit={send}><label>Reply as Mayuri<textarea value={draft} maxLength={5000} required rows={3} disabled={busy||conversation.opted_out} onChange={e=>setDraft(e.target.value)} placeholder="Type a reply. Sending pauses the assistant for this conversation."/></label><button className="button primary" disabled={busy||conversation.opted_out||!draft.trim()}><Send size={15}/>{supabase?'Queue reply':'Preview reply'}</button></form>
    {!supabase&&<form className="agent-simulator" onSubmit={simulate}><label>Try a customer reply<input value={sample} required onChange={e=>setSample(e.target.value)} placeholder="e.g. Please follow up tomorrow"/></label><button className="button secondary compact" disabled={busy||!sample.trim()}>Simulate incoming message</button><small>Preview only. Enable automation above to see assistant replies. No inquiry dates are changed.</small></form>}
    <p className="agent-help agent-bottom">Latest 100 incoming and 100 outgoing messages. Failed or uncertain sends need a WhatsApp check before another message is sent.</p>
   </>}</section>
  </div>
 </div>;
}
