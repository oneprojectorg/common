/* eslint-disable antfu/no-top-level-await */
/**
 * Docker dev seed.
 *
 * The standard `seed.ts` has a database-URL allowlist that excludes the dind
 * hostname used inside our docker-compose stack, so it refuses to run there.
 * This script handles the minimum needed to make a fresh docker dev DB usable:
 *
 *   1. Access control zones, roles, and permissions.
 *   2. A default "One Project" organization + profile.
 *   3. onboardedAt backfill for admin users (prevents the /start redirect loop).
 *   4. Admin-user linkage to the default organization, with the Admin role.
 *
 * Idempotent: every step uses onConflictDoNothing or existence checks, so the
 * script is safe to re-run on every api container start.
 */
import { adminEmails } from '@op/core';
import { and, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '.';
import { accessRoles } from './schema/tables/access.sql';
import {
  accessRolePermissionsOnAccessZones,
  accessZones,
} from './schema/tables/accessZones.sql';
import { decisionProcesses } from './schema/tables/decisionProcesses.sql';
import {
  organizationUserToAccessRoles,
  organizationUsers,
} from './schema/tables/organizationUsers.sql';
import { organizations } from './schema/tables/organizations.sql';
import { profiles } from './schema/tables/profiles.sql';
import { users } from './schema/tables/users.sql';
import {
  ACCESS_ROLES,
  ACCESS_ROLE_PERMISSIONS,
  ACCESS_ZONES,
} from './seedData/accessControl';
import { decisionTemplates } from './seedData/decisionTemplates';

const DEFAULT_ORG = {
  name: 'One Project',
  slug: 'one-project',
  bio: 'One Project collaborates with people to build tools, systems, and support for the futures ahead.',
  mission: 'To nurture a just transition to a regenerative democratic economy.',
  email: 'hello@oneproject.org',
  website: 'https://oneproject.org',
};

console.log('Seeding access control data...');

await db.insert(accessZones).values(ACCESS_ZONES).onConflictDoNothing();
console.log(`Inserted ${ACCESS_ZONES.length} access zones`);

await db.insert(accessRoles).values(ACCESS_ROLES).onConflictDoNothing();
console.log(`Inserted ${ACCESS_ROLES.length} access roles`);

await db
  .insert(accessRolePermissionsOnAccessZones)
  .values(ACCESS_ROLE_PERMISSIONS)
  .onConflictDoNothing();
console.log(`Inserted ${ACCESS_ROLE_PERMISSIONS.length} role permissions`);

// ---------------------------------------------------------------------------
// Default organization: One Project
// ---------------------------------------------------------------------------
console.log('Ensuring default organization exists...');

let orgProfile = await db._query.profiles.findFirst({
  where: (t, { eq }) => eq(t.slug, DEFAULT_ORG.slug),
});

if (!orgProfile) {
  [orgProfile] = await db
    .insert(profiles)
    .values({
      name: DEFAULT_ORG.name,
      slug: DEFAULT_ORG.slug,
      bio: DEFAULT_ORG.bio,
      mission: DEFAULT_ORG.mission,
      email: DEFAULT_ORG.email,
      website: DEFAULT_ORG.website,
    })
    .returning();

  if (!orgProfile) {
    throw new Error('Failed to create One Project profile');
  }
  console.log(`  Created profile: ${DEFAULT_ORG.name} (${orgProfile.id})`);
}

let defaultOrg = await db._query.organizations.findFirst({
  where: (t, { eq }) => eq(t.profileId, orgProfile!.id),
});

if (!defaultOrg) {
  [defaultOrg] = await db
    .insert(organizations)
    .values({
      profileId: orgProfile.id,
      domain: 'oneproject.org',
      isVerified: true,
    })
    .returning();

  if (!defaultOrg) {
    throw new Error('Failed to create One Project organization');
  }
  console.log(`  Created organization: ${DEFAULT_ORG.name} (${defaultOrg.id})`);
}

// ---------------------------------------------------------------------------
// Decision process templates — the Create menu's decision action picks the
// first available template, so without at least one seeded the action errors
// out and the ProcessBuilder never opens.
// ---------------------------------------------------------------------------
for (const template of Object.values(decisionTemplates)) {
  const existing = await db._query.decisionProcesses.findFirst({
    where: (t, { eq }) => eq(t.name, template.name),
  });

  if (!existing) {
    await db.insert(decisionProcesses).values({
      name: template.name,
      description: template.description,
      processSchema: template,
      createdByProfileId: orgProfile.id,
    });
    console.log(`Created decision template: ${template.name}`);
  }
}

// ---------------------------------------------------------------------------
// Admin users: backfill onboardedAt + link to default org as Admin
// ---------------------------------------------------------------------------
if (adminEmails.length === 0) {
  await db.$client.end();
  console.log('Done!');
  process.exit(0);
}

const backfilled = await db
  .update(users)
  .set({ onboardedAt: new Date().toISOString() })
  .where(and(inArray(users.email, [...adminEmails]), isNull(users.onboardedAt)))
  .returning({ email: users.email });

if (backfilled.length > 0) {
  console.log(
    `Backfilled onboardedAt for ${backfilled.length} admin user(s): ${backfilled
      .map((u) => u.email)
      .join(', ')}`,
  );
}

const adminRole = await db._query.accessRoles.findFirst({
  where: (t, { eq, and, isNull }) =>
    and(eq(t.name, 'Admin'), isNull(t.profileId)),
});

if (!adminRole) {
  throw new Error(
    'Admin role not found — access-control seed above should have created it',
  );
}

const existingAdmins = await db._query.users.findMany({
  where: (t, { inArray }) => inArray(t.email, [...adminEmails]),
  columns: { authUserId: true, email: true },
});

let linkedCount = 0;
for (const admin of existingAdmins) {
  // Is this admin already an org user for the default org?
  const existingOrgUser = await db._query.organizationUsers.findFirst({
    where: (t, { and, eq }) =>
      and(
        eq(t.authUserId, admin.authUserId),
        eq(t.organizationId, defaultOrg!.id),
      ),
  });

  let orgUserId = existingOrgUser?.id;

  if (!orgUserId) {
    const [created] = await db
      .insert(organizationUsers)
      .values({
        authUserId: admin.authUserId,
        email: admin.email,
        organizationId: defaultOrg.id,
      })
      .returning();

    if (!created) continue;
    orgUserId = created.id;
    linkedCount++;
  }

  await db
    .insert(organizationUserToAccessRoles)
    .values({ organizationUserId: orgUserId, accessRoleId: adminRole.id })
    .onConflictDoNothing();

  // Point the user's last/current org at the default org so the UI lands there.
  await db
    .update(users)
    .set({ lastOrgId: defaultOrg.id, currentProfileId: orgProfile.id })
    .where(eq(users.authUserId, admin.authUserId));
}

if (linkedCount > 0) {
  console.log(
    `Linked ${linkedCount} admin user(s) to ${DEFAULT_ORG.name} with Admin role`,
  );
}

await db.$client.end();
console.log('Done!');
