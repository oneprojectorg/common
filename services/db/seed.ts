/* eslint-disable antfu/no-top-level-await */
import { adminEmails } from '@op/core';
import type { User } from '@op/supabase/lib';
import { createServerClient } from '@supabase/ssr';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
import { eq, sql } from 'drizzle-orm';
import { reset } from 'drizzle-seed';
import * as fs from 'fs';
import * as path from 'path';

import { db } from '.';
import * as schema from './schema';
import {
  links,
  organizationUserToAccessRoles,
  organizationUsers,
  profiles,
  taxonomyTerms,
  users,
} from './schema/publicTables';
import { OrgType, organizations } from './schema/tables/organizations.sql';

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
 * Create admin users in Supabase auth and local database
 */
async function seedAdminUsers() {
  console.log('👥 Creating admin users...');
  const createdUsers: User[] = [];

  for (const email of adminEmails) {
    try {
      // Check if user already exists in local users table
      const existingUser = await db.query.users.findFirst({
        where: (table, { eq }) => eq(table.email, email),
      });

      if (existingUser) {
        // Get the auth user data from Supabase
        const { data: authUser } = await supabase.auth.admin.getUserById(
          existingUser.authUserId,
        );
        if (authUser?.user) {
          createdUsers.push(authUser.user as User);
          console.log(`User ${email} already exists, using existing user`);
          continue;
        }
      }

      // Check if auth user already exists in Supabase
      const { data: existingAuthUsers } = await supabase.auth.admin.listUsers();
      const existingAuthUser = existingAuthUsers.users?.find(
        (user) => user.email === email,
      );

      let authUser;
      if (existingAuthUser) {
        // Auth user exists, use it
        authUser = existingAuthUser;
        console.log(
          `Auth user ${email} already exists, using existing auth user`,
        );
      } else {
        // Create new auth user
        const { data, error } = await supabase.auth.admin.createUser({
          email,
        });

        if (error) {
          console.log('ERROR', error);
          throw new Error('Failed to create dev user');
        }

        authUser = data?.user;
      }

      if (authUser) {
        // Insert or update user in local users table
        await db
          .insert(users)
          .values({
            authUserId: authUser.id,
            email: authUser.email!,
            name: authUser.user_metadata?.name || null,
          })
          .onConflictDoUpdate({
            target: [users.email],
            set: {
              authUserId: authUser.id,
              name: sql`excluded.name`,
            },
          });

        createdUsers.push(authUser as User);
      }
    } catch (e) {
      console.warn(e);
    }
  }

  console.log(`✓ Created ${createdUsers.length} admin users\n`);
  return createdUsers;
}

/**
 * Seed access control data including zones, roles, and permissions
 */
async function seedAccessControl() {
  console.log('🔐 Seeding access control data (zones, roles, permissions)...');

  const { accessZones, accessRoles, accessRolePermissionsOnAccessZones } =
    schema;

  // Seed access zones
  const accessZonesData = [
    {
      name: 'admin',
      description:
        'Administrative access zone for managing organization settings, users, and permissions',
    },
    {
      name: 'content',
      description: 'Content management access zone for posts and other content',
    },
    {
      name: 'member',
      description: 'Member access zone for viewing organization information',
    },
  ];

  const insertedZones = await db
    .insert(accessZones)
    .values(accessZonesData)
    .returning();
  console.log(`  ✓ Inserted ${insertedZones.length} access zones`);

  // Seed access roles
  const accessRolesData = [
    {
      name: 'Admin',
      description: 'Administrator with full permissions',
    },
    {
      name: 'Member',
      description: 'Basic member with limited permissions',
    },
    {
      name: 'Editor',
      description: 'Editor with content management permissions',
    },
  ];

  const insertedRoles = await db
    .insert(accessRoles)
    .values(accessRolesData)
    .returning();
  console.log(`  ✓ Inserted ${insertedRoles.length} access roles`);

  // Seed access role permissions on access zones
  const adminRole = insertedRoles.find((r) => r.name === 'Admin')!;
  const memberRole = insertedRoles.find((r) => r.name === 'Member')!;
  const editorRole = insertedRoles.find((r) => r.name === 'Editor')!;

  const contentZone = insertedZones.find((z) => z.name === 'content')!;
  const memberZone = insertedZones.find((z) => z.name === 'member')!;

  const rolePermissionsData = [
    // Admin gets full permissions (7 = READ + WRITE + DELETE) on all zones
    ...insertedZones.map((zone) => ({
      accessRoleId: adminRole.id,
      accessZoneId: zone.id,
      permission: 7,
    })),
    // Member gets read permissions (1) on member zone only
    {
      accessRoleId: memberRole.id,
      accessZoneId: memberZone.id,
      permission: 1,
    },
    // Editor gets read/write (3) on content zone and read (1) on member zone
    {
      accessRoleId: editorRole.id,
      accessZoneId: contentZone.id,
      permission: 3,
    },
    {
      accessRoleId: editorRole.id,
      accessZoneId: memberZone.id,
      permission: 1,
    },
  ];

  await db
    .insert(accessRolePermissionsOnAccessZones)
    .values(rolePermissionsData);
  console.log(
    `  ✓ Inserted ${rolePermissionsData.length} role permissions on access zones`,
  );
}

/**
 * Seed organizations with profiles, funding links, and locations
 */
