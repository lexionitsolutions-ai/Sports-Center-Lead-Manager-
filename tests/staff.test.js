import test from 'node:test';
import assert from 'node:assert/strict';
import {staffPhone,staffIdentity,validateStaff} from '../shared/staff-domain.js';

test('phone sign-in has one canonical identifier for Indian and explicit international numbers',()=>{
 assert.equal(staffPhone('8999655797'),'+918999655797');
 assert.equal(staffIdentity('8999655797'),staffIdentity('+91 89996 55797'));
 assert.equal(staffIdentity('08999655797'),'phone-918999655797@staff.sports-center.invalid');
 assert.equal(staffPhone('+44 7700 900123'),'+447700900123');
 for(const input of ['person@example.com','123','8999655797@evil.invalid','9876543210123456789'])assert.throws(()=>staffPhone(input));
});
test('staff provisioning validates names, supported roles and password byte limits',()=>{
 const input={name:' Service Staff ',phone:'9876543210',password:'Sample123456',role:'technician'};
 assert.equal(validateStaff(input).name,'Service Staff');
 assert.equal(validateStaff(input).phone,'+919876543210');
 assert.throws(()=>validateStaff({...input,role:'superadmin'}));
 assert.throws(()=>validateStaff({...input,name:' '}));
 assert.throws(()=>validateStaff({...input,password:'short1'}));
 assert.throws(()=>validateStaff({...input,password:'x'.repeat(73)+'1'}));
 assert.throws(()=>validateStaff({...input,password:'a1'+'🟩'.repeat(20)}));
});
