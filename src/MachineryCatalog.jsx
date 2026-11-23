import React, { useEffect, useRef, useState } from 'react';
import { Plus, Search, X, Pencil, Upload, ChevronLeft, ChevronRight } from 'lucide-react';
import { CATEGORIES, UNITS, machineDimensions, normalizeMachine, validateMachine } from './quotation-domain';
import { photoDataUrl } from './machine-photos';
import { supabase } from './store';

export const currency = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(Number(n)||0);
export function Label({title,children,wide=false}){const id=React.useId();return <label className={`field ${wide?'wide':''}`}><span id={id}>{title}</span>{React.Children.map(children,child=>React.isValidElement(child)&&['input','select','textarea'].includes(child.type)&&!child.props['aria-label']?React.cloneElement(child,{'aria-labelledby':id}):child)}</label>;}

// Local vector illustrations keep the demo catalog available without image services.
export function MachineImage({machine}) {
 const [failed,setFailed]=useState(false);
 if((!machine.image_url||failed)&&['Dumbbells','Racks','Benches'].includes(machine.category))return <div className="machine-illustration"><svg viewBox="0 0 300 180" role="img" aria-label={`${machine.name}, illustrative equipment drawing`}><ellipse cx="150" cy="153" rx="105" ry="9" fill="#dce5d5"/><g fill="none" stroke="#325449" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round">{machine.category==='Dumbbells'?<><path d="M82 90h136"/><path d="M77 63v55M91 54v73M209 54v73M223 63v55" strokeWidth="18"/><path d="M119 90h62" stroke="#a5bc86" strokeWidth="14"/></>:machine.category==='Racks'?<><path d="M66 146l17-95M234 146l-17-95M73 124h154M78 96h144M83 68h134"/>{[68,96,124].map(y=><path key={y} d={`M100 ${y-11}v16M115 ${y-11}v16M142 ${y-11}v16M157 ${y-11}v16M185 ${y-11}v16M200 ${y-11}v16`} stroke="#a5bc86" strokeWidth="10"/>)}</>:<><path d="M75 145l30-66M224 145l-28-35M65 145h40M207 145h30M100 84l87 26"/><path d="M99 73l71 23M181 103l40 13" stroke="#a5bc86" strokeWidth="18"/></>}</g></svg><span>Demo illustration</span></div>;
 return machine.image_url&&!failed?<img className="machine-image" src={machine.image_url} alt={machine.name} onError={()=>setFailed(true)}/>:<div className="machine-illustration"><svg viewBox="0 0 300 180" role="img" aria-label={`${machine.name}, illustrative equipment drawing`}><ellipse cx="155" cy="163" rx="100" ry="9" fill="#dce5d5"/><g fill="none" stroke="#325449" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"><path d="M67 157h151M86 155V30h100v125M86 31l-20 18M186 31l23 18"/><path d="M174 45v82M162 65h24M162 79h24M162 93h24M162 107h24" strokeWidth="10" stroke="#839779"/>{machine.category==='Cardio'?<><path d="M65 151l137-21 13 25H65M202 130l-29-87h-27"/><path d="M145 42h38" stroke="#b6cc8d" strokeWidth="13"/></>:machine.category==='Legs'?<><path d="M105 145l65-57M102 113l32 17M164 84l24-28"/><path d="M101 110l25 14M173 66l18-15" stroke="#b6cc8d" strokeWidth="16"/></>:<><path d="M111 151v-44M111 110h37M115 106V78M114 53h39M133 31v22"/><path d={machine.category==='Abs'?'M110 89l21-15':machine.category==='Chest'?'M110 68l-14 25M150 68l13 25':'M105 54h52'} stroke="#b6cc8d" strokeWidth="12"/><path d="M103 106h39" stroke="#b6cc8d" strokeWidth="13"/></>}</g></svg><span>Demo illustration</span></div>;
}

