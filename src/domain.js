export const REASONS = ['Gym machinery', 'Professional gym setup', 'Home gym setup', 'School equipment', 'Sports equipment', 'Other'];
export const INQUIRY_STATUSES = ['New', 'Call done', 'Interested', 'Call not received', 'Not interested', 'Converted', 'Quoted'];
export function inquiryStatus(status) { return ({Contacted:'Call done',Won:'Converted',Lost:'Not interested'})[status]||status; }
export function isConverted(status) { return inquiryStatus(status)==='Converted'; }
export function isClosed(status) { return ['Converted','Not interested'].includes(inquiryStatus(status)); }
export function statusClass(status) { return inquiryStatus(status).toLowerCase().replaceAll(' ','-'); }
export function normalizeInquiry(row) {return {...row,status:inquiryStatus(row.status),follow_up:isClosed(row.status)?null:row.follow_up};}
function validDate(value) {return /^\d{4}-\d{2}-\d{2}$/.test(value||'') && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)===value;}
export function validateFollowup(input) {
 const status=inquiryStatus(input.status);
 if(!INQUIRY_STATUSES.includes(status))throw Error('Choose a follow-up status.');
 if(!isClosed(status)&&!validDate(input.follow_up))throw Error('Choose the next follow-up date.');
 let amount=0;if(isConverted(status)){amount=Number(input.amount);if(input.amount===''||input.amount==null||!Number.isFinite(amount)||amount<0||amount>999999999999.99)throw Error('Enter a valid collected amount.');amount=Math.round(amount*100)/100;}
 if(String(input.notes||'').length>3000)throw Error('Keep notes within 3,000 characters.');
 return {status,follow_up:isClosed(status)?null:input.follow_up,amount,notes:String(input.notes||'').trim()};
}
export function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date()); }
export function shiftDate(date, days) { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0,10); }
export function dateLabel(date, options = {}) { return date ? new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { day:'numeric', month:'short', ...options }) : 'Not recorded'; }
export function money(value) { return new Intl.NumberFormat('en-IN', {style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(value)||0); }
export function dueInquiries(inquiries, date) { return inquiries.filter(i => !isClosed(i.status) && i.follow_up === date); }
export function metrics(data, date) {
  const open = data.inquiries.filter(i => !isClosed(i.status));
  const won = data.inquiries.filter(i=>isConverted(i.status));
  return { open:open.length, due:dueInquiries(data.inquiries,date).length, overdue:open.filter(i=>i.follow_up&&i.follow_up<date).length, won:won.length, revenue:won.reduce((s,i)=>s+Number(i.amount||0),0), serviceRevenue:data.visits.reduce((s,v)=>s+Number(v.charge||0),0), renewals:data.gyms.filter(g=>g.amc_renewal>=date&&g.amc_renewal<=shiftDate(date,30)).length };
}
export function validateInquiry(input) { if (!input.name?.trim()) throw new Error('Enter the customer name.'); if (!/^[+\d][\d\s()-]{6,19}$/.test(input.phone||'')) throw new Error('Enter a valid contact number (7–20 characters).'); if (!REASONS.includes(input.reason)) throw new Error('Choose a reason for visit.'); if (input.reason==='Other'&&!input.other_reason?.trim()) throw new Error('Please specify the reason.'); if (!validDate(input.follow_up)) throw new Error('Choose a follow-up date.'); return {...input,name:input.name.trim()}; }
