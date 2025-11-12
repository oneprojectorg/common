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
  locations,
  organizationUserToAccessRoles,
  organizationUsers,
  profiles,
  taxonomyTerms,
  users,
} from './schema/publicTables';
import {
  OrgType,
  organizations,
  organizationsWhereWeWork,
} from './schema/tables/organizations.sql';

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

console.log('🌱 Starting database seeding...\n');

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

console.log('🔐 Seeding access control data (zones, roles, permissions)...');

// Import schema tables needed for seeding
const {
  accessZones,
  accessRoles,
  accessRolePermissionsOnAccessZones,
  taxonomies: taxonomiesTable,
} = schema;

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

await db.insert(accessRolePermissionsOnAccessZones).values(rolePermissionsData);
console.log(
  `  ✓ Inserted ${rolePermissionsData.length} role permissions on access zones`,
);

// Seed taxonomies
const taxonomiesData = [
  {
    id: 'ad45a607-0d5d-4c9e-83c7-4ad9a44f3d81',
    name: 'NECFunding',
    description: 'NEC Simple Funding',
    namespaceUri: 'necFunding',
  },
  {
    id: 'cde31035-40b4-4e5b-963d-49b9e7ddd8d4',
    name: 'splcStrategies',
    description: null,
    namespaceUri: 'splcStrategies',
  },
  {
    id: 'd81c255a-7e12-436a-bb52-a52eb592b770',
    name: 'candid',
    description: 'Candid Taxonomy',
    namespaceUri: 'candid',
  },
  {
    id: 'f1bfbae2-3b2f-42b8-8b02-747ee1504399',
    name: 'NEC Simple',
    description: 'NEC Simple',
    namespaceUri: 'necSimple',
  },
];

await db.insert(taxonomiesTable).values(taxonomiesData);
console.log(`  ✓ Inserted ${taxonomiesData.length} taxonomies`);

console.log('📚 Importing taxonomy terms from CSV...');
// Import taxonomy terms from CSV
const seedDataPath = path.join(process.cwd(), 'seedData');
const taxonomyTermsCsvPath = path.join(seedDataPath, 'TaxonomyTerms.csv');
const taxonomyTermsCsvContent = fs.readFileSync(taxonomyTermsCsvPath, 'utf8');

// Parse CSV content
const lines = taxonomyTermsCsvContent.trim().split('\n');
const headers = lines?.[0]?.split(',') ?? [];

// Process each row (skip header)
const taxonomyTermsData = lines.slice(1).map((line) => {
  // Handle CSV parsing with potential commas in quoted fields
  const values: string[] = [];
  let currentValue = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(currentValue.trim());
      currentValue = '';
    } else {
      currentValue += char;
    }
  }
  values.push(currentValue.trim()); // Add the last value

  // Create object mapping headers to values
  const row: Record<string, string> = {};
  headers.forEach((header, index) => {
    row[header] = values[index] || '';
  });

  return {
    id: row.id,
    taxonomyId: row.taxonomy_id,
    termUri: row.term_uri,
    facet: row.facet || null,
    label: row.label,
    definition: row.definition || null,
    parentId: row.parent_id || null,
    data: row.data ? JSON.parse(row.data) : null,
  };
});

// Sort data so records without parent_id come first, then by parent_id
taxonomyTermsData.sort((a, b) => {
  // Records without parent_id come first
  if (!a.parentId && !b.parentId) return 0;
  if (!a.parentId) return -1;
  if (!b.parentId) return 1;

  // Both have parent_id, sort by parent_id
  return a.parentId.localeCompare(b.parentId);
});

console.log(
  `  Importing ${taxonomyTermsData.length} taxonomy terms in batches...`,
);

// Insert taxonomy terms in batches to handle large datasets
const batchSize = 100;
for (let i = 0; i < taxonomyTermsData.length; i += batchSize) {
  const batch = taxonomyTermsData.slice(i, i + batchSize);
  try {
    await db
      .insert(taxonomyTerms)
      .values(batch)
      .onConflictDoUpdate({
        target: [taxonomyTerms.taxonomyId, taxonomyTerms.termUri],
        set: {
          facet: sql`excluded.facet`,
          label: sql`excluded.label`,
          definition: sql`excluded.definition`,
          parentId: sql`excluded.parent_id`,
          data: sql`excluded.data`,
        },
      });
    console.log(
      `  ✓ Imported batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(taxonomyTermsData.length / batchSize)}`,
    );
  } catch (error) {
    console.error(
      `  ✗ Error importing taxonomy terms batch ${Math.floor(i / batchSize) + 1}:`,
      error,
    );
    throw error;
  }
}