export function Dialog({title,close,children,busy=false,wide=false}) {
 const ref=useRef(),busyRef=useRef(busy);busyRef.current=busy;
 useEffect(()=>{const prior=document.activeElement;(ref.current?.querySelector('[data-dialog-focus]')||ref.current?.querySelector('input,select,textarea,button'))?.focus();const key=e=>{if(e.key==='Escape'&&!busyRef.current)close();if(e.key==='Tab'){const nodes=[...ref.current.querySelectorAll('button,input,select,textarea,a[href]')].filter(n=>!n.disabled&&n.getClientRects().length);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);prior?.focus();};},[]);
 return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&!busy&&close()}><section className={`modal equipment-dialog ${wide?'equipment-dialog-wide':''}`} ref={ref} role="dialog" aria-modal="true" aria-labelledby="equipment-dialog-title"><header><h2 id="equipment-dialog-title">{title}</h2><button className="icon-button" aria-label="Close dialog" disabled={busy} onClick={close}><X size={20}/></button></header>{children}</section></div>;
}

export function Catalog({machines,database=false,onSelect,onCreate}) {
 const [category,setCategory]=useState('All'),[search,setSearch]=useState(''),[page,setPage]=useState(0);
 const compact=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const filtered=machines.filter(m=>(category==='All'||m.category===category)&&compact(`${m.name} ${m.brand||''} ${m.series||''} ${m.model_code||''} ${m.specifications} ${machineDimensions(m)}`).includes(compact(search)));
 const count=Math.ceil(filtered.length/24),current=Math.min(page,Math.max(0,count-1));
 return <section className={`equipment-catalog ${database?'database-catalog':''}`}>
  <div className="equipment-search-row"><label className="search-box"><Search size={19}/><input aria-label="Search machinery" placeholder="Search machinery…" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}}/>{search&&<button aria-label="Clear machinery search" onClick={()=>{setSearch('');setPage(0);}}><X size={16}/></button>}</label>{database&&<button className="button primary" onClick={onCreate}><Plus size={18}/>Add machinery</button>}</div>
  <div className="category-pills" aria-label="Machinery categories">{['All',...CATEGORIES].map(c=><button key={c} aria-pressed={category===c} className={category===c?'selected':''} onClick={()=>{setCategory(c);setPage(0);}}>{c}</button>)}</div>
  <div className="catalog-count">{filtered.length} {filtered.length===1?'machine':'machines'}</div>
  <div className="machine-grid">{filtered.slice(current*24,(current+1)*24).map(m=><article className="card machine-card" key={m.id}>
   <button className="machine-photo-button" aria-label={`${database?'Edit':'View'} ${m.name}`} onClick={()=>onSelect(m)}><MachineImage key={`${m.id}-${m.image_url}`} machine={m}/></button>
   <div className="machine-content"><span className="machine-category">{m.category}</span>{m.series&&<span className="machine-series">{m.series}</span>}<h3>{m.name}</h3><p className="machine-dimensions">{machineDimensions(m)} <span>· L × B × H</span></p>{database&&<p className="machine-spec-preview">{m.specifications||'No specifications added'}</p>}
   <div className="equipment-card-bottom"><div><span>{m.price_on_request?'PRICE':'MRP'}</span><strong className={m.price_on_request?'price-on-request':''}>{m.price_on_request?'Price on request':currency(m.mrp)}</strong></div><button className={`equipment-plus ${database?'edit-equipment':''}`} aria-label={`${database?'Edit':'Add'} ${m.name}`} onClick={()=>onSelect(m)}>{database?<Pencil size={18}/>:<Plus size={23}/>}</button></div></div>
  </article>)}</div>
  {!filtered.length&&<div className="card empty"><Search size={30}/><h3>{machines.length?'No machines found':'Add your first machine'}</h3>{!machines.length&&database&&<button className="button primary" onClick={onCreate}><Plus size={16}/>Add machinery</button>}</div>}
  {count>1&&<div className="catalog-pagination"><button className="button secondary compact" disabled={!current} onClick={()=>setPage(current-1)}><ChevronLeft size={16}/>Previous</button><span>{current+1} / {count}</span><button className="button secondary compact" disabled={current+1>=count} onClick={()=>setPage(current+1)}>Next<ChevronRight size={16}/></button></div>}
 </section>;
}

