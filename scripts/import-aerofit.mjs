import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {staffIdentity} from '../shared/staff-domain.js';
import {validateMachine} from '../src/quotation-domain.js';

// Credentials are supplied only through the process environment, never the manifest or repository.
try {process.loadEnvFile('.env.local');}catch{/* CI may supply the environment directly. */}
const url=process.env.VITE_SUPABASE_URL,key=process.env.VITE_SUPABASE_ANON_KEY;
const phone=process.env.SPORTS_CENTER_IMPORT_PHONE,password=process.env.SPORTS_CENTER_IMPORT_PASSWORD;
if(!url||!key||!phone||!password)throw Error('Set the public Supabase configuration and SPORTS_CENTER_IMPORT_PHONE / SPORTS_CENTER_IMPORT_PASSWORD.');
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(30000)})}});
const manifest=JSON.parse(await fs.readFile(new URL('../data/aerofit-aero-power.json',import.meta.url),'utf8'));
const result=[];
try{
 const login=await db.auth.signInWithPassword({email:staffIdentity(phone),password});
 if(login.error)throw Error('Administrator login failed.');
 const profile=await db.from('profiles').select('role').eq('id',login.data.user.id).single();
 if(profile.error||profile.data.role!=='admin')throw Error('Administrator access required.');
 const existing=await db.from('machines').select('id,source_url,brand,model_code');
 if(existing.error)throw existing.error;
 await fs.mkdir('tmp/aerofit-import/images',{recursive:true});
 for(const entry of manifest.machines){
  const {source_image_url,...fields}=entry;
  const prior=existing.data.find(x=>x.source_url===fields.source_url||(x.brand===fields.brand&&x.model_code===fields.model_code));
  if(prior){result.push({model:fields.model_code,id:prior.id,status:'already imported'});continue;}
  const imageUrl=new URL(source_image_url);
  if(imageUrl.protocol!=='https:'||imageUrl.hostname!=='aerofit.co')throw Error('Unexpected image host for '+fields.model_code);
  const response=await fetch(imageUrl,{signal:AbortSignal.timeout(30000),redirect:'error'});
  if(!response.ok)throw Error('Image download failed for '+fields.model_code);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(!bytes.length||bytes.length>5242880)throw Error('Image size invalid for '+fields.model_code);
  const format=bytes[0]===0xff&&bytes[1]===0xd8?['jpg','image/jpeg']:bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?['png','image/png']:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?['webp','image/webp']:null;
  if(!format)throw Error('Unsupported image content for '+fields.model_code);
  const hash=crypto.createHash('sha256').update(bytes).digest('hex').slice(0,16);
  const path=`aerofit/aero-power/${fields.model_code.toLowerCase()}-${hash}.${format[0]}`;
  await fs.writeFile(`tmp/aerofit-import/images/${fields.model_code}.${format[0]}`,bytes);
  const upload=await db.storage.from('machinery-photos').upload(path,bytes,{contentType:format[1],upsert:false});
  if(upload.error&&!/already exists|duplicate/i.test(upload.error.message))throw upload.error;
  const image_url=db.storage.from('machinery-photos').getPublicUrl(path).data.publicUrl;
  const payload=validateMachine({...fields,image_url});
  const insert=await db.from('machines').insert(payload).select('id').single();
  if(insert.error)throw insert.error;
  result.push({model:fields.model_code,category:fields.category,id:insert.data.id,image_url,status:'imported'});
  console.log(JSON.stringify({model:fields.model_code,category:fields.category,status:'imported'}));
 }
 await fs.writeFile('tmp/aerofit-import/result.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify({total:result.length,imported:result.filter(x=>x.status==='imported').length,skipped:result.filter(x=>x.status==='already imported').length}));
}finally{await db.auth.signOut();}
