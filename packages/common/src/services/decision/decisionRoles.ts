import { type DbClient, db as defaultDb } from '@op/db/client';
import { accessRolePermissionsOnAccessZones, accessRoles } from '@op/db/schema';
import { permission, toBitField } from 'access-zones';
import { eq } from 'drizzle-orm';

import { CommonError, NotFoundError } from '../../utils';
import { invalidateProfileUserCacheForRole } from '../access/permissions';
import { assertProfileAdmin } from '../assert';
import {
  type DecisionRolePermissions,
  fromDecisionBitField,
  toDecisionBitField,
} from './permissions';

export type ZonePermission =
  | { type: 'decision'; value: DecisionRolePermissions }
  | {
      type: 'acrud';
      value: {
        admin: boolean;
        create: boolean;
        read: boolean;
        update: boolean;
        delete: boolean;
      };
    };

export type CustomRoleDefinition = {
  name: string;
  description?: string;
  permissions: Record<string, ZonePermission>;
};

function toBitfield(zonePermission: ZonePermission): number {
  if (zonePermission.type === 'decision') {
    return toDecisionBitField(zonePermission.value) | permission.READ;
  }
  return toBitField(zonePermission.value);
}

/**
 * Create a decision role with permissions on one or more zones.
 * Each zone entry specifies its type: 'decision' for decision-specific bits,
 * or 'acrud' for standard access-zones bits.
 */
export async function createDecisionRole({
  name,
  profileId,
  permissions,
  description,
  db = defaultDb,
}: {
  name: string;
  profileId: string;
  permissions: Record<string, ZonePermission>;
  description?: string;
  db?: DbClient;
}) {

  // Scoped roles on a decision process always get profile READ
  if (permissions['profile']) {
    const existing = permissions['profile'];
    if (existing.type === 'acrud') {
      permissions = {
        ...permissions,
        profile: { type: 'acrud', value: { ...existing.value, read: true } },
      };
    }
  } else {
    permissions = {
      ...permissions,
      profile: {
        type: 'acrud',
        value: {
          admin: false,
          create: false,
          read: true,
          update: false,
          delete: false,
        },
      },
    };
  }

  const zoneNames = Object.keys(permissions);
  const zones = await Promise.all(
    zoneNames.map((zoneName) =>
      db.query.accessZones.findFirst({ where: { name: zoneName } }),
    ),
  );

  const zoneMap = new Map(
    zoneNames.map((zoneName, i) => {
      const zone = zones[i];
      if (!zone) {
        throw new NotFoundError('Zone', zoneName);
      }
      return [zoneName, zone];
    }),
  );

  const [role] = await db
    .insert(accessRoles)
    .values({ name, description, profileId })
    .returning();

  if (!role) {
    throw new CommonError('Failed to create decision role');
  }

  await db.insert(accessRolePermissionsOnAccessZones).values(
    zoneNames.map((zoneName) => ({
      accessRoleId: role.id,
      accessZoneId: zoneMap.get(zoneName)!.id,
      permission: toBitfield(permissions[zoneName]!),
    })),
  );

  return { id: role.id, name: role.name, permissions };
}

/**
 * Creates the default Admin and Participant roles for a decision instance.
 * Returns [adminRole, participantRole] — admin first for easy destructuring.
 */
export async function createDefaultDecisionRoles({
  profileId,
  db = defaultDb,
}: {
  profileId: string;
  db?: DbClient;
}) {
  const [admin, participant] = await Promise.all([
    createDecisionRole({
      name: 'Admin',
      profileId,
      permissions: {
        profile: {
          type: 'acrud',
          value: {
            admin: true,
            create: true,
            read: true,
            update: true,
            delete: true,
          },
        },
        decisions: {
          type: 'decision',
          value: {
            create: true,
            read: true,
            update: true,
            delete: true,
            admin: true,
            inviteMembers: true,
            review: true,
            submitProposals: true,
            vote: true,
          },
        },
      },
      db,
    }),
    createDecisionRole({
      name: 'Participant',
      profileId,
      permissions: {
        profile: {
          type: 'acrud',
          value: {
            admin: false,
            create: false,
            read: true,
            update: false,
            delete: false,
          },
        },
        decisions: {
          type: 'decision',
          value: {
            create: false,
            read: true,
            update: false,
            delete: false,
            admin: false,
            inviteMembers: false,
            review: false,
            submitProposals: true,
            vote: true,
          },
        },
      },
      db,
    }),
  ]);

  return { admin, participant };
}

/**
 * Get the decision role permissions for a role on the decisions zone.
 */
export async function getDecisionRole({
  roleId,
}: {
  roleId: string;
}): Promise<DecisionRolePermissions> {
  const zone = await defaultDb.query.accessZones.findFirst({
    where: { name: 'decisions' },
  });

  if (!zone) {
    throw new NotFoundError('Zone', 'decisions');
  }

  const existing =
    await defaultDb.query.accessRolePermissionsOnAccessZones.findFirst({
      where: { accessRoleId: roleId, accessZoneId: zone.id },
    });

  return fromDecisionBitField(existing?.permission ?? 0);
}

/**
 * Update the decision role permissions for a role on the decisions zone.
 * Preserves CRUD bits (0–3); overwrites admin (bit 4) and decision bits (6–9).
 */
export async function updateDecisionRoles({
  roleId,
  decisionPermissions,
  user,
}: {
  roleId: string;
  decisionPermissions: DecisionRolePermissions;
  user: { id: string };
}) {
  const [zone, role] = await Promise.all([
    defaultDb.query.accessZones.findFirst({
      where: { name: 'decisions' },
    }),
    defaultDb.query.accessRoles.findFirst({
      where: { id: roleId },
    }),
  ]);

  if (!zone) {
    throw new NotFoundError('Zone', 'decisions');
  }

  if (!role) {
    throw new NotFoundError('Role', roleId);
  }

  if (!role.profileId) {
    throw new NotFoundError('Role', roleId);
  }

  await assertProfileAdmin(user, role.profileId);

  const existing =
    await defaultDb.query.accessRolePermissionsOnAccessZones.findFirst({
      where: { accessRoleId: roleId, accessZoneId: zone.id },
    });

  const bitfield = toDecisionBitField(decisionPermissions) | permission.READ;

  if (existing) {
    await defaultDb
      .update(accessRolePermissionsOnAccessZones)
      .set({ permission: bitfield })
      .where(eq(accessRolePermissionsOnAccessZones.id, existing.id));
  } else {
    await defaultDb.insert(accessRolePermissionsOnAccessZones).values({
      accessRoleId: roleId,
      accessZoneId: zone.id,
      permission: bitfield,
    });
  }

  await invalidateProfileUserCacheForRole(roleId);

  return { roleId, decisionPermissions };
}
