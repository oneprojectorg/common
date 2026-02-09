import * as schema from '@op/db/schema';
import { ACCESS_ROLES, ACCESS_ZONES } from '@op/db/seedData/accessControl';
import { count, eq, getTableName, inArray } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/postgres-js';

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
 * Removes seeded data, then verifies all tables are empty.
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
  // Storage tables (buckets, objects) are managed by Supabase and persist between tests
  const seededTables = new Set([
    'access_roles',
    'access_role_permissions_on_access_zones',
    'access_zones',
    'buckets', // Supabase storage - created by seed
    'objects', // Supabase storage - files uploaded during tests
    'content_translations', // Translation cache — populated by translation tests
  ]);

  // Get all table objects from schema (filter for actual PgTable instances)
  const tables = Object.entries(schema).filter(
    (entry): entry is [string, PgTable] =>
      entry[1] instanceof PgTable && !seededTables.has(getTableName(entry[1])),
  );

  const accessZoneIds = ACCESS_ZONES.map((z) => z.id);
  const accessRoleIds = ACCESS_ROLES.map((r) => r.id);
  const DECISION_TEMPLATE_PROFILE_SLUG = 'decision-template-library';

  // Deseed: remove seeded data first (order matters due to FK constraints)
  console.log('🧹 Deseeding tables...');

  // Delete decision_processes (references profiles)
  await db
    .delete(schema.decisionProcesses)
    .where(
      eq(
        schema.decisionProcesses.createdByProfileId,
        db
          .select({ id: schema.profiles.id })
          .from(schema.profiles)
          .where(eq(schema.profiles.slug, DECISION_TEMPLATE_PROFILE_SLUG)),
      ),
    );

  // Delete the template profile
  await db
    .delete(schema.profiles)
    .where(eq(schema.profiles.slug, DECISION_TEMPLATE_PROFILE_SLUG));

  // Delete access control data
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

  // Check non-seeded tables are empty AFTER deseeding
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
      `Test cleanup failed. Tables not empty after deseeding:\n${errors.join('\n')}`,
    );
  }

  // Close the database connection to allow the process to exit
  await db.$client.end();
}
