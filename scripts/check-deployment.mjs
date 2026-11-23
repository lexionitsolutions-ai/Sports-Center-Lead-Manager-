import {pathToFileURL} from 'node:url';

export function validateDeploymentEnv(env) {
  if (env.VERCEL !== '1') return;
  const projectUrl = env.VITE_SUPABASE_URL?.trim();
  const publicKey = env.VITE_SUPABASE_ANON_KEY?.trim();
  // A deliberately hosted sample workspace must be explicitly selected; partial live settings still fail.
  if (!projectUrl && !publicKey && env.VITE_DEMO_PREVIEW === 'true') return;
  if (!projectUrl || !publicKey) throw Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the Vercel project before deploying. Production must connect to Supabase.');
  let url;
  try { url = new URL(projectUrl); } catch { throw Error('VITE_SUPABASE_URL must be a valid HTTPS project URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw Error('VITE_SUPABASE_URL must be an HTTPS project origin.');
  if (publicKey.startsWith('sb_publishable_') && publicKey.length > 25) return;
  let role;
  try { role = JSON.parse(Buffer.from(publicKey.split('.')[1], 'base64url').toString()).role; } catch { /* Reject unknown keys. */ }
  if (role !== 'anon') throw Error('VITE_SUPABASE_ANON_KEY must be a Supabase publishable key or legacy anon key. Never put a secret/service-role key in the frontend.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) validateDeploymentEnv(process.env);
