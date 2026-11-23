import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateMachine,assertMachinePriced,quoteTotals} from '../src/quotation-domain.js';

test('Aero Power import covers seven muscle groups with factual dimensions and distinct model sources',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../data/aerofit-aero-power.json',import.meta.url),'utf8'));
 assert.equal(manifest.machines.length,19);
 const models=new Set(),sources=new Set(),groups=new Map();
 for(const machine of manifest.machines){
  assert.equal(machine.brand,'Aerofit');assert.equal(machine.series,'Aero Power Series');
  assert.match(machine.source_url,/^https:\/\/aerofit.co\/product\//);assert.match(machine.source_image_url,/^https:\/\/aerofit.co\/wp-content\/uploads\//);
  assert.equal(machine.price_on_request,true);assert.equal(machine.mrp,0);
  assert.ok(machine.specifications.length>50);
  const {source_image_url,...record}=machine;
  assert.doesNotThrow(()=>validateMachine({...record,image_url:'https://example.com/image.jpg'}));
  assert.throws(()=>assertMachinePriced(machine),/confirmed MRP/);
  models.add(machine.model_code);sources.add(machine.source_url);groups.set(machine.category,(groups.get(machine.category)||0)+1);
 }
 assert.equal(models.size,19);assert.equal(sources.size,19);assert.equal(groups.size,7);
 for(const count of groups.values())assert.ok(count>=2&&count<=3);
});
test('unpublished prices cannot silently become free quotation items; setting a confirmed MRP enables them',()=>{
 const machine={name:'Imported machine',category:'Chest',length:100,breadth:120,height:150,dimension_unit:'cm',mrp:0,price:0,price_on_request:true};
 assert.throws(()=>quoteTotals([{...machine,quantity:1}]),/confirmed MRP/);
 const priced=validateMachine({...machine,mrp:100000,price:100000});
 assert.equal(priced.price_on_request,false);
 assert.doesNotThrow(()=>assertMachinePriced(priced));
 assert.equal(quoteTotals([{...priced,quantity:1}],18,0).total,118000);
});
