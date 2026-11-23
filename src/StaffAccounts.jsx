import React,{useEffect,useState} from 'react';
import {Plus,RefreshCw,UsersRound} from 'lucide-react';
import {supabase} from './store';
import {validateStaff} from '../shared/staff-domain';
import './staff.css';

export default function StaffAccounts(){
 const [rows,setRows]=useState([]),[name,setName]=useState(''),[phone,setPhone]=useState(''),[password,setPassword]=useState(''),[role,setRole]=useState('technician'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[refresh,setRefresh]=useState(0);
 useEffect(()=>{if(!supabase)return;let active=true;supabase.from('profiles').select('id,name,phone,role').order('name').then(({data,error})=>{if(!active)return;if(error)setError('Could not load staff accounts.');else setRows(data);});return()=>{active=false;};},[refresh]);
 async function create(e){e.preventDefault();setBusy(true);setError('');setNotice('');try{
  const input=validateStaff({name,phone,password,role});
  if(!supabase)throw Error('Staff accounts require the live workspace.');
  const {data,error}=await supabase.functions.invoke('staff-accounts',{body:input});
  if(error){let message='Could not create the account. Check your session and try again.';try{const details=await error.context?.json();if(details?.error)message=details.error;}catch{}throw Error(message);}
  if(data?.error)throw Error(data.error);
  setNotice(`${input.name} can now sign in with ${input.phone} and the password you set.`);setName('');setPhone('');setPassword('');setRole('technician');setRefresh(x=>x+1);
 }catch(e){setError(e.message);}finally{setBusy(false);}}
 return <div className="staff-workspace">
  <section className="card staff-create"><div className="card-heading"><div><h2>Create a staff account</h2><p>Give your team their own phone login and access level.</p></div><UsersRound size={22}/></div>
   {error&&<div className="form-error" role="alert">{error}</div>}{notice&&<div className="info-note" role="status">{notice}</div>}
   {!supabase?<div className="info-note">Account creation is available in the live workspace.</div>:<form onSubmit={create}>
    <label>Staff name<input required maxLength={120} value={name} disabled={busy} onChange={e=>setName(e.target.value)} autoComplete="off"/></label>
    <label>Phone number<input required type="tel" maxLength={24} value={phone} disabled={busy} onChange={e=>setPhone(e.target.value)} placeholder="10-digit Indian number" autoComplete="off"/></label>
    <label>Initial password<input required type="password" minLength={10} maxLength={72} value={password} disabled={busy} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/><small>At least 10 characters, including letters and numbers. Share it with the staff member privately.</small></label>
    <label>Access level<select value={role} disabled={busy} onChange={e=>setRole(e.target.value)}><option value="technician">Technician</option><option value="admin">Administrator</option></select><small>{role==='admin'?'Full business access, customer conversations and staff account creation.':'Gym directory, service visit entry and their own visit history.'}</small></label>
    <button className="button primary" disabled={busy}><Plus size={16}/>{busy?'Creating account…':'Create account'}</button>
   </form>}
  </section>
  <section className="card"><div className="card-heading"><div><h2>Your team</h2><p>Each person signs in with their own phone number.</p></div><button className="button secondary compact" onClick={()=>setRefresh(x=>x+1)} disabled={busy}><RefreshCw size={15}/>Refresh</button></div><div className="table-scroll"><table><thead><tr><th>Name</th><th>Phone</th><th>Access</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{row.name}</td><td>{row.phone||'Not set'}</td><td>{row.role==='admin'?'Administrator':'Technician'}</td></tr>)}</tbody></table>{!rows.length&&<div className="empty"><p>No staff accounts to show.</p></div>}</div></section>
 </div>;
}
