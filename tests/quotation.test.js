import test from 'node:test';
import assert from 'node:assert/strict';
import { demoMachines, quoteTotals, validateMachine, normalizeMachine, machineDimensions } from '../src/quotation-domain.js';

test('quotation totals use offer prices, quantities, GST and final delivery charges',()=>{
 const m=demoMachines()[0];
 assert.deepEqual(quoteTotals([{...m,quantity:2}],18,1500),{mrp:250000,subtotal:195000,discount:55000,tax:35100,delivery:1500,total:231600});
});
test('quotation currency is rounded to paise at each line and tax',()=>{
 assert.deepEqual(quoteTotals([{name:'Machine',mrp:120,price:99.99,quantity:3}],18,0.01),{mrp:360,subtotal:299.97,discount:60.03,tax:53.99,delivery:0.01,total:353.97});
});
test('invalid quantities, prices, charges and empty quotations cannot export',()=>{
 const item={...demoMachines()[0],quantity:1};
 for(const changes of [{quantity:0},{quantity:1.5},{quantity:1000},{price:-1},{price:''},{price:null},{price:Infinity},{price:item.mrp+1},{mrp:NaN}])assert.throws(()=>quoteTotals([{...item,...changes}]));
 assert.throws(()=>quoteTotals([]));
 assert.throws(()=>quoteTotals([item],101));
 assert.throws(()=>quoteTotals([item],0,-1));
});
test('catalog validates specifications, discounts and image URLs',()=>{
 assert.equal(validateMachine(demoMachines()[0]).price,97500);
 for(const changes of [{name:' '},{length:0},{breadth:-10},{height:''},{dimension_unit:'unknown'},{category:'Unknown'},{mrp:-1},{price:200000},{image_url:'javascript:alert(1)'}])assert.throws(()=>validateMachine({...demoMachines()[0],...changes}));
});
test('legacy dimensions migrate into separate fields without losing specifications',()=>{
 const m=normalizeMachine({dimensions:'145 x 120 x 225 cm',name:'Legacy machine'});
 assert.equal(m.length,145);assert.equal(m.breadth,120);assert.equal(m.height,225);assert.equal(machineDimensions(m),'145 × 120 × 225 cm');
 assert.equal(normalizeMachine({dimensions:'Custom size'}).dimensions,'Custom size');
 assert.equal(normalizeMachine({dimensions:'40 x 50 x 90 in',length:null,breadth:null,height:null,dimension_unit:'cm'}).dimension_unit,'in');
});
test('machinery database accepts all requested categories and photo uploads',()=>{
 for(const category of ['Biceps','Triceps','Dumbbells','Racks'])assert.equal(validateMachine({...demoMachines()[0],category,image_url:'data:image/jpeg;base64,/9j/'}).category,category);
 assert.equal(validateMachine({...demoMachines()[0],length:150,breadth:110,height:210,specifications:'Includes lat bar'}).dimensions,'150 × 110 × 210 cm');
});
test('quotation price snapshots survive catalog price changes',()=>{
 const machine=demoMachines()[0],item={...machine,quantity:1};machine.price=1;
 assert.equal(quoteTotals([item]).total,97500);
});
