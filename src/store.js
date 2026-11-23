import { createClient } from '@supabase/supabase-js';
import { seed } from './seed';
import { demoMachines, normalizeMachine } from './quotation-domain';
import { readDemo, writeDemo } from './demo-database';
import { normalizeInquiry } from './domain';
export const supabase = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY ? createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY) : null;
const KEY='sports-center-demo-v1';
export async function loadData(role) {
 if(!supabase) {
  let saved=await readDemo();
  if(!saved){const legacy=localStorage.getItem(KEY);saved=legacy?JSON.parse(legacy):seed();}
  const demo={machines:demoMachines(),quotations:[],...saved};
  demo.inquiries=demo.inquiries.map(normalizeInquiry);
  const samples=demoMachines();
  demo.machines=demo.machines.map(m=>normalizeMachine(m.demo?{...samples.find(s=>s.id===m.id),...m,image_url:m.image_url||samples.find(s=>s.id===m.id)?.image_url||''}:m));
  await writeDemo(demo);localStorage.removeItem(KEY);return demo;
 }
 const names=role==='technician'?['gyms','visits']:['inquiries','gyms','visits','deliveries','machines','quotations'];
 const results=await Promise.all(names.map(async name=>{
  const rows=[];let start=0;
  do {const {data,error}=await supabase.from(name).select('*').order('id').range(start,start+999);if(error)throw error;rows.push(...data);if(data.length<1000)break;start+=1000;}while(true);
  return [name,name==='inquiries'?rows.map(normalizeInquiry):rows];
 }));
 return {inquiries:[],gyms:[],visits:[],deliveries:[],machines:[],quotations:[],...Object.fromEntries(results)};
}
export async function saveRecord(table,record,existing,data) {
 if(Array.isArray(record)) {
  let rows;
  if(supabase){const result=await supabase.from(table).insert(record).select();if(result.error)throw result.error;rows=result.data;}
  else rows=record.map(r=>({...r,id:crypto.randomUUID(),created_at:new Date().toISOString()}));
  const next={...data,[table]:[...rows,...data[table]]};
  if(!supabase)await writeDemo(next);return next;
 }
 let saved;
 if(supabase){ const query=existing?supabase.from(table).update(record).eq('id',existing):supabase.from(table).insert(record); const {data:rows,error}=await query.select().single();if(error)throw error;saved=rows; }
 else saved={...record,id:existing||crypto.randomUUID(),created_at:new Date().toISOString()};
 const next={...data,[table]:existing?data[table].map(r=>r.id===existing?{...r,...saved}:r):[saved,...data[table]]};
 if(!supabase)await writeDemo(next);
 return next;
}
