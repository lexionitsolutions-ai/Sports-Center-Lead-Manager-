import test from 'node:test';
import assert from 'node:assert/strict';
import { REASONS } from '../src/domain.js';
import { inquiryMessage, whatsappLink, whatsappNumber } from '../src/whatsapp.js';

test('each inquiry reason has its own personal WhatsApp message',()=>{
 const texts=REASONS.map(reason=>inquiryMessage({name:'Asha',reason,other_reason:'Badminton court setup'}));
 assert.equal(new Set(texts).size,REASONS.length);
 for(const text of texts){assert.match(text,/Asha/);assert.match(text,/Mayuri Patil/);assert.match(text,/Thank you for enquiring at Sports Center/);assert.match(text,/previous work/);assert.match(text,/demo examples/);assert.doesNotMatch(text,/Zenith Fitness|undefined|https?:\/\//);}
 assert.match(texts.at(-1),/Badminton court setup/);
});
test('WhatsApp links normalize Indian mobiles, preserve explicit country codes and encode the edited text',()=>{
 assert.equal(whatsappNumber('98765 43210'),'919876543210');assert.equal(whatsappNumber('+91 98765-43210'),'919876543210');assert.equal(whatsappNumber('09876543210'),'919876543210');assert.equal(whatsappNumber('+44 7700 900123'),'447700900123');
 const edited='Hi Asha & team!\nCustom quotation: ₹5,000';const url=new URL(whatsappLink('9876543210',edited));
 assert.equal(url.hostname,'wa.me');assert.equal(url.pathname,'/919876543210');assert.equal(url.searchParams.get('text'),edited);
 assert.throws(()=>whatsappNumber('12345'));assert.throws(()=>whatsappNumber('123456789012'));
 assert.throws(()=>whatsappLink('9876543210',' '));
});
