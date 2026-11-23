export const CATEGORIES = ['Back', 'Biceps', 'Chest', 'Triceps', 'Shoulders', 'Abs', 'Legs', 'Dumbbells', 'Racks', 'Benches', 'Cardio', 'Accessories'];
export const UNITS = ['cm', 'mm', 'in', 'm'];
export function machineDimensions(m) {
 return m.length && m.breadth && m.height ? `${m.length} × ${m.breadth} × ${m.height} ${m.dimension_unit||'cm'}` : m.dimensions||'';
}
export function normalizeMachine(m) {
 const parts=String(m.dimensions||'').match(/^\s*([\d.]+)\s*[×x]\s*([\d.]+)\s*[×x]\s*([\d.]+)\s*(cm|mm|in|m)\s*$/i);
 const structured=['length','breadth','height'].every(k=>m[k]!=null);
 return {...m,length:m.length??(parts?Number(parts[1]):''),breadth:m.breadth??(parts?Number(parts[2]):''),height:m.height??(parts?Number(parts[3]):''),dimension_unit:!structured&&parts?parts[4]:(m.dimension_unit||'cm'),specifications:m.specifications||''};
}
export const demoMachines = () => [
 ['Lat pull-down','Back','145 × 120 × 225 cm',125000,97500],
 ['Seated row','Back','180 × 110 × 160 cm',110000,88000],
 ['Chest press','Chest','135 × 150 × 165 cm',135000,108000],
 ['Pec fly / rear delt','Chest','140 × 130 × 205 cm',145000,116000],
 ['Abdominal crunch','Abs','125 × 115 × 150 cm',95000,76000],
 ['Vertical knee raise','Abs','120 × 105 × 220 cm',45000,36000],
 ['Leg press','Legs','220 × 150 × 160 cm',185000,148000],
 ['Leg extension','Legs','140 × 110 × 155 cm',115000,92000],
 ['Shoulder press','Shoulders','145 × 135 × 165 cm',125000,100000],
 ['Commercial treadmill','Cardio','210 × 95 × 155 cm',225000,180000],
 ['Preacher curl','Biceps','115 × 100 × 145 cm',85000,68000],
 ['Triceps extension','Triceps','130 × 110 × 155 cm',95000,76000],
 ['Rubber dumbbell pair, 10 kg','Dumbbells','32 × 15 × 15 cm',6000,4800],
 ['Three-tier dumbbell rack','Racks','150 × 65 × 90 cm',25000,20000],
].map(([name,category,dimensions,mrp,price],i)=>normalizeMachine({id:`demo-machine-${i}`,name,category,dimensions,mrp,price,image_url:i===0?'/demo-machines/lat-pulldown.jpg':'',specifications:category==='Dumbbells'?'One pair, 10 kg each. Rubber-coated heads and textured handles.':category==='Racks'?'Three-tier storage frame. Dumbbells sold separately.':'Commercial frame, adjustable setup and padded contact points. Sample specifications; confirm the actual model and included accessories.',demo:true}));
export const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
export function validateMachine(m) {
 if(!m.name?.trim() || !CATEGORIES.includes(m.category)) throw Error('Enter a machine name and category.');
 const normalized=normalizeMachine(m);
 for(const key of ['length','breadth','height']) if(!Number.isFinite(Number(normalized[key]))||Number(normalized[key])<=0||Number(normalized[key])>100000) throw Error('Enter a positive length, breadth and height.');
 if(!UNITS.includes(normalized.dimension_unit)) throw Error('Choose a dimension unit.');
 for(const key of ['mrp','price']) if(m[key]==='' || m[key]==null || !Number.isFinite(Number(m[key])) || Number(m[key])<0) throw Error('Enter valid non-negative prices.');
 if(Number(m.price)>Number(m.mrp)) throw Error('Selling price cannot exceed MRP.');
 if(m.image_url && !/^(https:\/\/|data:image\/(jpeg|png|webp);base64,|\/demo-machines\/[a-z0-9-]+\.jpg$)/i.test(m.image_url)) throw Error('Upload a photo or use an HTTPS image URL.');
 if(String(m.specifications||'').length>3000) throw Error('Keep specifications within 3,000 characters.');
 for(const [key,max] of [['brand',80],['series',120],['model_code',80]])if(String(m[key]||'').length>max)throw Error(`Keep ${key.replace('_',' ')} within ${max} characters.`);
 if(m.source_url&&!/^https:\/\//.test(m.source_url))throw Error('Use an HTTPS manufacturer source URL.');
 const result={...normalized,name:m.name.trim(),length:Number(normalized.length),breadth:Number(normalized.breadth),height:Number(normalized.height),mrp:round(Number(m.mrp)),price:round(Number(m.price)),specifications:String(m.specifications||'').trim()};
 return {...result,price_on_request:Boolean(m.price_on_request)&&Number(m.mrp)===0,dimensions:machineDimensions(result)};
}
export function assertMachinePriced(machine) {
 if(machine.price_on_request)throw Error('Set a confirmed MRP in Machinery database before adding this machine to a quotation.');
}
export function quoteTotals(items,tax=0,delivery=0) {
 if(!Array.isArray(items)||!items.length) throw Error('Add at least one machine to the quotation.');
 let mrp=0,subtotal=0;
 for(const i of items){
  assertMachinePriced(i);
  if(!i.name?.trim() || !Number.isInteger(Number(i.quantity)) || Number(i.quantity)<1 || Number(i.quantity)>999) throw Error('Quantities must be whole numbers from 1 to 999.');
  if(i.price==='' || i.price==null || i.mrp==='' || i.mrp==null || !Number.isFinite(Number(i.price)) || !Number.isFinite(Number(i.mrp)) || Number(i.price)<0 || Number(i.mrp)<Number(i.price)) throw Error('Each selling price must be between zero and MRP.');
  mrp+=round(Number(i.mrp)*Number(i.quantity)); subtotal+=round(Number(i.price)*Number(i.quantity));
 }
 if(!Number.isFinite(Number(tax))||Number(tax)<0||Number(tax)>100||!Number.isFinite(Number(delivery))||Number(delivery)<0) throw Error('Check the tax rate and delivery charge.');
 if(!Number.isFinite(mrp+subtotal+Number(delivery))) throw Error('Quotation amounts are too large.');
 mrp=round(mrp);subtotal=round(subtotal);const gst=round(subtotal*Number(tax)/100);
 return {mrp,subtotal,discount:round(mrp-subtotal),tax:gst,delivery:round(Number(delivery)),total:round(subtotal+gst+Number(delivery))};
}
