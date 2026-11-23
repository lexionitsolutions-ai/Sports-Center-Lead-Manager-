import test from 'node:test';
import assert from 'node:assert/strict';
import {PRIMARY_PAGES,TOOL_PAGES,homeForRole,primaryForRole,toolsForRole} from '../src/navigation.js';

test('administrators open Overview and get the five confirmed bottom navigation destinations',()=>{
 assert.equal(homeForRole('admin'),'dashboard');
 assert.deepEqual(primaryForRole('admin'),['dashboard','inquiries','followups','services','quotations']);
 assert.equal(new Set(PRIMARY_PAGES).size,5);
 assert.equal(TOOL_PAGES.at(-1),'machines');
 assert.ok(TOOL_PAGES.includes('staff')&&TOOL_PAGES.includes('agent'));
});
test('technician navigation retains its service-only permissions',()=>{
 assert.equal(homeForRole('technician'),'services');
 assert.deepEqual(primaryForRole('technician'),['services']);
 assert.deepEqual(toolsForRole('technician'),['services']);
});
