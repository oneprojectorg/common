import * as schema from '@op/db/schema';
import { count, getTableName } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
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

  // Tables to skip: seeded RBAC data (access_*) and shared location references
  const tablesToSkip = new Set([
    'access_roles',
    'access_role_permissions_on_access_zones',
    'access_zones',
    'locations',
  ]);

  // Get all table objects from schema (filter for actual PgTable instances)
  const tables = Object.entries(schema).filter(
    (entry): entry is [string, PgTable] =>
      entry[1] instanceof PgTable && !tablesToSkip.has(getTableName(entry[1])),
  );

  const errors: string[] = [];

  for (const [, table] of tables) {
    const tableName = getTableName(table);
    const [result] = await db.select({ count: count() }).from(table);
    const tableCount = result?.count ?? 0;

    if (tableCount !== 0) {
      errors.push(`Expected 0 rows in "${tableName}" but found ${tableCount}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Test cleanup failed. This indicates that some test cleanup failed:\n${errors.join('\n')}`,
    );
  }

  await client.end();
}