export function MachineEditor({machine,save,close}) {
 const [values,setValues]=useState(()=>normalizeMachine(machine||{name:'',category:'Back',mrp:'',price:0,image_url:'',specifications:''}));
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const change=(k,v)=>setValues(prev=>({...prev,[k]:v,...(k==='mrp'&&Number(v)>0?{price_on_request:false}:{})}));
 async function selectPhoto(e){const file=e.target.files?.[0];if(!file)return;setBusy(true);setError('');try{change('image_url',await photoDataUrl(file));}catch(err){setError(err.message);}finally{setBusy(false);e.target.value='';}}
 async function submit(e){e.preventDefault();setBusy(true);setError('');let uploaded;
  try{const {id,created_at,demo,...fields}=values;const payload=validateMachine({...fields,price:Number(fields.mrp)});
   if(supabase&&payload.image_url.startsWith('data:image/')){const blob=await (await fetch(payload.image_url)).blob();uploaded=`${crypto.randomUUID()}.jpg`;const {error}=await supabase.storage.from('machinery-photos').upload(uploaded,blob,{contentType:'image/jpeg',upsert:false});if(error)throw error;payload.image_url=supabase.storage.from('machinery-photos').getPublicUrl(uploaded).data.publicUrl;}
   await save('machines',payload,id);close();
  }catch(err){if(uploaded&&supabase)await supabase.storage.from('machinery-photos').remove([uploaded]);setError(err.message);}finally{setBusy(false);}
 }
 return <Dialog title={machine?'Edit machinery':'Add machinery'} close={close} busy={busy} wide><form onSubmit={submit}>
  {error&&<div className="equipment-form-error form-error" role="alert">{error}</div>}
  <div className="equipment-editor"><div className="equipment-photo-editor"><MachineImage key={values.image_url} machine={values}/><label className={`button secondary upload-photo ${busy?'disabled':''}`}><Upload size={17}/>{values.image_url?'Change photo':'Upload photo'}<input aria-label="Upload machinery photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={selectPhoto}/></label><span className="photo-file-hint">JPG, PNG or WebP</span><details className="photo-url"><summary>Use an image link</summary><Label title="Photo URL"><input type="url" maxLength={2000} placeholder="https://…" value={values.image_url.startsWith('https://')?values.image_url:''} onChange={e=>change('image_url',e.target.value)}/></Label></details></div>
   <div className="equipment-editor-fields"><Label title="Machine name"><input data-dialog-focus required maxLength={120} value={values.name} onChange={e=>change('name',e.target.value)}/></Label><Label title="Brand"><input maxLength={80} value={values.brand||''} onChange={e=>change('brand',e.target.value)}/></Label><Label title="Series"><input maxLength={120} value={values.series||''} onChange={e=>change('series',e.target.value)}/></Label><Label title="Model code"><input maxLength={80} value={values.model_code||''} onChange={e=>change('model_code',e.target.value)}/></Label><Label title="Category"><select value={values.category} onChange={e=>change('category',e.target.value)}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></Label>
   <div className="dimension-fields">{[['length','Length'],['breadth','Breadth'],['height','Height']].map(([key,label])=><Label title={label} key={key}><input required type="number" min="0.01" max="100000" step="0.01" value={values[key]} onChange={e=>change(key,e.target.value)}/></Label>)}<Label title="Unit"><select value={values.dimension_unit} onChange={e=>change('dimension_unit',e.target.value)}>{UNITS.map(u=><option key={u}>{u}</option>)}</select></Label></div>
   <Label title="MRP (₹)"><input required type="number" min="0" max="999999999999.99" step="0.01" value={values.mrp} onChange={e=>change('mrp',e.target.value)}/></Label><Label title="Specifications & included accessories"><textarea rows={5} maxLength={3000} placeholder="Weight stack, frame, attachments, accessories included…" value={values.specifications} onChange={e=>change('specifications',e.target.value)}/></Label>
   {values.source_url&&<a className="text-button" href={values.source_url} target="_blank" rel="noreferrer">Manufacturer product page</a>}
  </div></div><div className="modal-footer"><button type="button" className="button secondary" disabled={busy} onClick={close}>Cancel</button><button className="button primary" disabled={busy}>{busy?'Saving…':'Save machinery'}</button></div>
 </form></Dialog>;
}

