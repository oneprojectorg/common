import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const here = import.meta.dirname;
const repoRoot = (() => {
  let dir = here;
  while (!existsSync(resolve(dir, 'pnpm-workspace.yaml'))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`repo root not found above ${here}`);
    dir = parent;
  }
  return dir;
})();
const envPath = resolve(repoRoot, '.env.local');

const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText
    .split('\n')
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line) => {
      const idx = line.indexOf('=');
      return [line.slice(0, idx), line.slice(idx + 1).replace(/^"|"$/g, '')];
    }),
);

const requireEnv = (key: string): string => {
  const value = env[key];
  if (!value) throw new Error(`${key} is not set in .env.local`);
  return value;
};
const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const anonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const serviceRole = requireEnv('SUPABASE_SERVICE_ROLE');
const password = 'TestPassword123!';
const label = process.argv[2] ?? 'shot';
const email = `screenshot-${label}-${randomUUID().slice(0, 6)}@oneproject.org`;

const created = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    apikey: serviceRole,
    Authorization: `Bearer ${serviceRole}`,
  },
  body: JSON.stringify({ email, password, email_confirm: true }),
});
if (!created.ok)
  throw new Error(`create ${created.status}: ${await created.text()}`);
const user = (await created.json()) as { id: string };

const signedIn = await fetch(
  `${supabaseUrl}/auth/v1/token?grant_type=password`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anonKey },
    body: JSON.stringify({ email, password }),
  },
);
if (!signedIn.ok)
  throw new Error(`signin ${signedIn.status}: ${await signedIn.text()}`);
const session = await signedIn.json();

const projectId = new URL(supabaseUrl).hostname.split('.')[0];
const storageKey = `sb-${projectId}-auth-token`;
const sessionJson = JSON.stringify(session);
const b64 = `base64-${Buffer.from(sessionJson)
  .toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '')}`;
const CHUNK = 3180;
const chunks = Array.from({ length: Math.ceil(b64.length / CHUNK) }, (_, i) =>
  b64.slice(i * CHUNK, (i + 1) * CHUNK),
);
const cookies = chunks.map((value, i) => ({
  name: chunks.length === 1 ? storageKey : `${storageKey}.${i}`,
  value,
  domain: 'localhost',
  path: '/',
  expires: -1,
  httpOnly: false,
  secure: false,
  sameSite: 'Lax',
}));
const consent = env.NEXT_PUBLIC_POSTHOG_KEY
  ? [
      {
        name: `__ph_opt_in_out_${env.NEXT_PUBLIC_POSTHOG_KEY}`,
        value: '0',
        domain: 'localhost',
        path: '/',
        expires: -1,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ]
  : [];

const out = resolve(here, `session-${label}.json`);
writeFileSync(
  out,
  JSON.stringify({
    email,
    id: user.id,
    storageKey,
    sessionJson,
    cookies: [...cookies, ...consent],
  }),
);
console.log(JSON.stringify({ email, id: user.id, out }));
