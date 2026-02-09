import { execSync } from 'node:child_process';
import path from 'node:path';

/**
 * Shared global setup for vitest suites that need the test database.
 *
 * Runs migrations and seeds against the test Supabase (port 55322).
 * Errors are caught so tests can proceed if the schema is already current.
 *
 * Used by:
 *  - services/api/vitest.config.ts
 *  - packages/common/vitest.config.ts
 */
export async function setup() {
  // Resolve to monorepo root regardless of which workspace runs vitest
  const projectRoot = path.resolve(process.cwd(), '../..');

  console.log('Running Drizzle migrations...');
  try {
    execSync('pnpm w:db migrate:test', {
      cwd: projectRoot,
      stdio: 'inherit',
    });
    console.log('Drizzle migrations completed successfully');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('Migration warning:', message);
    console.warn(
      '  Tests will continue, but some may fail if schema is outdated',
    );
  }

  try {
    console.log('Running database seed...');
    execSync('pnpm w:db seed:test', {
      cwd: projectRoot,
      stdio: 'inherit',
    });
    console.log('Database seed completed successfully');
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message.split('\n')[0] : String(error);
    console.warn('Seeding warning:', message);
    console.warn('  Tests will continue without seed data');
  }
}
