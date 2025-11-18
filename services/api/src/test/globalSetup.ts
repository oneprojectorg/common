import { authUsers, organizations, profiles, users } from '@op/db/schema';
import { count } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

/**
 * Global setup for Vitest - runs once before all test files
 * This ensures migrations and seeding happen only once per test run
 */
export async function setup() {
  console.log('🔄 Running Drizzle migrations...');

  const { execSync } = await import('child_process');
  const path = await import('path');

  const projectRoot = path.resolve(process.cwd(), '../..');
  const migrationCommand = 'pnpm w:db migrate:test';

  try {
    execSync(migrationCommand, {
      cwd: projectRoot,
      stdio: 'inherit',
    });
    console.log('✅ Drizzle migrations completed successfully');
  } catch (error: any) {
    console.warn('⚠️  Migration warning:', error.message);
    console.warn(
      '   Tests will continue, but some may fail if schema is outdated',
    );
  }

  try {
    console.log('🌱 Running database seed...');
    const seedCommand = 'pnpm w:db seed:test';

    execSync(seedCommand, {
      cwd: projectRoot,
      stdio: 'inherit',
    });
    console.log('✅ Database seed completed successfully');
  } catch (seedError: any) {
    console.warn('⚠️  Seeding warning:', seedError.message.split('\n')[0]);
    console.warn('   Tests will continue without seed data');
  }
}

/**
 * Global teardown for Vitest - runs once after all test files complete
 * Verifies that all test data has been properly cleaned.
 * Add more tables as needed.
 */
export async function teardown() {
  const databaseUrl = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL or TEST_DATABASE_URL environment variable is not set',
    );
  }

  const client = postgres(databaseUrl);
  const db = drizzle(client);

  const [profileCountResult] = await db
    .select({ count: count() })
    .from(profiles);
  const [userCountResult] = await db.select({ count: count() }).from(users);
  const [orgCountResult] = await db
    .select({ count: count() })
    .from(organizations);
  const [authUserCountResult] = await db
    .select({ count: count() })
    .from(authUsers);

  const profileCount = profileCountResult?.count ?? 0;
  const userCount = userCountResult?.count ?? 0;
  const orgCount = orgCountResult?.count ?? 0;
  const authUserCount = authUserCountResult?.count ?? 0;

  if (profileCount !== 0) {
    throw new Error(
      `Expected 0 profiles but found ${profileCount}. This indicates that some test cleanup failed.`,
    );
  }

  if (userCount !== 0) {
    throw new Error(
      `Expected 0 users but found ${userCount}. This indicates that some test cleanup failed.`,
    );
  }

  if (orgCount !== 0) {
    throw new Error(
      `Expected 0 organizations but found ${orgCount}. This indicates that some test cleanup failed.`,
    );
  }

  if (authUserCount !== 0) {
    throw new Error(
      `Expected 0 auth.users but found ${authUserCount}. This indicates that some test cleanup failed.`,
    );
  }

  await client.end();
}
