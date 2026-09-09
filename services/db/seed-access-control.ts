/* eslint-disable antfu/no-top-level-await */
/**
 * Access-control seed.
 *
 * The standard `seed.ts` has a database-URL allowlist that excludes the dind
 * hostname used inside our docker-compose stack, so it refuses to run there.
 * This script handles the minimum needed to make a fresh docker dev DB usable:
 *
 *   1. Access control zones, roles, and permissions.
 *   2. A default "One Project" organization + profile.
 *   3. onboardedAt backfill for admin users (prevents the /start redirect loop).
 *   4. The Platform Admin role, granted to admin users at the user level.
 *   5. Admin-user linkage to the default organization, with the Admin role.
 *
 * `docker-compose.dev.yml` runs it on every api container start, and it is also
 * how step 1's rows — including the `platform` zone and the `Platform Admin`
 * role of ADR 0005 — reach staging and production: an operator runs it there.
 * Nothing runs it automatically outside docker dev.
 *
 * Idempotent: every step uses onConflictDoNothing or existence checks, so the
 * script is safe to re-run.
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
import {
  profileUserToAccessRoles,
  profileUsers,
} from './schema/tables/profileUsers.sql';
import { profiles } from './schema/tables/profiles.sql';
import { users } from './schema/tables/users.sql';
import { seedGlobalUsers } from './seed-global-users';
import {
  ACCESS_ROLES,
  ACCESS_ROLE_PERMISSIONS,
  ACCESS_ZONES,
  ROLES,
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

// A seeded id that already belongs to a different zone or role takes the two
// inserts above as a conflict and skips them — and then the permission rows
// below attach to whatever does hold that id. This script is the only writer
// of global roles, so the ids of a database it has never run against cannot be
// assumed. Abort instead of mis-granting.
const assertSeededNames = (
  label: string,
  expected: Array<{ id: string; name: string }>,
  stored: Array<{ id: string; name: string }>,
) => {
  const storedNameById = new Map(stored.map((row) => [row.id, row.name]));

  for (const { id, name } of expected) {
    const storedName = storedNameById.get(id);

    if (storedName !== undefined && storedName !== name) {
      throw new Error(
        `Seed collision: ${label} id ${id} holds "${storedName}", not "${name}". Refusing to seed.`,
      );
    }
  }
};

const [storedZones, storedRoles] = await Promise.all([
  db
    .select({ id: accessZones.id, name: accessZones.name })
    .from(accessZones)
    .where(
      inArray(
        accessZones.id,
        ACCESS_ZONES.map((zone) => zone.id),
      ),
    ),
  db
    .select({ id: accessRoles.id, name: accessRoles.name })
    .from(accessRoles)
    .where(
      inArray(
        accessRoles.id,
        ACCESS_ROLES.map((role) => role.id),
      ),
    ),
]);

assertSeededNames('access_zones', ACCESS_ZONES, storedZones);
assertSeededNames('access_roles', ACCESS_ROLES, storedRoles);

// The rows carry no id of their own, so a re-run would insert duplicates were
// it not for `arpoaz_role_zone_profile_unique` on (role, zone, profile) —
// declared `nullsNotDistinct`, so the NULL `profile_id` of a global baseline
// row conflicts too. An untargeted DO NOTHING covers it.
await db
  .insert(accessRolePermissionsOnAccessZones)
  .values(ACCESS_ROLE_PERMISSIONS)
  .onConflictDoNothing();
console.log(`Inserted ${ACCESS_ROLE_PERMISSIONS.length} role permissions`);

// ---------------------------------------------------------------------------
// Global sentinel user (PUBLIC) for the access-control substitution layer.
// Must exist in every environment.
// ---------------------------------------------------------------------------
await seedGlobalUsers();

// ---------------------------------------------------------------------------
// Default organization: One Project
// ---------------------------------------------------------------------------
console.log('Ensuring default organization exists...');

let orgProfile = await db.query.profiles.findFirst({
  where: { slug: DEFAULT_ORG.slug },
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

let defaultOrg = await db.query.organizations.findFirst({
  where: { profileId: orgProfile!.id },
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
  const existing = await db.query.decisionProcesses.findFirst({
    where: { name: template.name },
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
// Admin users: backfill onboardedAt + Platform Admin, link to default org as Admin
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

const existingAdmins = await db.query.users.findMany({
  where: { email: { in: [...adminEmails] } },
  columns: { authUserId: true, email: true },
});

// A user-level grant is a role row on the holder's own individual-profile
// membership, which the signup trigger creates. Same row shape as
// grantPlatformAdmin in @op/common, written here because services/db cannot
// import it — including resolving the role by name, the runtime identifier for
// a global role. Without this a fresh local DB 404s on /admin for every dev.
// On staging and production an operator grants the role the same way.
const platformAdminRole = await db.query.accessRoles.findFirst({
  where: { name: ROLES.PLATFORM_ADMIN.name, profileId: { isNull: true } },
});

if (!platformAdminRole) {
  throw new Error(
    `Could not find the global "${ROLES.PLATFORM_ADMIN.name}" role after seeding access roles`,
  );
}

const adminMemberships = await db
  .select({ profileUserId: profileUsers.id })
  .from(users)
  .innerJoin(
    profileUsers,
    and(
      eq(profileUsers.profileId, users.profileId),
      eq(profileUsers.authUserId, users.authUserId),
    ),
  )
  .where(inArray(users.email, [...adminEmails]));

if (adminMemberships.length > 0) {
  await db
    .insert(profileUserToAccessRoles)
    .values(
      adminMemberships.map(({ profileUserId }) => ({
        profileUserId,
        accessRoleId: platformAdminRole.id,
      })),
    )
    .onConflictDoNothing();

  // Count only: the emails are personal data and this runs in CI logs.
  console.log(`Granted Platform Admin to ${adminMemberships.length} user(s)`);
}

const adminRole = await db.query.accessRoles.findFirst({
  where: { name: 'Admin', profileId: { isNull: true } },
});

if (!adminRole) {
  throw new Error(
    'Admin role not found — access-control seed above should have created it',
  );
}

let linkedCount = 0;
for (const admin of existingAdmins) {
  // Is this admin already an org user for the default org?
  const existingOrgUser = await db.query.organizationUsers.findFirst({
    where: {
      authUserId: admin.authUserId,
      organizationId: defaultOrg!.id,
    },
  });

  let orgUserId = existingOrgUser?.id;

  if (!orgUserId) {
    if (!admin.email) {
      throw new Error(
        `Admin user ${admin.authUserId} has no email — cannot link to organization`,
      );
    }
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
