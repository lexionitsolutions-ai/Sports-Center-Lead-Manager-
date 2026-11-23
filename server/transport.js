import {createHmac, timingSafeEqual} from 'node:crypto';

export function sameSecret(a, b) {
  const left = Buffer.from(String(a || '')), right = Buffer.from(String(b || ''));
  return left.length > 0 && left.length === right.length && timingSafeEqual(left,right);
}
export function verifyTelephony(raw, timestamp, signature, secret, now = Date.now()) {
  if (!secret || !/^\d{10}$/.test(timestamp || '') || Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac('sha256',secret).update(`${timestamp}.`).update(raw).digest('hex');
  return sameSecret(signature,expected);
}
export async function sendEvolution(config, job, phone, fetcher = fetch) {
  try {
    const response = await fetcher(`${config.evolutionUrl}/send/text`, {
      method:'POST', headers:{'Content-Type':'application/json',apikey:config.evolutionToken},
      body:JSON.stringify({number:phone, text:job.body, id:job.provider_id, delay:0}),
      signal:AbortSignal.timeout(20000), redirect:'error'
    });
    if (!response.ok) return {
      state:[400,401,403,404,422,429,503].includes(response.status)?'failed':'uncertain',
      error:`Evolution returned HTTP ${response.status}. Review WhatsApp before sending again.`
    };
    const payload = await response.json();
    if (payload?.data?.Info?.ID !== job.provider_id) return {state:'uncertain',error:'Unexpected send acknowledgement. Check WhatsApp before sending again.'};
    return {state:'sent',error:'',sent_at:new Date().toISOString()};
  } catch {
    return {state:'uncertain',error:'Send response was interrupted. Check WhatsApp before sending again.'};
  }
}
