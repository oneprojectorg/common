import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envText = readFileSync(
  resolve(import.meta.dirname, '../../../../.env.local'),
  'utf8',
);
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
const serviceRole = requireEnv('SUPABASE_SERVICE_ROLE');
const ids = process.argv.slice(2);

for (const id of ids) {
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}` },
  });
  console.log(id, res.status);
}
