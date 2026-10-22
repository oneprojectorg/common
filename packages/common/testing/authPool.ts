import { execFileSync } from 'node:child_process';

/**
 * Give the local Supabase auth server a reusable Postgres connection pool.
 *
 * GoTrue's `MaxIdlePoolSize` defaults to Go's `database/sql` default of 2, so
 * under concurrency it opens a fresh Postgres connection per request and closes
 * it again. Each closed socket sits in TIME_WAIT for 60 s inside the container's
 * network namespace, the ephemeral ports run out, and every auth call then fails
 * as `Database error finding user` — which reads like a schema fault and is not
 * one.
 *
 * The Supabase CLI exposes no pool setting, but GoTrue loads a `.env` from its
 * working directory at startup (`godotenv.Load()`), so the variable goes in a
 * file and the container restarts. Values already in the process environment
 * win, so this can never override something the CLI set.
 *
 * Failure is not fatal: without it the suite still runs, it just cannot be
 * driven hard.
 */
const CONTAINER =
  process.env.SUPABASE_AUTH_CONTAINER ?? 'supabase_auth_common-test';
const SETTING = `GOTRUE_DB_MAX_IDLE_POOL_SIZE=${process.env.SUPABASE_AUTH_IDLE_POOL_SIZE ?? '30'}`;
const HEALTH_URL = `${process.env.SUPABASE_URL ?? 'http://127.0.0.1:55321'}/auth/v1/health`;

const docker = (...args: Array<string>): string =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

export async function widenAuthConnectionPool(): Promise<void> {
  try {
    const applied = docker(
      'exec',
      CONTAINER,
      'sh',
      '-c',
      `grep -qsxF '${SETTING}' /.env && echo yes || echo no`,
    );
    if (applied === 'yes') {
      return;
    }

    console.log(`🔧 Setting ${SETTING} on ${CONTAINER}...`);
    docker(
      'exec',
      '--user',
      '0',
      CONTAINER,
      'sh',
      '-c',
      `printf '%s\n' '${SETTING}' > /.env && chmod a+r /.env`,
    );
    docker('restart', CONTAINER);
  } catch (error) {
    console.warn(`⚠️  Could not pool ${CONTAINER}:`, error);
    return;
  }

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(HEALTH_URL)).ok) {
        console.log('✅ Auth server back up with a pooled connection');
        return;
      }
    } catch {
      // Still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Auth container unhealthy at ${HEALTH_URL} after restart`);
}
