import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDeploymentEnv} from '../scripts/check-deployment.mjs';

test('Vercel builds require Supabase while local builds can preview demo mode',()=>{
  assert.doesNotThrow(()=>validateDeploymentEnv({}));
  assert.throws(()=>validateDeploymentEnv({VERCEL:'1'}),/Set VITE_SUPABASE_URL/);
  const env={VERCEL:'1',VITE_SUPABASE_URL:'https://example.supabase.co',VITE_SUPABASE_ANON_KEY:'sb_publishable_examplepublickey123456'};
  assert.doesNotThrow(()=>validateDeploymentEnv(env));
  assert.throws(()=>validateDeploymentEnv({...env,VITE_SUPABASE_URL:'http://example.supabase.co'}),/HTTPS/);
  assert.throws(()=>validateDeploymentEnv({...env,VITE_SUPABASE_ANON_KEY:'sb_secret_privatekey123456'}),/Never put a secret/);
  const jwt=role=>'eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.signature';
  assert.doesNotThrow(()=>validateDeploymentEnv({...env,VITE_SUPABASE_ANON_KEY:jwt('anon')}));
  assert.throws(()=>validateDeploymentEnv({...env,VITE_SUPABASE_ANON_KEY:jwt('service_role')}),/Never put a secret/);
});
