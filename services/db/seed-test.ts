/* eslint-disable antfu/no-top-level-await */
import { createServerClient } from '@supabase/ssr';
import dotenv from 'dotenv';
import { reset } from 'drizzle-seed';

import { db } from '.';
import * as schema from './schema';
import {
  ACCESS_ROLES,
  ACCESS_ROLE_PERMISSIONS,
  ACCESS_ZONES,
} from './seedData/accessControl';

// For local development, we need to load the .env.local file from the root of the monorepo
dotenv.config({
  override: true,
});

if (!process.env.DB_SEEDING) {
  throw new Error('You must set DB_SEEDING to "true" when truncating');
}

const allowedDatabaseUrls = [
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres', // Development database
  'postgresql://postgres:postgres@127.0.0.1:55322/postgres', // Test database
];

if (!allowedDatabaseUrls.includes(process.env.DATABASE_URL || '')) {
  throw new Error('You are truncating in production');
}

// Determine the correct Supabase URL based on the database URL
const isTestDatabase = process.env.DATABASE_URL?.includes('55322');
const supabaseUrl = isTestDatabase
  ? 'http://127.0.0.1:55321' // Test Supabase instance
  : process.env.NEXT_PUBLIC_SUPABASE_URL!; // Production/dev instance

const supabase = createServerClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE!,
  {
    cookieOptions: {},
    cookies: {
      getAll: async () => [],
      setAll: async () => {},
    },
  },
);

/**
 * Wipe database tables and empty storage buckets
 */
async function wipeDatabase() {
  console.log('🧹 Wiping database before seeding...');

  // Use drizzle-seed reset function to truncate all tables
  await reset(db, schema);

  console.log('✅ Database wipe completed\n');

  // Empty storage buckets
  try {
    await supabase.storage.emptyBucket('assets');
    console.log(`  ✓ Emptied assets bucket`);
  } catch (error: any) {
    console.warn(`  ⚠ Warning emptying assets bucket:`, error.message);
  }

  try {
    await supabase.storage.emptyBucket('avatars');
    console.log(`  ✓ Emptied avatars bucket`);
  } catch (error: any) {
    console.warn(`  ⚠ Warning emptying avatars bucket:`, error.message);
  }
}

/**
 * Seed access control data including zones, roles, and permissions
 */
async function seedAccessControl() {
  console.log('🔐 Seeding access control data (zones, roles, permissions)...');

  const { accessZones, accessRoles, accessRolePermissionsOnAccessZones } =
    schema;

  // Seed access zones using predefined constants
  const insertedZones = await db
    .insert(accessZones)
    .values(ACCESS_ZONES)
    .returning();
  console.log(`  ✓ Inserted ${insertedZones.length} access zones`);

  // Seed access roles using predefined constants
  const insertedRoles = await db
    .insert(accessRoles)
    .values(ACCESS_ROLES)
    .returning();
  console.log(`  ✓ Inserted ${insertedRoles.length} access roles`);

  // Seed access role permissions on access zones using predefined constants
  await db
    .insert(accessRolePermissionsOnAccessZones)
    .values(ACCESS_ROLE_PERMISSIONS);
  console.log(
    `  ✓ Inserted ${ACCESS_ROLE_PERMISSIONS.length} role permissions on access zones`,
  );
}

/**
 * Main seed function that orchestrates all seeding operations
 */
async function seed() {
  console.log('🌱 Starting database seeding...\n');

  await wipeDatabase();
  await seedAccessControl();

  console.log('\n✅ Database seeding completed successfully!');
}

// Execute seed function
await seed();
await db.$client.end();
