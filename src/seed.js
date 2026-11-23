import { today, shiftDate } from './domain';
export function seed() {
 const d=today();
 return {
 inquiries:[
  {id:'i1',name:'Arjun Mehta',phone:'9876543210',reason:'Gym machinery',other_reason:'',follow_up:d,status:'New',amount:0,notes:'Interested in a complete strength training setup.',created_at:d},
  {id:'i2',name:'Priya Sharma',phone:'9823456781',reason:'Home gym setup',follow_up:d,status:'Interested',amount:0,notes:'Discuss treadmill and multi-gym options.',created_at:d},
  {id:'i3',name:'Rahul Desai',phone:'9890123456',reason:'Sports equipment',follow_up:d,status:'Quoted',amount:0,notes:'Quotation shared for cricket and badminton equipment.',created_at:d},
  {id:'i4',name:'Neha Patel',phone:'9765432109',reason:'School equipment',follow_up:shiftDate(d,2),status:'New',amount:0,notes:'',created_at:d},
  {id:'i5',name:'Vikram Singh',phone:'9812345670',reason:'Gym machinery',follow_up:shiftDate(d,-1),status:'Call not received',amount:0,notes:'Call about the commercial treadmill range.',created_at:shiftDate(d,-4)},
  {id:'i6',name:'Karan Shah',phone:'9845671230',reason:'Home gym setup',follow_up:null,status:'Converted',amount:185000,notes:'Home gym delivered. Full payment collected.',created_at:shiftDate(d,-12)},
  {id:'i7',name:'Aditi Rao',phone:'9867891230',reason:'Sports equipment',follow_up:null,status:'Converted',amount:72000,notes:'School sports kit supplied.',created_at:shiftDate(d,-15)}
 ],
 gyms:[
  {id:'g1',name:'Iron House Fitness',contact:'Sanjay Kapoor',phone:'9876500011',location:'Andheri West, Mumbai',amc_renewal:shiftDate(d,12)},
  {id:'g2',name:'The Movement Studio',contact:'Riya Malhotra',phone:'9876500022',location:'Bandra, Mumbai',amc_renewal:shiftDate(d,26)},
  {id:'g3',name:'Elevate Fitness Club',contact:'Amit Joshi',phone:'9876500033',location:'Powai, Mumbai',amc_renewal:shiftDate(d,95)},
  {id:'g4',name:'Mehta Home Gym',contact:'Rohit Mehta',phone:'9876500044',location:'Juhu, Mumbai',amc_renewal:shiftDate(d,155)}
 ],
 visits:[
  {id:'v1',gym_id:'g1',technician_name:'Ravi Kumar',reason:'Monthly AMC visit',issue:'',visit_date:shiftDate(d,-2),coverage:'AMC',charge:0,notes:'Routine inspection and lubrication completed.',created_at:d},
  {id:'v2',gym_id:'g2',technician_name:'Ravi Kumar',reason:'Machinery issue',issue:'Treadmill belt adjustment',visit_date:shiftDate(d,-4),coverage:'Chargeable',charge:2500,notes:'Belt aligned and tested.',created_at:d},
  {id:'v3',gym_id:'g3',technician_name:'Ravi Kumar',reason:'Monthly AMC visit',issue:'',visit_date:shiftDate(d,-7),coverage:'AMC',charge:0,notes:'All machines inspected.',created_at:d}
 ],
 deliveries:[
  {id:'d1',institution:'Greenwood International School',head:'Dr. Anjali Verma',phone:'9820012345',equipment:'Basketball hoops × 2, footballs × 20, athletics kits × 6',delivered_on:shiftDate(d,-4),amount:125000},
  {id:'d2',institution:'St. Xavier’s College',head:'Prof. Rajesh Nair',phone:'9820056789',equipment:'Table tennis tables × 3, badminton sets × 12',delivered_on:shiftDate(d,-10),amount:98000},
  {id:'d3',institution:'Delhi Public School',head:'Mrs. Sunita Shah',phone:'9820098765',equipment:'Cricket kits × 8, volleyball nets × 4',delivered_on:shiftDate(d,-18),amount:72000}
 ]};
}
