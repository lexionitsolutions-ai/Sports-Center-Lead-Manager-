import { jsPDF } from 'jspdf';
import { quoteTotals } from './quotation-domain.js';
import { snapshotPhoto } from './machine-photos.js';

const amount=n=>Number(n).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const printable=s=>String(s??'').replace(/\u00d7/g,'x').normalize('NFKD').replace(/[^\x20-\x7E\n]/g,' ');

export async function quotationPdf(q) {
 const totals=quoteTotals(q.items,18,0),doc=new jsPDF({compress:true});
 const photos=await Promise.all(q.items.map(i=>snapshotPhoto(i.image_url||'')));
 const left=14,right=196,bottom=274;let y=0;
 const color='#20483e',muted='#75857c';
 function text(value,x,at,size=9,c=color,options={}){doc.setFontSize(size);doc.setTextColor(c);doc.text(Array.isArray(value)?value.map(printable):printable(value),x,at,options);}
 function lines(value,width,size=9){doc.setFontSize(size);return doc.splitTextToSize(printable(value),width);}
 function header(){doc.setFillColor('#193f35');doc.rect(0,0,210,34,'F');doc.setFont('helvetica','bold');text('SPORTS CENTER',left,17,21,'#ffffff');doc.setFont('helvetica','normal');text('QUOTATION  /  GYM EQUIPMENT',left,26,9,'#d9e8d0');text('PROPOSAL',right,18,9,'#ffffff',{align:'right'});y=44;}
 function nextPage(){doc.addPage();header();}
 function room(h){if(y+h>bottom)nextPage();}
 function block(value,size=9){for(const line of lines(value,182,size)){room(5);text(line,left,y,size);y+=5;}}
 header();doc.setFont('helvetica','bold');block(`PREPARED FOR  ${q.customer_name}`,12);doc.setFont('helvetica','normal');
 for(const value of [q.customer_contact,q.customer_phone,q.customer_email,q.customer_address])if(value)block(value);
 y+=2;block(`Quotation: ${q.number}`);block(`Date: ${q.issued_on}    |    Valid until: ${q.valid_until}`);y+=7;
 const cols=[14,44,102,127,154,166,196];
 function tableHead(){room(16);doc.setFillColor('#eaf0e5');doc.rect(left,y,right-left,14,'F');doc.setFont('helvetica','bold');text('PHOTO',17,y+8,8);text('MACHINE / SPECIFICATIONS',47,y+8,8);text(['MRP','/ unit'],124,y+5,8,color,{align:'right'});text(['DISCOUNTED','price / unit'],151,y+5,7.5,color,{align:'right'});text('QTY',160,y+8,8,color,{align:'center'});text(['TOTAL','INR'],193,y+5,8,color,{align:'right'});doc.setFont('helvetica','normal');y+=14;}
 tableHead();
 q.items.forEach((item,index)=>{
  const detail=[...lines(item.name,52,10),...lines(item.dimensions,52,8.5),...lines(item.specifications||'',52,8.5)];
  let offset=0,first=true;
  while(offset<detail.length){
   if(bottom-y<48){nextPage();tableHead();}
   const capacity=Math.max(1,Math.floor((bottom-y-10)/4.4));
   const chunk=detail.slice(offset,offset+capacity),height=Math.max(first?36:18,chunk.length*4.4+10);
   doc.setDrawColor('#e1e7e0');doc.setLineWidth(0.2);doc.rect(left,y,right-left,height);for(const x of cols.slice(1,-1))doc.line(x,y,x,y+height);
   if(first){
    if(photos[index]){const props=doc.getImageProperties(photos[index]);const scale=Math.min(26/props.width,28/props.height);const w=props.width*scale,h=props.height*scale;doc.addImage(photos[index],'JPEG',16+(26-w)/2,y+4+(28-h)/2,w,h,undefined,'FAST');}
    else{text(['Photo not','added'],29,y+19,7.5,muted,{align:'center'});}
    text(amount(item.mrp),124,y+10,8.5,color,{align:'right'});text(amount(item.price),151,y+10,8.5,color,{align:'right'});text(String(item.quantity),160,y+10,9,color,{align:'center'});text(amount(Math.round(item.price*item.quantity*100)/100),193,y+10,8.5,color,{align:'right'});
   }else{text('Continued',29,y+10,7,muted,{align:'center'});}
   chunk.forEach((line,n)=>{doc.setFont('helvetica',first&&n===0?'bold':'normal');text(line,47,y+7+n*4.4,first&&n===0?10:8.5);});doc.setFont('helvetica','normal');
   offset+=chunk.length;y+=height;first=false;
  }
 });
 room(67);y+=7;const signatureY=y+10;
 for(const [label,value] of [['Total MRP',`INR ${amount(totals.mrp)}`],['Total discount',`INR ${amount(totals.discount)}`],['Total of all machinery',`INR ${amount(totals.subtotal)}`],['GST 18%',''],['Transportation','As actual']]){text(label,105,y,10);text(value,193,y,10,color,{align:'right'});y+=7;}
 doc.setFillColor('#193f35');doc.roundedRect(101,y-3,95,14,2,2,'F');doc.setFont('helvetica','bold');text('TOTAL WITH GST',105,y+6,9,'#ffffff');text(`INR ${amount(totals.total)}`,192,y+6,12,'#ffffff',{align:'right'});doc.setFont('helvetica','normal');y+=22;
 doc.setFont('helvetica','bold');text('Mayuri Pathak',left,signatureY,11);doc.setFont('helvetica','normal');text('For Sports Center',left,signatureY+6,9);
 if(q.notes){block(q.notes,9);y+=5;}
 const count=doc.getNumberOfPages();for(let p=1;p<=count;p++){doc.setPage(p);text('SPORTS CENTER  |  All prices in INR',left,288,8,muted);text(`Page ${p} of ${count}`,right,288,8,muted,{align:'right'});}
 return doc;
}
export const quotationFilename=q=>`${q.number}-${q.customer_name}`.replace(/[^a-z0-9-]/gi,'-').slice(0,110)+'.pdf';
