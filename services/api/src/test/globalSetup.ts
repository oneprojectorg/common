import * as schema from '@op/db/schema';
import {
  ACCESS_ROLES,
  ACCESS_ROLE_PERMISSIONS,
  ACCESS_ZONES,
} from '@op/db/seedData/accessControl';
import { count, getTableName, inArray } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/postgres-js';

/**
 * Global setup for Vitest - runs once before all test files
 * This ensures migrations and seeding happen only once per test run
 */
export async function setup() {
  const { execSync } = await import('child_process');
  const path = await import('path');

  const projectRoot = path.resolve(process.cwd(), '../..');
  const databaseUrl = process.env.DATABASE_URL ?? '';

  // Check if we're running against a remote Supabase branch (CI with pooler)
  const isRemoteSupabase = databaseUrl.includes('pooler.supabase.com');

  if (isRemoteSupabase) {
    // Run migrations against remote Supabase branch
    // Branch databases start empty - they don't inherit schema from parent
    console.log(
      '🔄 Running Drizzle migrations against remote Supabase branch...',
    );
    try {
      execSync('cross-env DB_MIGRATING=true tsx ./migrate.ts', {
        cwd: path.resolve(projectRoot, 'services/db'),
        stdio: 'inherit',
        env: {
          ...process.env,
          DB_MIGRATING: 'true',
        },
      });
      console.log('✅ Drizzle migrations completed successfully');
    } catch (error: any) {
      console.warn('⚠️  Migration warning:', error.message);
      console.warn(
        '   Tests will continue, but some may fail if schema is outdated',
      );
    }

    // Run seed directly with the remote DATABASE_URL
    console.log('🌱 Running database seed against remote branch...');
    try {
      execSync('cross-env DB_SEEDING=true tsx ./seed-test.ts', {
        cwd: path.resolve(projectRoot, 'services/db'),
        stdio: 'inherit',
        env: {
          ...process.env,
          DB_SEEDING: 'true',
        },
      });
      console.log('✅ Database seed completed successfully');
    } catch (seedError: any) {
      console.warn('⚠️  Seeding warning:', seedError.message.split('\n')[0]);
      console.warn('   Tests will continue without seed data');
    }
    return;
  }

  // Local development: run migrations and seed with hardcoded local URLs
  console.log('🔄 Running Drizzle migrations...');
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
 * Verifies that all test data has been properly cleaned, then removes seeded data.
 */
export async function teardown() {
  const databaseUrl = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL or TEST_DATABASE_URL environment variable is not set',
    );
  }

  const db = drizzle({
    connection: { url: databaseUrl },
    schema,
    casing: 'snake_case',
  });

  // Seeded tables that will be "deseeded" - only the exact seeded rows should exist
  const seededTables = new Set([
    'access_roles',
    'access_role_permissions_on_access_zones',
    'access_zones',
  ]);

  // Get all table objects from schema (filter for actual PgTable instances)
  const tables = Object.entries(schema).filter(
    (entry): entry is [string, PgTable] =>
      entry[1] instanceof PgTable && !seededTables.has(getTableName(entry[1])),
  );

  const errors: string[] = [];

  // Check non-seeded tables are empty
  for (const [, table] of tables) {
    const tableName = getTableName(table);
    const [result] = await db.select({ count: count() }).from(table);
    const tableCount = result?.count ?? 0;

    if (tableCount !== 0) {
      errors.push(`Expected 0 rows in "${tableName}" but found ${tableCount}`);
    }
  }

  // Verify seeded tables only contain expected seed data
  const accessZoneIds = ACCESS_ZONES.map((z) => z.id);
  const accessRoleIds = ACCESS_ROLES.map((r) => r.id);
  const expectedPermissionCount = ACCESS_ROLE_PERMISSIONS.length;

  const [zonesResult] = await db
    .select({ count: count() })
    .from(schema.accessZones);
  const [rolesResult] = await db
    .select({ count: count() })
    .from(schema.accessRoles);
  const [permissionsResult] = await db
    .select({ count: count() })
    .from(schema.accessRolePermissionsOnAccessZones);

  if (zonesResult?.count !== accessZoneIds.length) {
    errors.push(
      `Expected ${accessZoneIds.length} rows in "access_zones" but found ${zonesResult?.count}`,
    );
  }
  if (rolesResult?.count !== accessRoleIds.length) {
    errors.push(
      `Expected ${accessRoleIds.length} rows in "access_roles" but found ${rolesResult?.count}`,
    );
  }
  if (permissionsResult?.count !== expectedPermissionCount) {
    errors.push(
      `Expected ${expectedPermissionCount} rows in "access_role_permissions_on_access_zones" but found ${permissionsResult?.count}`,
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Test cleanup failed. This indicates that some test cleanup failed:\n${errors.join('\n')}`,
    );
  }

  // Deseed: remove the seeded access control data (order matters due to FK constraints)
  console.log('🧹 Deseeding access control tables...');
  await db
    .delete(schema.accessRolePermissionsOnAccessZones)
    .where(
      inArray(
        schema.accessRolePermissionsOnAccessZones.accessRoleId,
        accessRoleIds,
      ),
    );
  await db
    .delete(schema.accessRoles)
    .where(inArray(schema.accessRoles.id, accessRoleIds));
  await db
    .delete(schema.accessZones)
    .where(inArray(schema.accessZones.id, accessZoneIds));
  console.log('✅ Deseeding completed');

  // Close the database connection to allow the process to exit
  await db.$client.end();
}
