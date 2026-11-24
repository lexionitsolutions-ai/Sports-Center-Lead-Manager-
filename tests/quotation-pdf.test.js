import test from 'node:test';
import assert from 'node:assert/strict';
import { quotationPdf, quotationFilename } from '../src/quotation-pdf.js';
import { quotationLine, applyQuotationDiscount } from '../src/quotation-domain.js';
const quote=()=>({number:'SC-20261124-TEST',customer_name:'Prime Strength Gym',customer_phone:'+91 98765 43210',issued_on:'2026-11-24',valid_until:'2026-12-09',items:applyQuotationDiscount(['Lat pulldown','Chest press','Shoulder press'].map(name=>quotationLine({name,dimensions:'145 × 120 × 225 cm',specifications:'Commercial strength equipment. Adjustable seat and padded contact points.'})),35)});
test('professional PDF names customer, shows machinery and totals, and labels GST without a tax amount',async()=>{
 const q=quote(),doc=await quotationPdf(q),content=doc.internal.pages.flat().join('\n');
 assert.equal(doc.getNumberOfPages(),1);
 for(const value of ['SPORTS CENTER','Prime Strength Gym',q.customer_phone,q.number,'Lat pulldown','Chest press','Shoulder press','145 x 120 x 225 cm','GST 18%','As actual','2,30,100.00','Mayuri Pathak'])assert.ok(content.includes(value),value);
 assert.ok(!content.includes('35,100.00'));
 assert.ok(quotationFilename(q).endsWith('.pdf'));
});
test('long quotations keep table headings and page numbering across pages',async()=>{
 const q=quote();q.items=Array.from({length:20},(_,i)=>({...q.items[i%3],name:`${i+1}. ${q.items[i%3].name}`}));
 const doc=await quotationPdf(q),pages=doc.internal.pages.slice(1).map(p=>p.join('\n'));
 assert.ok(pages.length>1);
 pages.forEach((p,i)=>{assert.ok(p.includes('SPORTS CENTER'));assert.ok(p.includes(`Page ${i+1} of ${pages.length}`));});
 assert.ok(pages.at(-1).includes('20. Chest press'));
 assert.ok(pages.at(-1).includes('15,34,000.00'));
});
