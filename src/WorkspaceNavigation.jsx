import React,{useEffect,useRef} from 'react';
import {X,ArrowUpRight,LogOut,ShieldCheck} from 'lucide-react';
import {primaryForRole,toolsForRole} from './navigation';

export function BrandLogo({large=false}){
 return <span className={`brand-lockup ${large?'brand-lockup-large':''}`}><img className="brand-shield" src="/brand/sc-shield-hd.png" alt="Sports Centre SC shield" width="64" height="64"/><span className="brand-wordmark" aria-hidden="true"><span>SPORTS</span><span>CENTRE</span></span></span>;
}

const shortLabels={dashboard:'Overview',inquiries:'Inquiries',followups:'Follow-ups',services:'Service & AMC',quotations:'Quotations'};
export function BottomNavigation({pages,page,role,due,onNavigate,inert=false}){
 const items=primaryForRole(role).map(id=>pages.find(p=>p[0]===id)).filter(Boolean);
 return <nav className={`bottom-navigation ${items.length===1?'single-destination':''}`} style={{'--nav-items':items.length}} aria-label="Main navigation" inert={inert||undefined}>
  {items.map(([id,label,Icon])=><button key={id} className={`bottom-nav-item ${page===id?'active':''}`} aria-label={id==='followups'&&due>0?`${label}, ${due} due`:label} aria-current={page===id?'page':undefined} onClick={()=>onNavigate(id)}><span className="bottom-nav-icon"><Icon size={21} strokeWidth={page===id?2.2:1.7}/>{id==='followups'&&due>0&&<span className="bottom-nav-count" aria-label={`${due} due`}>{due>99?'99+':due}</span>}</span><span>{shortLabels[id]||label}</span></button>)}
 </nav>;
}

export function WorkspaceMenu({open,close,pages,page,role,name,live,onNavigate,onHelp,onLogout,onDemoRole}){
 const panel=useRef();
 useEffect(()=>{
  if(!open)return;
  const prior=document.activeElement,oldOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';panel.current?.querySelector('button')?.focus();
  const key=e=>{
   if(e.key==='Escape'){e.preventDefault();close();}
   if(e.key==='Tab'){
    const nodes=[...panel.current.querySelectorAll('button:not([disabled]),a[href],select')];
    if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1)?.focus();}
    else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0]?.focus();}
   }
  };
  document.addEventListener('keydown',key);
  return()=>{document.removeEventListener('keydown',key);document.body.style.overflow=oldOverflow;prior?.focus();};
 },[open]);
 if(!open)return null;
 const items=toolsForRole(role).map(id=>pages.find(p=>p[0]===id)).filter(Boolean);
 return <div className="workspace-menu-backdrop" onMouseDown={e=>e.target===e.currentTarget&&close()}><section className="workspace-menu" id="workspace-tools" role="dialog" aria-modal="true" aria-labelledby="workspace-menu-title" ref={panel}>
  <header><BrandLogo/><button className="icon-button" onClick={close} aria-label="Close workspace menu"><X size={21}/></button></header>
  <div className="workspace-menu-intro"><span className="menu-eyebrow">SPORTS CENTRE</span><h2 id="workspace-menu-title">Your workspace</h2><p>Tools and team management, in one place.</p></div>
  <nav aria-label="Workspace tools">{items.map(([id,label,Icon])=><button key={id} className={`workspace-tool ${page===id?'active':''}`} aria-current={page===id?'page':undefined} onClick={()=>onNavigate(id)}><span className="workspace-tool-icon"><Icon size={19}/></span><span><strong>{label}</strong>{id==='machines'&&<small>Equipment, photos and specifications</small>}{id==='agent'&&<small>Messages and scheduled follow-ups</small>}{id==='staff'&&<small>Phone logins and access levels</small>}</span><ArrowUpRight size={15}/></button>)}</nav>
  <div className="workspace-menu-footer"><div><ShieldCheck size={19}/><span><strong>{name}</strong><small>{role==='admin'?'Administrator':'Technician'} · {live?'Live workspace':'Demo workspace'}</small></span></div><button className="text-button" onClick={onHelp}>Workspace guide<ArrowUpRight size={14}/></button>{!live&&<label className="menu-demo-role">Preview role<select aria-label="Demo role" value={role} onChange={e=>onDemoRole(e.target.value)}><option value="admin">Administrator</option><option value="technician">Technician</option></select></label>}{live&&<button className="menu-sign-out" onClick={onLogout}><LogOut size={16}/>Sign out</button>}</div>
 </section></div>;
}
