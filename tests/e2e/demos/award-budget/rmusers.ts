import { existsSync, readFileSync } from 'node:fs';
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
