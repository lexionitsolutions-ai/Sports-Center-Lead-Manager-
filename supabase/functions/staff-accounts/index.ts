import {createClient} from 'npm:@supabase/supabase-js@2';
import {validateStaff,staffIdentity} from '../../../shared/staff-domain.js';

const allowedOrigins=new Set(['https://sports-center-lead-manager.vercel.app','http://localhost:5173','http://127.0.0.1:5173']);
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')||'';
 const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
 if(allowedOrigins.has(origin))headers['Access-Control-Allow-Origin']=origin;
 headers['Access-Control-Allow-Headers']='authorization, apikey, content-type, x-client-info';
 headers['Access-Control-Allow-Methods']='POST, OPTIONS';
 const respond=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return respond(405,{error:'POST required'});
 if(origin&&!allowedOrigins.has(origin))return respond(403,{error:'Origin not allowed'});
 try{
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  // ADMIN_AUTH_START
  const authorization=req.headers.get('authorization')||'';
  if(!authorization.startsWith('Bearer '))return respond(401,{error:'Sign in first'});
  const {data:identity,error:authError}=await admin.auth.getUser(authorization.slice(7));
  if(authError||!identity.user)return respond(401,{error:'Session expired. Sign in again.'});
  const {data:profile,error:profileError}=await admin.from('profiles').select('role').eq('id',identity.user.id).single();
  if(profileError||profile?.role!=='admin')return respond(403,{error:'Administrator access required'});
  // ADMIN_AUTH_END
  const raw=await req.text();
  if(raw.length>8192)return respond(413,{error:'Request too large'});
  let input;
  try{input=validateStaff(JSON.parse(raw));}catch(error){return respond(400,{error:error instanceof Error?error.message:'Invalid account details'});}
  const {data,error}=await admin.auth.admin.createUser({
   email:staffIdentity(input.phone),password:input.password,email_confirm:true,
   user_metadata:{name:input.name},
   app_metadata:{sports_center_staff:true,sports_center_role:input.role,sports_center_name:input.name,sports_center_phone:input.phone}
  });
  if(error||!data.user)return respond(error?.status===422?409:400,{error:error?.code==='email_exists'?'An account already uses that phone number.':'Could not create account. Check the details or whether that number already has an account.'});
  return respond(201,{user:{id:data.user.id,name:input.name,phone:input.phone,role:input.role}});
 }catch{return respond(500,{error:'Account creation is temporarily unavailable.'});}
});