async function seedOrganizations(createdUsers: User[]) {
  console.log('🏢 Creating seed organizations...');

  const seedOrgs = [
    {
      name: 'One Project',
      slug: 'one-project',
      description:
        'One Project collaborates with people to build tools, systems and support for the futures ahead. We build deep relationships with communities who share a vision for a new economy.We work alongside them to co- create social and digital infrastructure, and also offer material support to nurture a growing ecosystem of collective action.',
      mission:
        'To nurture a just transition to a regenerative democratic economy.',
      city: 'San Francisco',
      bio: 'One Project bio',
      state: 'CA',
      isOfferingFunds: true,
      isReceivingFunds: true,
      receivingFundsLink: 'https://oneproject.org',
      offeringFundsLink: 'https://oneproject.org',
      receivingFundsDescription: 'description here',
      offeringFundsDescription: 'offering description here',
      email: 'info@oneproject.org',
      website: 'https://oneproject.org',
      type: OrgType.NONPROFIT,
    },
  ];

  const firstUser = createdUsers[0];

  if (!firstUser) {
    console.warn('⚠️  No users created, skipping organization creation');
    return;
  }

  for (const org of seedOrgs) {
    try {
      const broadDomains: string[] = [];
      const user = firstUser;
      const orgInputs = {
        ...org,
        profileId: null,
      };

      const data = orgInputs;

      // Parse domain from website
      let domain: string | undefined;
      if (data.website) {
        try {
          let val = data.website;
          if (
            val &&
            !val.startsWith('http://') &&
            !val.startsWith('https://')
          ) {
            val = `https://${val}`;
          }
          const fullDomain = new URL(val);
          domain = fullDomain.hostname.toLowerCase();
          if (
            domain &&
            broadDomains.some((broad) => domain?.match(new RegExp(broad)))
          ) {
            domain = undefined;
          }
        } catch (e) {
          console.error('Could not parse hostname', e);
        }
      }

      // Create profile
      const [profile] = await db
        .insert(profiles)
        .values({
          name: data.name! ?? 'New Organization',
          slug: randomUUID(),
          email: data.email,
          bio: data.bio,
          website: data.website,
          mission: data.mission,
        })
        .returning();

      if (!profile) {
        throw new Error('Failed to create profile');
      }

      // Create organization
      const [newOrg] = await db
        .insert(organizations)
        .values({
          ...orgInputs,
          profileId: profile.id,
          domain,
        })
        .returning();

      if (!newOrg) {
        throw new Error('Failed to create organization');
      }

      // Link user to organization with admin role
      const [[newOrgUser], adminRole] = await Promise.all([
        db
          .insert(organizationUsers)
          .values({
            organizationId: newOrg.id,
            authUserId: user.id,
            email: user.email!,
          })
          .returning(),
        db.query.accessRoles.findFirst({
          where: (table, { eq }) => eq(table.name, 'Admin'),
        }),
        db
          .update(users)
          .set({ lastOrgId: newOrg.id, currentProfileId: profile.id })
          .where(eq(users.authUserId, user.id)),
      ]);

      if (!(adminRole && newOrgUser)) {
        throw new Error('Failed to create organization');
      }

      await db.insert(organizationUserToAccessRoles).values({
        organizationUserId: newOrgUser.id,
        accessRoleId: adminRole.id,
      });

      // Add funding links
      await Promise.all([
        ...(data.receivingFundsLink
          ? [
              db.insert(links).values({
                organizationId: newOrg.id,
                href: data.receivingFundsLink,
                description: data.receivingFundsDescription,
                type: 'receiving',
              }),
            ]
          : []),
        ...(data.offeringFundsLink
          ? [
              db.insert(links).values({
                organizationId: newOrg.id,
                href: data.offeringFundsLink,
                description: data.offeringFundsDescription,
                type: 'offering',
              }),
            ]
          : []),
      ]);

      if (!newOrgUser) {
        throw new Error('Failed to associate organization with user');
      }

      console.log(`  ✓ Created organization: ${org.name}`);
    } catch (error) {
      console.error(`Error processing organization ${org.name}:`, error);
    }
  }
}

/**
 * Main seed function that orchestrates all seeding operations
 */
async function seed() {
  console.log('🌱 Starting database seeding...\n');

  // TODO: Seeding order for listUsers test case:
  // 1. Wipe database (includes auth.users cleanup)
  // 2. Seed auth.users table (via Supabase Admin API)
  // 3. Seed users table (references auth.users)
  // 4. DONE in seed.ts -- Seed access_zones table (standalone)
  // 5. DONE in seed.ts -- Seed access_roles table (standalone)
  // 6. DONE in seed.ts -- Seed access_role_permissions_on_access_zones table (references access_zones and access_roles)
  // 7. Seed profiles table (optional: references storage.objects for avatarImageId/headerImageId)
  // 8. Seed organizations table (references profiles)
  // 9. Seed organization_users table (references auth.users and organizations)
  // 10. Seed organizationUser_to_access_roles table (references organization_users and access_roles)

  await wipeDatabase();
  // const createdUsers = await seedAdminUsers();
  await seedAccessControl();
  // await seedOrganizations(createdUsers);

  console.log('\n✅ Database seeding completed successfully!');
}

// Execute seed function
await seed();
await db.$client.end();
