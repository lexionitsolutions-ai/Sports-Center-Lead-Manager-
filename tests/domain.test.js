import test from 'node:test';
import assert from 'node:assert/strict';
import { dueInquiries, metrics, shiftDate, validateInquiry, validateFollowup, today, isClosed, normalizeInquiry } from '../src/domain.js';
test('follow-ups show the selected day and exclude closed deals',()=>{
 const rows=[{status:'New',follow_up:'2026-11-23'},{status:'Won',follow_up:'2026-11-23'},{status:'Lost',follow_up:'2026-11-23'},{status:'Contacted',follow_up:'2026-11-24'}];
 assert.equal(dueInquiries(rows,'2026-11-23').length,1);
 assert.equal(dueInquiries(rows,'2026-11-24').length,1);
});
test('dashboard separates collected sales, service charges, overdue calls and upcoming renewals',()=>{
 const data={inquiries:[{status:'Won',amount:100,follow_up:'2026-11-20'},{status:'Lost',amount:0,follow_up:'2026-11-20'},{status:'Quoted',follow_up:'2026-11-20'},{status:'New',follow_up:'2026-11-21'}],visits:[{charge:25},{charge:0}],gyms:[{amc_renewal:'2026-11-20'},{amc_renewal:'2026-11-21'},{amc_renewal:'2026-12-21'},{amc_renewal:'2026-12-22'}]};
 assert.deepEqual(metrics(data,'2026-11-21'),{open:2,due:1,overdue:1,won:1,revenue:100,serviceRevenue:25,renewals:2});
});
test('custom reasons and invalid numbers cannot be saved',()=>{
 const valid={name:' Raj ',phone:'9876543210',reason:'Other',other_reason:'Treadmill accessories',follow_up:'2026-11-23'};
 assert.equal(validateInquiry(valid).name,'Raj');
 assert.throws(()=>validateInquiry({...valid,other_reason:' '}));
 assert.throws(()=>validateInquiry({...valid,phone:'abc'}));
 assert.throws(()=>validateInquiry({...valid,follow_up:''}));
});
test('date navigation handles month and year changes',()=>{
 assert.equal(shiftDate('2026-12-31',1),'2027-01-01');
 assert.equal(shiftDate('2026-03-01',-1),'2026-02-28');
 assert.match(today(),/^\d{4}-\d{2}-\d{2}$/);
});
test('rescheduling moves an inquiry to the selected date and closes without another date',()=>{
 const row={name:'Customer',status:'New',follow_up:'2026-11-22',amount:0};
 const updated={...row,...validateFollowup({status:'Interested',follow_up:'2026-11-25',amount:0,notes:'Called'})};
 assert.equal(dueInquiries([updated],'2026-11-22').length,0);
 assert.equal(dueInquiries([updated],'2026-11-25').length,1);
 for(const status of ['Not interested','Converted']){
  const closed={...updated,...validateFollowup({status,follow_up:'',amount:status==='Converted'?5000:0})};
  assert.equal(closed.follow_up,null);assert.equal(isClosed(closed.status),true);assert.equal(dueInquiries([closed],'2026-11-25').length,0);
 }
});
test('call outcomes require real dates, converted sales feed collected revenue, legacy statuses remain compatible',()=>{
 for(const status of ['Call done','Interested','Call not received']){
  assert.throws(()=>validateFollowup({status,follow_up:'',amount:0}));
  assert.throws(()=>validateFollowup({status,follow_up:'2026-02-30',amount:0}));
  assert.equal(validateFollowup({status,follow_up:'2026-11-25',amount:100}).amount,0);
 }
 assert.throws(()=>validateFollowup({status:'Converted',amount:-1}));
 assert.equal(normalizeInquiry({status:'Won',follow_up:'2026-11-25',amount:2500}).follow_up,null);
 assert.equal(normalizeInquiry({status:'Contacted'}).status,'Call done');
 assert.equal(normalizeInquiry({status:'Lost'}).status,'Not interested');
 const data={inquiries:[{status:'Converted',amount:5000,follow_up:null},{status:'Not interested',amount:0,follow_up:null}],gyms:[],visits:[]};
 assert.equal(metrics(data,'2026-11-22').revenue,5000);assert.equal(metrics(data,'2026-11-22').open,0);assert.equal(metrics(data,'2026-11-22').overdue,0);
});
