// Business decisions are deterministic. Prices, commitments and ambiguous dates go to Mayuri.
export function indiaDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Kolkata', year:'numeric', month:'2-digit', day:'2-digit'}).format(now);
}
export function phoneNumber(value) {
  const raw = String(value || '').trim();
  if (raw.includes('@')) {
    if (!raw.endsWith('@s.whatsapp.net')) return null; // Never treat a LID or group ID as a telephone number.
    return phoneNumber('+' + raw.split('@')[0].split(':')[0]);
  }
  if (!/^\+?[\d ()-]+$/.test(raw)) return null;
  let digits = raw.replace(/\D/g, '');
  if (/^0[6-9]\d{9}$/.test(digits)) digits = digits.slice(1);
  if (/^[6-9]\d{9}$/.test(digits)) digits = '91' + digits;
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}
const addDays = (day, count) => new Date(Date.parse(day + 'T12:00:00Z') + count * 86400000).toISOString().slice(0,10);
export function requestedDate(text, now = new Date()) {
  const day = indiaDate(now), lower = text.toLowerCase();
  const explicit = lower.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (explicit) {
    const value = explicit[1], date = new Date(value + 'T12:00:00Z');
    return Number.isFinite(+date) && date.toISOString().slice(0,10) === value && value > day && value <= addDays(day,365) ? value : null;
  }
  if (/\btomorrow\b/.test(lower)) return addDays(day,1);
  if (/\bnext week\b/.test(lower)) return addDays(day,7);
  const weekdays = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const weekday = weekdays.findIndex(d => new RegExp('\\b' + d + '\\b').test(lower));
  if (weekday >= 0) {
    const current = new Date(day + 'T12:00:00Z').getUTCDay();
    return addDays(day, (weekday - current + 7) % 7 || 7);
  }
  return null;
}
export const isStop = text => /^(please\s+)?(stop|unsubscribe|opt out|remove me)[.!\s]*$/i.test(text.trim()) || /\b(do not contact|don't contact|don’t contact|stop (messaging|contacting|sending)|no more messages|remove me from|unsubscribe me)\b/i.test(text);
export function decideReply({text, conversation = {}, inquiry, now = new Date()}) {
  const message = String(text || '').trim(), lower = message.toLowerCase();
  if (isStop(message)) return {kind:'stop', text:''};
  if (conversation.opted_out || conversation.mode === 'human') return {kind:'skip', text:''};
  if (!message || message === '[Media message]') return {kind:'handoff', task:'Review customer attachment', text:'Thank you for sharing this. I’m the Sports Center assistant helping Mayuri Pathak. I’ll ask Mayuri to review your attachment and get back to you.'};
  if (/\b(not interested|already purchased|already bought)\b/.test(lower)) return {kind:'not_interested', text:'Thank you for letting us know. We’ll stop these follow-ups. You’re welcome to message Sports Center whenever you need help.'};
  if (/\b(human|person|mayuri|call me|callback|call back|phone me|discount|negotiate|complaint|refund)\b/.test(lower)) return {kind:'handoff', task:/call|callback|phone/.test(lower)?'Customer requested a callback':'Mayuri’s attention requested', text:'I’m the Sports Center assistant helping Mayuri Pathak. I’ve flagged your message for her. Please share a convenient time if you’d like a callback.'};
  if (conversation.pending_date && /^(yes|confirm|confirmed|okay|ok)[.!\s]*$/i.test(message)) {
    if (conversation.pending_date > indiaDate(now) && inquiry && !['Converted','Not interested'].includes(inquiry.status)) return {kind:'schedule_confirm', date:conversation.pending_date, text:`Thank you. We’ll follow up on ${conversation.pending_date} (India time). You can message us here in the meantime.`};
    return {kind:'handoff', task:'Follow-up date needs review', text:'I’ll ask Mayuri to confirm a suitable follow-up date with you.'};
  }
  if (/\b(follow.?up|contact|call|remind|later|tomorrow|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\d{4}-\d{2}-\d{2}/i.test(message)) {
    const date = requestedDate(message,now);
    if (date && inquiry && !['Converted','Not interested'].includes(inquiry.status)) return {kind:'schedule_proposal', date, text:`Would you like us to follow up on ${date} (India time)? Please reply YES to confirm, or share another date as YYYY-MM-DD.`};
    return {kind:'handoff', task:'Confirm customer’s requested follow-up time', text:'Please share your preferred follow-up date as YYYY-MM-DD. I’ll ask Mayuri to confirm any specific call time.'};
  }
  if (/\b(quote|quotation|price|pricing|delivery|stock|available)\b/.test(lower)) return {kind:'handoff', task:'Quotation / availability request', text:'I can collect your requirements for Mayuri. Please share the equipment names, quantities and delivery location. Mayuri will confirm pricing, availability and the quotation.'};
  if (conversation.last_outbound_at) return {kind:'handoff', task:'Review customer requirements', text:'Thank you, I’ve recorded your message for Mayuri Pathak. She can review the details and help with the next step.'};
  return {kind:'reply', text:'Hello! I’m the Sports Center assistant helping Mayuri Pathak. Please share your name, location and whether you need gym machinery, a gym setup, sports equipment or servicing. You can ask to speak with Mayuri at any time.'};
}

// Evolution Go 0.7.3 serializes whatsmeow events under data, with exported Go field names.
export function normalizeEvolution(payload, expectedInstance) {
  if (!expectedInstance || payload.instanceId !== expectedInstance) throw Error('Unexpected instance');
  const d = payload.data || {}, info = d.Info || {}, source = info.MessageSource || info;
  if (['Message','SendMessage'].includes(payload.event)) {
    if (source.IsGroup || info.IsGroup || String(source.Chat || info.Chat || '').includes('@g.us')) return null;
    const fromMe = payload.event==='SendMessage' || (source.IsFromMe ?? info.IsFromMe ?? false);
    const jid = fromMe ? (source.Chat || info.Chat) : (source.SenderAlt || info.SenderAlt);
    const phone = phoneNumber(jid) || phoneNumber(fromMe ? (source.Chat || info.Chat) : (source.Sender || info.Sender));
    const msg = d.Message || {};
    if (!phone || !info.ID || msg.protocolMessage || msg.reactionMessage) return null;
    return {id:`message:${info.ID}`, type:fromMe?'outbound_echo':'message', phone, provider_id:info.ID,
      text:String(msg.conversation || msg.extendedTextMessage?.text || msg.imageMessage?.caption || msg.documentMessage?.caption || '[Media message]').slice(0,5000),
      occurred_at:info.Timestamp || null, stop:isStop(String(msg.conversation || msg.extendedTextMessage?.text || ''))};
  }
  if (['CallOffer','CallAccept','CallTerminate'].includes(payload.event)) {
    const meta = d.CallMeta || d.BasicCallMeta || d;
    const id = d.CallID || meta.CallID;
    const phone = phoneNumber(d.CallCreator || meta.CallCreator || d.From || meta.From);
    if (!id) return null;
    return {id:`${payload.event}:${id}`, type:'call', call_id:id, phone, state:payload.event, reason:String(d.Reason || '').toLowerCase()};
  }
  return null;
}
