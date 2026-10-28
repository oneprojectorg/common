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
const envText = readFileSync(resolve(repoRoot, '.env.local'), 'utf8');
const env = Object.fromEntries(
  envText
    .split('\n')
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line) => {
      const idx = line.indexOf('=');
      return [line.slice(0, idx), line.slice(idx + 1).replace(/^"|"$/g, '')];
    }),
);

const [email, password, label] = process.argv.slice(2);
if (!email || !password || !label) {
  throw new Error('usage: session.ts <email> <password> <label>');
}

const requireEnv = (key: string): string => {
  const value = env[key];
  if (!value) throw new Error(`${key} is not set in .env.local`);
  return value;
};
const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const anonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

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
const b64 = `base64-${Buffer.from(JSON.stringify(session))
  .toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '')}`;
const CHUNK = 3180;
const chunks = Array.from({ length: Math.ceil(b64.length / CHUNK) }, (_, i) =>
  b64.slice(i * CHUNK, (i + 1) * CHUNK),
);
const cookie = (name: string, value: string) => ({
  name,
  value,
  domain: 'localhost',
  path: '/',
  httpOnly: false,
  secure: false,
  sameSite: 'Lax',
});
const cookies = [
  ...chunks.map((value, i) =>
    cookie(chunks.length === 1 ? storageKey : `${storageKey}.${i}`, value),
  ),
  ...(env.NEXT_PUBLIC_POSTHOG_KEY
    ? [cookie(`__ph_opt_in_out_${env.NEXT_PUBLIC_POSTHOG_KEY}`, '0')]
    : []),
];

const out = resolve(here, `cookies-${label}.json`);
writeFileSync(out, JSON.stringify(cookies));
console.log(JSON.stringify({ email, out, accessToken: session.access_token }));