console.log('✓ Taxonomy terms import completed\n');

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
    email: 'scott@oneproject.org',
    website: 'https://oneproject.org',
    type: OrgType.NONPROFIT,
    whereWeWork: [],
  },
];

// Setup mock organizations using @op/common createOrganization
const firstUser = createdUsers[0];

if (firstUser) {
  for (const org of seedOrgs) {
    try {
      // await createOrganization({
      // data: {
      // name: org.name,
      // slug: org.slug,
      // bio: org.description,
      // mission: org.mission,
      // city: org.city,
      // state: org.state,
      // isOfferingFunds: org.isOfferingFunds,
      // isReceivingFunds: org.isReceivingFunds,
      // email: org.email,
      // website: org.website,
      // type: org.type,
      // profileId: null,
      // },
      // user: firstUser,
      // });

      // Set these up so we can pull in logic directly from createOrganization

      const broadDomains: string[] = [];
      const user = firstUser;
      const orgInputs = {
        ...org,
        profileId: null,
      };

      const data = orgInputs;

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

      // Insert organizationUser linking the user to organization, with a default role of owner
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

      // Add admin role to the user creating the organization
      if (!(adminRole && newOrgUser)) {
        throw new Error('Failed to create organization');
      }

      await db.insert(organizationUserToAccessRoles).values({
        organizationUserId: newOrgUser.id,
        accessRoleId: adminRole.id,
      });

      try {
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

        // Add where we work locations using Google Places data
        if (data.whereWeWork?.length) {
          await Promise.all(
            data.whereWeWork.map(async (whereWeWork) => {
              // @ts-ignore
              const geoData = whereWeWork.data
                ? // @ts-ignore
                  geoNamesDataSchema.parse(whereWeWork.data)
                : null;

              // Create location record
              const [location] = await db
                .insert(locations)
                .values({
                  // @ts-ignore
                  name: whereWeWork.label,
                  placeId: geoData?.geonameId?.toString() ?? randomUUID(),
                  address: geoData?.toponymName,
                  location:
                    geoData?.lat && geoData?.lng
                      ? sql`ST_SetSRID(ST_MakePoint(${geoData.lng}, ${geoData.lat}), 4326)`
                      : undefined,
                  countryCode: geoData?.countryCode,
                  countryName: geoData?.countryName,
                  metadata: geoData,
                })
                .onConflictDoUpdate({
                  target: [locations.placeId],
                  set: {
                    name: sql`excluded.name`,
                    address: sql`excluded.address`,
                    // location: sql`excluded.location`,
                    countryCode: sql`excluded.country_code`,
                    countryName: sql`excluded.country_name`,
                    metadata: sql`excluded.metadata`,
                  },
                })
                .returning();

              if (location) {
                // Link location to organization
                await db
                  .insert(organizationsWhereWeWork)
                  .values({
                    organizationId: newOrg.id,
                    locationId: location.id,
                  })
                  .onConflictDoNothing();
              }
            }),
          );
        }

        // const {
        // focusAreas,
        // strategies,
        // communitiesServed,
        // receivingFundsTerms,
        // offeringFundsTerms,
        // } = data;

        // // add all stategy terms to the org (strategy terms already exist in the DB)
        // // TODO: parallelize this

        // if (strategies) {
        // await Promise.all(
        // strategies.map((strategy) =>
        // db
        // .insert(organizationsStrategies)
        // .values({
        // organizationId: newOrg.id,
        // taxonomyTermId: strategy.id,
        // })
        // .onConflictDoNothing(),
        // ),
        // );
        // }

        // // TODO: this was changed quickly in the process. We are transitioning to this way of doing terms.
        // if (
        // focusAreas ||
        // communitiesServed ||
        // receivingFundsTerms ||
        // offeringFundsTerms
        // ) {
        // const terms = [
        // ...(communitiesServed ?? []),
        // ...(receivingFundsTerms ?? []),
        // ...(offeringFundsTerms ?? []),
        // ...(focusAreas ?? []),
        // ];

        // await Promise.all(
        // terms.map((term) =>
        // db
        // .insert(organizationsTerms)
        // .values({
        // organizationId: newOrg.id,
        // taxonomyTermId: term.id,
        // })
        // .onConflictDoNothing(),
        // ),
        // );
        // }

        if (!newOrgUser) {
          throw new Error('Failed to associate organization with user');
        }

        console.log(`  ✓ Created organization: ${org.name}`);
      } catch (error) {
        console.error(`Error creating organization ${org.name}:`, error);
      }
    } catch (error) {
      console.error(`Error processing organization ${org.name}:`, error);
    }
  }
} else {
  console.warn('⚠️  No users created, skipping organization creation');
}

console.log('\n✅ Database seeding completed successfully!');

await db.$client.end();
